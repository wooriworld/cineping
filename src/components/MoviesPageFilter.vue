<template>
  <!-- 활성 필터 칩 -->
  <div v-if="filterShowNew || filterShowUpdate || filterShowEng" class="movies-active-filters">
    <span class="movies-active-filter-label">필터:</span>
    <span v-if="filterShowNew" class="movies-active-chip movies-active-chip--new">NEW</span>
    <span v-if="filterShowUpdate" class="movies-active-chip movies-active-chip--update">UPDATE</span>
    <span v-if="filterShowEng" class="movies-active-chip movies-active-chip--eng">ENG</span>
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
        <q-btn outline @click="resetFilters">Reset</q-btn>
        <q-btn class="filter-dialog-apply-btn" @click="applyFilter">Apply</q-btn>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useMoviesFilter } from 'src/composables/useMoviesFilter';
import { trackEvent } from 'src/composables/useAnalytics';

const { filterShowNew, filterShowUpdate, filterShowEng, filterDialog } = useMoviesFilter();

function resetFilters() {
  filterShowNew.value = false;
  filterShowUpdate.value = false;
  filterShowEng.value = false;
}

function applyFilter() {
  trackEvent('filter_apply', {
    filter_new: filterShowNew.value,
    filter_update: filterShowUpdate.value,
    filter_eng: filterShowEng.value,
  });
  filterDialog.value = false;
}
</script>
