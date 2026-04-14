<template>
  <div class="theater-map-area">
    <!-- 지도 캔버스 -->
    <div class="theater-map-canvas-wrap" @click="handleMapClick">
      <div ref="mapRef" class="naver-map-canvas"></div>

      <div v-if="isLoading" class="map-overlay map-overlay--loading">
        <q-spinner color="white" size="28px" />
        <span class="map-overlay-text">지도 로딩 중...</span>
      </div>

      <div v-else-if="error" class="map-overlay map-overlay--error">
        <q-icon name="location_off" size="32px" color="grey-4" />
        <span class="map-overlay-text">{{ error }}</span>
      </div>

      <!-- 지도 열기 힌트 -->
      <div v-else class="map-open-hint">
        <q-icon name="open_in_new" size="14px" />
        <span>지도 탭하여 열기</span>
      </div>
    </div>

    <!-- 하단 정보 바 -->
    <div class="theater-map-info">
      <div class="map-info-address">
        <div class="map-address-name">{{ theaterName }}</div>
        <div class="map-address-detail">
          {{ coords?.roadAddress || (isLoading ? '주소 검색 중...' : '주소 정보 없음') }}
        </div>
      </div>
      <q-btn
        unelevated
        label="길찾기"
        icon="directions"
        color="deep-purple-7"
        text-color="white"
        size="sm"
        class="map-navi-btn"
        @click.stop="handleNavigate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useNaverMap } from 'src/composables/useNaverMap';

const props = defineProps<{
  theaterName: string;
}>();

const mapRef = ref<HTMLElement | null>(null);
const { isLoading, error, coords, initMap, openNaverMaps, destroyMap } = useNaverMap();

async function loadMap(): Promise<void> {
  if (!mapRef.value) return;
  destroyMap();
  await initMap(mapRef.value, props.theaterName);
}

onMounted(loadMap);

watch(() => props.theaterName, loadMap);

function handleMapClick(): void {
  if (isLoading.value || error.value) return;
  openNaverMaps(props.theaterName);
}

function handleNavigate(): void {
  openNaverMaps(props.theaterName);
}
</script>
