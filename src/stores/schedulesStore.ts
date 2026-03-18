import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabase } from 'src/composables/useSupabase';
import { supabase } from 'src/supabase';
import type { Schedule } from 'src/types';
import {
  scrapeNaverSchedules,
  scrapeNaverScheduleForMovieViaApi,
  type ScrapeScheduleResult,
  type ScrapeMovieScheduleResult,
} from 'src/services/scraperService';

const COLLECTION = 'schedules';

export const useSchedulesStore = defineStore('schedulesStore', () => {
  const { getAll, getWhere, create, update, remove } = useSupabase();

  const schedules = ref<Schedule[]>([]);
  const scheduleCounts = ref<Record<string, number>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const scrapeLoading = ref(false);
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

  async function fetchScheduleCounts() {
    try {
      const { data, error: err } = await supabase
        .from('schedule_counts')
        .select('movieId, count');
      if (err) throw new Error(err.message);
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const r = row as { movieId: string; count: number };
        counts[r.movieId] = Number(r.count);
      }
      scheduleCounts.value = counts;
    } catch (e) {
      error.value = (e as Error).message;
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

  async function getByMovie(movieId: string): Promise<Schedule[]> {
    try {
      return await getWhere<Schedule>(COLLECTION, 'movieId', '==', movieId);
    } catch (e) {
      error.value = (e as Error).message;
      return [];
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
    scheduleCounts,
    loading,
    error,
    scrapeLoading,
    apiScrapeLoadingMovies,
    fetchSchedules,
    fetchScheduleCounts,
    fetchByMovie,
    addSchedule,
    editSchedule,
    deleteSchedule,
    getByMovie,
    fetchByMovieCount,
    deleteAllByMovie,
    scrapeScheduleForMovieViaApi,
    scrapeSchedulesFromNaver,
  };
});
