<template>
  <div class="schedule-section">
    <div class="schedule-inner">

      <!-- 빈 상태 -->
      <div v-if="grouped.length === 0" class="schedule-empty">
        <q-icon name="event_busy" size="48px" color="grey-4" />
        <div class="q-mt-md text-grey-5 text-body1">선택하신 날짜에 상영 일정이 없습니다.</div>
      </div>

      <!-- 극장 카드 목록 -->
      <div
        v-for="theater in grouped"
        :key="theater.name"
        class="theater-card"
      >
        <!-- 극장 헤더 -->
        <div class="theater-header" @click="toggleMap(theater.name)">
          <span :class="['theater-name', { 'theater-name--active': openMapSet.has(theater.name) }]">{{ theater.name }}</span>
        </div>

        <!-- 가로 스크롤 상영 시간 -->
        <div class="showtime-scroll-wrapper">
          <q-btn
            flat round dense icon="chevron_left" size="sm"
            class="scroll-arrow"
            @click="scrollShowtime($event, -260)"
          />
          <div class="showtime-scroll">
            <template v-for="hall in theater.halls" :key="hall.key">
              <button
                v-for="s in hall.schedules"
                :key="s.id"
                class="showtime-btn"
                @click="openBooking(s.bookingUrl)"
              >
                <div class="showtime-btn-time-row">
                  <span class="showtime-btn-start">{{ s.startTime }}</span><span class="showtime-btn-end">~{{ s.endTime }}</span>
                  <q-badge v-if="s.lastUpdatedAt && (s.lastUpdatedAt).slice(0, 10) === today && (props.movieCreatedAt ?? '').slice(0, 10) < today" color="red" label="NEW" class="q-ml-xs showtime-new-badge" />
                  <q-badge v-if="s.hasEnglishSubtitle" color="primary" label="ENG" class="q-ml-xs showtime-new-badge" />
                </div>
                <span class="showtime-btn-hall">{{ s.screenType || '2D' }}</span>
              </button>
            </template>
          </div>
          <q-btn
            flat round dense icon="chevron_right" size="sm"
            class="scroll-arrow"
            @click="scrollShowtime($event, 260)"
          />
        </div>

        <!-- 지도 영역 -->
        <transition name="map-slide">
          <div v-if="openMapSet.has(theater.name)" class="theater-map-area">
            <div class="theater-map-placeholder">
              <div class="map-pin-icon">
                <q-icon name="location_on" size="36px" color="deep-purple-6" />
                <q-icon name="place" size="20px" color="deep-purple-4" class="map-pin-dot" />
              </div>
              <div class="map-placeholder-text">지도 API 연동 영역</div>
              <div class="map-placeholder-sub">Kakao Maps / Naver Maps</div>
            </div>
            <div class="theater-map-info">
              <div class="map-info-address">
                <div class="map-address-name">{{ theater.name }}</div>
                <div class="map-address-detail">지도 API 연동 시 주소가 표시됩니다</div>
              </div>
              <q-btn
                unelevated
                label="길찾기"
                icon="directions"
                color="deep-purple-7"
                text-color="white"
                size="sm"
                class="map-navi-btn"
              />
            </div>
          </div>
        </transition>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Schedule } from 'src/types';
import type { SortType } from 'components/TheaterFilter.vue';
import 'src/css/schedule.css';

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

// 지도 토글 상태
const openMapSet = ref<Set<string>>(new Set());
function toggleMap(theaterName: string): void {
  const next = new Set(openMapSet.value);
  next.has(theaterName) ? next.delete(theaterName) : next.add(theaterName);
  openMapSet.value = next;
}

interface TheaterGroup {
  name: string;
  chain: string;
  halls: Record<string, Schedule[]>;
  earliestTime: string;
}

const props = defineProps<{
  schedules: Schedule[];
  sortModel: SortType;
  movieCreatedAt?: string | undefined;
}>();

const grouped = computed(() => {
  const nowTime = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(11, 16); // "HH:MM"

  const visible = props.schedules.filter(
    (s) => s.date !== today || s.startTime >= nowTime,
  );

  const map: Record<string, TheaterGroup> = {};

  for (const s of visible) {
    if (!map[s.theater]) {
      map[s.theater] = { name: s.theater, chain: s.chain, halls: {}, earliestTime: s.startTime };
    }
    const key = s.screenType || '2D';
    const theater = map[s.theater]!;
    if (!theater.halls[key]) theater.halls[key] = [];
    theater.halls[key]?.push(s);
    if (s.startTime < theater.earliestTime) theater.earliestTime = s.startTime;
  }

  return Object.values(map)
    .sort((a, b) =>
      props.sortModel === 'time'
        ? a.earliestTime.localeCompare(b.earliestTime)
        : a.name.localeCompare(b.name, 'ko'),
    )
    .map((t) => ({
      ...t,
      halls: [
        {
          key: '',
          schedules: Object.values(t.halls)
            .flat()
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        },
      ],
    }));
});


function openBooking(url: string): void {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function scrollShowtime(event: Event, delta: number): void {
  const wrapper = (event.currentTarget as HTMLElement).closest('.showtime-scroll-wrapper');
  const scroll = wrapper?.querySelector('.showtime-scroll');
  scroll?.scrollBy({ left: delta, behavior: 'smooth' });
}
</script>
