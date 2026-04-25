<template>
  <q-page class="q-pa-md movies-page">
    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <!-- 활성 필터 칩 -->
    <div v-if="filterShowNew || filterShowUpdate || filterShowEng" class="movies-active-filters">
      <span class="movies-active-filter-label">필터:</span>
      <span v-if="filterShowNew" class="movies-active-chip movies-active-chip--new">NEW</span>
      <span v-if="filterShowUpdate" class="movies-active-chip movies-active-chip--update"
        >UPDATE</span
      >
      <span v-if="filterShowEng" class="movies-active-chip movies-active-chip--eng">ENG</span>
    </div>

    <!-- 로딩 -->
    <div v-if="store.loading" class="movies-loading">
      <q-spinner size="40px" color="deep-purple" />
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
            <div class="movie-card-badge-wrap">
              <q-badge
                v-if="isMovieNew(movie)"
                color="negative"
                label="NEW"
                class="movie-card-badge-item"
              />
              <q-badge
                v-else-if="isMovieUpdate(movie)"
                color="warning"
                label="UPDATE"
                class="movie-card-badge-item"
              />
              <q-badge
                v-if="schedulesStore.engScheduleMovieIds.has(movie.id)"
                color="primary"
                label="ENG"
                class="movie-card-badge-item"
              />
            </div>
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
      <div class="movies-footer-logo-row">
        <div class="movies-footer-logo-box">
          <q-icon name="movie" size="14px" color="white" />
        </div>
        <span class="movies-footer-logo-text">cineping</span>
      </div>
      <div class="movies-footer-links">
        <router-link to="/about" class="movies-footer-link">About</router-link>
        <span class="movies-footer-divider">·</span>
        <a href="mailto:wooriworld82@gmail.com" class="movies-footer-link">Contact</a>
      </div>
      <p class="movies-footer-copyright">© 2026 cineping. All rights reserved.</p>
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
            <label class="filter-checkbox-row">
              <q-checkbox v-model="filterShowEng" color="primary" />
              <span class="filter-badge filter-badge--eng">ENG</span>
              <span>Subtitle</span>
            </label>
          </div>
        </div>

        <div class="filter-dialog-footer">
          <q-btn
            outline
            @click="
              filterShowNew = false;
              filterShowUpdate = false;
              filterShowEng = false;
            "
          >
            Reset
          </q-btn>
          <q-btn style="background: #5b21b6; color: #fff" @click="applyFilter">Apply</q-btn>
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
            <a
              href="#"
              class="text-h6 movies-dialog-title"
              @click.prevent="openNaverMovieSearch"
            >
              {{ scheduleDialogMovie?.title }}
            </a>
            <a
              v-if="scheduleDialogMovie?.englishTitle"
              href="#"
              class="movies-dialog-english-title"
              @click.prevent="openLetterboxdByEnglishTitle"
            >
              {{ scheduleDialogMovie.englishTitle }}
            </a>
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
import { computed, ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useMeta } from 'quasar';
import { useMoviesStore } from 'src/stores/moviesStore';
import { useSchedulesStore } from 'src/stores/schedulesStore';
import type { Movie, Schedule } from 'src/types';
import DateSelector from 'src/components/DateSelector.vue';
import TheaterFilter, { type SortType } from 'src/components/TheaterFilter.vue';
import ScheduleList from 'src/components/ScheduleList.vue';
import { useMoviesFilter } from 'src/composables/useMoviesFilter';
import { resolveUrlToken } from 'src/services/urlTokenService';
import { trackEvent } from 'src/composables/useAnalytics';
import { openLetterboxdSearchByEnglishTitle } from 'src/composables/useLetterboxdSearch';

const route = useRoute();
const store = useMoviesStore();

