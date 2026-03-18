import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useSupabase } from 'src/composables/useSupabase';
import type { User } from 'src/types';

const COLLECTION = 'users';

export const useUsersStore = defineStore('usersStore', () => {
  const { getAll, create, update, remove } = useSupabase();

  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchUsers() {
    loading.value = true;
    error.value = null;
    try {
      users.value = await getAll<User>(COLLECTION);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function addUser(data: User) {
    loading.value = true;
    error.value = null;
    try {
      await create<User>(COLLECTION, data, data.uid);
      users.value.push(data);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function editUser(uid: string, data: Partial<Omit<User, 'uid'>>) {
    loading.value = true;
    error.value = null;
    try {
      await update(COLLECTION, uid, data as Partial<Record<string, unknown>>);
      const idx = users.value.findIndex((u) => u.uid === uid);
      if (idx !== -1) users.value[idx] = { ...users.value[idx]!, ...data };
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function deleteUser(uid: string) {
    loading.value = true;
    error.value = null;
    try {
      await remove(COLLECTION, uid);
      users.value = users.value.filter((u) => u.uid !== uid);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return { users, loading, error, fetchUsers, addUser, editUser, deleteUser };
});
