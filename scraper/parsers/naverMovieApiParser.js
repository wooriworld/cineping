import * as cheerio from 'cheerio';

const DISPLAY = 20;

async function fetchPage(inputUrl, start, display) {
  const url = new URL(inputUrl);
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
    const title = $('a.this_text._text').text().trim();
    if (!title) continue;

    const poster = $('a.img_box img').attr('src') ?? '';

    let naverMovieId = '';
    $('a[href*="mediaView.nhn"]').each((_, el) => {
      const match = ($(el).attr('href') ?? '').match(/[?&]code=(\d+)/);
      if (match) {
        naverMovieId = match[1];
        return false;
      }
    });

    movies.push({ title, naverMovieId, poster });
  }
  return movies;
}

export async function scrapeMoviesViaApi(inputUrl) {
  const first = await fetchPage(inputUrl, 1, DISPLAY);
  const total = parseInt(String(first.total), 10) || 0;
  const movies = parseItems(first.items);

  if (total > DISPLAY) {
    const starts = [];
    for (let s = DISPLAY + 1; s <= total; s += DISPLAY) starts.push(s);

    const pages = await Promise.all(starts.map((s) => fetchPage(inputUrl, s, DISPLAY)));
    for (const page of pages) {
      movies.push(...parseItems(page.items));
    }
  }

  console.log(`[MovieAPI] 총 ${total}개 중 ${movies.length}개 파싱 완료`);
  return movies;
}
