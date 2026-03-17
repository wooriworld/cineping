import { chromium } from 'playwright';

/**
 * 특정 영화의 네이버 상영일정 크롤링 (날짜별 병렬 수집)
 *
 * 페이지 7개를 동시에 열고 각 페이지에서 인덱스 기준으로 날짜 탭 클릭
 */
export async function scrapeMovieSchedules(movie) {
  const { id: movieId, title, naverMovieId } = movie;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const url =
      `https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw` +
      `&pkid=68&os=${naverMovieId}&qvt=0` +
      `&query=${encodeURIComponent(title + ' 상영일정')}`;

    // ── Step 1. 페이지 7개 동시 오픈 + URL 로드 ──────────────────
    const MAX_DATES = 7;
    const pages = await Promise.all(
      Array.from({ length: MAX_DATES }, () => openPage(browser)),
    );

    console.log(`  [스케줄] "${title}" — ${MAX_DATES}개 페이지 병렬 로딩...`);
    await Promise.all(
      pages.map((p) => p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })),
    );

    // ── Step 2. 초기 콘텐츠 로드 대기 (병렬) ─────────────────────
    const loadResults = await Promise.all(pages.map((p) => waitForContent(p, title)));

    // 첫 번째 성공 페이지에서 실제 날짜 탭 수 확인
    const firstOk = loadResults.findIndex(Boolean);
    if (firstOk === -1) {
      console.warn(`  [스케줄] "${title}" — 콘텐츠 로드 실패`);
      await Promise.all(pages.map((p) => p.close()));
      return [];
    }

    const dateCount = Math.min(
      await pages[firstOk].$$eval('button.play_btn_date', (btns) => btns.length),
      MAX_DATES,
    );
    console.log(`  [스케줄] "${title}" — 날짜 탭 ${dateCount}개 병렬 수집 시작`);

    // 사용하지 않는 페이지 닫기
    await Promise.all(pages.slice(dateCount).map((p) => p.close()));

    if (dateCount === 0) {
      // 날짜 탭 없는 경우: 첫 페이지에서 단일 수집
      const page = pages[0];
      await selectSeoulAll(page, title);
      await waitForContent(page, title, 2);
      const result = await extractSchedules(page, movieId);
      await page.close();
      return result;
    }

    // ── Step 3. 각 페이지에서 날짜 탭 클릭 + 수집 (병렬) ─────────
    const results = await Promise.all(
      pages.slice(0, dateCount).map((page, i) =>
        scrapeDateOnPage(page, title, movieId, i, loadResults[i]),
      ),
    );

    const allSchedules = results.flat();
    console.log(`  [스케줄] "${title}" 완료 — 총 ${allSchedules.length}개`);
    return allSchedules;
  } finally {
    await browser.close();
  }
}

/**
 * 특정 페이지에서 i번째 날짜 탭 클릭 후 수집
 */
async function scrapeDateOnPage(page, title, movieId, i, initiallyLoaded) {
  try {
    if (!initiallyLoaded) return [];

    const tabs = await page.$$('button.play_btn_date');
    if (!tabs[i]) return [];

    await tabs[i].click();
    const ok = await waitForContent(page, title, 2);
    if (!ok) return [];

    await selectSeoulAll(page, title);
    await waitForContent(page, title, 2);

    const list = await extractSchedules(page, movieId);
    console.log(`  [스케줄] "${title}" 날짜 ${i + 1}: ${list.length}개`);
    return list;
  } catch (err) {
    console.warn(`  [스케줄] "${title}" 날짜 ${i + 1} 오류: ${err.message}`);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * 공통 헤더/뷰포트가 설정된 새 페이지 생성
 */
async function openPage(browser) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  return page;
}

/**
 * 극장 목록 로드 대기. 실패 시 ._retry 버튼 클릭 후 재시도.
 */
async function waitForContent(page, title, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const found = await page
      .waitForSelector('li._scrolling_wrapper', { timeout: 6000 })
      .then(() => true)
      .catch(() => false);

    if (found) return true;

    const retryBtn = page.locator('button._retry').first();
    if (await retryBtn.isVisible().catch(() => false)) {
      console.warn(`  [스케줄] "${title}" — 에러 감지, 새로고침 시도 (${attempt}/${maxRetries})`);
      await retryBtn.click();
      await page.waitForSelector('button._retry', { state: 'hidden', timeout: 3000 }).catch(() => {});
    } else {
      console.warn(`  [스케줄] "${title}" — 극장 목록 없음 (상영 종료 또는 데이터 없음)`);
      return false;
    }
  }
  return false;
}

