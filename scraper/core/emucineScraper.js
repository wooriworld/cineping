import * as cheerio from 'cheerio';
import { scrapeEmucineSchedules } from '../parsers/emucineParser.js';

const EMU_BOOKING_URL =
  'https://www.dtryx.com/reserve/movie.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&CinemaCd=000069';

const NAVER_SEARCH_HEADERS = {
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  Referer: 'https://www.naver.com/',
};

async function fetchNaverMovieInfo(title) {
  const params = new URLSearchParams({ where: 'nexearch', pkid: '68', query: title });
  try {
    const res = await fetch(`https://search.naver.com/search.naver?${params}`, { headers: NAVER_SEARCH_HEADERS });
    if (!res.ok) return { englishTitle: '', poster: '' };
    const html = await res.text();
    const $ = cheerio.load(html);
    const txts = $('.sub_title .txt');
    const candidate = txts.length >= 2 ? $(txts[1]).text().trim() : '';
    const englishTitle = /[a-zA-Z]/.test(candidate) ? candidate : '';
    const poster = $('a.thumb._item img._img').first().attr('src') ?? '';
    return { englishTitle, poster };
  } catch {
    return { englishTitle: '', poster: '' };
  }
}
const CHUNK = 100;

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function findMovieFuzzy(title, movieList) {
  const exact = movieList.find((m) => m.title === title);
  if (exact) return { movie: exact, matched: title };

  let best = null;
  let bestDist = Infinity;
  for (const m of movieList) {
    const dist = levenshtein(title, m.title);
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  if (best) console.log(`  [퍼지매칭] "${title}" → "${best.title}" (거리: ${bestDist})`);
  return best ? { movie: best, matched: best.title } : null;
}

/**
 * 에무시네마 Eng 자막 영화와 상영 스케줄을 수집해 Supabase에 저장한다.
 *
 * 흐름:
 * 1. 이미지에서 Eng 자막 스케줄 수집 (오늘 이후만)
 * 2. 영화 제목으로 DB 검색 + 오늘~7일치 스케줄 조회
 * 3. 수집한 시작시간이 DB에 이미 있으면 스킵, 없으면 저장
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function runEmucineScrape(supabase) {
  const start = Date.now();
  console.log('\n[에무시네마 수집 시작]');

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10);
  const in7days = new Date(nowKst.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toHHMM = (t) => (t ?? '').slice(0, 5);

  // ── 1. 이미지 파싱 (오늘 이후 Eng 자막만) ────────────────────────
  const imageResults = await scrapeEmucineSchedules();
  const errors = imageResults.filter((r) => r.error).map((r) => r.error);

  const engSchedules = imageResults
    .flatMap((r) => r.schedules)
    .filter((s) => (s.subtitle ?? '').includes('Eng') && s.date >= todayStr);

  console.log(`[에무시네마] Eng 자막 스케줄 ${engSchedules.length}건`);

  if (engSchedules.length === 0) {
    return { added: 0, updated: 0, skipped: 0, schedulesAdded: 0, addedTitles: [], errors };
  }

  // ── 2. 영화 제목으로 DB 검색 + 7일치 스케줄 조회 ─────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from('movies')
    .select('id, title, hasEnglishSubtitle');
  if (fetchErr) throw new Error(fetchErr.message);

  const existingList = existing ?? [];
  const uniqueTitles = [...new Set(engSchedules.map((s) => s.title))];

  let added = 0, updated = 0, skipped = 0;
  const addedTitles = [];
  const titleMap = new Map(); // ocrTitle → dbTitle
  const movieIdMap = new Map(); // dbTitle → movieId

  // 영화 저장/업데이트
  for (const title of uniqueTitles) {
    const found = findMovieFuzzy(title, existingList);

    if (found) {
      const { movie: ex, matched } = found;
      titleMap.set(title, matched);
      movieIdMap.set(matched, ex.id);

      if (ex.hasEnglishSubtitle) {
        console.log(`  = 스킵: "${matched}" (이미 hasEnglishSubtitle)`);
        skipped++;
      } else {
        const { error: updErr } = await supabase
          .from('movies')
          .update({ hasEnglishSubtitle: true })
          .eq('id', ex.id);
        if (updErr) throw new Error(updErr.message);
        console.log(`  ~ 업데이트: "${matched}" → hasEnglishSubtitle = true`);
        updated++;
      }
    } else {
      titleMap.set(title, title);
      const dates = engSchedules.filter((s) => s.title === title).map((s) => s.date).sort();
      const releaseDate = dates[0] ?? todayStr;

      const { englishTitle, poster } = await fetchNaverMovieInfo(title);
      if (englishTitle) console.log(`  + 네이버 영어제목: "${englishTitle}"`);
      await new Promise((r) => setTimeout(r, 500));

      const { data: inserted, error: insErr } = await supabase
        .from('movies')
        .insert({ title, englishTitle, poster, hasEnglishSubtitle: true, source: 'EMUCINE', releaseDate, createdAt: nowKst.toISOString() })
        .select('id')
        .single();
      if (insErr) throw new Error(insErr.message);
      movieIdMap.set(title, inserted.id);
      console.log(`  + 신규 저장: "${title}"${englishTitle ? ` (${englishTitle})` : ''}`);
      addedTitles.push(title);
      added++;
    }
  }

  // ── 3. 스케줄 비교 후 저장 ────────────────────────────────────────
  console.log('\n[에무시네마 스케줄 저장 시작]');

  let schedulesAdded = 0;
  const lastUpdatedAt = nowKst.toISOString();

  for (const title of uniqueTitles) {
    const dbTitle = titleMap.get(title) ?? title;
    const movieId = movieIdMap.get(dbTitle);
    if (!movieId) continue;

    // 해당 영화의 오늘~7일 스케줄 조회 (체인 무관)
    const { data: dbSchedules, error: schErr } = await supabase
      .from('schedules')
      .select('date, startTime')
      .eq('movieId', movieId)
      .gte('date', todayStr)
      .lte('date', in7days);
    if (schErr) throw new Error(schErr.message);

    const dbKeySet = new Set((dbSchedules ?? []).map((s) => `${s.date}_${toHHMM(s.startTime)}`));

    // 이 영화의 수집 스케줄 중 DB에 없는 것만 추가
    const toAdd = engSchedules
      .filter((s) => (titleMap.get(s.title) ?? s.title) === dbTitle)
      .filter((s) => !dbKeySet.has(`${s.date}_${toHHMM(s.time)}`))
      .map((s) => ({
        movieId,
        chain: 'EMUCINE',
        theater: '에무시네마',
        date: s.date,
        startTime: s.time,
        endTime: '',
        screenType: '',
        bookingUrl: EMU_BOOKING_URL,
        lastUpdatedAt,
      }));

    if (toAdd.length === 0) {
      console.log(`  = 스킵: "${dbTitle}" (스케줄 중복 없음)`);
      continue;
    }

    for (let i = 0; i < toAdd.length; i += CHUNK) {
      const { error: insErr } = await supabase.from('schedules').insert(toAdd.slice(i, i + CHUNK));
      if (insErr) throw new Error(insErr.message);
    }
    schedulesAdded += toAdd.length;
    console.log(`  ✓ "${dbTitle}" — 스케줄 ${toAdd.length}개 추가`);
  }

  const elapsed = Date.now() - start;
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  console.log(
    `[에무시네마 수집 완료] 영화 추가: ${added}개 / 업데이트: ${updated}개 / 스킵: ${skipped}개 | 스케줄 추가: ${schedulesAdded}개 (소요: ${m}분 ${s}초)\n`,
  );

  return { added, updated, skipped, schedulesAdded, addedTitles, errors };
}
