<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 col">영화 관리</div>
      <q-btn color="primary" icon="add" label="영화 추가" @click="openDialog()" />
    </div>

    <q-banner v-if="store.error" class="bg-negative text-white q-mb-md" rounded>
      {{ store.error }}
    </q-banner>

    <q-table
      :rows="store.movies"
      :columns="columns"
      row-key="id"
      :loading="store.loading"
      flat
      bordered
    >
      <template #body-cell-isTracking="{ value }">
        <q-td>
          <q-badge :color="value ? 'positive' : 'grey'">
            {{ value ? '감시 중' : '중지' }}
          </q-badge>
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
        <q-td>
          <q-btn flat round dense icon="edit" color="primary" @click="openDialog(props.row)" />
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

    <!-- 등록/수정 다이얼로그 -->
    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ editTarget ? '영화 수정' : '영화 추가' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input v-model="form.title" label="영화 제목 *" outlined dense :rules="[required]" />
          <q-input v-model="form.naverMovieId" label="네이버 영화 ID" outlined dense />
          <q-input v-model="form.poster" label="포스터 URL" outlined dense />
          <q-toggle v-model="form.isTracking" label="감시 활성화" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn
            color="primary"
            :label="editTarget ? '수정' : '추가'"
            :loading="store.loading"
            @click="submit"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 삭제 확인 -->
    <q-dialog v-model="deleteDialog">
      <q-card>
        <q-card-section class="text-h6">정말 삭제하시겠습니까?</q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="취소" v-close-popup />
          <q-btn
            color="negative"
            label="삭제"
            :loading="store.loading"
            @click="doDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMoviesStore } from 'src/stores/moviesStore';
import type { Movie } from 'src/types';
import type { QTableColumn } from 'quasar';

const store = useMoviesStore();

const columns: QTableColumn[] = [
  { name: 'poster', label: '포스터', field: 'poster', align: 'center' },
  { name: 'title', label: '제목', field: 'title', align: 'left', sortable: true },
  { name: 'naverMovieId', label: '네이버 ID', field: 'naverMovieId', align: 'left' },
  { name: 'isTracking', label: '상태', field: 'isTracking', align: 'center', sortable: true },
  { name: 'createdAt', label: '등록일', field: 'createdAt', align: 'left', sortable: true },
  { name: 'actions', label: '관리', field: 'actions', align: 'center' },
];

const dialog = ref(false);
const deleteDialog = ref(false);
const editTarget = ref<Movie | null>(null);
const deleteTargetId = ref<string>('');

const emptyForm = () => ({
  title: '',
  naverMovieId: '',
  poster: '',
  isTracking: true,
});

const form = ref(emptyForm());

function required(val: string) {
  return !!val || '필수 입력 항목입니다.';
}

function openDialog(movie?: Movie) {
  editTarget.value = movie ?? null;
  form.value = movie
    ? { title: movie.title, naverMovieId: movie.naverMovieId, poster: movie.poster, isTracking: movie.isTracking }
    : emptyForm();
  dialog.value = true;
}

function confirmDelete(id: string) {
  deleteTargetId.value = id;
  deleteDialog.value = true;
}

async function submit() {
  if (!form.value.title) return;
  try {
    if (editTarget.value) {
      await store.editMovie(editTarget.value.id, form.value);
    } else {
      await store.addMovie({ ...form.value, createdAt: new Date().toISOString() });
    }
    dialog.value = false;
  } catch {
    // error는 store.error로 표시됨
  }
}

async function doDelete() {
  try {
    await store.deleteMovie(deleteTargetId.value);
    deleteDialog.value = false;
  } catch {
    // error는 store.error로 표시됨
  }
}

onMounted(() => store.fetchMovies());
</script>
