import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabase } from 'src/composables/useSupabase';
import type { Movie } from 'src/types';
import {
  scrapeNaverMovies,
  scrapeAll as scrapeAllService,
  scrapeKofaMovies,
  scrapeEmucineMovies,
} from 'src/services/scraperService';

const COLLECTION = 'movies';

export const useMoviesStore = defineStore('moviesStore', () => {
  const { getAll, remove } = useSupabase();

  const movies = ref<Movie[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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
    error.value = null;
    try {
      await scrapeNaverMovies();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    }
  }

  async function scrapeAll(): Promise<void> {
    error.value = null;
    try {
      await scrapeAllService();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    }
  }

  async function scrapeFromKofa(): Promise<void> {
    error.value = null;
    try {
      await scrapeKofaMovies();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    }
  }

  async function scrapeFromEmucine(): Promise<void> {
    error.value = null;
    try {
      await scrapeEmucineMovies();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    }
  }

  return {
    movies,
    loading,
    error,
    fetchMovies,
    deleteMovie,
    scrapeFromNaver,
    scrapeAll,
    scrapeFromKofa,
    scrapeFromEmucine,
  };
});
