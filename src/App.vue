<script setup lang="ts">
import { ref } from 'vue'
import SearchTab from './components/SearchTab.vue'
import GameTab from './components/GameTab.vue'

const activeTab = ref<'search' | 'game'>('search')
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>Pokémon Booster-Duell</h1>
      <nav class="tab-nav">
        <button
          :class="['tab-btn', { active: activeTab === 'search' }]"
          @click="activeTab = 'search'"
        >
          Suche
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'game' }]"
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

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}

.app-header {
  background: linear-gradient(135deg, #e366ea 0%, #a24b8b 100%);
  padding: 20px 24px;
  text-align: center;
  box-shadow: inset 0 4px 20px rgba(255, 255, 255, 0.3);
}

.app-header h1 {
  color: #fff;
  font-size: 28px;
  margin: 0 0 16px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.tab-nav {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.tab-btn {
  margin-top: 16px;
  padding: 8px 16px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: #000;
  background: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 8px;
  cursor: pointer;
}
.tab-btn:hover {
  background: #f0f0f5;
  color: #080808;
}
.tab-btn:focus-visible {
  outline: inset 2px solid #09071855;
  outline-offset: 2px;
}

.app-main {
  flex: 1;
  padding: 14px;
  max-width: 2400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
</style>
