import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabase } from 'src/composables/useSupabase';
import { supabase } from 'src/supabase';
import type { Schedule } from 'src/types';
import { scrapeNaverSchedules } from 'src/services/scraperService';

const COLLECTION = 'schedules';

export const useSchedulesStore = defineStore('schedulesStore', () => {
  const { getAll, getWhere, create, update, remove } = useSupabase();

  const schedules = ref<Schedule[]>([]);
  const scheduleCounts = ref<Record<string, number>>({});
  const newScheduleMovieIds = ref<Set<string>>(new Set());
  const engScheduleMovieIds = ref<Set<string>>(new Set());
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  async function fetchNewScheduleMovieIds() {
    try {
      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error: err } = await supabase
        .from('schedules')
        .select('movieId')
        .gte('lastUpdatedAt', `${kstToday}T00:00:00.000Z`);
      if (err) throw new Error(err.message);
      newScheduleMovieIds.value = new Set((data ?? []).map((r) => (r as { movieId: string }).movieId));
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  async function fetchEngScheduleMovieIds() {
    try {
      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const in7days = new Date(Date.now() + 9 * 60 * 60 * 1000 + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error: err } = await supabase
        .from('schedules')
        .select('movieId')
        .eq('hasEnglishSubtitle', true)
        .gte('date', kstToday)
        .lte('date', in7days);
      if (err) throw new Error(err.message);
      engScheduleMovieIds.value = new Set((data ?? []).map((r) => (r as { movieId: string }).movieId));
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
      return await getWhere<Schedule>(COLLECTION, 'movieId', '==', movieId, 10000);
    } catch (e) {
      error.value = (e as Error).message;
      return [];
    }
  }

  async function scrapeSchedulesFromNaver(): Promise<void> {
    error.value = null;
    try {
      await scrapeNaverSchedules();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    }
  }

  return {
    schedules,
    scheduleCounts,
    newScheduleMovieIds,
    engScheduleMovieIds,
    loading,
    error,
    fetchSchedules,
    fetchScheduleCounts,
    fetchNewScheduleMovieIds,
    fetchEngScheduleMovieIds,
    fetchByMovie,
    addSchedule,
    editSchedule,
    deleteSchedule,
    getByMovie,
    scrapeSchedulesFromNaver,
  };
});
