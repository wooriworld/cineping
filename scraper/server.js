import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { scrapeMovieSchedulesViaApi } from './parsers/naverScheduleApiParser.js';
import { scrapeMoviesViaApi } from './parsers/naverMovieApiParser.js';

// ── Telegram 알림 ─────────────────────────────────────────────────
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
const MOVIES_URL = 'https://wooriworld.github.io/cineping/#';


async function sendTelegramMessage(text) {
  try {
    const res = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('[Telegram 오류]', err.description ?? res.status);
    }
  } catch (err) {
    console.error('[Telegram 오류]', err.message);
  }
}

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Express 서버 설정 ─────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Cineping Scraper Server 실행 중' });
});

// ── 내부 헬퍼: 영화 수집 ──────────────────────────────────────────
async function _runMovieScrape() {
  const start = Date.now();
  console.log('\n[API 영화 수집 시작]');
  const scraped = await scrapeMoviesViaApi();
  console.log(`[크롤링 완료] ${scraped.length}개 영화 파싱`);

  if (scraped.length === 0) {
    return { added: 0, skipped: 0, total: 0, addedTitles: [] };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('movies')
    .select('id, title, englishTitle');
  if (fetchErr) throw new Error(fetchErr.message);

  const existingMap = new Map(existing.map((m) => [m.title, m]));
  let added = 0;
  let skipped = 0;
  const addedTitles = [];
  const addedNaverMovieIds = [];

  for (const movie of scraped) {
    const existingMovie = existingMap.get(movie.title);

    if (existingMovie) {
      if (movie.englishTitle && !existingMovie.englishTitle) {
        const { error: updErr } = await supabase
          .from('movies')
          .update({ englishTitle: movie.englishTitle })
          .eq('id', existingMovie.id);
        if (updErr) throw new Error(updErr.message);
        console.log(`  ~ 영어 제목 업데이트: ${movie.title} → ${movie.englishTitle}`);
      }
      skipped++;
      continue;
    }

    const { error } = await supabase.from('movies').insert({
      title: movie.title,
      englishTitle: movie.englishTitle || '',
      naverMovieId: movie.naverMovieId || '',
      poster: movie.poster || '',
      releaseDate: movie.releaseDate || '',
      createdAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);

    existingMap.set(movie.title, { id: '', title: movie.title, englishTitle: movie.englishTitle });
    addedTitles.push(movie.title);
    if (movie.naverMovieId) addedNaverMovieIds.push(movie.naverMovieId);
    added++;
    console.log(`  + 저장: ${movie.title}`);
  }

  const elapsed = Date.now() - start;
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  console.log(
    `[영화 저장 완료] 추가: ${added}개 / 중복 스킵: ${skipped}개 (소요: ${m}분 ${s}초)\n`,
  );

  return { added, skipped, total: scraped.length, addedTitles, addedNaverMovieIds };
}

// ── 내부 헬퍼: 스케줄 수집 ────────────────────────────────────────
async function _runScheduleScrape(movies) {
  const start = Date.now();
  console.log('\n[스케줄 수집 시작]');
  console.log(`[대상 영화] ${movies.length}개`);

  let schedulesAdded = 0;
  const errors = [];
  const CHUNK = 100;
  const DELAY_MS = 1500;
  const updatedMovies = [];
  const scheduleKey = (s) => `${s.date}_${s.theater}_${s.startTime}`;

  for (const movie of movies) {
    const movieStart = Date.now();
    try {
      const scraped = await scrapeMovieSchedulesViaApi(movie);

      const { data: existing, error: exErr } = await supabase
        .from('schedules')
        .select('*')
        .eq('movieId', movie.id)
        .limit(10000);
      if (exErr) {
        console.error(
          `  [Supabase SELECT 오류] code=${exErr.code} message=${exErr.message} details=${exErr.details} hint=${exErr.hint}`,
        );
        throw new Error(exErr.message);
      }

      const existingMap = new Map(existing.map((s) => [scheduleKey(s), s]));
      const scrapedKeySet = new Set(scraped.map(scheduleKey));

      const toAdd = [];
      const toUpdate = [];

      for (const s of scraped) {
        const key = scheduleKey(s);
        const ex = existingMap.get(key);
        if (!ex) {
          toAdd.push(s);
        } else if (
          s.endTime !== ex.endTime ||
          s.screenType !== ex.screenType ||
          s.bookingUrl !== ex.bookingUrl ||
          s.chain !== ex.chain
        ) {
          toUpdate.push({
            id: ex.id,
            data: {
              endTime: s.endTime,
              screenType: s.screenType,
              bookingUrl: s.bookingUrl,
              chain: s.chain,
              lastUpdatedAt: s.lastUpdatedAt,
            },
          });
        }
      }

      const toDeleteIds = existing
        .filter((s) => !scrapedKeySet.has(scheduleKey(s)))
        .map((s) => s.id);

      for (let i = 0; i < toDeleteIds.length; i += CHUNK) {
        const { error: delErr } = await supabase
          .from('schedules')
          .delete()
          .in('id', toDeleteIds.slice(i, i + CHUNK));
        if (delErr) {
          console.error(
            `  [Supabase DELETE 오류] code=${delErr.code} message=${delErr.message} details=${delErr.details} hint=${delErr.hint}`,
          );
          throw new Error(delErr.message);
        }
      }

      for (const { id, data } of toUpdate) {
        const { error: updErr } = await supabase.from('schedules').update(data).eq('id', id);
        if (updErr) {
          console.error(
            `  [Supabase UPDATE 오류] id=${id} code=${updErr.code} message=${updErr.message} details=${updErr.details} hint=${updErr.hint}`,
          );
          console.error(`  [Supabase UPDATE 오류] data=`, JSON.stringify(data));
          throw new Error(updErr.message);
        }
      }

      for (let i = 0; i < toAdd.length; i += CHUNK) {
        const chunk = toAdd.slice(i, i + CHUNK);
        const { error: insErr } = await supabase.from('schedules').insert(chunk);
        if (insErr) {
          console.error(
            `  [Supabase INSERT 오류] chunk[${i}~${i + chunk.length}] code=${insErr.code} message=${insErr.message} details=${insErr.details} hint=${insErr.hint}`,
          );
          console.error(`  [Supabase INSERT 오류] 첫 번째 레코드=`, JSON.stringify(chunk[0]));
          throw new Error(insErr.message);
        }
      }

      schedulesAdded += toAdd.length;
      if (toAdd.length > 0) updatedMovies.push(movie);

      const elapsed = Date.now() - movieStart;
      const m = Math.floor(elapsed / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      console.log(
        `  ✓ "${movie.title}" 완료 — 추가 ${toAdd.length}개 / 수정 ${toUpdate.length}개 / 삭제 ${toDeleteIds.length}개 (${m}분 ${s}초)`,
      );
    } catch (err) {
      const elapsed = Date.now() - movieStart;
      const m = Math.floor(elapsed / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      const msg = `${movie.title}: ${err.message}`;
      console.error(`  [오류] ${msg} (${m}분 ${s}초)`);
      errors.push(msg);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const elapsed = Date.now() - start;
  const tm = Math.floor(elapsed / 60000);
  const ts = Math.floor((elapsed % 60000) / 1000);
  console.log(`[스케줄 수집 완료] 총 ${schedulesAdded}개 저장 (소요: ${tm}분 ${ts}초)\n`);

  return { schedulesAdded, errors, updatedMovies };
}

// ── API 기반 영화 수집 엔드포인트 ─────────────────────────────────
app.post('/api/scrape/movies-api', async (_req, res) => {
  try {
    const { added, skipped, total, addedTitles, addedNaverMovieIds } = await _runMovieScrape();

    if (addedTitles.length > 0) {
      const displayTitles = addedTitles.slice(0, 3).map((t) => `🎬 [ ${t} ]`);
      if (addedTitles.length > 3) displayTitles.push(`    ...외 ${addedTitles.length - 3}개`);
      const url =
        addedNaverMovieIds.length > 0
          ? `${MOVIES_URL}?id=${addedNaverMovieIds.join(',')}`
          : MOVIES_URL;
      const message = `🔥🔥 신규 영화 업데이트 ${addedTitles.length}건\n\n${displayTitles.join('\n')}\n\n🔗 바로가기:\n${url}`;
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

    const { schedulesAdded, errors, updatedMovies } = await _runScheduleScrape(movies);

    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const notifyMovies = updatedMovies.filter((m) => (m.createdAt ?? '').slice(0, 10) < today);

    if (notifyMovies.length > 0) {
      const MAX_SHOW = 3;
      const lines = notifyMovies.slice(0, MAX_SHOW).map((m) => `🎬 [ ${m.title} ]`);
      if (notifyMovies.length > MAX_SHOW) lines.push(`... 외 ${notifyMovies.length - MAX_SHOW}개`);
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
    const {
      added: movieAdded,
      skipped: movieSkipped,
      total: movieTotal,
      addedTitles,
      addedNaverMovieIds,
    } = await _runMovieScrape();

    // 2. 전체 영화 조회 (신규 추가된 영화 포함)
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('naverMovieId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    // 3. 전체 스케줄 수집
    const { schedulesAdded, errors, updatedMovies } = await _runScheduleScrape(movies);

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

    console.log(`\n[API 스케줄 수집] "${movie.title}" (${movie.naverMovieId})`);
    const movieStart = Date.now();

    const scraped = await scrapeMovieSchedulesViaApi(movie);

    const { data: existing, error: exErr } = await supabase
      .from('schedules')
      .select('*')
      .eq('movieId', movieId)
      .limit(10000);
    if (exErr) throw new Error(exErr.message);

    const scheduleKey = (s) => `${s.date}_${s.theater}_${s.startTime}`;
    const existingMap = new Map(existing.map((s) => [scheduleKey(s), s]));
    const scrapedKeySet = new Set(scraped.map(scheduleKey));

    const toAdd = [];
    const toUpdate = [];

    for (const s of scraped) {
      const key = scheduleKey(s);
      const ex = existingMap.get(key);
      if (!ex) {
        toAdd.push(s);
      } else if (
        s.endTime !== ex.endTime ||
        s.screenType !== ex.screenType ||
        s.bookingUrl !== ex.bookingUrl ||
        s.chain !== ex.chain
      ) {
        toUpdate.push({
          id: ex.id,
          data: {
            endTime: s.endTime,
            screenType: s.screenType,
            bookingUrl: s.bookingUrl,
            chain: s.chain,
            lastUpdatedAt: s.lastUpdatedAt,
          },
        });
      }
    }

    const toDeleteIds = existing.filter((s) => !scrapedKeySet.has(scheduleKey(s))).map((s) => s.id);

    const CHUNK = 100;

    for (let i = 0; i < toDeleteIds.length; i += CHUNK) {
      const { error: delErr } = await supabase
        .from('schedules')
        .delete()
        .in('id', toDeleteIds.slice(i, i + CHUNK));
      if (delErr) throw new Error(delErr.message);
    }

    for (const { id, data } of toUpdate) {
      const { error: updErr } = await supabase.from('schedules').update(data).eq('id', id);
      if (updErr) throw new Error(updErr.message);
    }
    for (let i = 0; i < toAdd.length; i += CHUNK) {
      const { error: insErr } = await supabase.from('schedules').insert(toAdd.slice(i, i + CHUNK));
      if (insErr) throw new Error(insErr.message);
    }

    const elapsed = Date.now() - movieStart;
    const m = Math.floor(elapsed / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    console.log(
      `  ✓ "${movie.title}" 완료 — 신규 ${toAdd.length}개 / 수정 ${toUpdate.length}개 / 삭제 ${toDeleteIds.length}개 (${m}분 ${s}초)\n`,
    );
    return res.json({
      success: true,
      added: toAdd.length,
      updated: toUpdate.length,
      deleted: toDeleteIds.length,
    });
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