/**
 * 지역 필터를 서울 → 전체 로 변경.
 */
async function selectSeoulAll(page, title) {
  try {
    const trigger = page.locator('a._select_trigger').first();
    if (!(await trigger.isVisible().catch(() => false))) return;

    await trigger.click();
    await page.waitForSelector('ul._depth1_list', { state: 'visible', timeout: 3000 }).catch(() => {});

    const seoulBtn = page.locator('ul._depth1_list li[data-kgs-option="서울특별시"] a.item_link').first();
    if (!(await seoulBtn.isVisible().catch(() => false))) {
      await trigger.click();
      return;
    }
    await seoulBtn.click();
    await page.waitForSelector('ul._depth2_list', { state: 'visible', timeout: 3000 }).catch(() => {});

    const allBtn = page.locator('ul._depth2_list li[data-kgs-option=""] a.item_link').first();
    if (await allBtn.isVisible().catch(() => false)) {
      await allBtn.click();
      await page.waitForSelector('ul._depth2_list', { state: 'hidden', timeout: 3000 }).catch(() => {});
      console.log(`  [스케줄] "${title}" — 지역: 서울 전체 선택 완료`);
    }
  } catch (err) {
    console.warn(`  [스케줄] "${title}" — 지역 필터 변경 실패: ${err.message}`);
  }
}

/**
 * 현재 페이지의 모든 극장/회차 데이터 추출
 */
async function extractSchedules(page, movieId) {
  const lastUpdatedAt = new Date().toISOString();

  const raw = await page.evaluate(() => {
    const results = [];

    document.querySelectorAll('li._scrolling_wrapper').forEach((theaterEl) => {
      const theaterName = theaterEl.querySelector('a.this_link_place')?.textContent?.trim() ?? '';
      if (!theaterName) return;

      theaterEl.querySelectorAll('li._time_check').forEach((item) => {
        const bookingUrl = item.querySelector('a.area_link')?.getAttribute('href') ?? '';
        let chain = '';
        if (bookingUrl.includes('megabox.co.kr') || theaterName.startsWith('메가박스')) {
          chain = '메가박스';
        } else if (bookingUrl.includes('cgv.co.kr') || theaterName.startsWith('CGV')) {
          chain = 'CGV';
        } else if (
          bookingUrl.includes('lottecinema.co.kr') ||
          theaterName.startsWith('롯데시네마')
        ) {
          chain = '롯데시네마';
        } else if (theaterName.startsWith('씨네Q')) {
          chain = '씨네Q';
        }

        const date = (item.getAttribute('data-time') ?? '').substring(0, 10);
        const timeEl = item.querySelector('dd.this_text_time');
        const startTime = timeEl?.querySelector('span.this_point_big')?.textContent?.trim() ?? '';
        const endTime = (timeEl?.textContent?.trim() ?? '').split('~')[1]?.trim() ?? '';
        const screenType = item.querySelector('dd.this_text_place')?.textContent?.trim() ?? '';

        if (!date || !startTime) return;

        results.push({ chain, theater: theaterName, date, startTime, endTime, screenType, bookingUrl });
      });
    });

    return results;
  });

  return raw.map((s) => ({ ...s, movieId, lastUpdatedAt }));
}
