<template>
  <div class="theater-filter-section">
    <div class="theater-filter-inner">

      <!-- 극장 체인 선택 -->
      <q-select
        :model-value="chainModel"
        :options="CHAINS"
        multiple
        use-chips
        outlined
        dense
        label="극장"
        emit-value
        map-options
        placeholder="전체"
        class="filter-select"
        @update:model-value="$emit('update:chainModel', $event)"
      />

      <!-- 지역 선택 -->
      <q-select
        :model-value="regionModel"
        :options="REGIONS"
        multiple
        use-chips
        outlined
        dense
        label="지역"
        placeholder="전체"
        class="filter-select"
        @update:model-value="$emit('update:regionModel', $event)"
      />

    </div>
  </div>
</template>

<script setup lang="ts">
import 'src/css/theater-filter.css';

defineProps<{
  chainModel: string[];
  regionModel: string[];
}>();

defineEmits<{
  'update:chainModel': [value: string[]];
  'update:regionModel': [value: string[]];
}>();

const CHAINS = [
  { value: '전체', label: '전체' },
  { value: 'CGV', label: 'CGV' },
  { value: '롯데시네마', label: '롯데시네마' },
  { value: '메가박스', label: '메가박스' },
];

const REGIONS = [
  '서울', '경기', '인천', '강원', '충청', '대전', '세종',
  '전라', '광주', '경상', '대구', '부산', '울산', '제주',
];
</script>
