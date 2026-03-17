import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useFirestore } from 'src/composables/useFirestore';
import type { Schedule } from 'src/types';
import {
  scrapeNaverSchedules,
  scrapeNaverScheduleForMovie,
  scrapeNaverScheduleForMovieViaApi,
  type ScrapeScheduleResult,
  type ScrapeMovieScheduleResult,
} from 'src/services/scraperService';

const COLLECTION = 'schedules';

export const useSchedulesStore = defineStore('schedulesStore', () => {
  const { getAll, getWhere, create, update, remove } = useFirestore();

  const schedules = ref<Schedule[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const scrapeLoading = ref(false);
  const scrapeLoadingMovies = ref<Set<string>>(new Set());
  const apiScrapeLoadingMovies = ref<Set<string>>(new Set());

  async function fetchSchedules() {
    loading.value = true;
    error.value = null;
    try {
      schedules.value = await getAll<Schedule>(COLLECTION);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchByMovie(movieId: string) {
    loading.value = true;
    error.value = null;
    try {
      schedules.value = await getWhere<Schedule>(COLLECTION, 'movieId', '==', movieId);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function addSchedule(data: Omit<Schedule, 'id'>) {
    loading.value = true;
    error.value = null;
    try {
      const id = await create<Omit<Schedule, 'id'>>(COLLECTION, data);
      schedules.value.push({ id, ...data });
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function editSchedule(id: string, data: Partial<Omit<Schedule, 'id'>>) {
    loading.value = true;
    error.value = null;
    try {
      await update(COLLECTION, id, data as Partial<Record<string, unknown>>);
      const idx = schedules.value.findIndex((s) => s.id === id);
      if (idx !== -1) schedules.value[idx] = { ...schedules.value[idx]!, ...data };
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function deleteSchedule(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await remove(COLLECTION, id);
      schedules.value = schedules.value.filter((s) => s.id !== id);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchByMovieCount(movieId: string): Promise<number> {
    try {
      const list = await getWhere<Schedule>(COLLECTION, 'movieId', '==', movieId);
      return list.length;
    } catch {
      return 0;
    }
  }

  async function deleteAllByMovie(movieId: string) {
    loading.value = true;
    error.value = null;
    try {
      const targets = await getWhere<Schedule>(COLLECTION, 'movieId', '==', movieId);
      await Promise.all(targets.map((s) => remove(COLLECTION, s.id)));
      schedules.value = schedules.value.filter((s) => s.movieId !== movieId);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function scrapeScheduleForMovie(movieId: string): Promise<ScrapeMovieScheduleResult> {
    scrapeLoadingMovies.value = new Set([...scrapeLoadingMovies.value, movieId]);
    error.value = null;
    try {
      return await scrapeNaverScheduleForMovie(movieId);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      const next = new Set(scrapeLoadingMovies.value);
      next.delete(movieId);
      scrapeLoadingMovies.value = next;
    }
  }

  async function scrapeScheduleForMovieViaApi(movieId: string): Promise<ScrapeMovieScheduleResult> {
    apiScrapeLoadingMovies.value = new Set([...apiScrapeLoadingMovies.value, movieId]);
    error.value = null;
    try {
      return await scrapeNaverScheduleForMovieViaApi(movieId);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      const next = new Set(apiScrapeLoadingMovies.value);
      next.delete(movieId);
      apiScrapeLoadingMovies.value = next;
    }
  }

  async function scrapeSchedulesFromNaver(): Promise<ScrapeScheduleResult> {
    scrapeLoading.value = true;
    error.value = null;
    try {
      return await scrapeNaverSchedules();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      scrapeLoading.value = false;
    }
  }

  return {
    schedules,
    loading,
    error,
    scrapeLoading,
    scrapeLoadingMovies,
    apiScrapeLoadingMovies,
    fetchSchedules,
    fetchByMovie,
    addSchedule,
    editSchedule,
    deleteSchedule,
    fetchByMovieCount,
    deleteAllByMovie,
    scrapeScheduleForMovie,
    scrapeScheduleForMovieViaApi,
    scrapeSchedulesFromNaver,
  };
});
