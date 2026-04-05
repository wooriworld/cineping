<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">어드민</div>
      <q-btn
        color="green-8"
        icon="cloud_sync"
        label="전체 수집"
        class="q-mr-sm"
        @click="runAllScrape"
      >
      </q-btn>
      <q-btn
        color="indigo"
        icon="api"
        label="Naver 영화 수집"
        class="q-mr-sm"
        @click="runApiMovieScrape"
      >
      </q-btn>
      <q-btn
        color="deep-orange"
        icon="event_note"
        label="Naver 스케줄 수집"
        class="q-mr-sm"
        @click="runNaverScheduleScrape"
      >
      </q-btn>
      <q-btn
        color="teal"
        icon="video_library"
        label="KOFA 영화 수집"
        class="q-mr-sm"
        @click="runKofaScrape"
      >
      </q-btn>
      <q-btn
        color="deep-purple"
        icon="theaters"
        label="에무시네마 영화 수집"
        class="q-mr-sm"
        @click="runEmucinemaScrape"
      >
      </q-btn>
    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <div class="row items-center q-gutter-sm q-mb-md">
      <q-input
        v-model="searchTitle"
        outlined
        dense
        clearable
        placeholder="Search for movie titles"
        style="max-width: 300px"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn-dropdown
        :label="badgeFilterLabel"
        outline
        dense
        no-caps
        color="grey-7"
        icon="filter_list"
      >
        <q-list dense>
          <q-item
            v-for="opt in badgeFilterOptions"
            :key="opt.value"
            v-close-popup
            clickable
            :active="badgeFilter === opt.value"
            active-class="text-primary"
            @click="badgeFilter = opt.value"
          >
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-dropdown :label="sourceFilterLabel" outline dense no-caps color="grey-7" icon="source">
        <q-list dense>
          <q-item
            v-for="opt in sourceFilterOptions"
            :key="opt.value"
            v-close-popup
            clickable
            :active="sourceFilter === opt.value"
            active-class="text-primary"
            @click="sourceFilter = opt.value"
          >
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>

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
          <q-badge
            v-if="
              schedulesStore.newScheduleMovieIds.has(props.row.id) &&
              new Date(new Date(props.row.createdAt).getTime() + 9 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10) < today
            "
            color="teal"
            label="UPDATE"
            class="q-ml-xs"
          />
          <q-badge
            v-if="schedulesStore.engScheduleMovieIds.has(props.row.id)"
            color="primary"
            label="ENG"
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

    <!-- 스케줄 조회 팝업 -->
    <q-dialog v-model="scheduleDialog" maximized>
      <q-card>
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            {{ scheduleDialogMovie?.title }}
            <span v-if="scheduleDialogMovie?.englishTitle" class="text-subtitle1 text-grey-6"
              >({{ scheduleDialogMovie.englishTitle }})</span
            >
          </div>
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
              v-model:hall-type-model="scheduleDialogHallType"
            />
            <ScheduleList
              :schedules="scheduleDialogFiltered"
              :sort-model="scheduleDialogSort"
              :movie-created-at="scheduleDialogMovie?.createdAt"
            />
          </template>
        </q-card-section>
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
import type { QTableColumn } from 'quasar';

const store = useMoviesStore();
const schedulesStore = useSchedulesStore();

const columns: QTableColumn[] = [
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
  { name: 'sourceId', label: '수집처ID', field: 'sourceId', align: 'left' },
  { name: 'source', label: '수집처', field: 'source', align: 'center' },
  { name: 'actions', label: '관리', field: 'actions', align: 'center' },
];

const searchTitle = ref('');

type BadgeFilter = 'all' | 'new' | 'update' | 'both';
const badgeFilter = ref<BadgeFilter>('all');
const badgeFilterOptions: { label: string; value: BadgeFilter }[] = [
  { label: '전체', value: 'all' },
  { label: 'NEW', value: 'new' },
  { label: 'UPDATE', value: 'update' },
  { label: 'NEW + UPDATE', value: 'both' },
];
const badgeFilterLabel = computed(
  () => badgeFilterOptions.find((o) => o.value === badgeFilter.value)?.label ?? '전체',
);

type SourceFilter = 'all' | 'NAVER' | 'KOFA' | 'EMUCINE';
const sourceFilter = ref<SourceFilter>('all');
const sourceFilterOptions: { label: string; value: SourceFilter }[] = [
  { label: '수집처 전체', value: 'all' },
  { label: 'NAVER', value: 'NAVER' },
  { label: 'KOFA', value: 'KOFA' },
  { label: 'EMUCINE', value: 'EMUCINE' },
];
const sourceFilterLabel = computed(
  () => sourceFilterOptions.find((o) => o.value === sourceFilter.value)?.label ?? '수집처 전체',
);

