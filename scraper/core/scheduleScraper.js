import { scrapeMovieSchedulesViaApi } from '../parsers/naverScheduleApiParser.js';

const LOG = '[Naver 스케줄 수집]';
const CHUNK = 100;
const CONCURRENCY = 2; // 동시 처리 영화 수 (2 × 7일 = 14 동시 요청)
const BATCH_DELAY_MS = 1000; // 배치 간 딜레이

const scheduleKey = (s) => `${s.date}_${s.theater}_${s.startTime}`;

/**
 * 영화 목록의 스케줄을 수집해 Supabase에 저장한다 (diff 방식).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array} movies - movies 테이블 레코드 배열
 * @returns {{ schedulesAdded: number, errors: string[], updatedMovies: Array }}
 */
export async function runScheduleScrape(supabase, movies) {
  const start = Date.now();
  console.log(`\n${LOG} 시작`);
  console.log(`${LOG} 대상 ${movies.length}개`);

  let schedulesAdded = 0;
  let schedulesUpdated = 0;
  let schedulesDeleted = 0;
  const errors = [];
  const updatedMovies = [];

  async function processMovie(movie) {
    const movieStart = Date.now();
    try {
      const scraped = await scrapeMovieSchedulesViaApi(movie);

      const { data: existing, error: exErr } = await supabase
        .from('schedules')
        .select('*')
        .eq('movieId', movie.id)
        .limit(10000);
      if (exErr) {
        console.error(
          `  [Supabase SELECT 오류] code=${exErr.code} message=${exErr.message} details=${exErr.details} hint=${exErr.hint}`,
        );
        throw new Error(exErr.message);
      }

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
        if (delErr) {
          console.error(
            `  [Supabase DELETE 오류] code=${delErr.code} message=${delErr.message} details=${delErr.details} hint=${delErr.hint}`,
          );
          throw new Error(delErr.message);
        }
      }

      const upsertData = toUpdate.map(({ id, data }) => ({ id, ...data }));
      for (let i = 0; i < upsertData.length; i += CHUNK) {
        const { error: updErr } = await supabase
          .from('schedules')
          .upsert(upsertData.slice(i, i + CHUNK));
        if (updErr) {
          console.error(
            `  [Supabase UPSERT 오류] code=${updErr.code} message=${updErr.message} details=${updErr.details} hint=${updErr.hint}`,
          );
          throw new Error(updErr.message);
        }
      }

      for (let i = 0; i < toAdd.length; i += CHUNK) {
        const chunk = toAdd.slice(i, i + CHUNK);
        const { error: insErr } = await supabase.from('schedules').insert(chunk);
        if (insErr) {
          console.error(
            `  [Supabase INSERT 오류] chunk[${i}~${i + chunk.length}] code=${insErr.code} message=${insErr.message} details=${insErr.details} hint=${insErr.hint}`,
          );
          console.error(`  [Supabase INSERT 오류] 첫 번째 레코드=`, JSON.stringify(chunk[0]));
          throw new Error(insErr.message);
        }
      }

      schedulesAdded += toAdd.length;
      schedulesUpdated += toUpdate.length;
      schedulesDeleted += toDeleteIds.length;
      if (toAdd.length > 0) updatedMovies.push(movie);
    } catch (err) {
      const elapsed = Date.now() - movieStart;
      const m = Math.floor(elapsed / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      const msg = `${movie.title}: ${err.message}`;
      console.error(`  [오류] ${msg} (${m}분 ${s}초)`);
      errors.push(msg);
    }
  }

  // CONCURRENCY개씩 묶어 병렬 처리
  for (let i = 0; i < movies.length; i += CONCURRENCY) {
    const batch = movies.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((movie) => processMovie(movie)));
    if (i + CONCURRENCY < movies.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  const elapsed = Date.now() - start;
  const tm = Math.floor(elapsed / 60000);
  const ts = Math.floor((elapsed % 60000) / 1000);
  console.log(
    `${LOG} 추가 ${schedulesAdded}개 / 스킵 ${schedulesUpdated}개 / 삭제 ${schedulesDeleted}개`,
  );
  console.log(`${LOG} 소요: ${tm}분 ${ts}초`);

  return { schedulesAdded, schedulesUpdated, schedulesDeleted, errors, updatedMovies };
}
