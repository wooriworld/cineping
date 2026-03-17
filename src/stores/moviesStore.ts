import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useFirestore } from 'src/composables/useFirestore';
import type { Movie } from 'src/types';
import { scrapeNaverMovies, scrapeNaverMoviesViaApi, type ScrapeResult } from 'src/services/scraperService';

const COLLECTION = 'movies';

export const useMoviesStore = defineStore('moviesStore', () => {
  const { getAll, create, update, remove } = useFirestore();

  const movies = ref<Movie[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const scrapeLoading = ref(false);
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

  async function addMovie(data: Omit<Movie, 'id'>) {
    loading.value = true;
    error.value = null;
    try {
      const id = await create<Omit<Movie, 'id'>>(COLLECTION, data);
      movies.value.push({ id, ...data });
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function editMovie(id: string, data: Partial<Omit<Movie, 'id'>>) {
    loading.value = true;
    error.value = null;
    try {
      await update(COLLECTION, id, data as Partial<Record<string, unknown>>);
      const idx = movies.value.findIndex((m) => m.id === id);
      if (idx !== -1) movies.value[idx] = { ...movies.value[idx]!, ...data };
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
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

  async function scrapeFromNaver(): Promise<ScrapeResult> {
    scrapeLoading.value = true;
    error.value = null;
    try {
      const result = await scrapeNaverMovies();
      await fetchMovies();
      return result;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      scrapeLoading.value = false;
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

  return { movies, loading, error, scrapeLoading, apiScrapeLoading, fetchMovies, addMovie, editMovie, deleteMovie, scrapeFromNaver, scrapeFromNaverViaApi };
});
