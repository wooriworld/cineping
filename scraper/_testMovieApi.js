import * as cheerio from 'cheerio';

const url = 'https://ts-proxy.naver.com/content/qapirender.nhn?_callback=___MovieAPIforPList_key_68_pkid_nexearch_where_9_start_8_display_s1_dsc_so_%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%81%ED%99%94_q&key=MovieAPIforPList&pkid=68&where=nexearch&start=9&display=8&so=s1.dsc&q=%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%81%ED%99%94';

const res = await fetch(url, {
  headers: {
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Referer: 'https://search.naver.com/',
  },
});
const text = await res.text();
const inner = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'));

// \'는 JSON 비표준 → ' 로 치환
const fixed = inner.replace(/\\'/g, "'");
const parsed = JSON.parse(fixed);

console.log('total:', parsed.total, '/ itemCount:', parsed.itemCount);

for (const item of parsed.items) {
  const $ = cheerio.load(item.html);
  const title = $('a.this_text._text').text().trim();
  const poster = $('a.img_box img').attr('src') ?? '';

  let naverMovieId = '';
  $('a[href*="mediaView.nhn"]').each((_, el) => {
    const match = ($(el).attr('href') ?? '').match(/[?&]code=(\d+)/);
    if (match) { naverMovieId = match[1]; return false; }
  });

  console.log({ title, naverMovieId, poster: poster.slice(0, 60) });
}
