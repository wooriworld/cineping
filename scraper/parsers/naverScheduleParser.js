import { chromium } from 'playwright';

/**
 * 특정 영화의 네이버 상영일정 크롤링 (날짜별 전체)
 *
 * 지역 필터: 서울 → 전체 로 변경 후 수집 (첫 번째 날짜에서만 1회 수행)
 * 에러 복구: ._retry 버튼 감지 시 최대 3회 재시도
 */
export async function scrapeMovieSchedules(movie) {
  const { id: movieId, title, naverMovieId } = movie;

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

    const url =
      `https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw` +
      `&pkid=68&os=${naverMovieId}&qvt=0` +
      `&query=${encodeURIComponent(title + ' 상영일정')}`;

    console.log(`  [스케줄] "${title}" 로딩...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. 초기 콘텐츠 로드 대기
    const loaded = await waitForContent(page, title);
    if (!loaded) {
      console.warn(`  [스케줄] "${title}" — 콘텐츠 로드 실패, 빈 결과 반환`);
      return [];
    }

    // ── 날짜 탭 수집 (오늘부터 최대 7일) ────────────────────────
    const dateTabs = await page.$$('button.play_btn_date');
    const dateCount = Math.min(dateTabs.length, 7);
    console.log(`  [스케줄] "${title}" — 날짜 탭 ${dateCount}개 (최대 7일)`);

    const allSchedules = [];

    if (dateCount === 0) {
      // 날짜 탭 없는 경우
      await selectSeoulAll(page, title);
      await waitForContent(page, title, 2);
      allSchedules.push(...(await extractSchedules(page, movieId)));
    } else {
      for (let i = 0; i < dateCount; i++) {
        // 날짜 탭 클릭
        const tabs = await page.$$('button.play_btn_date');
        if (!tabs[i]) break;
        await tabs[i].click();

        // 콘텐츠 갱신 대기
        const ok = await waitForContent(page, title, 2);
        if (!ok) continue;

        // 서울 전체 선택은 첫 번째 날짜에서만
        if (i === 0) {
          await selectSeoulAll(page, title);
          await waitForContent(page, title, 2);
        }

        // 수집
        const list = await extractSchedules(page, movieId);
        allSchedules.push(...list);
        console.log(`  [스케줄] "${title}" 날짜 ${i + 1}: ${list.length}개`);
      }
    }

    console.log(`  [스케줄] "${title}" 완료 — 총 ${allSchedules.length}개`);
    return allSchedules;
  } finally {
    await browser.close();
  }
}

/**
 * 극장 목록 로드 대기. 실패 시 ._retry 버튼 클릭 후 재시도.
 * 고정 sleep 없이 이벤트 기반 대기 사용.
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
      // 재시도 버튼 클릭 후 버튼이 사라질 때까지 대기 (고정 sleep 대신)
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
 * 고정 sleep 대신 각 클릭 후 다음 요소가 visible 해질 때까지 대기.
 */
async function selectSeoulAll(page, title) {
  try {
    const trigger = page.locator('a._select_trigger').first();
    if (!(await trigger.isVisible().catch(() => false))) return;

    await trigger.click();
    // depth1 리스트가 열릴 때까지 대기
    await page.waitForSelector('ul._depth1_list', { state: 'visible', timeout: 3000 }).catch(() => {});

    const seoulBtn = page.locator('ul._depth1_list li[data-kgs-option="서울특별시"] a.item_link').first();
    if (!(await seoulBtn.isVisible().catch(() => false))) {
      await trigger.click(); // 닫기
      return;
    }
    await seoulBtn.click();
    // depth2 리스트가 열릴 때까지 대기
    await page.waitForSelector('ul._depth2_list', { state: 'visible', timeout: 3000 }).catch(() => {});

    const allBtn = page.locator('ul._depth2_list li[data-kgs-option=""] a.item_link').first();
    if (await allBtn.isVisible().catch(() => false)) {
      await allBtn.click();
      // 드롭다운이 닫히고 극장 목록이 갱신될 때까지 대기
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
