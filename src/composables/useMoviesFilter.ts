import { ref } from 'vue';

// 모듈 레벨 싱글톤 — MainLayout과 MoviesPage가 동일 상태 공유
const searchTitle = ref('');
const filterShowNew = ref(false);
const filterShowUpdate = ref(false);
const filterShowEng = ref(false);
const filterDialog = ref(false);

export function useMoviesFilter() {
  return { searchTitle, filterShowNew, filterShowUpdate, filterShowEng, filterDialog };
}
