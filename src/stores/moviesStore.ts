import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabase } from 'src/composables/useSupabase';
import type { Movie } from 'src/types';
import {
  scrapeNaverMoviesViaApi,
  scrapeAll as scrapeAllService,
  scrapeKofaMovies,
  scrapeEmucineMovies,
  type ScrapeAllResult,
  type ScrapeKofaResult,
  type ScrapeEmucineResult,
} from 'src/services/scraperService';

const COLLECTION = 'movies';

export const useMoviesStore = defineStore('moviesStore', () => {
  const { getAll, remove } = useSupabase();

  const movies = ref<Movie[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const apiScrapeLoading = ref(false);
  const allScrapeLoading = ref(false);
  const kofaScrapeLoading = ref(false);
  const emucineScrapeLoading = ref(false);

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

  async function scrapeFromNaver(): Promise<void> {
    apiScrapeLoading.value = true;
    error.value = null;
    try {
      await scrapeNaverMoviesViaApi();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      apiScrapeLoading.value = false;
    }
  }

  async function scrapeAll(): Promise<ScrapeAllResult> {
    allScrapeLoading.value = true;
    error.value = null;
    try {
      const result = await scrapeAllService();
      await fetchMovies();
      return result;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      allScrapeLoading.value = false;
    }
  }

  async function scrapeFromKofa(): Promise<ScrapeKofaResult> {
    kofaScrapeLoading.value = true;
    error.value = null;
    try {
      const result = await scrapeKofaMovies();
      await fetchMovies();
      return result;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      kofaScrapeLoading.value = false;
    }
  }

  async function scrapeFromEmucine(): Promise<ScrapeEmucineResult> {
    emucineScrapeLoading.value = true;
    error.value = null;
    try {
      return await scrapeEmucineMovies();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      emucineScrapeLoading.value = false;
    }
  }

  return {
    movies,
    loading,
    error,
    apiScrapeLoading,
    allScrapeLoading,
    kofaScrapeLoading,
    emucineScrapeLoading,
    fetchMovies,
    deleteMovie,
    scrapeFromNaver,
    scrapeAll,
    scrapeFromKofa,
    scrapeFromEmucine,
  };
});
