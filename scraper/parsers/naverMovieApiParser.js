import * as cheerio from 'cheerio';

const NAVER_MOVIE_API_URL = 'https://ts-proxy.naver.com/content/qapirender.nhn?_callback=___MovieAPIforPList_key_68_pkid_nexearch_where_9_start_8_display_s1_dsc_so_%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%81%ED%99%94_q&key=MovieAPIforPList&pkid=68&where=nexearch&start=1&display=20&so=s1.dsc&q=%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%81%ED%99%94';
const DISPLAY = 20;

const NAVER_SEARCH_URL = 'https://search.naver.com/search.naver';
const SEARCH_HEADERS = {
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  Referer: 'https://www.naver.com/',
};

async function fetchNaverMovieIdBySearch(title) {
  const params = new URLSearchParams({ where: 'nexearch', pkid: '68', query: title });
  try {
    const res = await fetch(`${NAVER_SEARCH_URL}?${params}`, { headers: SEARCH_HEADERS });
    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);
    return $('[data-did="NCOMOVIE"]').first().attr('data-cid') ?? '';
  } catch {
    return '';
  }
}

async function fetchPage(start, display) {
  const url = new URL(NAVER_MOVIE_API_URL);
  url.searchParams.set('start', String(start));
  url.searchParams.set('display', String(display));

  const res = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://search.naver.com/',
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const inner = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'));
  const fixed = inner.replace(/\\'/g, "'");
  return JSON.parse(fixed);
}

function parseItems(items) {
  const movies = [];
  for (const item of items) {
    const $ = cheerio.load(item.html);
    $('.card_item').each((_, card) => {
      const $card = $(card);
      const title = $card.find('a.this_text._text').text().trim();
      if (!title) return;

      const poster = $card.find('a.img_box img').attr('src') ?? '';

      let naverMovieId = '';
      $card.find('a[href*="mediaView.nhn"]').each((_, el) => {
        const match = ($(el).attr('href') ?? '').match(/[?&]code=(\d+)/);
        if (match) {
          naverMovieId = match[1];
          return false;
        }
      });

      let releaseDate = '';
      $card.find('dl.info_group').each((_, dl) => {
        const dtText = $(dl).find('dt').first().text().trim();
        if (dtText === '개봉' || dtText === '재개봉') {
          releaseDate = $(dl).find('dd').first().text().trim().replace(/\.$/, '');
          return false;
        }
      });

      movies.push({ title, naverMovieId, poster, releaseDate });
    });
  }
  return movies;
}

export async function scrapeMoviesViaApi() {
  const first = await fetchPage(1, DISPLAY);
  const total = parseInt(String(first.total), 10) || 0;
  const movies = parseItems(first.items);

  if (total > DISPLAY) {
    const starts = [];
    for (let s = DISPLAY + 1; s <= total; s += DISPLAY) starts.push(s);

    const pages = await Promise.all(starts.map((s) => fetchPage(s, DISPLAY)));
    for (const page of pages) {
      movies.push(...parseItems(page.items));
    }
  }

  // API에서 중복 항목이 내려오는 경우 제거
  const seen = new Set();
  const unique = movies.filter((m) => {
    const key = m.naverMovieId || m.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[MovieAPI] 총 ${total}개 중 ${unique.length}개 파싱 완료 (중복 ${movies.length - unique.length}개 제거)`);

  // naverMovieId 미수집 항목 → 검색 페이지에서 data-cid 보완
  const missing = unique.filter((m) => !m.naverMovieId);
  if (missing.length > 0) {
    console.log(`[MovieAPI] naverMovieId 미수집 ${missing.length}개 — 검색 페이지에서 보완 시도...`);
    for (const movie of missing) {
      const cid = await fetchNaverMovieIdBySearch(movie.title);
      if (cid) {
        movie.naverMovieId = cid;
        console.log(`  + "${movie.title}" → ${cid}`);
      } else {
        console.warn(`  ! "${movie.title}" — naverMovieId 찾지 못함`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return unique;
}
