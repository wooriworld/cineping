import * as cheerio from 'cheerio';

const KOFA_BASE = 'https://www.koreafilm.or.kr';
const KOFA_SCHEDULE_URL = `${KOFA_BASE}/cinematheque/schedule?keySort=EC`;

const FETCH_HEADERS = {
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
};

const DETAIL_DELAY_MS = 300;

/**
 * 스케줄 페이지에서 영어자막 영화의 { title, moviePath } 추출 (중복 제거)
 * @returns {{ title: string, moviePath: string }[]}
 */
async function scrapeSchedulePage() {
  const res = await fetch(KOFA_SCHEDULE_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`KOFA 스케줄 페이지 HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const seen = new Set();
  const movies = [];

  $('p.txt-1').each((_, el) => {
    if ($(el).find('span.cm-icon-screen-E').length === 0) return;

    const anchor = $(el).find('a').first();
    const title = anchor.text().trim();
    const href = anchor.attr('href') ?? '';

    if (!title || !href || seen.has(href)) return;
    seen.add(href);
    movies.push({ title, moviePath: href });
  });

  return movies;
}

/**
 * 영화 상세 페이지에서 영어 제목과 포스터 URL을 수집한다.
 * @param {string} moviePath  예) /movie/PM_010410
 * @returns {{ englishTitle: string, poster: string }}
 */
async function fetchMovieDetail(moviePath) {
  const url = `${KOFA_BASE}${moviePath}`;
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return { englishTitle: '', poster: '' };

    const html = await res.text();
    const $ = cheerio.load(html);

    const englishTitle = $('.title-wrap p.txt-2').first().text().trim();

    // thumb-wrap의 background-image에서 포스터 URL 추출
    let poster = '';
    const style = $('div.thumb-wrap').first().attr('style') ?? '';
    const match = style.match(/background-image:url\(['"]?([^'")\s]+)['"]?\)/);
    if (match) {
      const src = match[1];
      poster = src.startsWith('http') ? src : `${KOFA_BASE}${src}`;
    }

    return { englishTitle, poster };
  } catch {
    return { englishTitle: '', poster: '' };
  }
}

/**
 * KOFA 시네마테크 스케줄 페이지에서 영어자막 영화의 상영 일정을 파싱한다.
 * dl.list-kofa-calendar-1 구조에서 날짜·상영관·시작시간·상영시간을 수집.
 * @returns {Promise<{ movieTitle: string, date: string, startTime: string, endTime: string, screen: string }[]>}
 */
export async function scrapeKofaSchedules() {
  const res = await fetch(KOFA_SCHEDULE_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`KOFA 스케줄 페이지 HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYear = nowKst.getFullYear();

  const schedules = [];

  // 실제 구조:
  // dl.list-kofa-calendar-1 > dt.txt-month + dd > dl.list-day-1 > dt.txt-day + dd(스케줄)
  $('dl.list-day-1').each((_, dayDl) => {
    // 월: 부모 dl.list-kofa-calendar-1 의 dt.txt-month
    const monthText = $(dayDl)
      .closest('dl.list-kofa-calendar-1')
      .find('> dt.txt-month')
      .first()
      .text()
      .trim();
    const currentMonth = parseInt(monthText.replace('월', ''), 10);
    if (!currentMonth) return;

    // 일: dl.list-day-1 의 dt.txt-day ("28.토" → 28)
    const dayText = $(dayDl).find('> dt.txt-day').first().text().trim();
    const currentDay = parseInt(dayText.split('.')[0], 10);
    if (!currentDay) return;

    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

    $(dayDl)
      .find('> dd')
      .each((_, dd) => {
        const movieTitle = $(dd).find('p.txt-1 a').first().text().trim();
        if (!movieTitle) return;

        const screen = $(dd).find('li.txt-room').first().text().trim();
        const startTime = $(dd).find('span.icon-dot').first().text().trim();
        if (!/^\d{1,2}:\d{2}$/.test(startTime)) return;

        // "러닝타임105분" 형태에서 숫자만 추출
        const minText = $(dd).find('span.min').first().text().trim();
        const minMatch = minText.match(/(\d+)분/);
        const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;

        // 종료 시간 계산
        const [h, m] = startTime.split(':').map(Number);
        const totalMin = h * 60 + m + minutes;
        const endH = Math.floor(totalMin / 60) % 24;
        const endM = totalMin % 60;
        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        schedules.push({ movieTitle, date, startTime, endTime, screen });
      });
  });

  return schedules;
}

/**
 * KOFA 시네마테크 스케줄 페이지에서 영어자막 영화 목록을 수집한다.
 * 스케줄 페이지 파싱 후 상세 페이지에서 영어 제목과 포스터를 추가 수집.
 * @returns {Promise<{ title: string, englishTitle: string, poster: string }[]>}
 */
export async function scrapeKofaMovies() {
  const movies = await scrapeSchedulePage();
  const results = [];
  for (const movie of movies) {
    const { englishTitle, poster } = await fetchMovieDetail(movie.moviePath);
    const kofaId = movie.moviePath.split('/').pop() ?? '';
    results.push({ title: movie.title, englishTitle, poster, kofaId });
    await new Promise((r) => setTimeout(r, DETAIL_DELAY_MS));
  }

  return results;
}
