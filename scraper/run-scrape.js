import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { runNaverScrape } from './core/movieScraper.js';
import { runNaverScheduleScrape } from './core/scheduleScraper.js';
import { runKofaScrape } from './core/kofaScraper.js';
import { runEmucineScrape } from './core/emucineScraper.js';
import { sendTelegramMessage } from './core/telegram.js';
import { sendUpdateNotification } from './core/notifier.js';

// ── 환경변수 검증 ──────────────────────────────────────────────────
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[오류] 환경변수 ${key} 가 설정되지 않았습니다.`);
    process.exit(1);
  }
}

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── 메인 실행 ──────────────────────────────────────────────────────
async function main() {
  const allStart = Date.now();
  console.log('[전체 수집] 시작');

  try {
    // 1. Naver 영화 수집
    const { addedTitles, addedNaverMovieIds } = await runNaverScrape(supabase);

    // 2. 전체 영화 조회 (신규 추가된 영화 포함)
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('sourceId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    // 3. Naver 스케줄 수집
    const { errors, updatedMovies } = await runNaverScheduleScrape(supabase, movies);

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

    const totalElapsed = Date.now() - allStart;
    const tm = Math.floor(totalElapsed / 60000);
    const ts = Math.floor((totalElapsed % 60000) / 1000);
    console.log(`[전체 수집] 완료 소요 ${tm}분 ${ts}초\n`);

    if (errors.length > 0) {
      console.warn(`[경고] 실패한 영화 ${errors.length}개:`);
      errors.forEach((e) => console.warn(`  - ${e}`));
    }

    process.exit(0);
  } catch (err) {
    console.error('[전체 수집 치명적 오류]', err.message);
    await sendTelegramMessage(`🚨 전체 수집 실패\n\n${err.message}`).catch(() => {});
    process.exit(1);
  }
}

main();
