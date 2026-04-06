<template>
  <q-page class="about-page">
    <!-- 히어로 -->
    <div class="about-hero">
      <div class="about-hero-icon">
        <q-icon name="movie" size="36px" color="white" />
      </div>
      <h1 class="about-hero-title">cineping</h1>
      <p class="about-hero-tagline">
        Find movies by English title & check English subtitles instantly.<br />
        Get notified when new showtimes open - don't miss your booking window.
      </p>
    </div>

    <!-- 서비스 소개 -->
    <div class="about-section">
      <p class="about-section-title">About</p>
      <div class="about-card">
        <p class="about-card-desc">
          cineping helps you find <strong>movies in Seoul with English subtitles</strong> across
          major multiplex chains (CGV, Lotte Cinema, Megabox) and indie/arthouse venues (KOFA
          Cinematheque, Emu Cinema) — all in one place.<br /><br />
          Korean cinema booking sites are built around Korean, making it hard for foreigners to find
          <strong>Korean cinema English subtitles</strong> showtimes or search by English movie
          title. cineping removes that barrier so international audiences can easily access Korean
          theater culture.<br /><br />
          Newly added movies are marked <strong>NEW</strong>, updated schedules are marked
          <strong>UPDATE</strong>, and English-subtitled screenings are tagged <strong>ENG</strong>
          — filterable in one click.
        </p>
      </div>
    </div>

    <!-- 주요 기능 -->
    <div class="about-section">
      <p class="about-section-title">Features</p>
      <div class="about-card">
        <div class="about-feature-list">
          <div class="about-feature-item">
            <div class="about-feature-icon-wrap">
              <q-icon name="translate" size="20px" color="deep-purple" />
            </div>
            <div class="about-feature-text">
              <p class="about-feature-name">English Subtitle Filter (ENG)</p>
              <p class="about-feature-desc">
                Filter for <strong>indie films Seoul English subs</strong> and
                <strong>arthouse cinema Seoul English subtitles</strong> at KOFA Cinematheque, Emu
                Cinema, and all three multiplex chains in a single view.
              </p>
            </div>
          </div>
          <div class="about-feature-item">
            <div class="about-feature-icon-wrap">
              <q-icon name="search" size="20px" color="deep-purple" />
            </div>
            <div class="about-feature-text">
              <p class="about-feature-name">Search by English or Korean Title</p>
              <p class="about-feature-desc">
                Search movies by their original English title or Korean title simultaneously — no
                need to know the Korean translation.
              </p>
            </div>
          </div>
          <div class="about-feature-item">
            <div class="about-feature-icon-wrap">
              <q-icon name="update" size="20px" color="deep-purple" />
            </div>
            <div class="about-feature-text">
              <p class="about-feature-name">Auto Schedule Collection (Twice Daily)</p>
              <p class="about-feature-desc">
                Schedules are automatically scraped every day at 09:00 and 18:00 KST via Naver API,
                KOFA HTML parsing, and Emu Cinema image OCR (Gemini Vision API).
              </p>
            </div>
          </div>
          <div class="about-feature-item">
            <div class="about-feature-icon-wrap">
              <q-icon name="tune" size="20px" color="deep-purple" />
            </div>
            <div class="about-feature-text">
              <p class="about-feature-name">Theater, Region & Screen Type Filters</p>
              <p class="about-feature-desc">
                Filter by chain (CGV · Lotte · Megabox), region, and screen type (standard /
                premium: IMAX, 4DX, etc.) to find exactly the showtime you want.
              </p>
            </div>
          </div>
          <div class="about-feature-item">
            <div class="about-feature-icon-wrap">
              <q-icon name="notifications_active" size="20px" color="deep-purple" />
            </div>
            <div class="about-feature-text">
              <p class="about-feature-name">Telegram Alerts (@CINEPING)</p>
              <p class="about-feature-desc">
                Get instant Telegram notifications when new movies or schedules are added. Each
                alert includes a deep link that filters directly to the updated movies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 커버리지 -->
    <div class="about-section">
      <p class="about-section-title">Coverage</p>
      <div class="about-card">
        <div class="about-feature-list">
          <div class="about-feature-item">
            <div class="about-feature-icon-wrap">
              <q-icon name="movie" size="20px" color="deep-purple" />
            </div>
            <div class="about-feature-text">
              <p class="about-feature-name">Multiplex Chains</p>
              <p class="about-feature-desc">CGV · Lotte Cinema · Megabox — nationwide</p>
            </div>
          </div>
          <div class="about-feature-item">
            <div class="about-feature-icon-wrap">
              <q-icon name="account_balance" size="20px" color="deep-purple" />
            </div>
            <div class="about-feature-text">
              <p class="about-feature-name">Indie & Arthouse Venues</p>
              <p class="about-feature-desc">
                KOFA Cinematheque (Korean Film Archive) · Emu Cinema — English subtitled screenings
                tracked separately with ENG badge
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 연락처 -->
    <div class="about-section">
      <p class="about-section-title">Contact</p>
      <div class="about-card">
        <div class="about-feature-list">
          <div class="about-contact-row">
            <q-icon name="mail_outline" size="18px" color="deep-purple" />
            <a href="mailto:wooriworld82@gmail.com">wooriworld82@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useMeta } from 'quasar';
import 'src/css/about.css';

useMeta({
  title: 'Find English Subtitled Movies in Seoul | cineping',
  meta: {
    description: {
      name: 'description',
      content:
        'Find movies in Seoul with English subtitles across CGV, Lotte Cinema, Megabox, KOFA Cinematheque and Emu Cinema. Search Korean cinema English subtitles and indie films Seoul English subs easily.',
    },
    keywords: {
      name: 'keywords',
      content:
        'movies in Seoul with English subtitles, Korean cinema English subtitles, indie films Seoul English subs, arthouse cinema Seoul English subtitles',
    },
  },
});
</script>
