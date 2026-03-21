<template>
  <q-layout view="hHh lpR fFf">
    <!-- 헤더 -->
    <q-header bordered class="layout-header text-dark">
      <q-toolbar>
        <!-- 로고 -->
        <router-link
          to="/"
          class="cineping-logo"
          :class="{ 'cineping-logo--collapsed': searchOpen }"
        >
          <div class="cineping-logo-icon">
            <q-icon name="movie" size="18px" color="white" />
          </div>
          <span class="cineping-logo-text">cineping</span>
        </router-link>

        <!-- 스페이서 -->
        <div class="header-spacer" :class="{ 'header-spacer--collapsed': searchOpen }" />

        <!-- 검색 + 필터 (메인 페이지에서만 표시) -->
        <template v-if="isMoviesPage">
          <!-- 검색창 -->
          <div class="header-search-wrap" :class="{ 'header-search-wrap--open': searchOpen }">
            <q-input
              ref="searchInputRef"
              v-model="searchTitle"
              outlined
              dense
              clearable
              placeholder="Search for movie titles"
              class="header-search-input"
              @blur="onSearchBlur"
              @keyup.escape="closeSearch"
            >
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </div>

          <!-- 검색 아이콘 버튼 (닫힌 상태) -->
          <q-btn v-if="!searchOpen" flat round @click="openSearch" aria-label="검색">
            <q-icon name="search" size="22px" />
          </q-btn>

          <!-- 필터 버튼 -->
          <q-btn
            flat
            round
            class="movies-filter-btn q-ml-xs"
            @click="filterDialog = true"
            aria-label="필터"
          >
            <q-icon name="tune" size="22px" />
            <q-badge v-if="filterShowNew || filterShowUpdate" color="primary" floating rounded />
          </q-btn>
        </template>

        <!-- 데스크탑 네비게이션 -->
        <nav class="gt-sm row items-center q-gutter-sm q-ml-sm">
          <q-btn
            v-for="item in navItems"
            :key="item.to"
            flat
            no-caps
            :label="item.label"
            :to="item.to"
            :icon="item.icon"
            size="sm"
            text-color="dark"
          />
        </nav>
      </q-toolbar>
    </q-header>

    <!-- 본문 -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useMoviesFilter } from 'src/composables/useMoviesFilter';
import type { QInput } from 'quasar';
import 'src/css/layout.css';
import 'src/css/movies-page.css';

const route = useRoute();
const isMoviesPage = computed(() => route.path === '/');
const { searchTitle, filterShowNew, filterShowUpdate, filterDialog } = useMoviesFilter();

const searchOpen = ref(false);
const searchInputRef = ref<InstanceType<typeof QInput> | null>(null);

async function openSearch() {
  searchOpen.value = true;
  await nextTick();
  searchInputRef.value?.focus();
}

function closeSearch() {
  searchOpen.value = false;
  searchTitle.value = '';
}

function onSearchBlur() {
  if (!searchTitle.value) closeSearch();
}

const isLocalhost = window.location.hostname === 'localhost';

const navItems = [
  { to: '/', label: '현재 상영 영화', icon: 'movie' },
  ...(isLocalhost
    ? [
        { to: '/admin', label: '어드민', icon: 'admin_panel_settings' },
        { to: '/users', label: '사용자 관리', icon: 'people' },
      ]
    : []),
];
</script>
