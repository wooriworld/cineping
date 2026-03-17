import { chromium } from 'playwright';

const SEARCH_URL =
  'https://search.naver.com/search.naver?where=nexearch&query=%ED%98%84%EC%9E%AC+%EC%83%81%EC%98%81+%EC%98%81%ED%99%94';

/**
 * 네이버 현재 상영 영화 크롤링
 * @returns {{ title: string, poster: string, naverMovieId: string }[]}
 *
 * HTML 구조 (확인된 실제 구조):
 *   div.card_item
 *     div.data_area
 *       a.img_box > img          ← 포스터 (src), href에 os=XXXXXXX (naverMovieId)
 *       div.data_box
 *         div.title > div.area_text_box > a.this_text._text  ← 제목
 *
 * 페이지네이션: < 1/8 > 형태의 이전/다음 버튼
 */
export async function scrapeNaverMovies() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    await page.setViewportSize({ width: 1280, height: 900 });

    console.log('[naverParser] 페이지 로딩...');
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 영화 카드가 로드될 때까지 대기
    await page
      .waitForSelector('.card_item', { timeout: 15000 })
      .catch(() => console.warn('[naverParser] .card_item 대기 타임아웃, 계속 진행'));

    // "현재상영영화" 탭 클릭 (기본 선택이 아닌 경우 대비)
    const tab = page.locator('a:has-text("현재상영영화"), button:has-text("현재상영영화")').first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await page.waitForSelector('.card_item', { timeout: 10000 }).catch(() => {});
      console.log('[naverParser] "현재상영영화" 탭 클릭 완료');
    }

    const allMovies = [];
    let pageNum = 1;
    const MAX_PAGES = 20; // 8페이지까지지만 넉넉하게

    while (pageNum <= MAX_PAGES) {
      console.log(`[naverParser] ${pageNum}페이지 수집 중...`);

      const pageMovies = await extractMoviesFromPage(page);
      if (pageMovies.length === 0) {
        console.log('[naverParser] 영화 카드 없음, 종료');
        break;
      }

      allMovies.push(...pageMovies);
      console.log(`[naverParser] ${pageNum}페이지: ${pageMovies.length}개 추출`);

      const moved = await goToNextPage(page);
      if (!moved) break;

      pageNum++;
      await page.waitForTimeout(1000);
    }

    console.log(`[naverParser] 총 ${allMovies.length}개 수집 완료`);
    return allMovies;
  } finally {
    await browser.close();
  }
}

/**
 * 현재 페이지의 .card_item 에서 제목·포스터·ID 추출
 */
async function extractMoviesFromPage(page) {
  return await page.evaluate(() => {
    const cards = document.querySelectorAll('.card_item');
    if (cards.length === 0) return [];

    const results = [];

    for (const card of cards) {
      // ── 제목 ─────────────────────────────────────────────────
      const titleEl = card.querySelector('a.this_text._text');
      const title = titleEl?.textContent?.trim();
      if (!title) continue;

      // ── 포스터 URL ────────────────────────────────────────────
      const imgEl = card.querySelector('a.img_box img');
      const poster = imgEl?.getAttribute('src') || '';

      // ── naverMovieId (movie.naver.com mediaView.nhn 의 code= 파라미터) ──
      let naverMovieId = '';
      const anchors = card.querySelectorAll('a[href*="mediaView.nhn"]');
      for (const a of anchors) {
        const match = (a.getAttribute('href') || '').match(/[?&]code=(\d+)/);
        if (match) {
          naverMovieId = match[1];
          break;
        }
      }

      results.push({ title, poster, naverMovieId });
    }

    return results;
  });
}

/**
 * 다음 페이지로 이동. 성공 시 true, 마지막 페이지면 false.
 *
 * 네이버 페이지네이션 실제 구조:
 *   <div class="cm_paging_area _page">
 *     <div class="pgs">
 *       <a class="pg_prev _prev" aria-disabled="true">이전</a>
 *       <span class="npgs">
 *         <strong class="npgs_now _current">1</strong>
 *         <span class="_total">8</span>
 *       </span>
 *       <a class="pg_next on _next" aria-disabled="false">다음</a>
 *     </div>
 *   </div>
 */
async function goToNextPage(page) {
  // 현재/전체 페이지 확인
  const { current, total } = await page.evaluate(() => {
    const currentEl = document.querySelector('strong.npgs_now._current, strong._current');
    const totalEl = document.querySelector('span._total');
    return {
      current: parseInt(currentEl?.textContent?.trim() ?? '0', 10),
      total: parseInt(totalEl?.textContent?.trim() ?? '0', 10),
    };
  });

  if (total > 0) {
    console.log(`[naverParser] 페이지 ${current}/${total}`);
    if (current >= total) {
      console.log('[naverParser] 마지막 페이지 도달');
      return false;
    }
  }

  // 다음 버튼 aria-disabled 확인 후 클릭
  const nextBtn = page.locator('a.pg_next._next').first();

  if (!(await nextBtn.isVisible().catch(() => false))) {
    return false;
  }

  const isDisabled = (await nextBtn.getAttribute('aria-disabled').catch(() => 'true')) === 'true';
  if (isDisabled) {
    console.log('[naverParser] 다음 버튼 비활성화 — 마지막 페이지');
    return false;
  }

  await nextBtn.click();
  await page.waitForSelector('.card_item', { timeout: 8000 }).catch(() => {});
  return true;
}
