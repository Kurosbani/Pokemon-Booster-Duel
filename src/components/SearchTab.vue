<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

interface PokemonItem {
  id: number
  name: string
}

const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
let timerCleanup: ReturnType<typeof setTimeout> | null = null
const results = ref<PokemonItem[]>([])
const isLoading = ref(false)
const selectedPokemon = ref<{
  id: number
  name: string
  types: string[]
  image: string
  stats: Record<string, number>
} | null>(null)

const apiBase = 'http://localhost:3000'

function fetchResults(query: string): void {
  if (!query || query.length < 2) {
    results.value = []
    return
  }
  
  isLoading.value = true
  
  const url = `${apiBase}/pokemon/${encodeURIComponent(query)}`
  fetch(url).then(async (res) => {
    if (res.ok) {
      const data = await res.json()
      results.value = Array.isArray(data) ? data : []
    } else {
      results.value = []
    }
    isLoading.value = false
  }).catch(() => {
    results.value = []
    isLoading.value = false
  })
}

function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  
  if (timerCleanup) clearTimeout(timerCleanup)
  
  timerCleanup = setTimeout(() => {
    fetchResults(value.trim())
  }, 300)
}

onUnmounted(() => {
  if (timerCleanup) clearTimeout(timerCleanup)
})

function selectPokemon(item: PokemonItem): void {
  const url = `${apiBase}/pokemon/${item.id}`
  selectedPokemon.value = null
  
  fetch(url).then(async (res) => {
    if (res.ok) {
      const data = await res.json()
      selectedPokemon.value = {
        id: item.id,
        name: data.name,
        types: data.types?.map((t: any) => t.type.name) || [],
        image: data.images?.standard?.[0] || '',
        stats: data.stats || {}
      }
    }
  }).catch(() => {})
  
  results.value = []
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'red': '#e34f3d',
    'orange': '#ea7a32',
    'yellow': '#ececb4',
    'green': '#5c9036',
    'blue': '#483dca',
    'purple': '#7b0f9d',
    'pink': '#bdafb3',
    'cyan': '#a5eacc',
    'white': '#ddd9c8',
    'gray': '#7a7c90'
  }
  return colors[type.toLowerCase()] || '#7a7c90'
}
</script>

<template>
  <div class="search-tab">
    <h2>Find a Pokémon</h2>
    
    <div class="search-bar">
      <input
        type="text"
        placeholder="Find a Pokémon..."
        @input="onInput($event)"
      />
      
      <ul v-if="results.length > 0 && !selectedPokemon" class="result-list">
        <li
          v-for="item in results"
          :key="item.id"
          class="result-item"
          @click="selectPokemon(item)"
        >
          {{ item.name }}
        </li>
      </ul>
    </div>
    
    <div v-if="isLoading" class="loading">Loading...</div>
    
    <div 
      v-if="selectedPokemon" 
      :class="['pokemon-card', `type-${selectedPokemon.types[0]?.toLowerCase() || 'gray'}`]"
    >
      <img 
        :src="selectedPokemon.image" 
        :alt="selectedPokemon.name"
      />
      
      <div class="card-info">
        <h3>{{ selectedPokemon.name }}</h3>
        
        <div class="types">
          <span v-for="(type, idx) in selectedPokemon.types" :key="idx" class="type-badge" :style="{ backgroundColor: getTypeColor(type) }">
            {{ type }}
          </span>
        </div>
        
        <div class="stats-grid">
          <div 
            v-for="(value, key) in selectedPokemon.stats" 
            :key="key" 
            class="stat-item"
          >
            <strong>{{ key }}</strong>: {{ value }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-tab {
  padding: 20px;
}

.search-bar {
  position: relative;
  margin-bottom: 24px;
}

input[type="text"] {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
}

.result-list {
  background: #fff;
  border: 1px solid #eee;
  border-top: 4px solid #e0e0e0;
  border-radius: 0 0 8px 8px;
  max-height: 200px;
  overflow-y: auto;
}

.result-item {
  padding: 12px 16px;
  cursor: pointer;
  font-size: 15px;
}

.result-item:hover {
  background: #f0f0f5;
}

.pokemon-card {
  padding: 32px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  margin-top: 16px;
}

.card-info h3 {
  font-size: 24px;
  margin: 0 0 8px;
}

.type-badge {
  padding: 4px 12px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.stat-item {
  padding: 4px 0;
}

.loading {
  margin-top: 16px;
}
</style>
