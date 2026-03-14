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
        <div class="theater-header">
          <span class="theater-name" :class="'chain-' + chainBadgeClass(theater.chain)">{{ theater.name }}</span>
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
                :class="seatStatusClass(s.availableSeats)"
                :disabled="s.availableSeats === 0"
                @click="openBooking(s.bookingUrl)"
              >
                <div class="showtime-btn-time-row">
                  <span class="showtime-btn-start">{{ s.startTime }}</span><span class="showtime-btn-end">~{{ s.endTime }}</span>
                </div>
                <span class="showtime-btn-hall" :class="screenTypeBadgeClass(hall.key)">{{ hall.key }}</span>
              </button>
            </template>
          </div>
          <q-btn
            flat round dense icon="chevron_right" size="sm"
            class="scroll-arrow"
            @click="scrollShowtime($event, 260)"
          />
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Schedule } from 'src/types';
import 'src/css/schedule.css';

interface TheaterGroup {
  name: string;
  chain: string;
  halls: Record<string, Schedule[]>;
}

const props = defineProps<{
  schedules: Schedule[];
  favorites: string[];
}>();

defineEmits<{ toggleFavorite: [name: string] }>();

/* 즐겨찾기 극장 우선 → 이름순 정렬 후 그룹화 */
const grouped = computed(() => {
  const map: Record<string, TheaterGroup> = {};

  for (const s of props.schedules) {
    if (!map[s.theater]) {
      map[s.theater] = { name: s.theater, chain: s.chain, halls: {} };
    }
    const key = s.screenType || '2D';
    const theater = map[s.theater];
    if (theater && !theater.halls[key]) theater.halls[key] = [];
    theater?.halls[key]?.push(s);
  }

  return Object.values(map)
    .sort((a, b) => {
      const aFav = props.favorites.includes(a.name) ? 0 : 1;
      const bFav = props.favorites.includes(b.name) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.name.localeCompare(b.name);
    })
    .map((t) => ({
      ...t,
      halls: Object.entries(t.halls).map(([key, list]) => ({
        key,
        schedules: [...list].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      })),
    }));
});

function chainBadgeClass(chain: string): string {
  if (chain === 'CGV') return 'cgv';
  if (chain === '롯데시네마') return 'lotte';
  if (chain === '메가박스') return 'mega';
  return '';
}

function screenTypeBadgeClass(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('IMAX')) return 'imax';
  if (t.includes('4DX')) return 'four-dx';
  if (t.includes('SCREENX')) return 'screenx';
  if (t.includes('DOLBY')) return 'dolby';
  return 'type-2d';
}

function seatStatusClass(seats: number): string {
  if (seats === 0) return 'sold-out';
  if (seats <= 10) return 'almost-full';
  if (seats <= 50) return 'available';
  return 'normal';
}


function openBooking(url: string): void {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function scrollShowtime(event: Event, delta: number): void {
  const wrapper = (event.currentTarget as HTMLElement).closest('.showtime-scroll-wrapper');
  const scroll = wrapper?.querySelector('.showtime-scroll');
  scroll?.scrollBy({ left: delta, behavior: 'smooth' });
}
</script>
