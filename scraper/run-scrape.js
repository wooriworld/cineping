import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { runNaverScrape } from './core/movieScraper.js';
import { runNaverScheduleScrape } from './core/scheduleScraper.js';
import { runKofaScrape } from './core/kofaScraper.js';
import { runEmucineScrape } from './core/emucineScraper.js';
import { sendTelegramMessage } from './core/telegram.js';
import { createUrlToken } from './core/urlToken.js';

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

const MOVIES_URL = 'https://wooriworld.github.io/cineping/#';

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── 메인 실행 ──────────────────────────────────────────────────────
async function main() {
  const allStart = Date.now();
  console.log('[전체 수집 시작]');

  try {
    // 1. 영화 수집
    const {
      added: movieAdded,
      skipped: movieSkipped,
      addedTitles,
      addedNaverMovieIds,
    } = await runNaverScrape(supabase);

    // 2. 전체 영화 조회 (신규 추가된 영화 포함)
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('sourceId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    // 3. 전체 스케줄 수집
    const { schedulesAdded, errors, updatedMovies } = await runNaverScheduleScrape(
      supabase,
      movies,
    );

    // 4. KOFA 수집
    const kofaResult = await runKofaScrape(supabase);

    // 5. 에무시네마 수집
    const emucineResult = await runEmucineScrape(supabase);

    // 6. 통합 텔레그램 알림
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const notifyScheduleMovies = [
      ...updatedMovies.filter((m) => (m.createdAt ?? '').slice(0, 10) < today),
      ...kofaResult.updatedMovies,
    ];
    const parts = [];

    // 신규 영화 (네이버 + KOFA + 에무시네마 취합)
    const allAddedTitles = [
      ...addedTitles,
      ...kofaResult.addedTitles,
      ...emucineResult.addedTitles,
    ];
    if (allAddedTitles.length > 0) {
      const lines = allAddedTitles.slice(0, 3).map((t) => `🎬 [ ${t} ]`);
      if (allAddedTitles.length > 3) lines.push(`... and ${allAddedTitles.length - 3} more`);
      parts.push(`New Movies (${allAddedTitles.length})\n${lines.join('\n')}`);
    }
    if (notifyScheduleMovies.length > 0) {
      const lines = notifyScheduleMovies.slice(0, 3).map((m) => `🎬 [ ${m.title} ]`);
      if (notifyScheduleMovies.length > 3)
        lines.push(`... and ${notifyScheduleMovies.length - 3} more`);
      parts.push(`Showtime Updates (${notifyScheduleMovies.length})\n${lines.join('\n')}`);
    }

    if (parts.length > 0) {
      const allSourceIds = [
        ...new Set([
          ...addedNaverMovieIds,
          ...kofaResult.addedNaverMovieIds,
          ...emucineResult.addedSourceIds,
          ...notifyScheduleMovies.map((m) => m.sourceId).filter(Boolean),
        ]),
      ];
      const token = await createUrlToken(supabase, allSourceIds);
      const url = token ? `${MOVIES_URL}?t=${token}` : MOVIES_URL;
      const message = `🔥🔥 Movie Update Alert\n\n${parts.join('\n\n')}\n\n🔗 View Details\n${url}`;
      await sendTelegramMessage(message);
      console.log('[Telegram 발송] 전체 수집 완료 알림 발송');
    }

    const totalElapsed = Date.now() - allStart;
    const tm = Math.floor(totalElapsed / 60000);
    const ts = Math.floor((totalElapsed % 60000) / 1000);
    console.log(
      `[전체 수집 완료] 영화 추가 ${movieAdded}개 / 스킵 ${movieSkipped}개 / 스케줄 추가 ${schedulesAdded}개 / KOFA 추가 ${kofaResult.added}개 / 에무시네마 추가 ${emucineResult.added}개 (총 소요: ${tm}분 ${ts}초)`,
    );

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
