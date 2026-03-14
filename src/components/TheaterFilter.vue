<template>
  <div class="theater-filter-section">
    <div class="theater-filter-inner">
      <!-- 지역 드롭다운 (다중 선택) -->
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
          <q-item v-for="r in REGIONS" :key="r" clickable @click="toggleRegion(r)">
            <q-item-section side>
              <q-checkbox
                :model-value="regionModel.includes(r)"
                dense
                color="primary"
                @update:model-value="toggleRegion(r)"
              />
            </q-item-section>
            <q-item-section>{{ r }}</q-item-section>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import 'src/css/theater-filter.css';

const props = defineProps<{
  chainModel: string;
  regionModel: string[];
}>();

const emit = defineEmits<{
  'update:chainModel': [value: string];
  'update:regionModel': [value: string[]];
}>();

const CHAINS = [
  { value: '극장 전체', label: '극장 전체' },
  { value: 'CGV', label: 'CGV' },
  { value: '롯데시네마', label: '롯데시네마' },
  { value: '메가박스', label: '메가박스' },
];

const REGIONS = [
  '서울',
  '경기',
  '인천',
  '강원',
  '충청',
  '대전',
  '세종',
  '전라',
  '광주',
  '경상',
  '대구',
  '부산',
  '울산',
  '제주',
];

const regionLabel = computed(() => {
  const selected = props.regionModel;
  if (selected.length === 0) return '지역 선택';
  if (selected.length <= 2) return selected.join(', ');
  return `${selected[0]}, ${selected[1]} 외 ${selected.length - 2}개`;
});

function toggleRegion(region: string): void {
  const next = props.regionModel.includes(region)
    ? props.regionModel.filter((r) => r !== region)
    : [...props.regionModel, region];
  emit('update:regionModel', next);
}
</script>
