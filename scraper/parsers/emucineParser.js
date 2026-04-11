import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

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
  const cleaned = text
    .replace(/```(?:json)?\n?/g, '')
    .replace(/```/g, '')
    .trim();
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
 * 이미지 버퍼의 SHA-256 해시를 반환한다.
 * @param {Buffer} buffer
 * @returns {string}
 */
function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Supabase 캐시에서 이미지 해시로 스케줄을 조회한다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} imageHash
 * @returns {Promise<{ date: string, time: string, title: string }[] | null>}
 */
async function getCachedSchedules(supabase, imageHash) {
  const { data, error } = await supabase
    .from('emucine_image_cache')
    .select('schedules')
    .eq('imageHash', imageHash)
    .maybeSingle();
  if (error) {
    console.warn('[에무시네마] 캐시 조회 오류:', error.message);
    return null;
  }
  return data?.schedules ?? null;
}

/**
 * Supabase 캐시에 이미지 해시와 파싱 결과를 저장한다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} imageHash
 * @param {string} imageUrl
 * @param {{ date: string, time: string, title: string }[]} schedules
 */
async function setCachedSchedules(supabase, imageHash, imageUrl, schedules) {
  const { error } = await supabase.from('emucine_image_cache').upsert(
    { imageHash, imageUrl, schedules, cachedAt: new Date().toISOString() },
    { onConflict: 'imageHash' },
  );
  if (error) {
    console.warn('[에무시네마] 캐시 저장 오류:', error.message);
  }
}

/**
 * 에무시네마 상영시간표 이미지를 Gemini로 분석해 스케줄을 반환한다.
 * - 이미지 SHA-256 해시를 Supabase 캐시와 비교해 동일하면 Gemini 호출을 건너뜀
 * - 페이지에서 이미지 URL 동적 탐색 (파일명 변경에 무관)
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ imageUrl: string, schedules: { date: string, time: string, title: string }[], error?: string }[]>}
 */
export async function scrapeEmucineSchedules(supabase) {
  const imageUrls = await fetchScheduleImageUrls();
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
    try {
      const imgRes = await fetch(imageUrl, { headers: FETCH_HEADERS });
      if (!imgRes.ok) throw new Error(`이미지 다운로드 실패 HTTP ${imgRes.status}`);

      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

      // 50KB 미만은 로고/배너로 간주하고 스킵
      const MIN_SIZE = 50 * 1024;
      if (imgBuffer.byteLength < MIN_SIZE) {
        continue;
      }

      // ── 캐시 확인 ────────────────────────────────────────────────
      const imageHash = sha256(imgBuffer);
      const cached = await getCachedSchedules(supabase, imageHash);
      if (cached) {
        console.log(`[에무시네마] 캐시 HIT — Gemini 호출 생략 (${imageUrl})`);
        results.push({ imageUrl, schedules: cached, fromCache: true });
        continue;
      }

      // ── Gemini 호출 ──────────────────────────────────────────────
      const base64 = imgBuffer.toString('base64');
      const mimeType = imageUrl.toUpperCase().endsWith('.PNG') ? 'image/png' : 'image/jpeg';

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] },
            ],
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

      // ── 캐시 저장 ────────────────────────────────────────────────
      await setCachedSchedules(supabase, imageHash, imageUrl, schedules);
      console.log(`[에무시네마] Gemini 분석 완료 → 캐시 저장 (${imageUrl})`);

      results.push({ imageUrl, schedules });
    } catch (err) {
      console.error(`[에무시네마] Gemini 오류 (${imageUrl}):`, err.message);
      results.push({ imageUrl, schedules: [], error: err.message });
    }
  }

  return results;
}
