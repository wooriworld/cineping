import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { runMovieScrape } from './core/movieScraper.js';
import { runScheduleScrape } from './core/scheduleScraper.js';
import { sendTelegramMessage } from './core/telegram.js';

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
app.post('/api/scrape/movies-api', async (_req, res) => {
  try {
    const { added, skipped, total, addedTitles, addedNaverMovieIds } =
      await runMovieScrape(supabase);

    if (addedTitles.length > 0) {
      const lines = addedTitles.slice(0, 3).map((t) => `🎬 [ ${t} ]`);
      if (addedTitles.length > 3) lines.push(`    ...외 ${addedTitles.length - 3}개`);
      const url =
        addedNaverMovieIds.length > 0
          ? `${MOVIES_URL}?id=${addedNaverMovieIds.join(',')}`
          : MOVIES_URL;
      const message = `🔥🔥 신규 영화 업데이트 ${addedTitles.length}건\n\n${lines.join('\n')}\n\n🔗 바로가기:\n${url}`;
      await sendTelegramMessage(message);
      console.log(`[Telegram 발송] ${addedTitles.length}개 신규 영화 알림 발송`);
    }

    return res.json({ success: true, added, skipped, total });
  } catch (err) {
    console.error('[API 영화 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 스케줄 수집 엔드포인트 (전체) ────────────────────────────────
app.post('/api/scrape/schedules', async (_req, res) => {
  try {
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('naverMovieId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    const { schedulesAdded, errors, updatedMovies } = await runScheduleScrape(supabase, movies);

    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const notifyMovies = updatedMovies.filter((m) => (m.createdAt ?? '').slice(0, 10) < today);

    if (notifyMovies.length > 0) {
      const lines = notifyMovies.slice(0, 3).map((m) => `🎬 [ ${m.title} ]`);
      if (notifyMovies.length > 3) lines.push(`... 외 ${notifyMovies.length - 3}개`);
      const naverIds = notifyMovies.map((m) => m.naverMovieId).filter(Boolean);
      const url = naverIds.length > 0 ? `${MOVIES_URL}?id=${naverIds.join(',')}` : MOVIES_URL;
      const message = `🔥🔥 영화 스케줄 업데이트 ${notifyMovies.length}건\n\n${lines.join('\n')}\n\n🔗 바로가기\n${url}`;
      await sendTelegramMessage(message);
      console.log(`[Telegram 발송] 스케줄 업데이트 ${notifyMovies.length}개 알림 발송`);
    }

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
    const { added: movieAdded, skipped: movieSkipped, total: movieTotal, addedTitles, addedNaverMovieIds } =
      await runMovieScrape(supabase);

    // 2. 전체 영화 조회 (신규 추가된 영화 포함)
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('naverMovieId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    // 3. 전체 스케줄 수집
    const { schedulesAdded, errors, updatedMovies } = await runScheduleScrape(supabase, movies);

    // 4. 통합 텔레그램 알림
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const notifyScheduleMovies = updatedMovies.filter(
      (m) => (m.createdAt ?? '').slice(0, 10) < today,
    );
    const parts = [];

    if (addedTitles.length > 0) {
      const lines = addedTitles.slice(0, 3).map((t) => `🎬 [ ${t} ]`);
      if (addedTitles.length > 3) lines.push(`... 외 ${addedTitles.length - 3}개`);
      parts.push(`신규 영화 ${addedTitles.length}건\n${lines.join('\n')}`);
    }
    if (notifyScheduleMovies.length > 0) {
      const lines = notifyScheduleMovies.slice(0, 3).map((m) => `🎬 [ ${m.title} ]`);
      if (notifyScheduleMovies.length > 3)
        lines.push(`... 외 ${notifyScheduleMovies.length - 3}개`);
      parts.push(`스케줄 업데이트 ${notifyScheduleMovies.length}건\n${lines.join('\n')}`);
    }

    if (parts.length > 0) {
      const allNaverIds = [
        ...new Set([
          ...addedNaverMovieIds,
          ...notifyScheduleMovies.map((m) => m.naverMovieId).filter(Boolean),
        ]),
      ];
      const url = allNaverIds.length > 0 ? `${MOVIES_URL}?id=${allNaverIds.join(',')}` : MOVIES_URL;
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
      elapsedMs: totalElapsed,
    });
  } catch (err) {
    console.error('[전체 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 단일 영화 스케줄 수집 엔드포인트 (diff) ──────────────────────
app.post('/api/scrape/schedules-api/:movieId', async (req, res) => {
  const { movieId } = req.params;
  try {
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .eq('id', movieId);
    if (fetchErr) throw new Error(fetchErr.message);

    const movie = movies[0];
    if (!movie) return res.status(404).json({ success: false, error: '영화를 찾을 수 없습니다.' });
    if (!movie.naverMovieId)
      return res.status(400).json({ success: false, error: 'naverMovieId 가 없습니다.' });

    const { schedulesAdded: added, schedulesUpdated: updated, schedulesDeleted: deleted, errors } =
      await runScheduleScrape(supabase, [movie]);

    if (errors.length > 0) {
      return res.status(500).json({ success: false, error: errors[0] });
    }

    return res.json({ success: true, added, updated, deleted });
  } catch (err) {
    console.error('[API 스케줄 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 서버 시작 ─────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n[Cineping Scraper Server] 포트 ${PORT} 실행 중`);
  console.log(`  영화 스크래핑 : POST http://localhost:${PORT}/api/scrape/movies-api`);
  console.log(`  스케줄 수집   : POST http://localhost:${PORT}/api/scrape/schedules`);
  console.log(`  전체 수집     : POST http://localhost:${PORT}/api/scrape/all`);
  console.log(`  상태 확인     : GET  http://localhost:${PORT}/health\n`);
});
