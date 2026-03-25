import { scrapeMoviesViaApi } from '../parsers/naverMovieApiParser.js';

/**
 * 네이버 API로 현재 상영 영화를 수집해 Supabase에 저장한다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {{ added: number, skipped: number, total: number, addedTitles: string[], addedNaverMovieIds: string[] }}
 */
export async function runMovieScrape(supabase) {
  const start = Date.now();
  console.log('\n[API 영화 수집 시작]');
  const scraped = await scrapeMoviesViaApi();
  console.log(`[크롤링 완료] ${scraped.length}개 영화 파싱`);

  if (scraped.length === 0) {
    return { added: 0, skipped: 0, total: 0, addedTitles: [], addedNaverMovieIds: [] };
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
  console.log(`[영화 저장 완료] 추가: ${added}개 / 중복 스킵: ${skipped}개 (소요: ${m}분 ${s}초)\n`);

  return { added, skipped, total: scraped.length, addedTitles, addedNaverMovieIds };
}
