<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PokemonCard from './PokemonCard.vue'
import { cardVars, formatName } from './cardStyle'

// ---------- Types ----------
interface SearchItem {
  id: number
  name: string
  thumbnail: string | null
}

interface PokemonDetail {
  id: number
  name: string
  height: number | null // decimetres
  weight: number | null // hectograms
  base_experience: number | null
  is_legendary: boolean | null
  is_mythical: boolean | null
  is_baby: boolean | null
  color: string | null
  shape: string | null
  types: { slot: number; name: string }[]
  stats: { name: string; base_stat: number; effort: number }[]
  abilities: { name: string; is_hidden: boolean; slot: number }[]
  image: string | null
  cry: string | null
}

// ---------- Config ----------
const apiBase =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

// ---------- State ----------
const query = ref('')
const results = ref<SearchItem[]>([])
const showList = ref(false)
const isSearching = ref(false)
const hasSearched = ref(false)
const searchError = ref('')

const selectedPokemon = ref<PokemonDetail | null>(null)
const isLoadingDetail = ref(false)
const detailError = ref('')

const searchBarEl = ref<HTMLElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let searchController: AbortController | null = null
let detailController: AbortController | null = null

// ---------- API: search  ->  GET /pokemon/:value ----------
async function fetchResults(raw: string): Promise<void> {
  searchController?.abort()

  // Names need 2+ characters, but any number is a valid Pokédex id.
  const q = raw.trim().replace(/\s+/g, '-')
  if (!q || (!/^\d+$/.test(q) && q.length < 2)) {
    results.value = []
    hasSearched.value = false
    isSearching.value = false
    searchError.value = ''
    return
  }
const getFallbackUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

  const controller = new AbortController()
  searchController = controller
  isSearching.value = true
  searchError.value = ''

  try {
    const res = await fetch(
      `${apiBase}/pokemon/${encodeURIComponent(q)}/?limit=20`,
      { signal: controller.signal },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    results.value = Array.isArray(data) ? data : []
    hasSearched.value = true
    showList.value = true
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    results.value = []
    searchError.value = `Couldn't reach the Pokédex API at ${apiBase}. Is the server running?`
    showList.value = true
  } finally {
    if (searchController === controller) isSearching.value = false
  }
}

function onInput(): void {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchResults(query.value), 300)
}

