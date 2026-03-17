import * as cheerio from 'cheerio';

const NAVER_MOVIE_API_URL = 'https://ts-proxy.naver.com/content/qapirender.nhn?_callback=___MovieAPIforPList_key_68_pkid_nexearch_where_9_start_8_display_s1_dsc_so_%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%81%ED%99%94_q&key=MovieAPIforPList&pkid=68&where=nexearch&start=1&display=20&so=s1.dsc&q=%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%81%ED%99%94';
const DISPLAY = 20;

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
    // item.html 안에 .card_item 여러 개가 연결되어 있음
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

      movies.push({ title, naverMovieId, poster });
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

  console.log(`[MovieAPI] 총 ${total}개 중 ${movies.length}개 파싱 완료`);
  return movies;
}
