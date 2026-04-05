import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { runMovieScrape } from './core/movieScraper.js';
import { runScheduleScrape } from './core/scheduleScraper.js';
import { runKofaScrape } from './core/kofaScraper.js';
import { runEmucineScrape } from './core/emucineScraper.js';
import { sendTelegramMessage } from './core/telegram.js';
import { createUrlToken } from './core/urlToken.js';

const MOVIES_URL = 'https://wooriworld.github.io/cineping/#';

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Express 서버 설정 ─────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Cineping Scraper Server 실행 중' });
});

// ── API 기반 영화 수집 엔드포인트 ─────────────────────────────────
app.post('/api/scrape/naver-api', async (_req, res) => {
  try {
    const { added, skipped, total } = await runMovieScrape(supabase);

    return res.json({ success: true, added, skipped, total });
  } catch (err) {
    console.error('[API 영화 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 스케줄 수집 엔드포인트 (전체) ────────────────────────────────
app.post('/api/scrape/naver-schedules-api', async (_req, res) => {
  try {
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('sourceId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    const { schedulesAdded, errors } = await runScheduleScrape(supabase, movies);

    return res.json({ success: true, moviesProcessed: movies.length, schedulesAdded, errors });
  } catch (err) {
    console.error('[스케줄 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 전체 수집 엔드포인트 (영화 + 스케줄) ─────────────────────────
app.post('/api/scrape/all', async (_req, res) => {
  try {
    const allStart = Date.now();

    // 1. 영화 수집
    const {
      added: movieAdded,
      skipped: movieSkipped,
      total: movieTotal,
      addedTitles,
      addedNaverMovieIds,
    } = await runMovieScrape(supabase);

    // 2. 전체 영화 조회 (신규 추가된 영화 포함)
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('sourceId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    // 3. Nvaer 스케줄 수집
    const { schedulesAdded, errors, updatedMovies } = await runScheduleScrape(supabase, movies);

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
    // 스케줄 업데이트
    if (notifyScheduleMovies.length > 0) {
      const lines = notifyScheduleMovies.slice(0, 3).map((m) => `🎬 [ ${m.title} ]`);
      if (notifyScheduleMovies.length > 3)
        lines.push(`... and ${notifyScheduleMovies.length - 3} more`);
      parts.push(`Showtime Updates (${notifyScheduleMovies.length})\n${lines.join('\n')}`);
    }

    if (parts.length > 0) {
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
      console.log('[Telegram 발송] 전체 수집 완료 알림 발송');
    }

    const totalElapsed = Date.now() - allStart;
    const tm = Math.floor(totalElapsed / 60000);
    const ts = Math.floor((totalElapsed % 60000) / 1000);
    console.log(`[전체 수집 완료] 총 소요: ${tm}분 ${ts}초\n`);

    return res.json({
      success: true,
      movieAdded,
      movieSkipped,
      movieTotal,
      moviesProcessed: movies.length,
      schedulesAdded,
      errors,
      kofaAdded: kofaResult.added,
      kofaSkipped: kofaResult.skipped,
      kofaSchedulesAdded: kofaResult.schedulesAdded,
      kofaSchedulesDeleted: kofaResult.schedulesDeleted,
      kofaErrors: kofaResult.errors,
      emucineAdded: emucineResult.added,
      emucineSkipped: emucineResult.skipped,
      emucineSchedulesAdded: emucineResult.schedulesAdded,
      emucineErrors: emucineResult.errors,
      elapsedMs: totalElapsed,
    });
  } catch (err) {
    console.error('[전체 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 에무시네마 영화 수집 엔드포인트 ──────────────────────────────
app.post('/api/scrape/emucine-movies', async (_req, res) => {
  try {
    const result = await runEmucineScrape(supabase);
    return res.json({ success: true, ...result });
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

// ── 서버 시작 ─────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n[Cineping Scraper Server] 포트 ${PORT} 실행 중`);
  console.log(`  전체 수집 : [POST] http://localhost:${PORT}/api/scrape/all`);
  console.log(`  Naver 수집 : [POST] http://localhost:${PORT}/api/scrape/naver-api`);
  console.log(`  KOFA 수집 : [POST] http://localhost:${PORT}/api/scrape/kofa-api`);
  console.log(`  에무시네마 수집 : [POST] http://localhost:${PORT}/api/scrape/emucine-movies`);
  console.log(`  상태 확인 : [GET]  http://localhost:${PORT}/health\n`);
});
