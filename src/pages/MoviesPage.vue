<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">영화 관리</div>
      <q-btn color="primary" icon="add" label="영화 추가" @click="openMovieDialog()" />
    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <q-table
      :rows="store.movies"
      :columns="columns"
      row-key="id"
      :loading="store.loading"
      flat
      bordered
    >
      <template #body-cell-poster="{ value }">
        <q-td>
          <q-img
            v-if="value"
            :src="value"
            width="40px"
            height="56px"
            fit="cover"
            class="rounded-borders"
          />
          <q-icon v-else name="image_not_supported" size="sm" color="grey" />
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td>
          <q-btn flat round dense icon="event_available" color="teal" @click="openScheduleDialog(props.row)">
            <q-tooltip>스케줄 추가</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="edit" color="primary" @click="openMovieDialog(props.row)" />
          <q-btn flat round dense icon="delete" color="negative" @click="confirmDelete(props.row.id)" />
        </q-td>
      </template>
    </q-table>

    <!-- 영화 등록/수정 다이얼로그 -->
    <q-dialog v-model="movieDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ movieEditTarget ? '영화 수정' : '영화 추가' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input v-model="movieForm.title" label="영화 제목 *" outlined dense :rules="[required]" />
          <q-input v-model="movieForm.naverMovieId" label="네이버 영화 ID" outlined dense />
          <q-input v-model="movieForm.poster" label="포스터 URL" outlined dense />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn
            color="primary"
            :label="movieEditTarget ? '수정' : '추가'"
            :loading="store.loading"
            @click="submitMovie"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 스케줄 추가 다이얼로그 -->
    <q-dialog v-model="scheduleDialog" persistent>
      <q-card style="min-width: 480px">
        <q-card-section>
          <div class="text-h6">스케줄 추가</div>
          <div class="text-caption text-grey-6 q-mt-xs">{{ scheduleTargetTitle }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-select
            v-model="scheduleForm.chain"
            :options="chainOptions"
            label="영화관 체인 *"
            outlined
            dense
            emit-value
            map-options
            :rules="[required]"
          />
          <q-input v-model="scheduleForm.theater" label="지점명 *" outlined dense :rules="[required]" />
          <q-input v-model="scheduleForm.date" label="날짜 (YYYY-MM-DD) *" outlined dense :rules="[required]" />
          <div class="row q-gutter-sm">
            <q-input v-model="scheduleForm.startTime" label="시작 (HH:mm) *" outlined dense class="col" :rules="[required]" @update:model-value="onStartTimeInput" />
            <q-input v-model="scheduleForm.endTime" label="종료 (HH:mm)" outlined dense class="col" />
          </div>
          <q-input v-model="scheduleForm.screenType" label="상영관 타입 (IMAX, 4DX...)" outlined dense />
          <q-input v-model="scheduleForm.bookingUrl" label="예매 URL" outlined dense />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn
            color="teal"
            label="추가"
            :loading="schedulesStore.loading"
            @click="submitSchedule"
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
import { ref, onMounted } from 'vue';
import { useMoviesStore } from 'src/stores/moviesStore';
import { useSchedulesStore } from 'src/stores/schedulesStore';
import type { Movie, ChainType } from 'src/types';
import type { QTableColumn } from 'quasar';

const store = useMoviesStore();
const schedulesStore = useSchedulesStore();

const columns: QTableColumn[] = [
  { name: 'poster', label: '포스터', field: 'poster', align: 'center' },
  { name: 'title', label: '제목', field: 'title', align: 'left', sortable: true },
  { name: 'naverMovieId', label: '네이버 ID', field: 'naverMovieId', align: 'left' },
  { name: 'createdAt', label: '등록일', field: 'createdAt', align: 'left', sortable: true },
  { name: 'actions', label: '관리', field: 'actions', align: 'center' },
];

const chainOptions = [
  { label: 'CGV', value: 'CGV' },
  { label: '롯데시네마', value: '롯데시네마' },
  { label: '메가박스', value: '메가박스' },
  { label: '씨네Q', value: '씨네Q' },
];

// ── 영화 다이얼로그 ───────────────────────────────────────────────
const movieDialog = ref(false);
const movieEditTarget = ref<Movie | null>(null);
const emptyMovieForm = () => ({ title: '', naverMovieId: '', poster: '' });
const movieForm = ref(emptyMovieForm());

function openMovieDialog(movie?: Movie) {
  movieEditTarget.value = movie ?? null;
  movieForm.value = movie
    ? { title: movie.title, naverMovieId: movie.naverMovieId, poster: movie.poster }
    : emptyMovieForm();
  movieDialog.value = true;
}

async function submitMovie() {
  if (!movieForm.value.title) return;
  try {
    if (movieEditTarget.value) {
      await store.editMovie(movieEditTarget.value.id, movieForm.value);
    } else {
      await store.addMovie({ ...movieForm.value, createdAt: new Date().toISOString() });
    }
    movieDialog.value = false;
  } catch {
    // store.error로 표시됨
  }
}

// ── 스케줄 다이얼로그 ─────────────────────────────────────────────
const scheduleDialog = ref(false);
const scheduleTargetMovieId = ref('');
const scheduleTargetTitle = ref('');

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const emptyScheduleForm = () => ({
  chain: 'CGV' as ChainType,
  theater: '',
  date: todayStr(),
  startTime: '',
  endTime: '',
  screenType: '1관',
  bookingUrl: '',
});

const scheduleForm = ref(emptyScheduleForm());

function openScheduleDialog(movie: Movie) {
  scheduleTargetMovieId.value = movie.id;
  scheduleTargetTitle.value = movie.title;
  scheduleForm.value = emptyScheduleForm();
  scheduleDialog.value = true;
}

function onStartTimeInput(val: string | number | null): void {
  const raw = String(val ?? '').replace(/\D/g, '');
  if (raw.length === 4) {
    const formatted = `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
    scheduleForm.value.startTime = formatted;
    autoSetEndTime(formatted);
  } else {
    autoSetEndTime(val);
  }
}

function autoSetEndTime(val: string | number | null): void {
  const time = String(val ?? '');
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return;
  const h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  const totalMin = h * 60 + m + 120;
  const endH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const endM = String(totalMin % 60).padStart(2, '0');
  scheduleForm.value.endTime = `${endH}:${endM}`;
}

async function submitSchedule() {
  if (!scheduleForm.value.theater || !scheduleForm.value.date || !scheduleForm.value.startTime) return;
  try {
    await schedulesStore.addSchedule({
      ...scheduleForm.value,
      movieId: scheduleTargetMovieId.value,
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch {
    // schedulesStore.error로 표시됨
  }
}

// ── 삭제 ─────────────────────────────────────────────────────────
const deleteDialog = ref(false);
const deleteTargetId = ref('');

function confirmDelete(id: string) {
  deleteTargetId.value = id;
  deleteDialog.value = true;
}

async function doDelete() {
  try {
    await store.deleteMovie(deleteTargetId.value);
    deleteDialog.value = false;
  } catch {
    // store.error로 표시됨
  }
}

function required(val: string) {
  return !!val || '필수 입력 항목입니다.';
}

onMounted(() => store.fetchMovies());
</script>