useMeta({
  title: 'Find English Subtitled Movies in Seoul | cineping',
  meta: {
    description: {
      name: 'description',
      content:
        'Find movies in Seoul with English subtitles across CGV, Lotte Cinema, Megabox, KOFA Cinematheque and Emu Cinema. Search Korean cinema English subtitles and indie films Seoul English subs easily.',
    },
    keywords: {
      name: 'keywords',
      content:
        'movies in Seoul with English subtitles, Korean cinema English subtitles, indie films Seoul English subs, arthouse cinema Seoul English subtitles',
    },
    ogSiteName: {
      property: 'og:site_name',
      content: 'cineping',
    },
    ogTitle: {
      property: 'og:title',
      content: 'Find English Subtitled Movies in Seoul',
    },
    ogDescription: {
      property: 'og:description',
      content: 'Find English-subtitled movies and showtimes in Seoul easily.',
    },
    ogType: {
      property: 'og:type',
      content: 'website',
    },
    ogUrl: {
      property: 'og:url',
      content: 'https://wooriworld.github.io/cineping/',
    },
  },
  script: {
    ldJson: {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'cineping',
        url: 'https://wooriworld.github.io/cineping/',
      }),
    },
  },
});
const schedulesStore = useSchedulesStore();

const { searchTitle, filterShowNew, filterShowUpdate, filterShowEng, filterDialog } =
  useMoviesFilter();

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ?t= 토큰으로 조회한 sourceIds
const tokenIds = ref<string[]>([]);
const nowTimeKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(11, 16);

function isMovieNew(m: Movie): boolean {
  return (m.createdAt ?? '').slice(0, 10) === today;
}

function isMovieUpdate(m: Movie): boolean {
  return schedulesStore.newScheduleMovieIds.has(m.id) && (m.createdAt ?? '').slice(0, 10) < today;
}

