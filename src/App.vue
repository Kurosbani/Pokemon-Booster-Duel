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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #e366ea 0%, #a24b8b 100%);
  padding: 20px 24px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
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

.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
</style>
