/**
 * Firestore 테스트 데이터 시드 스크립트
 * 실행: node scripts/seed.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDmx9CExa5hrye-u3OyLP1WYPJmLoPta84',
  authDomain: 'cineping.firebaseapp.com',
  projectId: 'cineping',
  storageBucket: 'cineping.firebasestorage.app',
  messagingSenderId: '444231705969',
  appId: '1:444231705969:web:f28635003d5bc29e4b42d0',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── 테스트 데이터 ──────────────────────────────────────────────

const MOVIES = [
  {
    id: 'movie-001',
    title: '미키 17',
    naverMovieId: '246735',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-01T09:00:00+09:00',
  },
  {
    id: 'movie-002',
    title: '캡틴 아메리카: 브레이브 뉴 월드',
    naverMovieId: '239783',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-02T10:30:00+09:00',
  },
  {
    id: 'movie-003',
    title: '하얼빈',
    naverMovieId: '253777',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: false,
    createdAt: '2026-03-03T11:00:00+09:00',
  },
  {
    id: 'movie-004',
    title: '인터스텔라 리마스터',
    naverMovieId: '121921',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-04T09:00:00+09:00',
  },
  {
    id: 'movie-005',
    title: '어벤져스: 둠스데이',
    naverMovieId: '260001',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-05T10:00:00+09:00',
  },
  {
    id: 'movie-006',
    title: '베테랑2',
    naverMovieId: '258001',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-06T11:00:00+09:00',
  },
  {
    id: 'movie-007',
    title: '미션 임파서블: 파이널 레코닝',
    naverMovieId: '261002',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-07T09:30:00+09:00',
  },
  {
    id: 'movie-008',
    title: '범죄도시5',
    naverMovieId: '262003',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: false,
    createdAt: '2026-03-08T10:00:00+09:00',
  },
  {
    id: 'movie-009',
    title: '노스페라투',
    naverMovieId: '255004',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-09T13:00:00+09:00',
  },
  {
    id: 'movie-010',
    title: '공조3',
    naverMovieId: '263005',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: false,
    createdAt: '2026-03-10T09:00:00+09:00',
  },
  {
    id: 'movie-011',
    title: '듄: 파트 3',
    naverMovieId: '264006',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-11T14:00:00+09:00',
  },
  {
    id: 'movie-012',
    title: '서울의 봄2',
    naverMovieId: '265007',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: true,
    createdAt: '2026-03-12T10:30:00+09:00',
  },
  {
    id: 'movie-013',
    title: '위키드',
    naverMovieId: '248008',
    poster:
      'https://cdn.cgv.co.kr/cgvpomsfilm/Movie/Thumbnail/Poster/030000/30000994/30000994_320.jpg',
    isTracking: false,
    createdAt: '2026-03-13T11:00:00+09:00',
  },
];

const SCHEDULES = [
  // 미키 17 — CGV
  {
    id: 'sch-001',
    movieId: 'movie-001',
    chain: 'CGV',
    theater: 'CGV 강남',
    date: '2026-03-15',
    startTime: '10:00',
    endTime: '12:30',
    screenType: '4DX',
    availableSeats: 45,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  {
    id: 'sch-002',
    movieId: 'movie-001',
    chain: 'CGV',
    theater: 'CGV 홍대',
    date: '2026-03-15',
    startTime: '14:20',
    endTime: '16:50',
    screenType: 'IMAX',
    availableSeats: 120,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  // 미키 17 — 롯데시네마
  {
    id: 'sch-003',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 월드타워',
    date: '2026-03-15',
    startTime: '18:40',
    endTime: '21:10',
    screenType: 'SUPER PLEX',
    availableSeats: 200,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  // 캡틴 아메리카 — 메가박스
  {
    id: 'sch-004',
    movieId: 'movie-002',
    chain: '메가박스',
    theater: '메가박스 코엑스',
    date: '2026-03-15',
    startTime: '11:00',
    endTime: '13:10',
    screenType: 'MX',
    availableSeats: 80,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  {
    id: 'sch-005',
    movieId: 'movie-002',
    chain: '메가박스',
    theater: '메가박스 코엑스',
    date: '2026-03-15',
    startTime: '20:30',
    endTime: '22:40',
    screenType: '2D',
    availableSeats: 30,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  // 하얼빈 — CGV
  {
    id: 'sch-006',
    movieId: 'movie-003',
    chain: 'CGV',
    theater: 'CGV 용산아이파크몰',
    date: '2026-03-16',
    startTime: '13:00',
    endTime: '15:20',
    screenType: '2D',
    availableSeats: 60,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T10:00:00+09:00',
  },
  // 인터스텔라 리마스터 — CGV IMAX
  {
    id: 'sch-007',
    movieId: 'movie-004',
    chain: 'CGV',
    theater: 'CGV 여의도',
    date: '2026-03-15',
    startTime: '15:00',
    endTime: '17:49',
    screenType: 'IMAX',
    availableSeats: 95,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  // 어벤져스: 둠스데이 — 메가박스
  {
    id: 'sch-008',
    movieId: 'movie-005',
    chain: '메가박스',
    theater: '메가박스 성수',
    date: '2026-03-15',
    startTime: '19:00',
    endTime: '21:30',
    screenType: 'MX',
    availableSeats: 110,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  // 베테랑2 — 롯데시네마
  {
    id: 'sch-009',
    movieId: 'movie-006',
    chain: '롯데시네마',
    theater: '롯데시네마 건대입구',
    date: '2026-03-15',
    startTime: '12:00',
    endTime: '14:10',
    screenType: '2D',
    availableSeats: 55,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  // 미션 임파서블 — CGV
  {
    id: 'sch-010',
    movieId: 'movie-007',
    chain: 'CGV',
    theater: 'CGV 강남',
    date: '2026-03-16',
    startTime: '17:30',
    endTime: '20:00',
    screenType: '4DX',
    availableSeats: 42,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T10:00:00+09:00',
  },
  // 범죄도시5 — 메가박스
  {
    id: 'sch-011',
    movieId: 'movie-008',
    chain: '메가박스',
    theater: '메가박스 강남',
    date: '2026-03-16',
    startTime: '10:30',
    endTime: '12:30',
    screenType: '2D',
    availableSeats: 70,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:30:00+09:00',
  },
  // 노스페라투 — CGV
  {
    id: 'sch-012',
    movieId: 'movie-009',
    chain: 'CGV',
    theater: 'CGV 신촌아트레온',
    date: '2026-03-15',
    startTime: '21:00',
    endTime: '23:10',
    screenType: '2D',
    availableSeats: 38,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T10:00:00+09:00',
  },
  // 공조3 — 롯데시네마
  {
    id: 'sch-013',
    movieId: 'movie-010',
    chain: '롯데시네마',
    theater: '롯데시네마 노원',
    date: '2026-03-16',
    startTime: '14:00',
    endTime: '16:20',
    screenType: '2D',
    availableSeats: 85,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  // 듄: 파트 3 — CGV IMAX
  {
    id: 'sch-014',
    movieId: 'movie-011',
    chain: 'CGV',
    theater: 'CGV 용산아이파크몰',
    date: '2026-03-15',
    startTime: '16:00',
    endTime: '19:00',
    screenType: 'IMAX',
    availableSeats: 130,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  // 서울의 봄2 — 메가박스
  {
    id: 'sch-015',
    movieId: 'movie-012',
    chain: '메가박스',
    theater: '메가박스 코엑스',
    date: '2026-03-16',
    startTime: '18:00',
    endTime: '20:30',
    screenType: 'MX',
    availableSeats: 90,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:30:00+09:00',
  },
  // 위키드 — 롯데시네마
  {
    id: 'sch-016',
    movieId: 'movie-013',
    chain: '롯데시네마',
    theater: '롯데시네마 월드타워',
    date: '2026-03-15',
    startTime: '13:30',
    endTime: '16:10',
    screenType: 'SUPER PLEX',
    availableSeats: 150,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T10:00:00+09:00',
  },

  // ── movie-001 (미키 17) 추가 스케줄 ──────────────────────────────

  // CGV (기존 2개 + 추가 5개 = 총 7개)
  {
    id: 'sch-101',
    movieId: 'movie-001',
    chain: 'CGV',
    theater: 'CGV 강남',
    date: '2026-03-15',
    startTime: '13:10',
    endTime: '15:40',
    screenType: '2D',
    availableSeats: 88,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  {
    id: 'sch-102',
    movieId: 'movie-001',
    chain: 'CGV',
    theater: 'CGV 강남',
    date: '2026-03-15',
    startTime: '20:00',
    endTime: '22:30',
    screenType: '4DX',
    availableSeats: 22,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  {
    id: 'sch-103',
    movieId: 'movie-001',
    chain: 'CGV',
    theater: 'CGV 용산아이파크몰',
    date: '2026-03-15',
    startTime: '11:00',
    endTime: '13:30',
    screenType: 'IMAX',
    availableSeats: 140,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  {
    id: 'sch-104',
    movieId: 'movie-001',
    chain: 'CGV',
    theater: 'CGV 용산아이파크몰',
    date: '2026-03-16',
    startTime: '18:30',
    endTime: '21:00',
    screenType: 'IMAX',
    availableSeats: 75,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },
  {
    id: 'sch-105',
    movieId: 'movie-001',
    chain: 'CGV',
    theater: 'CGV 여의도',
    date: '2026-03-16',
    startTime: '20:10',
    endTime: '22:40',
    screenType: '4DX',
    availableSeats: 35,
    bookingUrl: 'https://www.cgv.co.kr/ticket',
    lastUpdatedAt: '2026-03-14T08:00:00+09:00',
  },

  // 롯데시네마 (기존 1개 + 추가 6개 = 총 7개)
  {
    id: 'sch-106',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 월드타워',
    date: '2026-03-15',
    startTime: '10:00',
    endTime: '12:30',
    screenType: '2D',
    availableSeats: 110,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-107',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 건대입구',
    date: '2026-03-15',
    startTime: '15:00',
    endTime: '17:30',
    screenType: '2D',
    availableSeats: 68,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-108',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 건대입구',
    date: '2026-03-16',
    startTime: '20:30',
    endTime: '23:00',
    screenType: '2D',
    availableSeats: 40,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-109',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 노원',
    date: '2026-03-15',
    startTime: '12:30',
    endTime: '15:00',
    screenType: '2D',
    availableSeats: 92,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-110',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 노원',
    date: '2026-03-16',
    startTime: '16:00',
    endTime: '18:30',
    screenType: '2D',
    availableSeats: 55,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-111',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 잠실',
    date: '2026-03-16',
    startTime: '11:30',
    endTime: '14:00',
    screenType: 'SUPER PLEX',
    availableSeats: 185,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },

  // 메가박스 (신규 7개)
  {
    id: 'sch-112',
    movieId: 'movie-001',
    chain: '메가박스',
    theater: '메가박스 코엑스',
    date: '2026-03-15',
    startTime: '09:30',
    endTime: '12:00',
    screenType: 'MX',
    availableSeats: 100,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  {
    id: 'sch-113',
    movieId: 'movie-001',
    chain: '메가박스',
    theater: '메가박스 코엑스',
    date: '2026-03-15',
    startTime: '17:00',
    endTime: '19:30',
    screenType: 'MX',
    availableSeats: 48,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  {
    id: 'sch-114',
    movieId: 'movie-001',
    chain: '메가박스',
    theater: '메가박스 강남',
    date: '2026-03-15',
    startTime: '12:00',
    endTime: '14:30',
    screenType: '2D',
    availableSeats: 72,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  {
    id: 'sch-115',
    movieId: 'movie-001',
    chain: '메가박스',
    theater: '메가박스 강남',
    date: '2026-03-16',
    startTime: '19:30',
    endTime: '22:00',
    screenType: 'MX',
    availableSeats: 55,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  {
    id: 'sch-116',
    movieId: 'movie-001',
    chain: '메가박스',
    theater: '메가박스 성수',
    date: '2026-03-15',
    startTime: '15:30',
    endTime: '18:00',
    screenType: 'MX',
    availableSeats: 83,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  {
    id: 'sch-117',
    movieId: 'movie-001',
    chain: '메가박스',
    theater: '메가박스 홍대',
    date: '2026-03-16',
    startTime: '14:00',
    endTime: '16:30',
    screenType: '2D',
    availableSeats: 61,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },
  {
    id: 'sch-118',
    movieId: 'movie-001',
    chain: '메가박스',
    theater: '메가박스 신촌',
    date: '2026-03-16',
    startTime: '10:00',
    endTime: '12:30',
    screenType: '2D',
    availableSeats: 45,
    bookingUrl: 'https://www.megabox.co.kr',
    lastUpdatedAt: '2026-03-14T09:00:00+09:00',
  },

  // 미키 17 — 롯데시네마 2026-03-15 추가 7개
  {
    id: 'sch-119',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 월드타워',
    date: '2026-03-15',
    startTime: '08:30',
    endTime: '11:00',
    screenType: '2D',
    availableSeats: 95,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-120',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 잠실',
    date: '2026-03-15',
    startTime: '09:00',
    endTime: '11:30',
    screenType: '2D',
    availableSeats: 78,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-121',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 잠실',
    date: '2026-03-15',
    startTime: '16:00',
    endTime: '18:30',
    screenType: 'SUPER PLEX',
    availableSeats: 160,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-122',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 잠실',
    date: '2026-03-15',
    startTime: '21:00',
    endTime: '23:30',
    screenType: '2D',
    availableSeats: 42,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-123',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 건대입구',
    date: '2026-03-15',
    startTime: '10:30',
    endTime: '13:00',
    screenType: '2D',
    availableSeats: 66,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-124',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 노원',
    date: '2026-03-15',
    startTime: '17:30',
    endTime: '20:00',
    screenType: '2D',
    availableSeats: 50,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
  {
    id: 'sch-125',
    movieId: 'movie-001',
    chain: '롯데시네마',
    theater: '롯데시네마 신림',
    date: '2026-03-15',
    startTime: '14:00',
    endTime: '16:30',
    screenType: '2D',
    availableSeats: 73,
    bookingUrl: 'https://www.lottecinema.co.kr/NLCHS',
    lastUpdatedAt: '2026-03-14T08:30:00+09:00',
  },
];

// ─── 유틸 ────────────────────────────────────────────────────────

async function clearCollection(colName) {
  const snap = await getDocs(collection(db, colName));
  const deletes = snap.docs.map((d) => deleteDoc(doc(db, colName, d.id)));
  await Promise.all(deletes);
  console.log(`  - ${colName} 기존 데이터 ${snap.size}건 삭제`);
}

async function seedCollection(colName, items) {
  for (const item of items) {
    const { id, ...data } = item;
    await setDoc(doc(db, colName, id), data);
  }
  console.log(`  - ${colName} ${items.length}건 삽입 완료`);
}

// ─── 메인 ────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Firestore 시드 시작...\n');

  console.log('[1/2] movies');
  await clearCollection('movies');
  await seedCollection('movies', MOVIES);

  console.log('[2/2] schedules');
  await clearCollection('schedules');
  await seedCollection('schedules', SCHEDULES);

  console.log('\n✅ 시드 완료!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 시드 실패:', err);
  process.exit(1);
});