const filteredMovies = computed(() => {
  const counts = schedulesStore.scheduleCounts;

  // ?t= 토큰 우선, 없으면 ?id= (하위 호환)
  const idParam = route.query.id;
  const idFilter =
    tokenIds.value.length > 0
      ? tokenIds.value
      : idParam
        ? (Array.isArray(idParam) ? idParam : [idParam])
            .flatMap((v) => (v ?? '').split(','))
            .filter(Boolean)
        : [];

  const q = (searchTitle.value ?? '').trim();

  let base = store.movies.filter((m) => (counts[m.id] ?? 0) > 0);

  if (idFilter.length > 0) {
    const idSet = new Set(idFilter);
    base = base.filter((m) => idSet.has(m.sourceId));
  } else {
    base = base.filter(
      (m) =>
        !q || m.title.includes(q) || (m.englishTitle ?? '').toLowerCase().includes(q.toLowerCase()),
    );
  }

  const filtered =
    !filterShowNew.value && !filterShowUpdate.value && !filterShowEng.value
      ? base
      : base.filter(
          (m) =>
            (filterShowNew.value && isMovieNew(m)) ||
            (filterShowUpdate.value && isMovieUpdate(m)) ||
            (filterShowEng.value && schedulesStore.engScheduleMovieIds.has(m.id)),
        );

  return filtered.sort((a, b) => {
    const aNew = isMovieNew(a) ? 0 : 1;
    const bNew = isMovieNew(b) ? 0 : 1;
    if (aNew !== bNew) return aNew - bNew;
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
const scheduleDialogChain = ref('All Theaters');
const scheduleDialogRegion = ref('Seoul');
const scheduleDialogSort = ref<SortType>('theater');
const scheduleDialogHallType = ref('All Screens');
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
  ...new Set(
    scheduleDialogSchedules.value
      .filter((s) => s.date !== today || s.startTime >= nowTimeKST)
      .map((s) => s.date),
  ),
]);

const scheduleDialogNewDates = computed<string[]>(() => {
  const movieCreatedAtKST = (scheduleDialogMovie.value?.createdAt ?? '').slice(0, 10);
  return [
    ...new Set(
      scheduleDialogSchedules.value
        .filter(
          (s) =>
            s.lastUpdatedAt && s.lastUpdatedAt.slice(0, 10) === today && movieCreatedAtKST < today,
        )
        .map((s) => s.date),
    ),
  ];
});

const scheduleDialogFiltered = computed(() =>
  scheduleDialogSchedules.value.filter((s) => {
    const matchDate = s.date === scheduleDialogDate.value;
    const matchChain =
      scheduleDialogChain.value === 'All Theaters' ||
      (scheduleDialogChain.value === 'Others'
        ? !['CGV', 'LotteCinema', 'Megabox'].includes(s.chain ?? '')
        : s.chain === scheduleDialogChain.value);
    const matchHallType =
      scheduleDialogHallType.value === 'All Screens' ||
      (scheduleDialogHallType.value === 'Premium'
        ? isRegularHall(s.screenType)
        : !isRegularHall(s.screenType));
    return matchDate && matchChain && matchHallType;
  }),
);

const scheduleDialogReady = ref(false);

async function openScheduleDialog(movie: Movie) {
  scheduleDialogReady.value = false;
  scheduleDialogMovie.value = movie;
  scheduleDialogDate.value = '';
  scheduleDialogChain.value = 'All Theaters';
  scheduleDialogRegion.value = 'Seoul';
  scheduleDialogSort.value = 'theater';
  scheduleDialogHallType.value = 'All Screens';
  scheduleDialogSchedules.value = [];
  scheduleDialogLoading.value = true;
  scheduleDialog.value = true;
  trackEvent('movie_open', {
    movie_title: movie.title,
    has_new_badge: isMovieNew(movie),
    has_update_badge: isMovieUpdate(movie),
    has_eng_badge: schedulesStore.engScheduleMovieIds.has(movie.id),
  });
  try {
    const list = await schedulesStore.getByMovie(movie.id);
    scheduleDialogSchedules.value = list;
    const dates = [
      ...new Set(
        list.filter((s) => s.date !== today || s.startTime >= nowTimeKST).map((s) => s.date),
      ),
    ].sort();
    scheduleDialogDate.value = dates.find((d) => d >= today) ?? '';
  } finally {
    scheduleDialogLoading.value = false;
    scheduleDialogReady.value = true;
  }
}

watch(scheduleDialogDate, (val) => {
  if (!scheduleDialogReady.value || !val) return;
  trackEvent('schedule_date_select', {
    movie_title: scheduleDialogMovie.value?.title ?? '',
    date: val,
  });
});

watch(scheduleDialogChain, (val) => {
  if (!scheduleDialogReady.value) return;
  trackEvent('schedule_chain_filter', {
    movie_title: scheduleDialogMovie.value?.title ?? '',
    chain: val,
  });
});

watch(scheduleDialogHallType, (val) => {
  if (!scheduleDialogReady.value) return;
  trackEvent('schedule_hall_filter', {
    movie_title: scheduleDialogMovie.value?.title ?? '',
    hall_type: val,
  });
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchTitle, (val) => {
  if (searchTimer) clearTimeout(searchTimer);
  const q = (val ?? '').trim();
  if (!q) return;
  searchTimer = setTimeout(() => {
    trackEvent('search', { search_term: q });
  }, 1000);
});

function applyFilter() {
  trackEvent('filter_apply', {
    filter_new: filterShowNew.value,
    filter_update: filterShowUpdate.value,
    filter_eng: filterShowEng.value,
  });
  filterDialog.value = false;
}

function openNaverMovieSearch() {
  const koreanTitle = scheduleDialogMovie.value?.title?.trim();
  if (!koreanTitle) return;
  const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(koreanTitle)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openLetterboxdByEnglishTitle() {
  const englishTitle = scheduleDialogMovie.value?.englishTitle;
  if (!englishTitle) return;
  openLetterboxdSearchByEnglishTitle(englishTitle);
}

watch(
  () => route.query.t,
  async (t) => {
    if (t && typeof t === 'string') {
      trackEvent('shared_link_access');
      tokenIds.value = await resolveUrlToken(t);
    } else {
      tokenIds.value = [];
    }
  },
  { immediate: true },
);

onMounted(() => {
  void store.fetchMovies();
  void schedulesStore.fetchScheduleCounts();
  void schedulesStore.fetchNewScheduleMovieIds();
  void schedulesStore.fetchEngScheduleMovieIds();
});
</script>
