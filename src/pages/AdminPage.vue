<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-gutter-sm q-mb-md">
      <q-btn
        class="admin-action-btn"
        color="green-8"
        icon="cloud_sync"
        label="전체 수집"
        @click="runAllScrape"
      />
      <q-btn
        class="admin-action-btn"
        color="indigo"
        icon="api"
        label="Naver 영화 수집"
        @click="runApiMovieScrape"
      />
      <q-btn
        class="admin-action-btn"
        color="deep-orange"
        icon="event_note"
        label="Naver 스케줄 수집"
        @click="runNaverScheduleScrape"
      />
      <q-btn
        class="admin-action-btn"
        color="teal"
        icon="video_library"
        label="KOFA 영화 수집"
        @click="runKofaScrape"
      />
      <q-btn
        class="admin-action-btn"
        color="deep-purple"
        icon="theaters"
        label="에무시네마 영화 수집"
        @click="runEmucinemaScrape"
      />

      <q-space />

      <q-input
        v-model="searchTitle"
        outlined
        dense
        clearable
        hide-bottom-space
        placeholder="제목으로 검색하세요"
        class="admin-filter-input"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <q-table
      :rows="filteredMovies"
      :columns="columns"
      row-key="id"
      :rows-per-page-options="[10, 20, 30, 0]"
      :pagination="{ rowsPerPage: 10 }"
      flat
      bordered
    >
      <template #body-cell-title="props">
        <q-td class="admin-title-cell">
          <div class="admin-title-wrap">
            <span class="admin-title-text">{{ props.row.title }}</span>
            <q-badge
              v-if="props.row.createdAt?.slice(0, 10) === today"
              color="red"
              label="NEW"
              class="q-ml-xs"
            />
            <q-badge
              v-if="
                schedulesStore.newScheduleMovieIds.has(props.row.id) &&
                new Date(new Date(props.row.createdAt).getTime() + 9 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 10) < today
              "
              color="teal"
              label="UPDATE"
              class="q-ml-xs"
            />
            <q-badge
              v-if="schedulesStore.engScheduleMovieIds.has(props.row.id)"
              color="primary"
              label="ENG"
              class="q-ml-xs"
            />
          </div>
        </q-td>
      </template>

      <template #body-cell-englishTitle="props">
        <q-td class="admin-title-cell">
          <span class="admin-title-text">{{ props.row.englishTitle }}</span>
        </q-td>
      </template>

      <template #body-cell-scheduleCount="props">
        <q-td align="center">
          {{ schedulesStore.scheduleCounts[props.row.id] || 0 }}
        </q-td>
      </template>

      <template #body-cell-poster="{ value }">
        <q-td>
          <q-img
            v-if="value"
            :src="value"
            width="40px"
            height="56px"
            fit="cover"
            class="rounded-borders"
          />
          <q-icon v-else name="image_not_supported" size="sm" color="grey" />
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td align="center">
          <q-btn
            flat
            round
            dense
            icon="delete"
            color="negative"
            @click="confirmDelete(props.row.id)"
          />
        </q-td>
      </template>
    </q-table>

  </q-page>
</template>

<script setup lang="ts">
import 'src/css/admin.css';
import { computed, ref, onMounted } from 'vue';
import { useMoviesStore } from 'src/stores/moviesStore';
import { useSchedulesStore } from 'src/stores/schedulesStore';
import type { QTableColumn } from 'quasar';

const store = useMoviesStore();
const schedulesStore = useSchedulesStore();

const columns: QTableColumn[] = [
  { name: 'poster', label: '포스터', field: 'poster', align: 'center' },
  { name: 'title', label: '제목', field: 'title', align: 'left', sortable: true },
  { name: 'englishTitle', label: '영어 제목', field: 'englishTitle', align: 'left' },
  { name: 'releaseDate', label: '개봉일', field: 'releaseDate', align: 'left', sortable: true },
  {
    name: 'createdAt',
    label: '등록일',
    field: 'createdAt',
    align: 'left',
    sortable: true,
    format: (val: string) => (val ? val.substring(0, 10).replace(/-/g, '/') : '-'),
  },
  { name: 'scheduleCount', label: '스케줄', field: (row) => schedulesStore.scheduleCounts[row.id] || 0, align: 'center', sortable: true },
  { name: 'sourceId', label: '수집처ID', field: 'sourceId', align: 'left' },
  { name: 'source', label: '수집처', field: 'source', align: 'center' },
  { name: 'actions', label: '관리', field: 'actions', align: 'center' },
];

const searchTitle = ref('');

const filteredMovies = computed(() => {
  const counts = schedulesStore.scheduleCounts; // 반응형 의존성 명시적 추적
  const q = (searchTitle.value ?? '').trim();

  return store.movies
    .filter(
      (m) =>
        !q || m.title.includes(q) || (m.englishTitle ?? '').toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => {
      const createdDiff = (b.createdAt ?? '')
        .slice(0, 10)
        .localeCompare((a.createdAt ?? '').slice(0, 10));
      if (createdDiff !== 0) return createdDiff;
      const countDiff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
      if (countDiff !== 0) return countDiff;
      return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
    });
});

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ── 삭제 ─────────────────────────────────────────────────────────
async function confirmDelete(id: string) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  try {
    await store.deleteMovie(id);
  } catch {
    // store.error로 표시됨
  }
}

// ── 전체 수집 ─────────────────────────────────────────────────────
async function runAllScrape() {
  try {
    await store.scrapeAll();
  } catch {
    // store.error 로 표시됨
  }
}

// ── Naver 영화 수집 ─────────────────────────────────────────────
async function runApiMovieScrape() {
  try {
    await store.scrapeFromNaver();
  } catch {
    // store.error 로 표시됨
  }
}

// ── 네이버 스케줄 수집 ─────────────────────────────────────
async function runNaverScheduleScrape() {
  try {
    await schedulesStore.scrapeSchedulesFromNaver();
  } catch {
    // schedulesStore.error 로 표시됨
  }
}

// ── KOFA 영화 수집 ────────────────────────────────────────────────
async function runKofaScrape() {
  try {
    await store.scrapeFromKofa();
  } catch {
    // store.error 로 표시됨
  }
}

// ── 에무시네마 영화 수집 ──────────────────────────────────────────
async function runEmucinemaScrape() {
  try {
    await store.scrapeFromEmucine();
  } catch {
    // store.error 로 표시됨
  }
}

onMounted(() => {
  void store.fetchMovies();
  void schedulesStore.fetchScheduleCounts();
  void schedulesStore.fetchNewScheduleMovieIds();
  void schedulesStore.fetchEngScheduleMovieIds();
});
</script>
