<template>
  <q-page>
    <!-- 영화 선택 캐러셀 -->
    <MovieCarousel
      :movies="movies"
      :selected-id="selectedMovie?.id ?? ''"
      :loading="moviesStore.loading"
      @select="onMovieSelect"
    />

    <!-- 영화 선택 후 표시 영역 -->
    <template v-if="selectedMovie">
      <!-- 날짜 선택 -->
      <DateSelector
        :movie="selectedMovie"
        v-model="selectedDate"
        :available-dates="availableDates"
        @detail="showDetailModal = true"
      />

      <!-- 극장 필터 -->
      <TheaterFilter v-model:chain-model="selectedChain" v-model:region-model="selectedRegion" />

      <!-- 스케줄 목록 -->
      <q-inner-loading :showing="schedulesLoading">
        <q-spinner color="primary" size="40px" />
      </q-inner-loading>

      <ScheduleList
        v-if="!schedulesLoading"
        :schedules="filteredSchedules"
        :favorites="favoriteTheaters"
        @toggle-favorite="onToggleFavorite"
      />
    </template>

    <!-- 영화 상세 모달 -->
    <q-dialog
      v-model="showDetailModal"
      maximized
      transition-show="slide-up"
      transition-hide="slide-down"
    >
      <q-card>
        <q-toolbar class="bg-primary text-white">
          <q-toolbar-title>영화 상세정보</q-toolbar-title>
          <q-btn flat round icon="close" @click="showDetailModal = false" />
        </q-toolbar>

        <q-card-section v-if="selectedMovie">
          <div class="row q-col-gutter-lg">
            <!-- 포스터 -->
            <div class="col-12 col-sm-4 col-md-3">
              <q-img :src="selectedMovie.poster" :ratio="2 / 3" class="rounded-borders">
                <template #error>
                  <div class="absolute-full flex flex-center bg-grey-3 text-grey-7">
                    <q-icon name="image_not_supported" size="40px" />
                  </div>
                </template>
              </q-img>
            </div>

            <!-- 상세 정보 -->
            <div class="col-12 col-sm-8 col-md-9">
              <div class="text-h5 text-weight-bold q-mb-md">{{ selectedMovie.title }}</div>

              <q-list separator>
                <q-item>
                  <q-item-section avatar><q-icon name="tag" /></q-item-section>
                  <q-item-section>{{
                    selectedMovie.naverMovieId ? `네이버 영화 #${selectedMovie.naverMovieId}` : '-'
                  }}</q-item-section>
                </q-item>
                <q-item v-if="selectedMovie.createdAt">
                  <q-item-section avatar><q-icon name="calendar_today" /></q-item-section>
                  <q-item-section
                    >등록일 {{ selectedMovie.createdAt?.slice(0, 10) }}</q-item-section
                  >
                </q-item>
                <q-item>
                  <q-item-section avatar><q-icon name="track_changes" /></q-item-section>
                  <q-item-section
                    >알림 {{ selectedMovie.isTracking ? '활성' : '비활성' }}</q-item-section
                  >
                </q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Movie } from 'src/types';
import { useMoviesStore } from 'stores/moviesStore';
import { useSchedulesStore } from 'stores/schedulesStore';
import MovieCarousel from 'components/MovieCarousel.vue';
import DateSelector from 'components/DateSelector.vue';
import TheaterFilter from 'components/TheaterFilter.vue';
import ScheduleList from 'components/ScheduleList.vue';
import 'src/css/home.css';

const moviesStore = useMoviesStore();
const schedulesStore = useSchedulesStore();

const selectedMovie = ref<Movie | null>(null);
const selectedDate = ref('');
const selectedChain = ref('극장 전체');
const selectedRegion = ref<string[]>([]);
const showDetailModal = ref(false);
const favoriteTheaters = ref<string[]>([]);

const movies = computed(() => moviesStore.movies);
const schedulesLoading = computed(() => schedulesStore.loading);

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const filteredSchedules = computed(() =>
  schedulesStore.schedules.filter((s) => {
    const matchDate = !selectedDate.value || s.date === selectedDate.value;
    const matchChain = selectedChain.value === '극장 전체' || s.chain === selectedChain.value;
    return matchDate && matchChain;
  }),
);

const availableDates = computed(() => {
  const dates = new Set(schedulesStore.schedules.map((s) => s.date));
  return [...dates];
});

async function onMovieSelect(movie: Movie): Promise<void> {
  selectedMovie.value = movie;
  selectedDate.value = todayStr();
  selectedChain.value = '극장 전체';
  selectedRegion.value = [];
  await schedulesStore.fetchByMovie(movie.id);
}

function onToggleFavorite(theaterName: string): void {
  const idx = favoriteTheaters.value.indexOf(theaterName);
  if (idx === -1) {
    favoriteTheaters.value.push(theaterName);
  } else {
    favoriteTheaters.value.splice(idx, 1);
  }
}

onMounted(async () => {
  await moviesStore.fetchMovies();
  if (moviesStore.movies.length > 0) {
    await onMovieSelect(moviesStore.movies[0]!);
  }
});
</script>
