<template>
  <q-page class="q-pa-md movies-page">
    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <div class="movies-toolbar">
      <q-input
        v-model="searchTitle"
        outlined
        dense
        clearable
        placeholder="Search for movie titles..."
        class="movies-search-input"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-btn outline dense no-caps class="movies-filter-dropdown">
        <span v-if="badgeFilter === 'all'" class="movies-filter-label-text">Filter</span>
        <template v-else>
          <span
            v-if="badgeFilter === 'new' || badgeFilter === 'both'"
            class="movies-filter-chip movies-filter-chip--new"
            >NEW</span
          >
          <span
            v-if="badgeFilter === 'update' || badgeFilter === 'both'"
            class="movies-filter-chip movies-filter-chip--update"
            :class="{ 'q-ml-xs': badgeFilter === 'both' }"
            >UPDATE</span
          >
        </template>
        <q-icon name="arrow_drop_down" size="xs" />

        <q-menu>
          <div class="movies-filter-panel">
            <button
              class="movies-filter-badge-btn movies-filter-badge-btn--new"
              :class="{ 'is-active': badgeFilter === 'new' || badgeFilter === 'both' }"
              @click="
                badgeFilter =
                  badgeFilter === 'new' || badgeFilter === 'both'
                    ? badgeFilter === 'both'
                      ? 'update'
                      : 'all'
                    : badgeFilter === 'update'
                      ? 'both'
                      : 'new'
              "
            >
              NEW
            </button>
            <button
              class="movies-filter-badge-btn movies-filter-badge-btn--update"
              :class="{ 'is-active': badgeFilter === 'update' || badgeFilter === 'both' }"
              @click="
                badgeFilter =
                  badgeFilter === 'update' || badgeFilter === 'both'
                    ? badgeFilter === 'both'
                      ? 'new'
                      : 'all'
                    : badgeFilter === 'new'
                      ? 'both'
                      : 'update'
              "
            >
              UPDATE
            </button>
          </div>
        </q-menu>
      </q-btn>
    </div>

    <div class="movies-table-wrap">
      <q-table
        :rows="filteredMovies"
        :columns="columns"
        row-key="id"
        :loading="store.loading"
        :rows-per-page-options="[10, 20, 30, 0]"
        :pagination="{ rowsPerPage: 10 }"
        flat
        bordered
        :grid="$q.screen.xs"
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
              class="q-ml-xs movies-status-badge"
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
              class="q-ml-xs movies-status-badge"
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

        <!-- 모바일 그리드 카드 (xs 화면) -->
        <template #item="props">
          <div class="movies-grid-item col-12">
            <div class="movies-grid-card" @click="openScheduleDialog(props.row)">
              <q-img
                v-if="props.row.poster"
                :src="props.row.poster"
                class="movies-grid-poster"
                fit="cover"
              />
              <div v-else class="movies-grid-poster movies-grid-poster-empty">
                <q-icon name="image_not_supported" size="sm" color="grey-4" />
              </div>
              <div class="movies-grid-info">
                <div class="movies-grid-title">
                  <span>{{ props.row.title }}</span>
                  <q-badge
                    v-if="
                      new Date(new Date(props.row.createdAt).getTime() + 9 * 60 * 60 * 1000)
                        .toISOString()
                        .slice(0, 10) === today
                    "
                    color="red"
                    label="NEW"
                    class="movies-status-badge"
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
                    class="movies-status-badge"
                  />
                </div>
                <div v-if="props.row.englishTitle" class="movies-grid-english-title">
                  {{ props.row.englishTitle }}
                </div>
                <div class="movies-grid-meta">
                  <span class="movies-grid-release">{{ props.row.releaseDate || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </q-table>
    </div>

    <!-- 스케줄 조회 팝업 -->
    <q-dialog v-model="scheduleDialog" maximized>
      <q-card class="column no-wrap">
        <q-card-section class="row items-center q-pb-none movies-dialog-header">
          <div class="movies-dialog-title-wrap">
            <div class="text-h6">{{ scheduleDialogMovie?.title }}</div>
            <div v-if="scheduleDialogMovie?.englishTitle" class="movies-dialog-english-title">
              {{ scheduleDialogMovie.englishTitle }}
            </div>
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="movies-dialog-body">
          <div v-if="scheduleDialogLoading" class="text-center q-pa-lg">
            <q-spinner size="40px" color="primary" />
          </div>
          <template v-else>
            <DateSelector
              v-model="scheduleDialogDate"
              :available-dates="scheduleDialogAvailableDates"
              :new-dates="scheduleDialogNewDates"
            />
            <TheaterFilter
              v-model:chain-model="scheduleDialogChain"
              v-model:region-model="scheduleDialogRegion"
              v-model:sort-model="scheduleDialogSort"
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

const filteredMovies = computed(() => {
  const counts = schedulesStore.scheduleCounts; // 반응형 의존성 명시적 추적
  const q = searchTitle.value.trim();
  const base = q
    ? store.movies.filter(
        (m) =>
          m.title.includes(q) || (m.englishTitle ?? '').toLowerCase().includes(q.toLowerCase()),
      )
    : [...store.movies];

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

const scheduleDialogNewDates = computed(() => {
  const movieCreatedAtKST = scheduleDialogMovie.value?.createdAt
    ? new Date(new Date(scheduleDialogMovie.value.createdAt).getTime() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
    : '';
  return [
    ...new Set(
      scheduleDialogSchedules.value
        .filter(
          (s) =>
            s.lastUpdatedAt &&
            new Date(new Date(s.lastUpdatedAt).getTime() + 9 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10) === today &&
            movieCreatedAtKST < today,
        )
        .map((s) => s.date),
    ),
  ];
});

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
});
</script>
