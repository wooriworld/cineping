<template>
  <div class="theater-filter-section">
    <div class="theater-filter-inner">
      <!-- 지역 드롭다운 (단일 선택) -->
      <q-btn-dropdown
        :label="regionLabel"
        outline
        dense
        no-caps
        menu-anchor="bottom left"
        menu-self="top left"
        class="region-dropdown"
      >
        <q-list dense>
          <q-item
            v-for="r in REGIONS"
            :key="r.value"
            v-close-popup
            clickable
            :active="regionModel === r.value"
            active-class="chain-item-active"
            @click="$emit('update:regionModel', r.value)"
          >
            <q-item-section>{{ r.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <!-- 극장 체인 드롭다운 (단일 선택) -->
      <q-btn-dropdown
        :label="chainModel"
        outline
        dense
        no-caps
        menu-anchor="bottom left"
        menu-self="top left"
        class="chain-dropdown"
      >
        <q-list dense>
          <q-item
            v-for="c in CHAINS"
            :key="c.value"
            v-close-popup
            clickable
            :active="chainModel === c.value"
            active-class="chain-item-active"
            @click="$emit('update:chainModel', c.value)"
          >
            <q-item-section>{{ c.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <!-- 상영관 드롭다운 -->
      <q-btn-dropdown
        :label="hallTypeModel"
        outline
        dense
        no-caps
        menu-anchor="bottom left"
        menu-self="top left"
        class="halltype-dropdown"
      >
        <q-list dense>
          <q-item
            v-for="h in HALL_TYPES"
            :key="h.value"
            v-close-popup
            clickable
            :active="hallTypeModel === h.value"
            active-class="chain-item-active"
            @click="$emit('update:hallTypeModel', h.value)"
          >
            <q-item-section>{{ h.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <!-- 정렬 드롭다운 (우측 정렬) -->
      <q-btn-dropdown
        :label="sortLabel"
        outline
        dense
        no-caps
        menu-anchor="bottom right"
        menu-self="top right"
        class="sort-dropdown"
      >
        <q-list dense>
          <q-item
            v-for="s in SORTS"
            :key="s.value"
            v-close-popup
            clickable
            :active="sortModel === s.value"
            active-class="chain-item-active"
            @click="$emit('update:sortModel', s.value)"
          >
            <q-item-section>{{ s.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import 'src/css/theater-filter.css';

export type SortType = 'theater' | 'time';

const props = defineProps<{
  chainModel: string;
  regionModel: string;
  sortModel: SortType;
  hallTypeModel: string;
}>();

defineEmits<{
  'update:chainModel': [value: string];
  'update:regionModel': [value: string];
  'update:sortModel': [value: SortType];
  'update:hallTypeModel': [value: string];
}>();

const CHAINS = [
  { value: 'All Theaters', label: 'All Theaters' },
  { value: 'CGV', label: 'CGV' },
  { value: 'LotteCinema', label: 'LotteCinema' },
  { value: 'Megabox', label: 'Megabox' },
  { value: 'Others', label: 'Others' },
];

const REGIONS = [
  { value: 'Select Region', label: 'Select Region' },
  { value: 'Seoul', label: 'Seoul' },
  /* { value: '경기', label: '경기' },
  { value: '인천', label: '인천' },
  { value: '강원', label: '강원' },
  { value: '충청', label: '충청' },
  { value: '대전', label: '대전' },
  { value: '세종', label: '세종' },
  { value: '전라', label: '전라' },
  { value: '광주', label: '광주' },
  { value: '경상', label: '경상' },
  { value: '대구', label: '대구' },
  { value: '부산', label: '부산' },
  { value: '울산', label: '울산' },
  { value: '제주', label: '제주' },*/
];

const HALL_TYPES = [
  { value: 'All Screens', label: 'All Screens' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Premium', label: 'Premium' },
];

const SORTS = [
  { value: 'theater' as SortType, label: 'Theater' },
  { value: 'time' as SortType, label: 'Showtime' },
];

const regionLabel = computed(() => {
  if (!props.regionModel || props.regionModel === 'Select Region') return 'Select Region';
  return `${props.regionModel}`;
});

const sortLabel = computed(
  () => SORTS.find((s) => s.value === props.sortModel)?.label ?? 'Theater',
);
</script>
