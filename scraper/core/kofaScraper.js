import { scrapeKofaMovies, scrapeKofaSchedules } from '../parsers/kofaMovieParser.js';

const KOFA_BOOKING_URL = 'https://www.koreafilm.or.kr/cinematheque/schedule?keySort=EC';
const CHUNK = 100;

/**
 * KOFA 영어자막 영화와 상영 스케줄을 함께 수집해 Supabase에 저장한다.
 * - movies: 기존 영화 hasEnglishSubtitle 업데이트 / 신규 영화 insert
 * - schedules: KOFA chain diff 방식 (추가/삭제)
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {{ added: number, updated: number, skipped: number, total: number, schedulesAdded: number, schedulesDeleted: number, schedulesTotal: number, errors: string[] }}
 */
export async function runKofaScrape(supabase) {
  const start = Date.now();
  console.log('\n[KOFA 수집 시작]');

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10);

  // ── 1. 영화 + 스케줄 파싱 (병렬) ────────────────────────────────
  const [movies, scraped] = await Promise.all([scrapeKofaMovies(), scrapeKofaSchedules()]);
  console.log(`[KOFA] ${movies.length}개 영어자막 영화 파싱 완료`);
  console.log(`[KOFA] ${scraped.length}개 스케줄 파싱 완료`);

  // 오늘 스케줄이 있는 영화 타이틀 셋
  const todayScheduleTitles = new Set(
    scraped.filter((s) => s.date === todayStr).map((s) => s.movieTitle),
  );
  console.log(`[KOFA] 오늘(${todayStr}) 스케줄 보유 영화: ${todayScheduleTitles.size}개`);

  // ── 2. 영화 DB 저장 ──────────────────────────────────────────────
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const addedTitles = [];
  const addedNaverMovieIds = [];

  if (movies.length > 0) {
    const { data: existing, error: fetchErr } = await supabase
      .from('movies')
      .select('id, title, hasEnglishSubtitle');
    if (fetchErr) throw new Error(fetchErr.message);

    const existingMap = new Map((existing ?? []).map((m) => [m.title, m]));

    for (const movie of movies) {
      const ex = existingMap.get(movie.title);

      if (ex) {
        if (ex.hasEnglishSubtitle) {
          skipped++;
          continue;
        }
        const { error: updErr } = await supabase
          .from('movies')
          .update({ hasEnglishSubtitle: true })
          .eq('id', ex.id);
        if (updErr) throw new Error(updErr.message);
        console.log(`  ~ 업데이트: "${movie.title}" → hasEnglishSubtitle = true`);
        updated++;
      } else {
        // 오늘 스케줄 없는 신규 영화는 등록하지 않음
        if (!todayScheduleTitles.has(movie.title)) {
          console.log(`  - 스킵(오늘 스케줄 없음): "${movie.title}"`);
          skipped++;
          continue;
        }
        const { error: insErr } = await supabase.from('movies').insert({
          title: movie.title,
          englishTitle: movie.englishTitle,
          sourceId: movie.kofaId,
          poster: movie.poster,
          releaseDate: todayStr,
          hasEnglishSubtitle: true,
          source: 'KOFA',
          createdAt: nowKst.toISOString(),
        });
        if (insErr) throw new Error(insErr.message);
        console.log(`  + 저장: "${movie.title}" (${movie.englishTitle})`);
        addedTitles.push(movie.title);
        addedNaverMovieIds.push(movie.kofaId);
        added++;
      }
    }
  }

  // ── 3. 스케줄 저장 ───────────────────────────────────────────────
  console.log('\n[KOFA 스케줄 저장 시작]');

  let schedulesAdded = 0;
  let schedulesDeleted = 0;
  const errors = [];
  const updatedMovies = [];

  if (scraped.length > 0) {
    const { data: dbMovies, error: dbErr } = await supabase
      .from('movies')
      .select('id, title, sourceId, createdAt');
    if (dbErr) throw new Error(dbErr.message);

    const movieMap = new Map((dbMovies ?? []).map((m) => [m.title, m]));
    const movieNameMap = new Map((dbMovies ?? []).map((m) => [m.id, m.title]));

    const lastUpdatedAt = nowKst.toISOString();

    const schedulesByMovieId = new Map();
    for (const s of scraped) {
      if (s.date > todayStr) continue; // 오늘 이후(미래) 날짜 스킵
      const movieRow = movieMap.get(s.movieTitle);
      if (!movieRow) continue;
      const movieId = movieRow.id;
      if (!schedulesByMovieId.has(movieId)) schedulesByMovieId.set(movieId, []);
      schedulesByMovieId.get(movieId).push({
        movieId,
        chain: 'KOFA',
        theater: 'KOFA 시네마테크',
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        screenType: s.screen,
        bookingUrl: KOFA_BOOKING_URL,
        lastUpdatedAt,
      });
    }

    for (const [movieId, newSchedules] of schedulesByMovieId) {
      const movieTitle = movieNameMap.get(movieId) ?? movieId;
      try {
        const { data: existing, error: exErr } = await supabase
          .from('schedules')
          .select('id, date, startTime')
          .eq('movieId', movieId)
          .eq('chain', 'KOFA')
          .limit(10000);
        if (exErr) throw new Error(exErr.message);

        const newKeySet = new Set(newSchedules.map((s) => `${s.date}_${s.startTime}`));
        const existingMap = new Map((existing ?? []).map((s) => [`${s.date}_${s.startTime}`, s]));

        const toDeleteIds = (existing ?? [])
          .filter((s) => !newKeySet.has(`${s.date}_${s.startTime}`))
          .map((s) => s.id);

        const toAdd = newSchedules.filter((s) => !existingMap.has(`${s.date}_${s.startTime}`));

        for (let i = 0; i < toDeleteIds.length; i += CHUNK) {
          const { error: delErr } = await supabase
            .from('schedules')
            .delete()
            .in('id', toDeleteIds.slice(i, i + CHUNK));
          if (delErr) throw new Error(delErr.message);
        }

        for (let i = 0; i < toAdd.length; i += CHUNK) {
          const { error: insErr } = await supabase
            .from('schedules')
            .insert(toAdd.slice(i, i + CHUNK));
          if (insErr) throw new Error(insErr.message);
        }

        schedulesAdded += toAdd.length;
        schedulesDeleted += toDeleteIds.length;
        // 오늘 이전에 등록된 기존 영화에 스케줄이 추가된 경우 업데이트 목록에 추가
        if (toAdd.length > 0) {
          const movieRow = [...movieMap.values()].find((m) => m.id === movieId);
          if (movieRow && (movieRow.createdAt ?? '').slice(0, 10) < todayStr) {
            updatedMovies.push(movieRow);
          }
        }
        console.log(`  ✓ "${movieTitle}" — 추가 ${toAdd.length}개 / 삭제 ${toDeleteIds.length}개`);
      } catch (err) {
        const msg = `${movieTitle}: ${err.message}`;
        console.error(`  [KOFA 스케줄 오류] ${msg}`);
        errors.push(msg);
      }
    }
  }

  const elapsed = Date.now() - start;
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  console.log(
    `[KOFA 수집 완료] 영화 추가: ${added}개 / 업데이트: ${updated}개 / 스킵: ${skipped}개 | 스케줄 추가: ${schedulesAdded}개 / 삭제: ${schedulesDeleted}개 (소요: ${m}분 ${s}초)\n`,
  );

  return { added, updated, skipped, total: movies.length, addedTitles, addedNaverMovieIds, updatedMovies, schedulesAdded, schedulesDeleted, schedulesTotal: scraped.length, errors };
}
