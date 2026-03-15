import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import { scrapeNaverMovies } from './parsers/naverParser.js';

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

// 스크래핑 엔드포인트
app.post('/api/scrape/movies', async (_req, res) => {
  try {
    console.log('\n[스크래핑 시작] 네이버 현재상영영화 크롤링...');

    // 1. 네이버 크롤링
    const scraped = await scrapeNaverMovies();
    console.log(`[크롤링 완료] ${scraped.length}개 영화 발견`);

    if (scraped.length === 0) {
      return res.json({ success: true, added: 0, skipped: 0, total: 0 });
    }

    // 2. 기존 영화 목록 조회 (중복 방지)
    const existingSnap = await getDocs(collection(db, 'movies'));
    const existingTitles = new Set(existingSnap.docs.map((d) => d.data().title));
    console.log(`[중복 검사] 기존 영화 ${existingTitles.size}개`);

    // 3. 신규 영화만 Firestore에 저장
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

      existingTitles.add(movie.title); // 같은 배치 내 중복 방지
      added++;
      console.log(`  + 저장: ${movie.title}`);
    }

    console.log(`[저장 완료] 추가: ${added}개 / 중복 스킵: ${skipped}개\n`);

    return res.json({ success: true, added, skipped, total: scraped.length });
  } catch (err) {
    console.error('[스크래핑 오류]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 서버 시작 ────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n[Cineping Scraper Server] 포트 ${PORT} 실행 중`);
  console.log(`  스크래핑 API : POST http://localhost:${PORT}/api/scrape/movies`);
  console.log(`  상태 확인    : GET  http://localhost:${PORT}/health\n`);
});
