import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { scrapeMovieSchedulesViaApi } from './parsers/naverScheduleApiParser.js';
import { scrapeMoviesViaApi } from './parsers/naverMovieApiParser.js';

// ── 환경변수 검증 ──────────────────────────────────────────────────
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[오류] 환경변수 ${key} 가 설정되지 않았습니다.`);
    process.exit(1);
  }
}

// ── Telegram 알림 ─────────────────────────────────────────────────
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
const MOVIES_URL = 'https://cheadev5831.github.io/cineping/#';


async function sendTelegramMessage(text) {
  try {
    const res = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('[Telegram 오류]', err.description ?? res.status);
    }
  } catch (err) {
    console.error('[Telegram 오류]', err.message);
  }
}

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── 영화 수집 ──────────────────────────────────────────────────────
async function runMovieScrape() {
  const start = Date.now();
  console.log('\n[API 영화 수집 시작]');
  const scraped = await scrapeMoviesViaApi();
  console.log(`[크롤링 완료] ${scraped.length}개 영화 파싱`);

  if (scraped.length === 0) {
    return { added: 0, skipped: 0, total: 0, addedTitles: [] };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('movies')
    .select('id, title, englishTitle');
  if (fetchErr) throw new Error(fetchErr.message);

  const existingMap = new Map(existing.map((m) => [m.title, m]));
  let added = 0;
  let skipped = 0;
  const addedTitles = [];
  const addedNaverMovieIds = [];

  for (const movie of scraped) {
    const existingMovie = existingMap.get(movie.title);

    if (existingMovie) {
      if (movie.englishTitle && !existingMovie.englishTitle) {
        const { error: updErr } = await supabase
          .from('movies')
          .update({ englishTitle: movie.englishTitle })
          .eq('id', existingMovie.id);
        if (updErr) throw new Error(updErr.message);
        console.log(`  ~ 영어 제목 업데이트: ${movie.title} → ${movie.englishTitle}`);
      }
      skipped++;
      continue;
    }

    const { error } = await supabase.from('movies').insert({
      title: movie.title,
      englishTitle: movie.englishTitle || '',
      naverMovieId: movie.naverMovieId || '',
      poster: movie.poster || '',
      releaseDate: movie.releaseDate || '',
      createdAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);

    existingMap.set(movie.title, { id: '', title: movie.title, englishTitle: movie.englishTitle });
    addedTitles.push(movie.title);
    if (movie.naverMovieId) addedNaverMovieIds.push(movie.naverMovieId);
    added++;
    console.log(`  + 저장: ${movie.title}`);
  }

  const elapsed = Date.now() - start;
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  console.log(
    `[영화 저장 완료] 추가: ${added}개 / 중복 스킵: ${skipped}개 (소요: ${m}분 ${s}초)\n`,
  );

  return { added, skipped, total: scraped.length, addedTitles, addedNaverMovieIds };
}

// ── 스케줄 수집 ────────────────────────────────────────────────────
async function runScheduleScrape(movies) {
  const start = Date.now();
  console.log('\n[스케줄 수집 시작]');
  console.log(`[대상 영화] ${movies.length}개`);

  let schedulesAdded = 0;
  const errors = [];
  const CHUNK = 100;
  const DELAY_MS = 1500;
  const updatedMovies = [];
  const scheduleKey = (s) => `${s.date}_${s.theater}_${s.startTime}`;

  for (const movie of movies) {
    const movieStart = Date.now();
    try {
      const scraped = await scrapeMovieSchedulesViaApi(movie);

      const { data: existing, error: exErr } = await supabase
        .from('schedules')
        .select('*')
        .eq('movieId', movie.id)
        .limit(10000);
      if (exErr) throw new Error(exErr.message);

      const existingMap = new Map(existing.map((s) => [scheduleKey(s), s]));
      const scrapedKeySet = new Set(scraped.map(scheduleKey));

      const toAdd = [];
      const toUpdate = [];

      for (const s of scraped) {
        const key = scheduleKey(s);
        const ex = existingMap.get(key);
        if (!ex) {
          toAdd.push(s);
        } else if (
          s.endTime !== ex.endTime ||
          s.screenType !== ex.screenType ||
          s.bookingUrl !== ex.bookingUrl ||
          s.chain !== ex.chain
        ) {
          toUpdate.push({
            id: ex.id,
            data: {
              endTime: s.endTime,
              screenType: s.screenType,
              bookingUrl: s.bookingUrl,
              chain: s.chain,
              lastUpdatedAt: s.lastUpdatedAt,
            },
          });
        }
      }

      const toDeleteIds = existing
        .filter((s) => !scrapedKeySet.has(scheduleKey(s)))
        .map((s) => s.id);

      for (let i = 0; i < toDeleteIds.length; i += CHUNK) {
        const { error: delErr } = await supabase
          .from('schedules')
          .delete()
          .in('id', toDeleteIds.slice(i, i + CHUNK));
        if (delErr) throw new Error(delErr.message);
      }

      for (const { id, data } of toUpdate) {
        const { error: updErr } = await supabase.from('schedules').update(data).eq('id', id);
        if (updErr) throw new Error(updErr.message);
      }

      for (let i = 0; i < toAdd.length; i += CHUNK) {
        const chunk = toAdd.slice(i, i + CHUNK);
        const { error: insErr } = await supabase.from('schedules').insert(chunk);
        if (insErr) throw new Error(insErr.message);
      }

      schedulesAdded += toAdd.length;
      if (toAdd.length > 0) updatedMovies.push(movie);

      const elapsed = Date.now() - movieStart;
      const m = Math.floor(elapsed / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      console.log(
        `  ✓ "${movie.title}" 완료 — 추가 ${toAdd.length}개 / 수정 ${toUpdate.length}개 / 삭제 ${toDeleteIds.length}개 (${m}분 ${s}초)`,
      );
    } catch (err) {
      const elapsed = Date.now() - movieStart;
      const m = Math.floor(elapsed / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      const msg = `${movie.title}: ${err.message}`;
      console.error(`  [오류] ${msg} (${m}분 ${s}초)`);
      errors.push(msg);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const elapsed = Date.now() - start;
  const tm = Math.floor(elapsed / 60000);
  const ts = Math.floor((elapsed % 60000) / 1000);
  console.log(`[스케줄 수집 완료] 총 ${schedulesAdded}개 저장 (소요: ${tm}분 ${ts}초)\n`);

  return { schedulesAdded, errors, updatedMovies };
}

// ── 메인 실행 ──────────────────────────────────────────────────────
async function main() {
  const allStart = Date.now();
  console.log('[전체 수집 시작]');

  try {
    // 1. 영화 수집
    const {
      added: movieAdded,
      skipped: movieSkipped,
      total: _movieTotal,
      addedTitles,
      addedNaverMovieIds,
    } = await runMovieScrape();

    // 2. 전체 영화 조회 (신규 추가된 영화 포함)
    const { data: movies, error: fetchErr } = await supabase
      .from('movies')
      .select('*')
      .neq('naverMovieId', '');
    if (fetchErr) throw new Error(fetchErr.message);

    // 3. 전체 스케줄 수집
    const { schedulesAdded, errors, updatedMovies } = await runScheduleScrape(movies);

    // 4. 통합 텔레그램 알림
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const notifyScheduleMovies = updatedMovies.filter(
      (m) => (m.createdAt ?? '').slice(0, 10) < today,
    );
    const parts = [];

    if (addedTitles.length > 0) {
      const lines = addedTitles.slice(0, 3).map((t) => `🎬 [ ${t} ]`);
      if (addedTitles.length > 3) lines.push(`... 외 ${addedTitles.length - 3}개`);
      parts.push(`신규 영화 ${addedTitles.length}건\n${lines.join('\n')}`);
    }
    if (notifyScheduleMovies.length > 0) {
      const lines = notifyScheduleMovies.slice(0, 3).map((m) => `🎬 [ ${m.title} ]`);
      if (notifyScheduleMovies.length > 3)
        lines.push(`... 외 ${notifyScheduleMovies.length - 3}개`);
      parts.push(`스케줄 업데이트 ${notifyScheduleMovies.length}건\n${lines.join('\n')}`);
    }

    if (parts.length > 0) {
      const allNaverIds = [
        ...new Set([
          ...addedNaverMovieIds,
          ...notifyScheduleMovies.map((m) => m.naverMovieId).filter(Boolean),
        ]),
      ];
      const url = allNaverIds.length > 0 ? `${MOVIES_URL}?id=${allNaverIds.join(',')}` : MOVIES_URL;
      const message = `🔥🔥 영화 업데이트 알림\n\n${parts.join('\n\n')}\n\n🔗 바로가기\n${url}`;
      await sendTelegramMessage(message);
      console.log('[Telegram 발송] 전체 수집 완료 알림 발송');
    }

    const totalElapsed = Date.now() - allStart;
    const tm = Math.floor(totalElapsed / 60000);
    const ts = Math.floor((totalElapsed % 60000) / 1000);
    console.log(
      `[전체 수집 완료] 영화 추가 ${movieAdded}개 / 스킵 ${movieSkipped}개 / 스케줄 추가 ${schedulesAdded}개 (총 소요: ${tm}분 ${ts}초)`,
    );

    if (errors.length > 0) {
      console.warn(`[경고] 실패한 영화 ${errors.length}개:`);
      errors.forEach((e) => console.warn(`  - ${e}`));
    }

    process.exit(0);
  } catch (err) {
    console.error('[전체 수집 치명적 오류]', err.message);
    await sendTelegramMessage(`🚨 전체 수집 실패\n\n${err.message}`).catch(() => {});
    process.exit(1);
  }
}

main();
