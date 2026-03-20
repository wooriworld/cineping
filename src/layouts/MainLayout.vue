<template>
  <q-layout view="hHh lpR fFf">
    <!-- 헤더 -->
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <!-- 로고 -->
        <router-link to="/" class="cineping-logo">
          <q-icon name="movie" size="24px" class="q-mr-xs" />
          <span>cineping</span>
        </router-link>

        <q-space />

        <!-- 데스크탑 네비게이션 -->
        <nav class="gt-sm row items-center q-gutter-sm">
          <q-btn
            v-for="item in navItems"
            :key="item.to"
            flat
            no-caps
            :label="item.label"
            :to="item.to"
            :icon="item.icon"
            size="sm"
          />
        </nav>

        <!-- 모바일 메뉴 버튼 -->
        <q-btn
          v-if="isLocalhost"
          class="lt-md"
          flat
          round
          icon="menu"
          @click="drawerOpen = !drawerOpen"
          aria-label="메뉴"
        />
      </q-toolbar>
    </q-header>

    <!-- 모바일 드로어 -->
    <q-drawer v-model="drawerOpen" side="right" overlay bordered :width="220">
      <q-list class="q-pt-md">
        <q-item-label header class="text-weight-bold text-grey-7">메뉴</q-item-label>
        <q-item
          v-for="item in navItems"
          :key="item.to"
          clickable
          :to="item.to"
          active-class="text-primary"
          @click="drawerOpen = false"
        >
          <q-item-section avatar>
            <q-icon :name="item.icon" />
          </q-item-section>
          <q-item-section>{{ item.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <!-- 본문 -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import 'src/css/layout.css';

const drawerOpen = ref(false);

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
