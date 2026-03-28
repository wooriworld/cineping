import * as cheerio from 'cheerio';

const SCHEDULE_API = 'https://ts-proxy.naver.com/dcontent/nqapirender.nhn';

const FETCH_HEADERS = {
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://search.naver.com/',
};

/**
 * 오늘부터 7일치 날짜 배열 반환 (YYYY-MM-DD)
 */
function getNext7Dates() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * 네이버 스케줄 API 직접 호출 → items 배열 반환
 * 응답 구조: { key, scheduleDates, items: [{ date, html }, ...] }
 */
const FETCH_TIMEOUT_MS = 10_000; // 10초

async function fetchScheduleItems(title, sourceId, date) {
  const params = new URLSearchParams({
    where: 'nexearch',
    pkid: '68',
    key: 'MovieAPIforScheduleListKB',
    _callback: 'cb',
    u9: title,
    u2: sourceId,
    u3: date,
    u4: '서울특별시',
    u5: '',
    u6: '',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${SCHEDULE_API}?${params}`, { headers: FETCH_HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`NAVER API ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  // JSONP 언래핑: cb({...})
  const inner = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'));
  const parsed = JSON.parse(inner);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

/**
 * items 배열 파싱 → 스케줄 배열 반환
 * 각 item: { date: 'YYYY-MM-DD', html: '여러 <li class="_scrolling_wrapper"> 연결된 문자열' }
 */
function parseItems(items, movieId) {
  const results = [];
  const lastUpdatedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();

  for (const item of items) {
    const date = item.date ?? '';
    const $ = cheerio.load(`<ul>${item.html ?? ''}</ul>`);

    $('li._scrolling_wrapper').each((_, theaterEl) => {
      const theaterName = $(theaterEl).find('a.this_link_place').text().trim();
      if (!theaterName) return;

      $(theaterEl).find('li._time_check').each((_, timeEl) => {
        const bookingUrl = $(timeEl).find('a.area_link').attr('href') ?? '';

        let chain = '';
        if (bookingUrl.includes('megabox.co.kr') || theaterName.startsWith('메가박스')) chain = '메가박스';
        else if (bookingUrl.includes('cgv.co.kr') || theaterName.startsWith('CGV')) chain = 'CGV';
        else if (bookingUrl.includes('lottecinema.co.kr') || theaterName.startsWith('롯데시네마')) chain = '롯데시네마';
        else if (theaterName.startsWith('씨네Q')) chain = '씨네Q';

        const itemDate = ($(timeEl).attr('data-time') ?? '').slice(0, 10) || date;
        const timeContainer = $(timeEl).find('dd.this_text_time');
        const startTime = timeContainer.find('span.this_point_big').text().trim();
        const endTime = (timeContainer.text().trim().split('~')[1] ?? '').trim();
        const screenType = $(timeEl).find('dd.this_text_place').text().trim();

        if (!startTime) return;

        results.push({
          chain, theater: theaterName, date: itemDate,
          startTime, endTime, screenType, bookingUrl,
          movieId, lastUpdatedAt,
        });
      });
    });
  }

  return results;
}

/**
 * 특정 영화의 상영일정을 API 직접 호출로 수집
 * Playwright 없이 7일 병렬 HTTP 요청
 */
export async function scrapeMovieSchedulesViaApi(movie) {
  const { id: movieId, title, sourceId } = movie;
  const dates = getNext7Dates();

  console.log(`  [API 스케줄] "${title}" — 7일 병렬 요청...`);

  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const items = await fetchScheduleItems(title, sourceId, date);
        const list = parseItems(items, movieId);
        console.log(`  [API 스케줄] "${title}" ${date}: ${list.length}개`);
        return list;
      } catch (err) {
        const reason = err.name === 'AbortError' ? '타임아웃(20s)' : err.message;
        console.warn(`  [API 스케줄] "${title}" ${date} 오류: ${reason}`);
        return [];
      }
    }),
  );

  const allSchedules = results.flat();
  console.log(`  [API 스케줄] "${title}" 완료 — 총 ${allSchedules.length}개`);
  return allSchedules;
}
