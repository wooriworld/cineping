<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">사용자 관리</div>
      <q-btn color="primary" icon="add" label="사용자 추가" @click="openDialog()" />
    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <q-table
      :rows="store.users"
      :columns="columns"
      row-key="uid"
      :loading="store.loading"
      flat
      bordered
    >
      <template #body-cell-watchlist="{ value }">
        <q-td>
          <q-badge v-for="id in (value as string[])" :key="id" color="blue-grey" class="q-mr-xs">
            {{ id }}
          </q-badge>
          <span v-if="!(value as string[]).length" class="text-grey">없음</span>
        </q-td>
      </template>

      <template #body-cell-preferredChains="props">
        <q-td>
          {{ props.row.alertConditions.preferredChains.join(', ') }}
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td>
          <q-btn flat round dense icon="edit" color="primary" @click="openDialog(props.row)" />
          <q-btn
            flat
            round
            dense
            icon="delete"
            color="negative"
            @click="confirmDelete(props.row.uid)"
          />
        </q-td>
      </template>
    </q-table>

    <!-- 등록/수정 다이얼로그 -->
    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 480px">
        <q-card-section>
          <div class="text-h6">{{ editTarget ? '사용자 수정' : '사용자 추가' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input
            v-model="form.uid"
            label="Firebase UID *"
            outlined
            dense
            :disable="!!editTarget"
            :rules="[required]"
          />
          <q-input v-model="form.telegramChatId" label="텔레그램 Chat ID" outlined dense />
          <q-input
            v-model="watchlistInput"
            label="구독 영화 ID (콤마 구분)"
            outlined
            dense
            hint="예: movie_001,movie_002"
          />

          <div class="text-subtitle2 q-mt-sm">알림 조건</div>
          <q-toggle v-model="form.alertConditions.newSchedule" label="새 스케줄 추가 알림" />
          <q-toggle v-model="form.alertConditions.deletedSchedule" label="스케줄 삭제 알림" />
          <q-toggle v-model="form.alertConditions.modifiedSchedule" label="스케줄 변경 알림" />
          <q-select
            v-model="form.alertConditions.preferredChains"
            :options="chainOptions"
            label="선호 영화관"
            outlined
            dense
            multiple
            emit-value
            map-options
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn
            color="primary"
            :label="editTarget ? '수정' : '추가'"
            :loading="store.loading"
            @click="submit"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 삭제 확인 -->
    <q-dialog v-model="deleteDialog">
      <q-card>
        <q-card-section class="text-h6">정말 삭제하시겠습니까?</q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn color="negative" label="삭제" :loading="store.loading" @click="doDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useUsersStore } from 'src/stores/usersStore';
import type { User, ChainType } from 'src/types';
import type { QTableColumn } from 'quasar';

const store = useUsersStore();

const chainOptions = [
  { label: 'CGV', value: 'CGV' },
  { label: '롯데시네마', value: '롯데시네마' },
  { label: '메가박스', value: '메가박스' },
];

const columns: QTableColumn[] = [
  { name: 'uid', label: 'UID', field: 'uid', align: 'left', sortable: true },
  { name: 'telegramChatId', label: '텔레그램 ID', field: 'telegramChatId', align: 'left' },
  { name: 'watchlist', label: '구독 영화', field: 'watchlist', align: 'left' },
  { name: 'preferredChains', label: '선호 체인', field: 'alertConditions', align: 'left' },
  { name: 'actions', label: '관리', field: 'actions', align: 'center' },
];

const dialog = ref(false);
const deleteDialog = ref(false);
const editTarget = ref<User | null>(null);
const deleteTargetId = ref('');
const watchlistInput = ref('');

const emptyForm = (): User => ({
  uid: '',
  telegramChatId: '',
  watchlist: [],
  alertConditions: {
    newSchedule: true,
    deletedSchedule: true,
    modifiedSchedule: true,
    preferredChains: ['CGV', '롯데시네마', '메가박스'],
  },
});

const form = ref<User>(emptyForm());

watch(watchlistInput, (val) => {
  form.value.watchlist = val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
});

function required(val: string) {
  return !!val || '필수 입력 항목입니다.';
}

function openDialog(user?: User) {
  editTarget.value = user ?? null;
  if (user) {
    form.value = JSON.parse(JSON.stringify(user)) as User;
    watchlistInput.value = user.watchlist.join(', ');
  } else {
    form.value = emptyForm();
    watchlistInput.value = '';
  }
  dialog.value = true;
}

function confirmDelete(uid: string) {
  deleteTargetId.value = uid;
  deleteDialog.value = true;
}

async function submit() {
  if (!form.value.uid) return;
  try {
    if (editTarget.value) {
      const { uid: _uid, ...rest } = form.value;
      await store.editUser(editTarget.value.uid, rest);
    } else {
      await store.addUser(form.value);
    }
    dialog.value = false;
  } catch {
    // store.error 로 표시됨
  }
}

async function doDelete() {
  try {
    await store.deleteUser(deleteTargetId.value);
    deleteDialog.value = false;
  } catch {
    // store.error 로 표시됨
  }
}

onMounted(() => store.fetchUsers());
</script>
