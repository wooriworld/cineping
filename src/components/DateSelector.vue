<template>
  <div class="date-selector-section">
    <div class="date-selector-inner">
      <!-- 날짜 탭 -->
      <div class="date-tabs-row">
        <button
          v-for="d in dates"
          :key="d.full"
          class="date-btn"
          :class="{
            'date-btn-selected': modelValue === d.full,
            'date-btn-today': d.isToday && modelValue !== d.full,
            'date-btn-disabled': d.disabled,
          }"
          :disabled="d.disabled"
          @click="$emit('update:modelValue', d.full)"
        >
          <q-badge v-if="newDates?.includes(d.full)" color="primary" floating rounded class="date-btn-badge" />
          <div class="date-btn-label">
            <span class="date-btn-day">{{ d.label }}</span>
            <span class="date-btn-num">{{ d.dateNum }}</span>
            <span v-if="d.isToday" class="date-btn-sub">오늘</span>
            <span v-else-if="d.isTomorrow" class="date-btn-sub">내일</span>
            <span v-else class="date-btn-sub date-btn-sub--placeholder" />
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import 'src/css/date-selector.css';

const props = defineProps<{
  modelValue: string;
  availableDates: string[];
  newDates?: string[];
}>();

defineEmits<{ 'update:modelValue': [value: string] }>();

const DAYS = ['Sun', 'Mon', 'The', 'Wed', 'Thu', 'Fri', 'Sat'];

const dates = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const full = `${yyyy}-${mm}-${dd}`;

    const hasSchedule = props.availableDates.length === 0 || props.availableDates.includes(full);

    return {
      full,
      label: DAYS[d.getDay()],
      dateNum: dd,
      isToday: i === 0,
      isTomorrow: i === 1,
      disabled: !hasSchedule,
    };
  });
});
</script>
