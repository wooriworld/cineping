<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">현재 상영 영화</div>
      <q-btn
        color="indigo"
        icon="api"
        label="현재 상영 영화 수집"
        class="q-mr-sm"
        :loading="store.apiScrapeLoading"
        @click="runApiMovieScrape"
      >
        <q-tooltip>네이버 API URL로 영화 수집</q-tooltip>
      </q-btn>
      <q-btn
        color="deep-orange"
        icon="event_note"
        label="전체 스케줄 수집"
        class="q-mr-sm"
        :loading="schedulesStore.scrapeLoading"
        @click="runScheduleScrape"
      >
        <q-tooltip>DB 영화 전체 상영 스케줄 수집 (7일치)</q-tooltip>
      </q-btn>
    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <q-input
      v-model="searchTitle"
      outlined
      dense
      clearable
      placeholder="영화 제목 검색"
      class="q-mb-md"
      style="max-width: 300px"
    >
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <q-table
      :rows="filteredMovies"
      :columns="columns"
      row-key="id"
      :loading="store.loading"
      :rows-per-page-options="[10, 20, 30, 0]"
      :pagination="{ rowsPerPage: 10 }"
      flat
      bordered
    >
      <template #body-cell-no="props">
        <q-td align="center">{{ props.rowIndex + 1 }}</q-td>
      </template>

      <template #body-cell-title="props">
        <q-td>
          <span class="cursor-pointer text-primary" @click="openScheduleDialog(props.row)">{{
            props.row.title
          }}</span>
          <q-badge
            v-if="props.row.createdAt?.slice(0, 10) === today"
            color="red"
            label="NEW"
            class="q-ml-xs"
          />
        </q-td>
      </template>

      <template #body-cell-scheduleCount="props">
        <q-td align="center">
          {{ schedulesStore.scheduleCounts[props.row.id] || 0 }}
        </q-td>
      </template>

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
          <q-btn
            flat
            round
            dense
            icon="event_busy"
            color="orange"
            @click="confirmDeleteSchedules(props.row)"
          >
            <q-tooltip>스케쥴 삭제</q-tooltip>
          </q-btn>
          <q-btn
            flat
            round
            dense
            icon="download"
            color="purple"
            :loading="schedulesStore.apiScrapeLoadingMovies.has(props.row.id)"
            :disable="!props.row.naverMovieId"
            @click="runMovieScheduleScrapeViaApi(props.row)"
          >
            <q-tooltip>{{
              props.row.naverMovieId ? '스케줄 수집' : 'naverMovieId 없음'
            }}</q-tooltip>
          </q-btn>
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
        <q-card-section class="text-h6">스케줄 삭제</q-card-section>
        <q-card-section class="text-body2 q-pt-none">
          <strong>{{ deleteSchedulesTarget?.title }}</strong
          >의 스케줄을 모두 삭제하시겠습니까?
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn
            color="negative"
            label="삭제"
            :loading="schedulesStore.loading"
            @click="doDeleteSchedules"
          />
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
          <q-list>
            <q-item>
              <q-item-section avatar><q-icon name="add_circle" color="positive" /></q-item-section>
              <q-item-section>
                <q-item-label>추가</q-item-label>
                <q-item-label caption>{{ movieScheduleScrapeResult.added }}개</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section avatar><q-icon name="edit" color="warning" /></q-item-section>
              <q-item-section>
                <q-item-label>수정</q-item-label>
                <q-item-label caption>{{ movieScheduleScrapeResult.updated }}개</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section>
              <q-item-section>
                <q-item-label>삭제</q-item-label>
                <q-item-label caption>{{ movieScheduleScrapeResult.deleted }}개</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
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

    <!-- 스케줄 조회 팝업 -->
    <q-dialog v-model="scheduleDialog" maximized>
      <q-card>
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ scheduleDialogMovie?.title }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-sm">
          <div v-if="scheduleDialogLoading" class="text-center q-pa-lg">
            <q-spinner size="40px" color="primary" />
          </div>
          <template v-else>
            <DateSelector
              v-model="scheduleDialogDate"
              :available-dates="scheduleDialogAvailableDates"
            />
            <TheaterFilter
              v-model:chain-model="scheduleDialogChain"
              v-model:region-model="scheduleDialogRegion"
              v-model:sort-model="scheduleDialogSort"
            />
            <ScheduleList :schedules="scheduleDialogFiltered" :sort-model="scheduleDialogSort" :movie-created-at="scheduleDialogMovie?.createdAt" />
          </template>
        </q-card-section>
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
                  >{{ err }}</q-item-label
                >
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
import { computed, ref, onMounted } from 'vue';
import { useMoviesStore } from 'src/stores/moviesStore';
import { useSchedulesStore } from 'src/stores/schedulesStore';
import type { Movie, Schedule } from 'src/types';
import DateSelector from 'src/components/DateSelector.vue';
import TheaterFilter, { type SortType } from 'src/components/TheaterFilter.vue';
import ScheduleList from 'src/components/ScheduleList.vue';
import type {
  ScrapeResult,
  ScrapeScheduleResult,
  ScrapeMovieScheduleResult,
} from 'src/services/scraperService';
import type { QTableColumn } from 'quasar';

