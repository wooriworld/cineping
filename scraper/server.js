import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { scrapeMovieSchedulesViaApi } from './parsers/naverScheduleApiParser.js';
import { scrapeMoviesViaApi } from './parsers/naverMovieApiParser.js';

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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
    console.log('\n[API 영화 수집 시작]');
    const scraped = await scrapeMoviesViaApi();
    console.log(`[크롤링 완료] ${scraped.length}개 영화 파싱`);

    if (scraped.length === 0) {
      return res.json({ success: true, added: 0, skipped: 0, total: 0 });
    }

    const { data: existing, error: fetchErr } = await supabase.from('movies').select('title');
    if (fetchErr) throw new Error(fetchErr.message);

    const existingTitles = new Set(existing.map((m) => m.title));

    let added = 0;
    let skipped = 0;

    for (const movie of scraped) {
      if (existingTitles.has(movie.title)) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('movies').insert({
        title: movie.title,
        naverMovieId: movie.naverMovieId || '',
        poster: movie.poster || '',
        createdAt: new Date().toISOString(),
      });

      if (error) throw new Error(error.message);
      existingTitles.add(movie.title);
      added++;
      console.log(`  + 저장: ${movie.title}`);
    }

    console.log(`[저장 완료] 추가: ${added}개 / 중복 스킵: ${skipped}개\n`);
    return res.json({ success: true, added, skipped, total: scraped.length });
  } catch (err) {
    console.error('[API 영화 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 스케줄 수집 엔드포인트 (전체)
app.post('/api/scrape/schedules', async (_req, res) => {
  try {
    console.log('\n[스케줄 수집 시작]');

    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('naverMovieId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    console.log(`[대상 영화] ${movies.length}개`);

    let schedulesAdded = 0;
    const errors = [];
    const CHUNK = 500;

    for (const movie of movies) {
      const movieStart = Date.now();
      try {
        const scraped = await scrapeMovieSchedulesViaApi(movie);

        // 기존 스케줄 전체 삭제
        const { error: delErr } = await supabase
          .from('schedules')
          .delete()
          .eq('movieId', movie.id);
        if (delErr) throw new Error(delErr.message);

        // 신규 저장 (500개 단위)
        for (let i = 0; i < scraped.length; i += CHUNK) {
          const { error: insErr } = await supabase
            .from('schedules')
            .insert(scraped.slice(i, i + CHUNK));
          if (insErr) throw new Error(insErr.message);
        }
        schedulesAdded += scraped.length;

        const elapsed = Date.now() - movieStart;
        const m = Math.floor(elapsed / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        console.log(`  ✓ "${movie.title}" 완료 — 신규 ${scraped.length}개 저장 (${m}분 ${s}초)`);
      } catch (err) {
        const elapsed = Date.now() - movieStart;
        const m = Math.floor(elapsed / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        const msg = `${movie.title}: ${err.message}`;
        console.error(`  [오류] ${msg} (${m}분 ${s}초)`);
        errors.push(msg);
      }
    }

    console.log(`[스케줄 수집 완료] 총 ${schedulesAdded}개 저장\n`);
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
    if (!movie.naverMovieId) return res.status(400).json({ success: false, error: 'naverMovieId 가 없습니다.' });

    console.log(`\n[API 스케줄 수집] "${movie.title}" (${movie.naverMovieId})`);
    const movieStart = Date.now();

    const scraped = await scrapeMovieSchedulesViaApi(movie);

    const { data: existing, error: exErr } = await supabase
      .from('schedules')
      .select('*')
      .eq('movieId', movieId);
    if (exErr) throw new Error(exErr.message);

    // unique key: date_theater_startTime
    const scheduleKey = (s) => `${s.date}_${s.theater}_${s.startTime}`;
    const existingKeyMap = new Map(existing.map((s) => [scheduleKey(s), s.id]));
    const scrapedKeySet = new Set(scraped.map(scheduleKey));

    const toAdd = scraped.filter((s) => !existingKeyMap.has(scheduleKey(s)));
    const toDeleteIds = existing
      .filter((s) => !scrapedKeySet.has(scheduleKey(s)))
      .map((s) => s.id);
    const skipped = scraped.length - toAdd.length;

    // 삭제
    if (toDeleteIds.length > 0) {
      const { error: delErr } = await supabase.from('schedules').delete().in('id', toDeleteIds);
      if (delErr) throw new Error(delErr.message);
    }

    // 추가
    const CHUNK = 500;
    for (let i = 0; i < toAdd.length; i += CHUNK) {
      const { error: insErr } = await supabase.from('schedules').insert(toAdd.slice(i, i + CHUNK));
      if (insErr) throw new Error(insErr.message);
    }

    const elapsed = Date.now() - movieStart;
    const m = Math.floor(elapsed / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    console.log(`  ✓ "${movie.title}" 완료 — 추가 ${toAdd.length}개 / 스킵 ${skipped}개 / 삭제 ${toDeleteIds.length}개 (${m}분 ${s}초)\n`);
    return res.json({ success: true, added: toAdd.length, skipped, deleted: toDeleteIds.length });
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
