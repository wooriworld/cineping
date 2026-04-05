import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { runNaverScrape } from './core/movieScraper.js';
import { runNaverScheduleScrape } from './core/scheduleScraper.js';
import { runKofaScrape } from './core/kofaScraper.js';
import { runEmucineScrape } from './core/emucineScraper.js';
import { sendTelegramMessage } from './core/telegram.js';
import { createUrlToken } from './core/urlToken.js';

const MOVIES_URL = 'https://wooriworld.github.io/cineping/#';

function kstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Express 서버 설정 ─────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Naver 영화 수집 엔드포인트 ─────────────────────────────────
app.post('/api/scrape/naver-api', async (_req, res) => {
  try {
    const { added, skipped, total } = await runNaverScrape(supabase);

    return res.json({ success: true, added, skipped, total });
  } catch (err) {
    console.error('[Naver 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Naver 스케줄 수집 엔드포인트 ────────────────────────────────
app.post('/api/scrape/naver-schedules-api', async (_req, res) => {
  try {
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('sourceId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    const { schedulesAdded, errors } = await runNaverScheduleScrape(supabase, movies);

    return res.json({ success: true, moviesProcessed: movies.length, schedulesAdded, errors });
  } catch (err) {
    console.error('[스케줄 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 에무시네마 영화 수집 엔드포인트 ──────────────────────────────
app.post('/api/scrape/emucine-api', async (_req, res) => {
  try {
    await runEmucineScrape(supabase);
    return res.json({ success: true });
  } catch (err) {
    console.error('[에무시네마 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── KOFA 영화 수집 엔드포인트 ─────────────────────────────────────
app.post('/api/scrape/kofa-api', async (_req, res) => {
  try {
    await runKofaScrape(supabase);
    return res.json({ success: true });
  } catch (err) {
    console.error('[KOFA 영화 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 전체 수집 엔드포인트 ─────────────────────────
app.post('/api/scrape/all', async (_req, res) => {
  try {
    console.log('[전체 수집] 시작');
    const allStart = Date.now();

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

    const totalElapsed = Date.now() - allStart;
    const tm = Math.floor(totalElapsed / 60000);
    const ts = Math.floor((totalElapsed % 60000) / 1000);
    console.log(`[전체 수집] 완료 소요 ${tm}분 ${ts}초\n`);

    return res.json({ success: true });
  } catch (err) {
    console.error('[전체 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function sendUpdateNotification(
  supabase,
  { addedTitles, addedNaverMovieIds, updatedMovies, kofaResult, emucineResult },
) {
  const today = kstToday();
  const notifyScheduleMovies = [
    ...new Map(
      [
        ...updatedMovies.filter((m) => (m.createdAt ?? '').slice(0, 10) < today),
        ...kofaResult.updatedMovies,
      ].map((m) => [m.id, m]),
    ).values(),
  ];
  const parts = [];

  const allAddedTitles = [...addedTitles, ...kofaResult.addedTitles, ...emucineResult.addedTitles];
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

  if (parts.length === 0) return;

  const allNaverIds = [
    ...new Set([
      ...addedNaverMovieIds,
      ...kofaResult.addedNaverMovieIds,
      ...emucineResult.addedSourceIds,
      ...notifyScheduleMovies.map((m) => m.sourceId).filter(Boolean),
    ]),
  ];
  const token = await createUrlToken(supabase, allNaverIds);
  const url = token ? `${MOVIES_URL}?t=${token}` : MOVIES_URL;
  const message = `🔥🔥 영화 업데이트 알림\n\n${parts.join('\n\n')}\n\n🔗 바로가기\n${url}`;
  await sendTelegramMessage(message);
  console.log('\n[Telegram 발송] 알림 발송');
}

// ── 서버 시작 ─────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n[Cineping Scraper Server] 포트 ${PORT} 실행 중`);
  console.log(`  전체 수집 : [POST] http://localhost:${PORT}/api/scrape/all`);
  console.log(`  Naver 수집 : [POST] http://localhost:${PORT}/api/scrape/naver-api`);
  console.log(`  KOFA 수집 : [POST] http://localhost:${PORT}/api/scrape/kofa-api`);
  console.log(`  에무시네마 수집 : [POST] http://localhost:${PORT}/api/scrape/emucine-api\n`);
});
