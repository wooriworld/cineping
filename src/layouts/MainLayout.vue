<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleLeftDrawer" />
        <q-toolbar-title>🎬 cineping</q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <q-item-label header>메뉴</q-item-label>

        <q-item v-for="item in navItems" :key="item.to" clickable :to="item.to" active-class="text-primary">
          <q-item-section avatar>
            <q-icon :name="item.icon" />
          </q-item-section>
          <q-item-section>{{ item.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const leftDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

const navItems = [
  { to: '/', label: '홈', icon: 'home' },
  { to: '/movies', label: '영화 관리', icon: 'movie' },
  { to: '/schedules', label: '스케줄 관리', icon: 'event' },
  { to: '/users', label: '사용자 관리', icon: 'people' },
];
</script>
