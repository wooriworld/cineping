<template>
  <div class="movie-carousel-section">
    <div class="movie-carousel-wrapper">

      <!-- 포스터 스크롤 트랙 -->
      <div ref="trackRef" class="movie-carousel-track">
        <div
          v-for="movie in movies"
          :key="movie.id"
          class="movie-poster-item"
          :class="{ selected: selectedId === movie.id }"
          @click="$emit('select', movie)"
        >
          <!-- 포스터 이미지 영역 -->
          <div class="movie-poster-img-wrap">
            <img
              :src="movie.poster || 'https://via.placeholder.com/152x228?text=No+Image'"
              :alt="movie.title"
              class="movie-poster-img"
            />

            <!-- 호버 오버레이 -->
            <div class="movie-poster-overlay" />
          </div>

          <!-- 영화 정보 -->
          <div class="movie-poster-title">{{ movie.title }}</div>
        </div>

        <!-- 빈 상태 -->
        <div v-if="movies.length === 0" class="text-grey-5 q-pa-xl text-body2">
          등록된 영화가 없습니다.
        </div>
      </div>


</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { Movie } from 'src/types';
import 'src/css/movie-carousel.css';

const props = defineProps<{
  movies: Movie[];
  selectedId: string;
}>();

defineEmits<{ select: [movie: Movie] }>();

const trackRef = ref<HTMLElement | null>(null);

async function centerSelected(): Promise<void> {
  await nextTick();
  if (!trackRef.value) return;
  const track = trackRef.value;
  const selected = track.querySelector<HTMLElement>('.selected');
  if (!selected) return;

  // 선택 아이템 너비 고정값 (CSS flex-basis 112px과 동기화)
  const selWidth = 112;
  const halfSel = selWidth / 2;
  const halfTrack = track.clientWidth / 2;

  // 첫/마지막 아이템도 정중앙 정렬이 되도록 인라인 패딩 설정
  track.style.paddingLeft = `${halfTrack - halfSel}px`;
  track.style.paddingRight = `${halfTrack - halfSel}px`;

  // 패딩 변경 후 레이아웃 즉시 반영 (강제 리플로우)
  void track.offsetWidth;

  const scrollLeft = selected.offsetLeft - halfTrack + halfSel;
  track.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
}

watch(() => props.selectedId, centerSelected);
</script>