const filteredMovies = computed(() => {
  const counts = schedulesStore.scheduleCounts; // 반응형 의존성 명시적 추적
  const q = (searchTitle.value ?? '').trim();
  const base = store.movies
    .filter(
      (m) =>
        !q || m.title.includes(q) || (m.englishTitle ?? '').toLowerCase().includes(q.toLowerCase()),
    )
    .filter((m) => sourceFilter.value === 'all' || m.source === sourceFilter.value);

  const isNew = (m: (typeof base)[0]) =>
    new Date(new Date(m.createdAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) ===
    today;
  const isScNew = (m: (typeof base)[0]) =>
    schedulesStore.newScheduleMovieIds.has(m.id) &&
    new Date(new Date(m.createdAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) <
      today;

  const filtered =
    badgeFilter.value === 'new'
      ? base.filter(isNew)
      : badgeFilter.value === 'update'
        ? base.filter(isScNew)
        : badgeFilter.value === 'both'
          ? base.filter((m) => isNew(m) || isScNew(m))
          : base;

  return filtered.sort((a, b) => {
    const createdDiff = (b.createdAt ?? '')
      .slice(0, 10)
      .localeCompare((a.createdAt ?? '').slice(0, 10));
    if (createdDiff !== 0) return createdDiff;
    const countDiff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
    if (countDiff !== 0) return countDiff;
    return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
  });
});

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

// ── 전체 수집 ─────────────────────────────────────────────────────
async function runAllScrape() {
  try {
    await store.scrapeAll();
  } catch {
    // store.error 로 표시됨
  }
}

// ── Naver 영화 수집 ─────────────────────────────────────────────
async function runApiMovieScrape() {
  try {
    await store.scrapeFromNaver();
  } catch {
    // store.error 로 표시됨
  }
}

// ── 네이버 스케줄 수집 ─────────────────────────────────────
async function runNaverScheduleScrape() {
  try {
    await schedulesStore.scrapeSchedulesFromNaver();
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

// ── KOFA 영화 수집 ────────────────────────────────────────────────
async function runKofaScrape() {
  try {
    await store.scrapeFromKofa();
  } catch {
    // store.error 로 표시됨
  }
}

// ── 에무시네마 영화 수집 ──────────────────────────────────────────
async function runEmucinemaScrape() {
  try {
    await store.scrapeFromEmucine();
  } catch {
    // store.error 로 표시됨
  }
}

// ── 스케줄 조회 팝업 ──────────────────────────────────────────────
const scheduleDialog = ref(false);
const scheduleDialogMovie = ref<Movie | null>(null);
const scheduleDialogDate = ref('');
const scheduleDialogChain = ref('극장 전체');
const scheduleDialogRegion = ref('서울');
const scheduleDialogSort = ref<SortType>('theater');
const scheduleDialogHallType = ref('상영관 전체');
const scheduleDialogLoading = ref(false);
const scheduleDialogSchedules = ref<Schedule[]>([]);

function isRegularHall(screenType: string): boolean {
  const s = screenType || '';
  return (
    /^\d+관$/.test(s) || // N관
    /^\d+관\(\d+층\)$/.test(s) || // N관(N층)
    /^\d+관 \d+층$/.test(s) || // N관 N층
    /^\d+관 \d+층 \(Laser\)$/.test(s) || // N관 N층 (Laser)
    /^\d+관 \(Laser\)$/.test(s) || // N관 (Laser)
    /^\d+관 B\d+층$/.test(s) || // N관 BN층
    /^\d+관 B\d+층 \(Laser\)$/.test(s) || // N관 BN층 (Laser)
    /^\d+관 본관\d+층$/.test(s) || // N관 본관N층
    /^\d+관 본관 B\d+층$/.test(s) // N관 본관 BN층
  );
}

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
    const matchHallType =
      scheduleDialogHallType.value === '상영관 전체' ||
      (scheduleDialogHallType.value === '일반관'
        ? isRegularHall(s.screenType)
        : !isRegularHall(s.screenType));
    return matchDate && matchChain && matchHallType;
  }),
);

async function openScheduleDialog(movie: Movie) {
  scheduleDialogMovie.value = movie;
  scheduleDialogDate.value = '';
  scheduleDialogChain.value = '극장 전체';
  scheduleDialogRegion.value = '서울';
  scheduleDialogSort.value = 'theater';
  scheduleDialogHallType.value = '상영관 전체';
  scheduleDialogSchedules.value = [];
  scheduleDialogLoading.value = true;
  scheduleDialog.value = true;
  try {
    const list = await schedulesStore.getByMovie(movie.id);
    scheduleDialogSchedules.value = list;
    const dates = [...new Set(list.map((s) => s.date))].sort();
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    scheduleDialogDate.value = dates.find((d) => d >= todayStr) ?? '';
  } finally {
    scheduleDialogLoading.value = false;
  }
}

onMounted(() => {
  void store.fetchMovies();
  void schedulesStore.fetchScheduleCounts();
  void schedulesStore.fetchNewScheduleMovieIds();
  void schedulesStore.fetchEngScheduleMovieIds();
});
</script>
