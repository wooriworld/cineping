<template>
  <q-page class="q-pa-md movies-page">
    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <!-- 활성 필터 칩 -->
    <div v-if="filterShowNew || filterShowUpdate" class="movies-active-filters">
      <span class="movies-active-filter-label">필터:</span>
      <span v-if="filterShowNew" class="movies-active-chip movies-active-chip--new">NEW</span>
      <span v-if="filterShowUpdate" class="movies-active-chip movies-active-chip--update"
        >UPDATE</span
      >
    </div>

    <!-- 로딩 -->
    <div v-if="store.loading" class="movies-loading">
      <q-spinner size="40px" color="primary" />
    </div>

    <!-- 영화 그리드 -->
    <template v-else>
      <div v-if="filteredMovies.length > 0" class="movie-grid">
        <div
          v-for="movie in filteredMovies"
          :key="movie.id"
          class="movie-card"
          @click="openScheduleDialog(movie)"
        >
          <!-- 포스터 -->
          <div class="movie-card-poster">
            <q-img v-if="movie.poster" :src="movie.poster" :ratio="2 / 3" fit="cover" />
            <div v-else class="movie-card-img-empty">
              <q-icon name="image_not_supported" size="36px" color="grey-4" />
            </div>
            <q-badge
              v-if="isMovieNew(movie)"
              color="negative"
              label="NEW"
              class="movie-card-badge"
            />
            <q-badge
              v-else-if="isMovieUpdate(movie)"
              color="warning"
              label="UPDATE"
              class="movie-card-badge"
            />
            <div class="movie-card-overlay" />
          </div>

          <!-- 정보 -->
          <div class="movie-card-info">
            <h3 class="movie-card-title">{{ movie.title }}</h3>
            <p v-if="movie.englishTitle" class="movie-card-en">{{ movie.englishTitle }}</p>
            <div class="movie-card-meta">
              <q-icon name="calendar_today" size="11px" />
              <span>{{ movie.releaseDate || '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 빈 상태 -->
      <div v-else class="movies-empty">
        <p>
          {{ searchTitle ? '검색 결과가 없습니다.' : '필터 조건에 맞는 영화가 없습니다.' }}
        </p>
      </div>
    </template>

    <!-- 푸터 -->
    <div class="movies-footer">
      <div class="movies-footer-inner">
        <div class="movies-footer-logo-box">
          <q-icon name="movie" size="14px" color="white" />
        </div>
        <span class="movies-footer-logo-text">cineping</span>
      </div>
      <p class="movies-footer-sub">당신의 영화 스케줄을 한눈에</p>
    </div>

    <!-- 필터 다이얼로그 (오른쪽 슬라이드) -->
    <q-dialog v-model="filterDialog" position="right" full-height>
      <q-card class="filter-dialog-card">
        <div class="filter-dialog-header">
          <span class="text-h6 text-weight-bold">Filter</span>
          <q-btn flat round dense icon="close" @click="filterDialog = false" />
        </div>

        <div class="filter-dialog-body">
          <div>
            <div class="filter-section-label">Listing Updates</div>
            <label class="filter-checkbox-row">
              <q-checkbox v-model="filterShowNew" color="negative" />
              <span class="filter-badge filter-badge--new">NEW</span>
              <span>Movie</span>
            </label>
            <label class="filter-checkbox-row">
              <q-checkbox v-model="filterShowUpdate" color="warning" />
              <span class="filter-badge filter-badge--update">UPDATE</span>
              <span>Schedule</span>
            </label>
          </div>
        </div>

        <div class="filter-dialog-footer">
          <q-btn
            outline
            @click="
              filterShowNew = false;
              filterShowUpdate = false;
            "
          >
            Reset
          </q-btn>
          <q-btn color="primary" @click="filterDialog = false">Apply</q-btn>
        </div>
      </q-card>
    </q-dialog>

    <!-- 스케줄 조회 팝업 -->
    <q-dialog v-model="scheduleDialog" maximized>
      <q-card class="column no-wrap">
        <q-card-section class="row items-start no-wrap q-pb-none movies-dialog-header">
          <q-img
            v-if="scheduleDialogMovie?.poster"
            :src="scheduleDialogMovie.poster"
            style="width: 48px"
            ratio="0.75"
            fit="cover"
            class="movies-dialog-poster q-mr-sm"
          />
          <div class="movies-dialog-title-wrap">
            <div class="text-h6 movies-dialog-title">{{ scheduleDialogMovie?.title }}</div>
            <div v-if="scheduleDialogMovie?.englishTitle" class="movies-dialog-english-title">
              {{ scheduleDialogMovie.englishTitle }}
            </div>
          </div>
          <q-btn
            icon="close"
            flat
            round
            dense
            v-close-popup
            class="q-ml-sm movies-dialog-close-btn"
          />
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
import { useRoute } from 'vue-router';
import { useMoviesStore } from 'src/stores/moviesStore';
import { useSchedulesStore } from 'src/stores/schedulesStore';
import type { Movie, Schedule } from 'src/types';
import DateSelector from 'src/components/DateSelector.vue';
import TheaterFilter, { type SortType } from 'src/components/TheaterFilter.vue';
import ScheduleList from 'src/components/ScheduleList.vue';
import { useMoviesFilter } from 'src/composables/useMoviesFilter';

const route = useRoute();
const store = useMoviesStore();
const schedulesStore = useSchedulesStore();

const { searchTitle, filterShowNew, filterShowUpdate, filterDialog } = useMoviesFilter();

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

function isMovieNew(m: Movie): boolean {
  return (
    new Date(new Date(m.createdAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) ===
    today
  );
}

function isMovieUpdate(m: Movie): boolean {
  return (
    schedulesStore.newScheduleMovieIds.has(m.id) &&
    new Date(new Date(m.createdAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) <
      today
  );
}

const filteredMovies = computed(() => {
  const counts = schedulesStore.scheduleCounts;
  const idParam = route.query.id;
  const idFilter = idParam
    ? (Array.isArray(idParam) ? idParam : [idParam])
        .flatMap((v) => (v ?? '').split(','))
        .filter(Boolean)
    : [];

  if (idFilter.length > 0) {
    const idSet = new Set(idFilter);
    return store.movies.filter((m) => idSet.has(m.naverMovieId) && (counts[m.id] ?? 0) > 0);
  }

  const q = (searchTitle.value ?? '').trim();
  const base = store.movies
    .filter((m) => (counts[m.id] ?? 0) > 0)
    .filter(
      (m) =>
        !q || m.title.includes(q) || (m.englishTitle ?? '').toLowerCase().includes(q.toLowerCase()),
    );

  const filtered =
    !filterShowNew.value && !filterShowUpdate.value
      ? base
      : base.filter(
          (m) =>
            (filterShowNew.value && isMovieNew(m)) || (filterShowUpdate.value && isMovieUpdate(m)),
        );

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
    /^\d+관 B\d+층$/.test(s) // N관 BN층
  );
}

const scheduleDialogAvailableDates = computed<string[]>(() => [
  ...new Set(scheduleDialogSchedules.value.map((s) => s.date)),
]);

const scheduleDialogNewDates = computed<string[]>(() => {
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
});
</script>
