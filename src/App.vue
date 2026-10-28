<script setup lang="ts">
import { ref } from 'vue'
import SearchTab from './components/SearchTab.vue'
import GameTab from './components/GameTab.vue'

const activeTab = ref<'search' | 'game'>('search')
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="brand">
        <span class="ball" aria-hidden="true"></span>
        <h1>Pokémon Booster-Duell</h1>
      </div>
      <nav class="tab-nav" aria-label="Bereiche">
        <button
          :class="['tab-btn', { active: activeTab === 'search' }]"
          :aria-pressed="activeTab === 'search'"
          @click="activeTab = 'search'"
        >
          Suche
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'game' }]"
          :aria-pressed="activeTab === 'game'"
          @click="activeTab = 'game'"
        >
          Spiel
        </button>
      </nav>
    </header>

    <main class="app-main">
      <SearchTab v-if="activeTab === 'search'" />
      <GameTab v-else />
    </main>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@400;500;600;700&family=Fredoka:wght@500;600;700&display=swap');

:root {
  --font-display: 'Fredoka', system-ui, 'Segoe UI', sans-serif;
  --font-ui: 'Barlow Semi Condensed', system-ui, 'Segoe UI', sans-serif;

  --mat: #15122b;
  --text: #f3f0ff;
  --muted: #b7b0dd;
  --ink: #1d1a2f;
  --yellow: #ffcb05;
  --yellow-deep: #f5a300;

  color-scheme: dark;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html:root {
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  background: var(--mat);
}

html body {
  display: block;
  place-items: initial;
  width: 100%;
  min-width: 0;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  color: var(--text);
  background: var(--mat);
  font-family: var(--font-ui);
  font-size: 16px;
  line-height: 1.35;
  -webkit-font-smoothing: antialiased;
}

html body #app {
  display: block;
  grid-template-columns: none;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  text-align: left;
  font-weight: 400;
}
</style>

<style scoped>
.app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  overflow-x: clip;
  background:
    radial-gradient(1100px 600px at 85% -10%, rgba(255, 61, 139, 0.3), transparent 60%),
    radial-gradient(900px 700px at -5% 105%, rgba(75, 91, 255, 0.32), transparent 60%),
    var(--mat);
}

/* One big, faint Poké Ball behind everything */
.app-container::before {
  content: '';
  position: fixed;
  right: -22vmin;
  bottom: -22vmin;
  width: 82vmin;
  aspect-ratio: 1;
  border: 3.4vmin solid rgba(255, 255, 255, 0.04);
  border-radius: 50%;
  background: linear-gradient(
    transparent calc(100% - 1.7vmin),
    rgba(255, 255, 255, 0.04) calc(50% - 1.7vmin) calc(50% + 1.7vmin),
    transparent calc(50% + 1.7vmin)
  );
  pointer-events: none;
}

.app-container::after {
  content: '';
  position: absolute;
  left: -22vmin;
  top: -22vmin;
  width: 62vmin;
  aspect-ratio: 1;
  border: 3.4vmin solid rgba(255, 255, 255, 0.04);
  border-radius: 50%;
  background: linear-gradient(
    transparent calc(100% - 1.7vmin),
    rgba(255, 255, 255, 0.04) calc(50% - 1.7vmin) calc(50% + 1.7vmin),
    transparent calc(50% + 1.7vmin)
  );
  pointer-events: none;
}

/* ---------- Header ---------- */
.app-header {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 14px clamp(14px, 3vw, 40px);
  background: linear-gradient(100deg, #ff3d8b 0%, #b13bff 48%, #4b5bff 100%);
  border-bottom: 3px solid var(--yellow);
  box-shadow: 0 8px 30px rgba(10, 6, 40, 0.5);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ball {
  flex: none;
  width: 36px;
  aspect-ratio: 1;
  border: 3px solid #14142b;
  border-radius: 50%;
  background:
    radial-gradient(circle, #ffffff 0 16%, #14142b 17% 26%, transparent 27%),
    linear-gradient(#ee3b3b 0 45%, #14142b 45% 55%, #ffffff 55%);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25);
}

.app-header h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 700;
  line-height: 1.1;
  color: #ffffff;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
}

.tab-nav {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(20, 10, 60, 0.35);
  border-radius: 999px;
}

.tab-btn {
  padding: 8px 22px;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tab-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}
.tab-btn.active {
  color: var(--ink);
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.tab-btn:focus-visible {
  outline: 3px solid var(--yellow);
  outline-offset: 2px;
}

/* ---------- Main: no max-width, no side padding ---------- */
.app-main {
  position: relative;
  z-index: 1;
  flex: 1;
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>
