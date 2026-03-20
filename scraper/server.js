import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { scrapeMovieSchedulesViaApi } from './parsers/naverScheduleApiParser.js';
import { scrapeMoviesViaApi } from './parsers/naverMovieApiParser.js';

// ── Telegram 알림 ─────────────────────────────────────────────────
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
const MOVIES_URL = 'https://cheadev5831.github.io/cineping';

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

// ── Express 서버 설정 ────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// 상태 확인 엔드포인트
app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Cineping Scraper Server 실행 중' });
});

// API 기반 영화 수집 엔드포인트
app.post('/api/scrape/movies-api', async (_req, res) => {
  try {
    const movieScrapeStart = Date.now();
    console.log('\n[API 영화 수집 시작]');
    const scraped = await scrapeMoviesViaApi();
    console.log(`[크롤링 완료] ${scraped.length}개 영화 파싱`);

    if (scraped.length === 0) {
      return res.json({ success: true, added: 0, skipped: 0, total: 0 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('movies')
      .select('id, title, englishTitle');
    if (fetchErr) throw new Error(fetchErr.message);

    const existingMap = new Map(existing.map((m) => [m.title, m]));

    let added = 0;
    let skipped = 0;
    const addedTitles = [];

    for (const movie of scraped) {
      const existingMovie = existingMap.get(movie.title);

      if (existingMovie) {
        // 영어 제목이 새로 수집됐고 기존에 비어있으면 업데이트
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
        createdAt: new Date().toISOString(),
      });

      if (error) throw new Error(error.message);
      existingMap.set(movie.title, {
        id: '',
        title: movie.title,
        englishTitle: movie.englishTitle,
      });
      addedTitles.push(movie.title);
      added++;
      console.log(`  + 저장: ${movie.title}`);
    }

    const movieScrapeElapsed = Date.now() - movieScrapeStart;
    const msm = Math.floor(movieScrapeElapsed / 60000);
    const mss = Math.floor((movieScrapeElapsed % 60000) / 1000);
    console.log(
      `[저장 완료] 추가: ${added}개 / 중복 스킵: ${skipped}개 (소요: ${msm}분 ${mss}초)\n`,
    );

    if (addedTitles.length > 0) {
      const displayTitles = addedTitles.slice(0, 3).map((t) => `🎬 [ ${t} ]`);
      if (addedTitles.length > 3) displayTitles.push(`    ...외 ${addedTitles.length - 3}개`);
      const message = `🔥🔥 신규 영화 업데이트 ${addedTitles.length}건\n\n${displayTitles.join('\n')}\n\n🔗 바로가기:\n${MOVIES_URL}`;
      await sendTelegramMessage(message);
      console.log(`[Telegram 발송] ${addedTitles.length}개 신규 영화 알림 발송`);
    }

    return res.json({ success: true, added, skipped, total: scraped.length });
  } catch (err) {
    console.error('[API 영화 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 스케줄 수집 엔드포인트 (전체)
app.post('/api/scrape/schedules', async (_req, res) => {
  try {
    const totalStart = Date.now();
    console.log('\n[스케줄 수집 시작]');

    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('naverMovieId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    console.log(`[대상 영화] ${movies.length}개`);

    let schedulesAdded = 0;
    const errors = [];
    const CHUNK = 100;
    const DELAY_MS = 1500; // 영화 간 딜레이 (레이트 리밋 방지)
    const updatedMovies = []; // 신규 스케줄이 추가된 영화 추적
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
        if (exErr) throw new Error(exErr.message);

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

        // 삭제
        if (toDeleteIds.length > 0) {
          const { error: delErr } = await supabase.from('schedules').delete().in('id', toDeleteIds);
          if (delErr) throw new Error(delErr.message);
        }

        // 수정
        for (const { id, data } of toUpdate) {
          const { error: updErr } = await supabase.from('schedules').update(data).eq('id', id);
          if (updErr) throw new Error(updErr.message);
        }

        // 추가
        for (let i = 0; i < toAdd.length; i += CHUNK) {
          const { error: insErr } = await supabase
            .from('schedules')
            .insert(toAdd.slice(i, i + CHUNK));
          if (insErr) throw new Error(insErr.message);
        }

        schedulesAdded += toAdd.length;

        if (toAdd.length > 0) {
          updatedMovies.push(movie);
        }

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

    const totalElapsed = Date.now() - totalStart;
    const tm = Math.floor(totalElapsed / 60000);
    const ts = Math.floor((totalElapsed % 60000) / 1000);
    console.log(`[스케줄 수집 완료] 총 ${schedulesAdded}개 저장 (소요: ${tm}분 ${ts}초)\n`);

    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const notifyMovies = updatedMovies.filter((m) => (m.createdAt ?? '').slice(0, 10) < today);

    if (notifyMovies.length > 0) {
      const MAX_SHOW = 3;
      const lines = notifyMovies.slice(0, MAX_SHOW).map((m) => `🎬 [ ${m.title} ]`);
      if (notifyMovies.length > MAX_SHOW) lines.push(`... 외 ${notifyMovies.length - MAX_SHOW}개`);
      const message = `🔥🔥 영화 스케줄 업데이트 ${notifyMovies.length}건\n\n${lines.join('\n')}\n\n🔗 바로가기\n${MOVIES_URL}`;
      await sendTelegramMessage(message);
      console.log(`[Telegram 발송] 스케줄 업데이트 ${notifyMovies.length}개 알림 발송`);
    }

    return res.json({ success: true, moviesProcessed: movies.length, schedulesAdded, errors });
  } catch (err) {
    console.error('[스케줄 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 단일 영화 스케줄 수집 엔드포인트 (diff)
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

    // unique key: date_theater_startTime
    const scheduleKey = (s) => `${s.date}_${s.theater}_${s.startTime}`;
    const existingMap = new Map(existing.map((s) => [scheduleKey(s), s]));
    const scrapedKeySet = new Set(scraped.map(scheduleKey));

    const toAdd = [];
    const toUpdate = []; // { id, data }

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

    // 삭제
    if (toDeleteIds.length > 0) {
      const { error: delErr } = await supabase.from('schedules').delete().in('id', toDeleteIds);
      if (delErr) throw new Error(delErr.message);
    }

    // 수정
    for (const { id, data } of toUpdate) {
      const { error: updErr } = await supabase.from('schedules').update(data).eq('id', id);
      if (updErr) throw new Error(updErr.message);
    }

    // 추가
    const CHUNK = 100;
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

// ── 서버 시작 ────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n[Cineping Scraper Server] 포트 ${PORT} 실행 중`);
  console.log(`  영화 스크래핑 : POST http://localhost:${PORT}/api/scrape/movies-api`);
  console.log(`  스케줄 수집   : POST http://localhost:${PORT}/api/scrape/schedules`);
  console.log(`  상태 확인     : GET  http://localhost:${PORT}/health\n`);
});
