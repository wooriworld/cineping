<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">상영 스케줄 관리</div>
      <q-btn color="primary" icon="add" label="스케줄 추가" @click="openDialog()" />
    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <!-- 필터 -->
    <div class="row q-gutter-sm q-mb-md">
      <q-select
        v-model="filterChain"
        :options="chainOptions"
        label="영화관 체인"
        outlined
        dense
        clearable
        style="min-width: 160px"
        emit-value
        map-options
      />
      <q-input v-model="filterMovie" label="영화 ID 검색" outlined dense clearable style="min-width: 200px" />
    </div>

    <q-table
      :rows="filteredSchedules"
      :columns="columns"
      row-key="id"
      :loading="store.loading"
      flat
      bordered
    >
      <template #body-cell-actions="props">
        <q-td>
          <q-btn flat round dense icon="edit" color="primary" @click="openDialog(props.row)" />
          <q-btn
            flat
            round
            dense
            icon="delete"
            color="negative"
            @click="confirmDelete(props.row.id)"
          />
        </q-td>
      </template>
    </q-table>

    <!-- 등록/수정 다이얼로그 -->
    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 480px">
        <q-card-section>
          <div class="text-h6">{{ editTarget ? '스케줄 수정' : '스케줄 추가' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input v-model="form.movieId" label="영화 ID *" outlined dense :rules="[required]" />
          <q-select
            v-model="form.chain"
            :options="chainOptions"
            label="영화관 체인 *"
            outlined
            dense
            emit-value
            map-options
            :rules="[required]"
          />
          <q-input v-model="form.theater" label="지점명 *" outlined dense :rules="[required]" />
          <q-input v-model="form.date" label="날짜 (YYYY-MM-DD) *" outlined dense :rules="[required]" />
          <div class="row q-gutter-sm">
            <q-input v-model="form.startTime" label="시작 시간 (HH:mm) *" outlined dense class="col" :rules="[required]" />
            <q-input v-model="form.endTime" label="종료 시간 (HH:mm)" outlined dense class="col" />
          </div>
          <q-input v-model="form.screenType" label="상영관 타입 (IMAX, 4DX, 일반...)" outlined dense />
          <q-input v-model.number="form.availableSeats" label="잔여 좌석" type="number" outlined dense />
          <q-input v-model="form.bookingUrl" label="예매 URL" outlined dense />
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
import { ref, computed, onMounted } from 'vue';
import { useSchedulesStore } from 'src/stores/schedulesStore';
import type { Schedule, ChainType } from 'src/types';
import type { QTableColumn } from 'quasar';

const store = useSchedulesStore();

const chainOptions = [
  { label: 'CGV', value: 'CGV' },
  { label: '롯데시네마', value: '롯데시네마' },
  { label: '메가박스', value: '메가박스' },
];

const columns: QTableColumn[] = [
  { name: 'movieId', label: '영화 ID', field: 'movieId', align: 'left', sortable: true },
  { name: 'chain', label: '체인', field: 'chain', align: 'left', sortable: true },
  { name: 'theater', label: '지점', field: 'theater', align: 'left', sortable: true },
  { name: 'date', label: '날짜', field: 'date', align: 'left', sortable: true },
  { name: 'startTime', label: '시작', field: 'startTime', align: 'center' },
  { name: 'endTime', label: '종료', field: 'endTime', align: 'center' },
  { name: 'screenType', label: '상영관', field: 'screenType', align: 'center' },
  { name: 'availableSeats', label: '잔여좌석', field: 'availableSeats', align: 'center', sortable: true },
  { name: 'actions', label: '관리', field: 'actions', align: 'center' },
];

const filterChain = ref<ChainType | null>(null);
const filterMovie = ref('');

const filteredSchedules = computed(() => {
  return store.schedules.filter((s) => {
    const matchChain = !filterChain.value || s.chain === filterChain.value;
    const matchMovie = !filterMovie.value || s.movieId.includes(filterMovie.value);
    return matchChain && matchMovie;
  });
});

const dialog = ref(false);
const deleteDialog = ref(false);
const editTarget = ref<Schedule | null>(null);
const deleteTargetId = ref('');

const emptyForm = (): Omit<Schedule, 'id' | 'lastUpdatedAt'> => ({
  movieId: '',
  chain: 'CGV',
  theater: '',
  date: '',
  startTime: '',
  endTime: '',
  screenType: '일반',
  availableSeats: 0,
  bookingUrl: '',
});

const form = ref(emptyForm());

function required(val: string | number) {
  return !!val || '필수 입력 항목입니다.';
}

function openDialog(schedule?: Schedule) {
  editTarget.value = schedule ?? null;
  if (schedule) {
    const { id: _id, lastUpdatedAt: _lu, ...rest } = schedule;
    form.value = { ...rest };
  } else {
    form.value = emptyForm();
  }
  dialog.value = true;
}

function confirmDelete(id: string) {
  deleteTargetId.value = id;
  deleteDialog.value = true;
}

async function submit() {
  if (!form.value.movieId || !form.value.theater || !form.value.date || !form.value.startTime) return;
  const payload: Omit<Schedule, 'id'> = { ...form.value, lastUpdatedAt: new Date().toISOString() };
  try {
    if (editTarget.value) {
      await store.editSchedule(editTarget.value.id, payload);
    } else {
      await store.addSchedule(payload);
    }
    dialog.value = false;
  } catch {
    // store.error 로 표시됨
  }
}

async function doDelete() {
  try {
    await store.deleteSchedule(deleteTargetId.value);
    deleteDialog.value = false;
  } catch {
    // store.error 로 표시됨
  }
}

onMounted(() => store.fetchSchedules());
</script>
