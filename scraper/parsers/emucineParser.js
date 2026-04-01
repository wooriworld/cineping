import * as cheerio from 'cheerio';

const EMU_BASE = 'https://www.emuartspace.com';
const EMU_PAGE_URL = `${EMU_BASE}/bbs/m/about_data_view.php?type=about&ep=ep205032292582d223ceaa81&gp=all&item=ad6632918315896c80e7cbf3`;

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
};

/**
 * 에무시네마 페이지에서 상영시간표 이미지 URL을 동적으로 추출
 * 파일명은 주기적으로 바뀌므로 패턴으로만 찾는다.
 * @returns {Promise<string[]>}
 */
async function fetchScheduleImageUrls() {
  const res = await fetch(EMU_PAGE_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`에무시네마 페이지 HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const urls = [];
  $('img[src^="/about/emuartspace/all/"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) urls.push(`${EMU_BASE}${src}`);
  });

  return urls;
}

/**
 * Gemini 응답에서 JSON 배열 추출 (마크다운 코드블록 제거)
 * @param {string} text
 * @returns {{ date: string, time: string, title: string }[]}
 */
function extractJsonFromResponse(text) {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error('[에무시네마] JSON 배열 없음. Gemini 원문:\n', text);
    throw new Error('JSON 배열을 찾지 못했습니다.');
  }
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('[에무시네마] JSON 파싱 실패. 추출된 문자열:\n', match[0]);
    throw new Error(`JSON 파싱 오류: ${e.message}`);
  }
}

/**
 * 에무시네마 상영시간표 이미지를 Gemini로 분석해 스케줄을 반환한다.
 * - 페이지에서 이미지 URL 동적 탐색 (파일명 변경에 무관)
 * - Gemini에게 직접 JSON 추출 요청
 *
 * @returns {Promise<{ imageUrl: string, schedules: { date: string, time: string, title: string }[], error?: string }[]>}
 */
export async function scrapeEmucineSchedules() {
  const imageUrls = await fetchScheduleImageUrls();
  console.log(`[에무시네마] 상영시간표 이미지 ${imageUrls.length}개 발견`);

  if (imageUrls.length === 0) {
    console.warn('[에무시네마] 상영시간표 이미지를 찾지 못했습니다.');
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 환경변수가 없습니다.');

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKst.toISOString().slice(0, 10);

  const prompt = `이 이미지는 에무시네마(Emu Cinema)의 주간 상영시간표입니다.
오늘 날짜는 ${todayStr} 입니다.

이미지에서 모든 상영 일정을 추출해 아래 JSON 배열 형식으로만 응답해주세요.
다른 설명 없이 JSON만 출력하세요.

[
  { "date": "2026-03-26", "time": "09:50", "title": "텐", "subtitle": "", "hall": "1관" },
  { "date": "2026-03-30", "time": "09:50", "title": "극장의 시간들", "subtitle": "*Eng Subtitles", "hall": "1관" }
]

규칙:
- date: YYYY-MM-DD 형식 (오늘 날짜 기준으로 연도 판단)
- time: HH:MM 형식
- title: 영화 제목만
- subtitle: 자막 정보(*Eng Subtitles, *Eng+Kor Subtitles 등), 없으면 빈 문자열
- hall: 이미지 상단 헤더에 표시된 상영관 (예: "1관", "2관"), 없으면 빈 문자열
- "시간표 추후 공지" 또는 시간이 없는 칸은 건너뜀`;

  const results = [];

  for (const imageUrl of imageUrls) {
    console.log(`\n[에무시네마] Gemini 분석 중: ${imageUrl}`);
    try {
      const imgRes = await fetch(imageUrl, { headers: FETCH_HEADERS });
      if (!imgRes.ok) throw new Error(`이미지 다운로드 실패 HTTP ${imgRes.status}`);

      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

      // 50KB 미만은 로고/배너로 간주하고 스킵
      const MIN_SIZE = 50 * 1024;
      if (imgBuffer.byteLength < MIN_SIZE) {
        console.log(`[에무시네마] 스킵 (${Math.round(imgBuffer.byteLength / 1024)}KB — 상영시간표 아님): ${imageUrl}`);
        continue;
      }

      const base64 = imgBuffer.toString('base64');
      const mimeType = imageUrl.toUpperCase().endsWith('.PNG') ? 'image/png' : 'image/jpeg';

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
          }),
        },
      );
      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        throw new Error(`Gemini API HTTP ${geminiRes.status}: ${errText}`);
      }
      const geminiData = await geminiRes.json();
      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const schedules = extractJsonFromResponse(responseText);

      // 로그 출력 (Eng 자막 + 오늘 이후 항목만)
      const todayLog = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const engSchedules = schedules.filter(
        (s) => (s.subtitle ?? '').includes('Eng') && s.date >= todayLog,
      );
      console.log(`\n  상영날짜     | 상영시간 | 제목`);
      console.log(`  -------------|----------|----------------------------`);
      for (const s of engSchedules) {
        console.log(`  ${s.date} | ${s.time.padEnd(5)}  | ${s.title}`);
      }
      console.log(`  → 전체 ${schedules.length}건 중 Eng 자막(오늘 이후) ${engSchedules.length}건`);

      results.push({ imageUrl, schedules });
    } catch (err) {
      console.error(`[에무시네마] Gemini 오류 (${imageUrl}):`, err.message);
      results.push({ imageUrl, schedules: [], error: err.message });
    }
  }

  return results;
}
