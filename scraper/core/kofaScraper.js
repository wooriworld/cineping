import { scrapeKofaMovies, scrapeKofaSchedules } from '../parsers/kofaMovieParser.js';

const LOG = '[KOFA 수집]';
const KOFA_BOOKING_URL = 'https://www.koreafilm.or.kr/cinematheque/schedule?keySort=EC';
const CHUNK = 100;

/**
 * KOFA 영어자막 영화와 상영 스케줄을 함께 수집해 Supabase에 저장한다.
 * - movies: 기존 영화 확인 / 신규 영화 insert
 * - schedules: KOFA chain diff 방식 (추가/삭제)
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {{ added: number, updated: number, skipped: number, total: number, schedulesAdded: number, schedulesDeleted: number, schedulesTotal: number, errors: string[] }}
 */
export async function runKofaScrape(supabase) {
  const start = Date.now();
  console.log(`\n${LOG} 시작`);

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10);
  const in7days = new Date(nowKst.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── 1. 영화 + 스케줄 파싱 (병렬) ────────────────────────────────
  const [movies, scraped] = await Promise.all([scrapeKofaMovies(), scrapeKofaSchedules()]);
  console.log(`${LOG} 파싱 영화 ${movies.length}개 | 스케줄 ${scraped.length}개`);

  // 이번 주(오늘~7일) 스케줄이 있는 영화 타이틀 셋
  const weekScheduleTitles = new Set(
    scraped.filter((s) => s.date >= todayStr && s.date <= in7days).map((s) => s.movieTitle),
  );

  // ── 2. 영화 DB 저장 ──────────────────────────────────────────────
  let added = 0;
  let skipped = 0;
  const addedTitles = [];
  const addedNaverMovieIds = [];

  if (movies.length > 0) {
    const { data: existing, error: fetchErr } = await supabase.from('movies').select('id, title');
    if (fetchErr) throw new Error(fetchErr.message);

    const existingTitles = new Set((existing ?? []).map((m) => m.title));
    const toInsert = movies.filter(
      (m) => !existingTitles.has(m.title) && weekScheduleTitles.has(m.title),
    );

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('movies').insert(
        toInsert.map((movie) => ({
          title: movie.title,
          englishTitle: movie.englishTitle,
          sourceId: movie.kofaId,
          poster: movie.poster,
          releaseDate: todayStr,
          source: 'KOFA',
          createdAt: nowKst.toISOString(),
        })),
      );
      if (insErr) throw new Error(insErr.message);
    }

    added = toInsert.length;
    skipped = movies.length - toInsert.length;
    addedTitles.push(...toInsert.map((m) => m.title));
    addedNaverMovieIds.push(...toInsert.map((m) => m.kofaId));
  }

  // ── 3. 스케줄 저장 ───────────────────────────────────────────────
  let schedulesAdded = 0;
  let schedulesDeleted = 0;
  const errors = [];
  const updatedMovies = [];

  if (scraped.length > 0) {
    const { data: dbMovies, error: dbErr } = await supabase
      .from('movies')
      .select('id, title, sourceId, createdAt');
    if (dbErr) throw new Error(dbErr.message);

    const movieByTitle = new Map((dbMovies ?? []).map((m) => [m.title, m]));
    const movieById = new Map((dbMovies ?? []).map((m) => [m.id, m]));

    const lastUpdatedAt = nowKst.toISOString();

    const schedulesByMovieId = new Map();
    for (const s of scraped) {
      if (s.date < todayStr || s.date > in7days) continue; // 오늘~7일 범위 외 스킵
      const movieRow = movieByTitle.get(s.movieTitle);
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
      const movieTitle = movieById.get(movieId)?.title ?? movieId;
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

        const toKeepIds = (existing ?? [])
          .filter((s) => newKeySet.has(`${s.date}_${s.startTime}`))
          .map((s) => s.id);

        const toAdd = newSchedules
          .filter((s) => !existingMap.has(`${s.date}_${s.startTime}`))
          .map((s) => ({ ...s, hasEnglishSubtitle: true }));

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

        for (let i = 0; i < toKeepIds.length; i += CHUNK) {
          const { error: updErr } = await supabase
            .from('schedules')
            .update({ hasEnglishSubtitle: true })
            .in('id', toKeepIds.slice(i, i + CHUNK));
          if (updErr) throw new Error(updErr.message);
        }

        schedulesAdded += toAdd.length;
        schedulesDeleted += toDeleteIds.length;
        // 오늘 이전에 등록된 기존 영화에 스케줄이 추가된 경우 업데이트 목록에 추가
        if (toAdd.length > 0) {
          const movieRow = movieById.get(movieId);
          if (movieRow && (movieRow.createdAt ?? '').slice(0, 10) < todayStr) {
            updatedMovies.push(movieRow);
          }
        }
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
    `${LOG} 영화 추가 ${added}개 / 스킵 ${skipped}개 | 스케줄 추가 ${schedulesAdded}개 / 삭제 ${schedulesDeleted}개`,
  );
  console.log(`${LOG} 소요 ${m}분 ${s}초`);
  return {
    added,
    skipped,
    total: movies.length,
    addedTitles,
    addedNaverMovieIds,
    updatedMovies,
    schedulesAdded,
    schedulesDeleted,
    schedulesTotal: scraped.length,
    errors,
  };
}