const store = useMoviesStore();
const schedulesStore = useSchedulesStore();

const columns: QTableColumn[] = [
  { name: 'no', label: 'No', field: 'id', align: 'center' },
  { name: 'poster', label: '포스터', field: 'poster', align: 'center' },
  { name: 'title', label: '제목', field: 'title', align: 'left', sortable: true },
  { name: 'englishTitle', label: '영어 제목', field: 'englishTitle', align: 'left' },
  { name: 'releaseDate', label: '개봉일', field: 'releaseDate', align: 'left', sortable: true },
  {
    name: 'createdAt',
    label: '등록일',
    field: 'createdAt',
    align: 'left',
    sortable: true,
    format: (val: string) => (val ? val.substring(0, 10).replace(/-/g, '/') : '-'),
  },
  { name: 'scheduleCount', label: '스케줄', field: 'id', align: 'center' },
  { name: 'naverMovieId', label: '네이버 ID', field: 'naverMovieId', align: 'left' },
  { name: 'actions', label: '관리', field: 'actions', align: 'center' },
];

const searchTitle = ref('');
const filteredMovies = computed(() => {
  const counts = schedulesStore.scheduleCounts; // 반응형 의존성 명시적 추적
  const base = searchTitle.value.trim()
    ? store.movies.filter((m) => m.title.includes(searchTitle.value.trim()))
    : [...store.movies];

  return base.sort((a, b) => {
    const createdDiff = (b.createdAt ?? '')
      .slice(0, 10)
      .localeCompare((a.createdAt ?? '').slice(0, 10));
    if (createdDiff !== 0) return createdDiff;
    const countDiff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
    if (countDiff !== 0) return countDiff;
    return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
  });
});

const today = new Date().toISOString().slice(0, 10);

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

// ── API 영화 스크래핑 ─────────────────────────────────────────────
const movieScrapeDialog = ref(false);
const movieScrapeResult = ref<ScrapeResult | null>(null);

async function runApiMovieScrape() {
  try {
    const result = await store.scrapeFromNaverViaApi();
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
    void schedulesStore.fetchScheduleCounts();
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

// ── 스케줄 개별 수집 (영화별) ─────────────────────────────────────
const movieScheduleScrapeDialog = ref(false);
const movieScheduleScrapeResult = ref<(ScrapeMovieScheduleResult & { title: string }) | null>(null);

async function runMovieScheduleScrapeViaApi(movie: Movie) {
  try {
    const result = await schedulesStore.scrapeScheduleForMovieViaApi(movie.id);
    movieScheduleScrapeResult.value = { ...result, title: movie.title };
    movieScheduleScrapeDialog.value = true;
    void schedulesStore.fetchScheduleCounts();
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

// ── 스케줄 조회 팝업 ──────────────────────────────────────────────
const scheduleDialog = ref(false);
const scheduleDialogMovie = ref<Movie | null>(null);
const scheduleDialogDate = ref('');
const scheduleDialogChain = ref('극장 전체');
const scheduleDialogRegion = ref('서울');
const scheduleDialogSort = ref<SortType>('theater');
const scheduleDialogLoading = ref(false);
const scheduleDialogSchedules = ref<Schedule[]>([]);

const scheduleDialogAvailableDates = computed(() => [
  ...new Set(scheduleDialogSchedules.value.map((s) => s.date)),
]);

const scheduleDialogFiltered = computed(() =>
  scheduleDialogSchedules.value.filter((s) => {
    const matchDate = s.date === scheduleDialogDate.value;
    const matchChain =
      scheduleDialogChain.value === '극장 전체' ||
      (scheduleDialogChain.value === '그 외 극장'
        ? !['CGV', '롯데시네마', '메가박스'].includes(s.chain ?? '')
        : s.chain === scheduleDialogChain.value);
    return matchDate && matchChain;
  }),
);

async function openScheduleDialog(movie: Movie) {
  scheduleDialogMovie.value = movie;
  scheduleDialogDate.value = '';
  scheduleDialogChain.value = '극장 전체';
  scheduleDialogRegion.value = '서울';
  scheduleDialogSort.value = 'theater';
  scheduleDialogSchedules.value = [];
  scheduleDialogLoading.value = true;
  scheduleDialog.value = true;
  try {
    const list = await schedulesStore.getByMovie(movie.id);
    scheduleDialogSchedules.value = list;
    const dates = [...new Set(list.map((s) => s.date))].sort();
    const today = new Date().toISOString().slice(0, 10);
    scheduleDialogDate.value = dates.find((d) => d >= today) ?? dates[0] ?? '';
  } finally {
    scheduleDialogLoading.value = false;
  }
}

onMounted(() => {
  void store.fetchMovies();
  void schedulesStore.fetchScheduleCounts();
});
</script>