// ---------- API: detail  ->  GET /pokemon/:id/details ----------
async function selectPokemon(item: SearchItem): Promise<void> {
  detailController?.abort()
  const controller = new AbortController()
  detailController = controller

  showList.value = false
  query.value = formatName(item.name)
  selectedPokemon.value = null
  detailError.value = ''
  isLoadingDetail.value = true

  try {
    const res = await fetch(`${apiBase}/pokemon/${item.id}/details`, {
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    selectedPokemon.value = await res.json()
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    detailError.value = `Couldn't load ${formatName(item.name)}. Try again.`
  } finally {
    if (detailController === controller) isLoadingDetail.value = false
  }
}

function selectFirst(): void {
  if (results.value.length > 0) selectPokemon(results.value[0])
}

// ---------- Close dropdown on outside click / Escape ----------
function onDocumentClick(e: MouseEvent): void {
  if (searchBarEl.value && !searchBarEl.value.contains(e.target as Node)) {
    showList.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  clearTimeout(debounceTimer)
  searchController?.abort()
  detailController?.abort()
})

// ---------- Card data ----------
const cardTypes = computed(() =>
  [...(selectedPokemon.value?.types ?? [])].sort((a, b) => a.slot - b.slot).map((t) => t.name),
)

const hpStat = computed(
  () => selectedPokemon.value?.stats.find((s) => s.name === 'hp')?.base_stat ?? null,
)

const rarityTags = computed(() => {
  const p = selectedPokemon.value
  if (!p) return []
  return [p.is_legendary && 'Legendary', p.is_mythical && 'Mythical', p.is_baby && 'Baby'].filter(
    (t): t is string => !!t,
  )
})

// Colours for the spotlight behind the card
const stageVars = computed(() =>
  selectedPokemon.value ? cardVars(cardTypes.value) : { '--c1': '#ff3d8b', '--c2': '#4b5bff' },
)

function playCry(): void {
  if (selectedPokemon.value?.cry) new Audio(selectedPokemon.value.cry).play().catch(() => {})
}

const getFallbackUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

</script>

<template>
  <div class="search-tab">
    <header class="page-head">
      <h2>Find a Pokémon</h2>
      <p>Search by name or Pokédex number.</p>
    </header>

    <!-- Search -->
    <div ref="searchBarEl" class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4" />
        <path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
      <input
        v-model="query"
        type="text"
        placeholder="Try “pika”, “char” or 25"
        autocomplete="off"
        aria-label="Search Pokémon"
        @input="onInput"
        @focus="results.length > 0 && (showList = true)"
        @keydown.enter.prevent="selectFirst"
        @keydown.esc="showList = false"
      />
      <span v-if="isSearching" class="spinner" aria-label="Searching"></span>

      <ul v-if="showList && results.length > 0" class="result-list">
        <li v-for="item in results" :key="item.id">
          <button type="button" class="result-item" @click="selectPokemon(item)">
            <img
              v-if="item.thumbnail"
              :src="item.thumbnail || getFallbackUrl(item.id)"
              :alt="''"
              class="thumb"
              loading="lazy"
            />
            <span v-else class="thumb thumb--empty"></span>
            <span class="result-name">{{ formatName(item.name) }}</span>
            <span class="result-id">#{{ String(item.id).padStart(4, '0') }}</span>
          </button>
        </li>
      </ul>

      <div v-else-if="showList && searchError" class="result-note result-note--error">
        {{ searchError }}
      </div>
      <div
        v-else-if="showList && hasSearched && !isSearching && results.length === 0"
        class="result-note"
      >
        No Pokémon match “{{ query }}”. Check the spelling or try its number.
      </div>
    </div>

    <!-- Stage: spotlight in the card's type colours, card (or empty slot) on top -->
    <section :class="['stage', { 'stage--idle': !selectedPokemon }]" :style="stageVars">
      <div v-if="selectedPokemon" class="card-wrap">
        <PokemonCard
          :key="selectedPokemon.id"
          :name="selectedPokemon.name"
          :types="cardTypes"
          :image="selectedPokemon.image || getFallbackUrl(selectedPokemon!.id)"
          :hp="hpStat"
          :dex="selectedPokemon.id"
          :height="selectedPokemon.height"
          :weight="selectedPokemon.weight"
          :base-exp="selectedPokemon.base_experience"
          :abilities="selectedPokemon.abilities"
          :stats="selectedPokemon.stats"
          :tags="rarityTags"
        />
      </div>

      <div v-else :class="['slot', { 'slot--error': detailError }]">
        <span v-if="isLoadingDetail" class="slot-spin" aria-hidden="true"></span>
        <p v-if="isLoadingDetail" class="status">Loading Pokémon…</p>
        <p v-else-if="detailError" class="status status--error">{{ detailError }}</p>
        <p v-else class="status">Pick a Pokémon from the results to see its stats.</p>
      </div>

      <button
        v-if="selectedPokemon?.cry"
        type="button"
        class="cry-btn"
        @click="playCry"
      >
        Play cry
      </button>
    </section>
  </div>
</template>

<style scoped>
.search-tab {
  --paper: #ffffff;
  --line: #dfe3ea;

  width: 100%;
  padding: 36px clamp(12px, 3vw, 32px) 64px;
  color: var(--text);
  font-family: var(--font-ui);
  text-align: center;
}

.page-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(30px, 5vw, 46px);
  font-weight: 700;
  line-height: 1.1;
}
.page-head p {
  margin: 8px 0 24px;
  font-size: 18px;
  color: var(--muted);
}

/* ---------- Bench (mini cards) ---------- */
.bench h3,
.moves h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
}
.bench-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.mini {
  width: 104px;
  border-radius: 6px;
  transition: transform 0.2s, filter 0.2s, opacity 0.2s;
}
.mini.active {
  transform: translateY(-6px);
  box-shadow: 0 0 0 3px var(--yellow), 0 0 26px rgba(255, 203, 5, 0.55);
}
.mini.fainted {
  opacity: 0.45;
  filter: grayscale(1) brightness(0.8);
}

