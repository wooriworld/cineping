import { chromium } from 'playwright';

/**
 * 특정 영화의 네이버 상영일정 크롤링 (날짜별 병렬 수집)
 *
 * 1. 첫 페이지에서 날짜 탭 목록 수집 + 서울 전체 선택
 * 2. 날짜별 페이지를 동시에 열어 병렬 수집
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

    // ── Step 1. 첫 페이지에서 날짜 탭 목록 수집 ──────────────────
    console.log(`  [스케줄] "${title}" 날짜 탭 수집 중...`);
    const dateDates = await getDateTabs(browser, url, title);

    if (dateDates.length === 0) {
      console.warn(`  [스케줄] "${title}" — 날짜 탭 없음, 단일 페이지로 수집`);
      const page = await openPage(browser);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const loaded = await waitForContent(page, title);
      if (!loaded) return [];
      await selectSeoulAll(page, title);
      await waitForContent(page, title, 2);
      const result = await extractSchedules(page, movieId);
      await page.close();
      return result;
    }

    console.log(`  [스케줄] "${title}" — ${dateDates.length}개 날짜 병렬 수집 시작`);

    // ── Step 2. 날짜별 페이지를 병렬로 열어 수집 ─────────────────
    const results = await Promise.all(
      dateDates.map((dateValue, i) => scrapeDate(browser, url, title, movieId, dateValue, i)),
    );

    const allSchedules = results.flat();
    console.log(`  [스케줄] "${title}" 완료 — 총 ${allSchedules.length}개`);
    return allSchedules;
  } finally {
    await browser.close();
  }
}

/**
 * 첫 페이지를 열어 날짜 탭의 data-kgs-option 값 목록을 반환
 */
async function getDateTabs(browser, url, title) {
  const page = await openPage(browser);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loaded = await waitForContent(page, title);
    if (!loaded) return [];

    // 날짜 탭의 부모 li[data-kgs-option] 에서 날짜값 수집
    const dates = await page.$$eval(
      'li[data-kgs-option] button.play_btn_date',
      (btns) =>
        btns
          .slice(0, 7)
          .map((btn) => btn.closest('li[data-kgs-option]')?.getAttribute('data-kgs-option') ?? '')
          .filter(Boolean),
    );

    return dates;
  } finally {
    await page.close();
  }
}

/**
 * 특정 날짜의 스케줄을 단일 페이지에서 수집
 */
async function scrapeDate(browser, url, title, movieId, dateValue, index) {
  const page = await openPage(browser);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const loaded = await waitForContent(page, title);
    if (!loaded) return [];

    // 해당 날짜 탭 클릭
    const tab = page.locator(`li[data-kgs-option="${dateValue}"] button.play_btn_date`).first();
    if (!(await tab.isVisible().catch(() => false))) return [];
    await tab.click();

    const ok = await waitForContent(page, title, 2);
    if (!ok) return [];

    // 서울 전체 선택
    await selectSeoulAll(page, title);
    await waitForContent(page, title, 2);

    const list = await extractSchedules(page, movieId);
    console.log(`  [스케줄] "${title}" 날짜 ${index + 1} (${dateValue}): ${list.length}개`);
    return list;
  } catch (err) {
    console.warn(`  [스케줄] "${title}" 날짜 ${index + 1} 오류: ${err.message}`);
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
