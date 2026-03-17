import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where, deleteDoc } from 'firebase/firestore';
import { scrapeMovieSchedulesViaApi } from './parsers/naverScheduleApiParser.js';
import { scrapeMoviesViaApi } from './parsers/naverMovieApiParser.js';

// ── Firebase 초기화 (seed.mjs 와 동일한 설정) ─────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyDmx9CExa5hrye-u3OyLP1WYPJmLoPta84',
  authDomain: 'cineping.firebaseapp.com',
  projectId: 'cineping',
  storageBucket: 'cineping.firebasestorage.app',
  messagingSenderId: '444231705969',
  appId: '1:444231705969:web:f28635003d5bc29e4b42d0',
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

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

    const existingSnap = await getDocs(collection(db, 'movies'));
    const existingTitles = new Set(existingSnap.docs.map((d) => d.data().title));

    let added = 0;
    let skipped = 0;

    for (const movie of scraped) {
      if (existingTitles.has(movie.title)) {
        skipped++;
        continue;
      }

      await addDoc(collection(db, 'movies'), {
        title: movie.title,
        naverMovieId: movie.naverMovieId || '',
        poster: movie.poster || '',
        createdAt: new Date().toISOString(),
      });

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

// 스케줄 수집 엔드포인트
app.post('/api/scrape/schedules', async (_req, res) => {
  try {
    console.log('\n[스케줄 수집 시작]');

    // 1. naverMovieId 있는 영화만 대상
    const moviesSnap = await getDocs(collection(db, 'movies'));
    const movies = moviesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.naverMovieId);

    console.log(`[대상 영화] ${movies.length}개`);

    let schedulesAdded = 0;
    const errors = [];

    for (const movie of movies) {
      const movieStart = Date.now();
      try {
        // 2. 크롤링 (API 직접 호출)
        const scraped = await scrapeMovieSchedulesViaApi(movie);

        // 3. 기존 스케줄 삭제
        const existingSnap = await getDocs(
          query(collection(db, 'schedules'), where('movieId', '==', movie.id)),
        );
        for (const d of existingSnap.docs) await deleteDoc(d.ref);

        // 4. 신규 저장
        for (const schedule of scraped) {
          await addDoc(collection(db, 'schedules'), schedule);
        }
        schedulesAdded += scraped.length;

        const elapsed = Date.now() - movieStart;
        const m = Math.floor(elapsed / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        console.log(`  ✓ "${movie.title}" 완료 — 기존 ${existingSnap.size}개 삭제 → 신규 ${scraped.length}개 저장 (${m}분 ${s}초)`);
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

// 단일 영화 스케줄 수집 엔드포인트
app.post('/api/scrape/schedules-api/:movieId', async (req, res) => {
  const { movieId } = req.params;
  try {
    const moviesSnap = await getDocs(collection(db, 'movies'));
    const movie = moviesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((m) => m.id === movieId);

    if (!movie) return res.status(404).json({ success: false, error: '영화를 찾을 수 없습니다.' });
    if (!movie.naverMovieId) return res.status(400).json({ success: false, error: 'naverMovieId 가 없습니다.' });

    console.log(`\n[API 스케줄 수집] "${movie.title}" (${movie.naverMovieId})`);

    const movieStart = Date.now();

    const scraped = await scrapeMovieSchedulesViaApi(movie);

    const existingSnap = await getDocs(
      query(collection(db, 'schedules'), where('movieId', '==', movieId)),
    );
    for (const d of existingSnap.docs) await deleteDoc(d.ref);

    for (const schedule of scraped) {
      await addDoc(collection(db, 'schedules'), schedule);
    }

    const elapsed = Date.now() - movieStart;
    const m = Math.floor(elapsed / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    console.log(`  ✓ "${movie.title}" 완료 — 기존 ${existingSnap.size}개 삭제 → 신규 ${scraped.length}개 저장 (${m}분 ${s}초)\n`);
    return res.json({ success: true, schedulesAdded: scraped.length });
  } catch (err) {
    console.error('[API 스케줄 수집 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 서버 시작 ────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n[Cineping Scraper Server] 포트 ${PORT} 실행 중`);
  console.log(`  영화 스크래핑 : POST http://localhost:${PORT}/api/scrape/movies`);
  console.log(`  스케줄 수집   : POST http://localhost:${PORT}/api/scrape/schedules`);
  console.log(`  상태 확인     : GET  http://localhost:${PORT}/health\n`);
});
