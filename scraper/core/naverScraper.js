import { scrapeMoviesViaApi } from '../parsers/naverMovieApiParser.js';

const LOG = '[Naver 수집]';

/**
 * 네이버 API로 현재 상영 영화를 수집해 Supabase에 저장한다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {{ added: number, skipped: number, total: number, addedTitles: string[], addedNaverMovieIds: string[] }}
 */
export async function runNaverScrape(supabase) {
  const start = Date.now();
  console.log(`\n${LOG} 시작`);

  // DB 기존 영화 먼저 조회 → 영어 제목 수집 스킵에 활용
  const { data: existing, error: fetchErr } = await supabase
    .from('movies')
    .select('id, title, englishTitle');
  if (fetchErr) throw new Error(fetchErr.message);

  const scraped = await scrapeMoviesViaApi(existing ?? []);
  console.log(`${LOG} 파싱 ${scraped.length}개`);

  if (scraped.length === 0) {
    return { added: 0, skipped: 0, total: 0, addedTitles: [], addedNaverMovieIds: [] };
  }

  const existingMap = new Map((existing ?? []).map((m) => [m.title, m]));
  const toInsert = [];
  const toUpdate = [];

  for (const movie of scraped) {
    const existingMovie = existingMap.get(movie.title);
    if (existingMovie) {
      if (movie.englishTitle && !existingMovie.englishTitle) {
        toUpdate.push({ id: existingMovie.id, englishTitle: movie.englishTitle });
      }
      continue;
    }
    toInsert.push(movie);
  }

  // 배치 INSERT
  if (toInsert.length > 0) {
    const createdAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('movies').insert(
      toInsert.map((movie) => ({
        title: movie.title,
        englishTitle: movie.englishTitle || '',
        sourceId: movie.sourceId || '',
        poster: movie.poster || '',
        releaseDate: movie.releaseDate || '',
        source: 'NAVER',
        createdAt,
      })),
    );
    if (error) throw new Error(error.message);
  }

  // englishTitle 개별 업데이트
  for (const { id, englishTitle } of toUpdate) {
    const { error } = await supabase.from('movies').update({ englishTitle }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  const added = toInsert.length;
  const skipped = scraped.length - toInsert.length;
  const addedTitles = toInsert.map((m) => m.title);
  const addedNaverMovieIds = toInsert.map((m) => m.sourceId).filter(Boolean);

  const elapsed = Date.now() - start;
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  console.log(`${LOG} 추가 ${added}개 / 스킵 ${skipped}개`);
  console.log(`${LOG} 소요 ${m}분 ${s}초`);

  return { added, skipped, total: scraped.length, addedTitles, addedNaverMovieIds };
}