/* ---------- Search ---------- */
.search-bar {
  position: relative;
  z-index: 5;
  max-width: 680px;
  margin: 0 auto 36px;
  text-align: left;
}

input[type='text'] {
  width: 100%;
  padding: 16px 48px 16px 52px;
  font: inherit;
  font-size: 18px;
  color: var(--ink);
  background: var(--paper);
  border: 3px solid transparent;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(8, 4, 40, 0.45);
}
input[type='text']::placeholder {
  color: #8a86a3;
}
input[type='text']:focus-visible {
  outline: none;
  border-color: var(--yellow);
  box-shadow: 0 0 0 4px rgba(255, 203, 5, 0.35), 0 10px 30px rgba(8, 4, 40, 0.45);
}

.search-icon {
  position: absolute;
  top: 50%;
  left: 18px;
  width: 24px;
  height: 24px;
  transform: translateY(-50%);
  color: #6a5fd0;
  pointer-events: none;
}

.spinner {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 20px;
  height: 20px;
  border: 3px solid #e3e0f5;
  border-top-color: #6a5fd0;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-list,
.result-note {
  position: absolute;
  z-index: 10;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  border-radius: 16px;
  box-shadow: 0 18px 44px rgba(8, 4, 40, 0.55);
}
.result-list {
  padding: 6px;
  list-style: none;
  max-height: 340px;
  overflow-y: auto;
}
.result-note {
  padding: 16px 18px;
  color: #5d6676;
}
.result-note--error {
  color: #b3261e;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 6px 12px;
  font: inherit;
  font-size: 17px;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}
.result-item:hover,
.result-item:focus-visible {
  background: #efeaff;
  outline: none;
}
.thumb {
  width: 44px;
  height: 44px;
  padding: 2px;
  object-fit: contain;
  image-rendering: pixelated;
  background: #f3f0ff;
  border-radius: 50%;
}
.thumb--empty {
  background: #ebe8f7;
}
.result-name {
  flex: 1;
  font-weight: 700;
}
.result-id {
  color: #7a7596;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}

/* ---------- Stage ---------- */
.stage {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 8px 0;
}
/* spotlight: both type colours glow behind the card, across the full width */
.stage::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -60px -4% -60px;
  background:
    radial-gradient(34% 56% at 36% 50%, color-mix(in srgb, var(--c1) 55%, transparent), transparent 100%),
    radial-gradient(34% 56% at 64% 50%, color-mix(in srgb, var(--c2) 55%, transparent), transparent 100%);
  transition: opacity 0.4s;
}
.stage--idle::before {
  opacity: 0.3;
}

.card-wrap {
  width: min(460px, 100%);
}

/* empty card slot, like a binder page */
.slot {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 16px;
  width: min(440px, 100%);
  aspect-ratio: 63 / 88;
  padding: 32px;
  border: 3px dashed rgba(255, 255, 255, 0.3);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.05);
}
.slot--error {
  border-color: rgba(255, 120, 110, 0.7);
  background: rgba(217, 71, 58, 0.12);
}
.slot-spin {
  width: 34px;
  height: 34px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--yellow);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.status {
  max-width: 24ch;
  margin: 0;
  font-size: 18px;
  color: var(--muted);
}
.status--error {
  color: #ffb4ab;
}

.cry-btn {
  padding: 12px 32px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
  background: linear-gradient(180deg, var(--yellow), var(--yellow-deep));
  border: 0;
  border-radius: 14px;
  box-shadow: 0 4px 0 #b97a00, 0 10px 22px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}
.cry-btn:hover {
  transform: translateY(-1px);
}
.cry-btn:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 #b97a00, 0 4px 10px rgba(0, 0, 0, 0.3);
}
.cry-btn:focus-visible {
  outline: 3px solid #ffffff;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .spinner,
  .slot-spin {
    animation-duration: 2s;
  }
}
</style>
