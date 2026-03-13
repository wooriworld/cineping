import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useFirestore } from 'src/composables/useFirestore';
import type { Schedule } from 'src/types';

const COLLECTION = 'schedules';

export const useSchedulesStore = defineStore('schedulesStore', () => {
  const { getAll, getWhere, create, update, remove } = useFirestore();

  const schedules = ref<Schedule[]>([]);
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

  return {
    schedules,
    loading,
    error,
    fetchSchedules,
    fetchByMovie,
    addSchedule,
    editSchedule,
    deleteSchedule,
  };
});
