<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">영화 관리</div>
      <q-btn
        color="teal"
        icon="travel_explore"
        label="영화 스크래핑"
        class="q-mr-sm"
        :loading="store.scrapeLoading"
        @click="runMovieScrape"
      >
        <q-tooltip>네이버 현재 상영 영화 자동 수집</q-tooltip>
      </q-btn>
      <q-btn
        color="deep-orange"
        icon="event_note"
        label="스케줄 수집"
        class="q-mr-sm"
        :loading="schedulesStore.scrapeLoading"
        @click="runScheduleScrape"
      >
        <q-tooltip>DB 영화 전체 상영 스케줄 수집 (7일치)</q-tooltip>
      </q-btn>
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
      :rows-per-page-options="[8, 16, 24, 0]"
      :pagination="{ rowsPerPage: 8 }"
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
          <q-btn flat round dense icon="event_busy" color="orange" @click="confirmDeleteSchedules(props.row)">
            <q-tooltip>스케줄 전체 삭제</q-tooltip>
          </q-btn>
          <q-btn
            flat round dense icon="cloud_download" color="deep-orange"
            :loading="schedulesStore.scrapeLoadingMovies.has(props.row.id)"
            :disable="!props.row.naverMovieId"
            @click="runMovieScheduleScrape(props.row)"
          >
            <q-tooltip>{{ props.row.naverMovieId ? '스케줄 수집' : 'naverMovieId 없음' }}</q-tooltip>
          </q-btn>
          <q-btn
            flat round dense icon="bolt" color="purple"
            :loading="schedulesStore.apiScrapeLoadingMovies.has(props.row.id)"
            :disable="!props.row.naverMovieId"
            @click="runMovieScheduleScrapeViaApi(props.row)"
          >
            <q-tooltip>{{ props.row.naverMovieId ? 'API 스케줄 수집 (빠름)' : 'naverMovieId 없음' }}</q-tooltip>
          </q-btn>
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

    <!-- 스케줄 전체 삭제 확인 -->
    <q-dialog v-model="deleteSchedulesDialog">
      <q-card>
        <q-card-section class="text-h6">스케줄 전체 삭제</q-card-section>
        <q-card-section class="text-body2 q-pt-none">
          <strong>{{ deleteSchedulesTarget?.title }}</strong>의 스케줄
          <q-badge color="negative" :label="deleteSchedulesCount" class="q-mx-xs" />
          개를 모두 삭제하시겠습니까?
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn color="negative" label="삭제" :loading="schedulesStore.loading" @click="doDeleteSchedules" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 영화별 스케줄 수집 결과 -->
    <q-dialog v-model="movieScheduleScrapeDialog">
      <q-card style="min-width: 280px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">스케줄 수집 완료</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section v-if="movieScheduleScrapeResult">
          <div class="text-body2 q-mb-sm text-grey-7">{{ movieScheduleScrapeResult.title }}</div>
          <q-item>
            <q-item-section avatar><q-icon name="event_note" color="positive" /></q-item-section>
            <q-item-section>
              <q-item-label>저장된 스케줄</q-item-label>
              <q-item-label caption>{{ movieScheduleScrapeResult.schedulesAdded }}개</q-item-label>
            </q-item-section>
          </q-item>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn color="primary" label="확인" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 영화 스크래핑 결과 -->
    <q-dialog v-model="movieScrapeDialog">
      <q-card style="min-width: 300px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">영화 스크래핑 완료</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section v-if="movieScrapeResult">
          <q-list>
            <q-item>
              <q-item-section avatar><q-icon name="add_circle" color="positive" /></q-item-section>
              <q-item-section>
                <q-item-label>신규 추가</q-item-label>
                <q-item-label caption>{{ movieScrapeResult.added }}개</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section avatar><q-icon name="skip_next" color="grey" /></q-item-section>
              <q-item-section>
                <q-item-label>중복 스킵</q-item-label>
                <q-item-label caption>{{ movieScrapeResult.skipped }}개</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn color="primary" label="확인" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 스케줄 수집 결과 -->
    <q-dialog v-model="scheduleScrapeDialog">
      <q-card style="min-width: 320px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">스케줄 수집 완료</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section v-if="scheduleScrapeResult">
          <q-list>
            <q-item>
              <q-item-section avatar><q-icon name="movie" color="deep-orange" /></q-item-section>
              <q-item-section>
                <q-item-label>처리 영화</q-item-label>
                <q-item-label caption>{{ scheduleScrapeResult.moviesProcessed }}개</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section avatar><q-icon name="event_note" color="positive" /></q-item-section>
              <q-item-section>
                <q-item-label>저장된 스케줄</q-item-label>
                <q-item-label caption>{{ scheduleScrapeResult.schedulesAdded }}개</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="scheduleScrapeResult.errors.length > 0">
              <q-item-section avatar><q-icon name="warning" color="negative" /></q-item-section>
              <q-item-section>
                <q-item-label>오류</q-item-label>
                <q-item-label
                  v-for="(err, i) in scheduleScrapeResult.errors"
                  :key="i"
                  caption
                  class="text-negative"
                >{{ err }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn color="primary" label="확인" v-close-popup />
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
import type { ScrapeResult, ScrapeScheduleResult, ScrapeMovieScheduleResult } from 'src/services/scraperService';
import type { QTableColumn } from 'quasar';

const store = useMoviesStore();
const schedulesStore = useSchedulesStore();

const columns: QTableColumn[] = [
  { name: 'poster', label: '포스터', field: 'poster', align: 'center' },
  { name: 'title', label: '제목', field: 'title', align: 'left', sortable: true },
  { name: 'naverMovieId', label: '네이버 ID', field: 'naverMovieId', align: 'left' },
  { name: 'createdAt', label: '등록일', field: 'createdAt', align: 'left', sortable: true, format: (val: string) => val ? val.substring(0, 10).replace(/-/g, '/') : '-' },
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

// ── 스케줄 전체 삭제 ──────────────────────────────────────────────
const deleteSchedulesDialog = ref(false);
const deleteSchedulesTarget = ref<Movie | null>(null);
const deleteSchedulesCount = ref(0);

async function confirmDeleteSchedules(movie: Movie) {
  deleteSchedulesTarget.value = movie;
  deleteSchedulesCount.value = 0;
  deleteSchedulesDialog.value = true;
  const list = await schedulesStore.fetchByMovieCount(movie.id);
  deleteSchedulesCount.value = list;
}

async function doDeleteSchedules() {
  if (!deleteSchedulesTarget.value) return;
  try {
    await schedulesStore.deleteAllByMovie(deleteSchedulesTarget.value.id);
    deleteSchedulesDialog.value = false;
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

// ── 영화 스크래핑 ─────────────────────────────────────────────────
const movieScrapeDialog = ref(false);
const movieScrapeResult = ref<ScrapeResult | null>(null);

async function runMovieScrape() {
  try {
    const result = await store.scrapeFromNaver();
    movieScrapeResult.value = result;
    movieScrapeDialog.value = true;
  } catch {
    // store.error 로 표시됨
  }
}

// ── 스케줄 전체 수집 (글로벌) ─────────────────────────────────────
const scheduleScrapeDialog = ref(false);
const scheduleScrapeResult = ref<ScrapeScheduleResult | null>(null);

async function runScheduleScrape() {
  try {
    const result = await schedulesStore.scrapeSchedulesFromNaver();
    scheduleScrapeResult.value = result;
    scheduleScrapeDialog.value = true;
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

// ── 스케줄 개별 수집 (영화별) ─────────────────────────────────────
const movieScheduleScrapeDialog = ref(false);
const movieScheduleScrapeResult = ref<ScrapeMovieScheduleResult & { title: string } | null>(null);

async function runMovieScheduleScrape(movie: Movie) {
  try {
    const result = await schedulesStore.scrapeScheduleForMovie(movie.id);
    movieScheduleScrapeResult.value = { ...result, title: movie.title };
    movieScheduleScrapeDialog.value = true;
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

async function runMovieScheduleScrapeViaApi(movie: Movie) {
  try {
    const result = await schedulesStore.scrapeScheduleForMovieViaApi(movie.id);
    movieScheduleScrapeResult.value = { ...result, title: movie.title };
    movieScheduleScrapeDialog.value = true;
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

onMounted(() => store.fetchMovies());
</script>
