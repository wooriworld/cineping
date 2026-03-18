import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabase } from 'src/composables/useSupabase';
import type { Movie } from 'src/types';
import { scrapeNaverMoviesViaApi, type ScrapeResult } from 'src/services/scraperService';

const COLLECTION = 'movies';

export const useMoviesStore = defineStore('moviesStore', () => {
  const { getAll, remove } = useSupabase();

  const movies = ref<Movie[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const apiScrapeLoading = ref(false);

  async function fetchMovies() {
    loading.value = true;
    error.value = null;
    try {
      movies.value = await getAll<Movie>(COLLECTION);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function deleteMovie(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await remove(COLLECTION, id);
      movies.value = movies.value.filter((m) => m.id !== id);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function scrapeFromNaverViaApi(): Promise<ScrapeResult> {
    apiScrapeLoading.value = true;
    error.value = null;
    try {
      const result = await scrapeNaverMoviesViaApi();
      await fetchMovies();
      return result;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      apiScrapeLoading.value = false;
    }
  }

  return { movies, loading, error, apiScrapeLoading, fetchMovies, deleteMovie, scrapeFromNaverViaApi };
});
