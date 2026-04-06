import { runNaverScrape } from './naverScraper.js';
import { runNaverScheduleScrape } from './naverScheduleScraper.js';
import { runKofaScrape } from './kofaScraper.js';
import { runEmucineScrape } from './emucineScraper.js';
import { sendUpdateNotification } from './notifier.js';

/**
 * 전체 수집 파이프라인 (1~6단계)
 * server.js 엔드포인트와 run-scrape.js CLI 양쪽에서 공유
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function runPipeline(supabase) {
  const start = Date.now();

  // 1. Naver 영화 수집
  const { addedTitles, addedNaverMovieIds } = await runNaverScrape(supabase);

  // 2. 전체 영화 조회 (신규 추가된 영화 포함)
  const { data: movies, error: fetchErr } = await supabase
    .from('movies')
    .select('*')
    .neq('sourceId', '');
  if (fetchErr) throw new Error(fetchErr.message);

  // 3. Naver 스케줄 수집
  const { updatedMovies } = await runNaverScheduleScrape(supabase, movies);

  // 4. KOFA 수집
  const kofaResult = await runKofaScrape(supabase);

  // 5. 에무시네마 수집
  const emucineResult = await runEmucineScrape(supabase);

  // 6. 텔레그램 알림
  await sendUpdateNotification(supabase, {
    addedTitles,
    addedNaverMovieIds,
    updatedMovies,
    kofaResult,
    emucineResult,
  });

  const elapsed = Date.now() - start;
  const tm = Math.floor(elapsed / 60000);
  const ts = Math.floor((elapsed % 60000) / 1000);
  console.log(`[전체 수집] 완료 소요 ${tm}분 ${ts}초\n`);
}
