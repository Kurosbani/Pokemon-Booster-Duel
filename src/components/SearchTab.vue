<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

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
const imageFailed = ref(false)

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

  const controller = new AbortController()
  searchController = controller
  isSearching.value = true
  searchError.value = ''

  try {
    const res = await fetch(
      `${apiBase}/pokemon/${encodeURIComponent(q)}?limit=20`,
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
  imageFailed.value = false
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

// ---------- Display helpers ----------
const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c',
  grass: '#7ac74c', ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1',
  ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746',
  steel: '#b7b7ce', fairy: '#d685ad',
}
const FALLBACK_COLOR = '#7a7c90'

function getTypeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? FALLBACK_COLOR
}

// Pick black or white text depending on how light the background is
function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1b2230' : '#ffffff'
}

function formatName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Speed',
}
function statLabel(name: string): string {
  return STAT_LABELS[name] ?? formatName(name)
}

const STAT_MAX = 180 // bar is full at this value (most stats stay below it)
function statWidth(value: number): string {
  return `${Math.min(100, (value / STAT_MAX) * 100)}%`
}

const accent = computed(() => {
  const first = selectedPokemon.value?.types[0]?.name
  return first ? getTypeColor(first) : FALLBACK_COLOR
})

const totalStats = computed(() =>
  (selectedPokemon.value?.stats ?? []).reduce((sum, s) => sum + s.base_stat, 0),
)

const dexNumber = computed(() =>
  selectedPokemon.value ? `#${String(selectedPokemon.value.id).padStart(4, '0')}` : '',
)

const heightLabel = computed(() =>
  selectedPokemon.value?.height != null ? `${(selectedPokemon.value.height / 10).toFixed(1)} m` : '—',
)
const weightLabel = computed(() =>
  selectedPokemon.value?.weight != null ? `${(selectedPokemon.value.weight / 10).toFixed(1)} kg` : '—',
)

function playCry(): void {
  if (selectedPokemon.value?.cry) new Audio(selectedPokemon.value.cry).play().catch(() => {})
}
</script>

<template>
  <div class="search-tab">
    <header class="page-head">
      <h2>Find a Pokémon</h2>
      <p>Search by name or Pokédex number.</p>
    </header>

    <!-- Search -->
    <div ref="searchBarEl" class="search-bar">
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
              :src="item.thumbnail"
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

    <!-- Detail states -->
    <p v-if="isLoadingDetail" class="status">Loading Pokémon…</p>
    <p v-else-if="detailError" class="status status--error">{{ detailError }}</p>

    <!-- Detail card -->
    <article
      v-if="selectedPokemon"
      class="pokemon-card"
      :style="{ '--accent': accent }"
    >
      <div class="art">
        <img
          v-if="selectedPokemon.image && !imageFailed"
          :src="selectedPokemon.image"
          :alt="formatName(selectedPokemon.name)"
          @error="imageFailed = true"
        />
        <div v-else class="art-empty">No image available</div>
      </div>

      <div class="card-info">
        <div class="title-row">
          <h3>{{ formatName(selectedPokemon.name) }}</h3>
          <span class="dex">{{ dexNumber }}</span>
        </div>

        <div class="types">
          <span
            v-for="t in selectedPokemon.types"
            :key="t.slot"
            class="type-badge"
            :style="{
              backgroundColor: getTypeColor(t.name),
              color: readableOn(getTypeColor(t.name)),
            }"
          >
            {{ formatName(t.name) }}
          </span>
          <span v-if="selectedPokemon.is_legendary" class="tag">Legendary</span>
          <span v-if="selectedPokemon.is_mythical" class="tag">Mythical</span>
          <span v-if="selectedPokemon.is_baby" class="tag">Baby</span>
        </div>

        <dl class="facts">
          <div><dt>Height</dt><dd>{{ heightLabel }}</dd></div>
          <div><dt>Weight</dt><dd>{{ weightLabel }}</dd></div>
          <div><dt>Base EXP</dt><dd>{{ selectedPokemon.base_experience ?? '-' }}</dd>
          </div>
        </dl>

        <div v-if="selectedPokemon.abilities.length" class="abilities">
          <h4>Abilities</h4>
          <ul>
            <li v-for="a in selectedPokemon.abilities" :key="a.slot + a.name">
              {{ formatName(a.name) }}
              <small v-if="a.is_hidden">hidden</small>
            </li>
          </ul>
        </div>

        <div v-if="selectedPokemon.stats.length" class="stats">
          <h4>Base stats</h4>
          <div v-for="s in selectedPokemon.stats" :key="s.name" class="stat-row">
            <span class="stat-name">{{ statLabel(s.name) }}</span>
            <span class="stat-value">{{ s.base_stat }}</span>
            <span class="bar"><span class="fill" :style="{ width: statWidth(s.base_stat) }"></span></span>
          </div>
          <div class="stat-row stat-row--total">
            <span class="stat-name">Total</span>
            <span class="stat-value">{{ totalStats }}</span>
          </div>
        </div>

        <button v-if="selectedPokemon.cry" type="button" class="cry-btn" @click="playCry">
          Play cry
        </button>
      </div>
    </article>

    <p
      v-else-if="!isLoadingDetail && !detailError"
      class="status status--hint"
    >
      Pick a Pokémon from the results to see its stats.
    </p>
  </div>
</template>

<style scoped>
.search-tab {
  --ink: #1b2230;
  --muted: #5d6676;
  --line: #dfe3ea;
  --paper: #ffffff;

  max-width: 760px;
  margin: 0 auto;
  padding: 24px 20px 48px;
  color: var(--ink);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

.page-head h2 {
  margin: 0;
  font-size: 32px;
  letter-spacing: -0.02em;
}
.page-head p {
  margin: 4px 0 20px;
  color: var(--muted);
}

/* ---------- Search ---------- */
.search-bar {
  position: relative;
  margin-bottom: 28px;
}

input[type='text'] {
  box-sizing: border-box;
  width: 100%;
  padding: 14px 44px 14px 16px;
  font-size: 16px;
  color: var(--ink);
  background: var(--paper);
  border: 2px solid var(--line);
  border-radius: 10px;
}
input[type='text']:focus-visible {
  outline: 3px solid #483dca55;
  border-color: #483dca;
}

.spinner {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 18px;
  height: 18px;
  border: 2px solid var(--line);
  border-top-color: #483dca;
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
  top: calc(100% + 6px);
  margin: 0;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(27, 34, 48, 0.12);
}
.result-list {
  padding: 4px;
  list-style: none;
  max-height: 320px;
  overflow-y: auto;
}
.result-note {
  padding: 14px 16px;
  color: var(--muted);
}
.result-note--error {
  color: #b3261e;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  font: inherit;
  font-size: 15px;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
.result-item:hover,
.result-item:focus-visible {
  background: #f0f0f8;
  outline: none;
}
.thumb {
  width: 40px;
  height: 40px;
  object-fit: contain;
  image-rendering: pixelated;
}
.thumb--empty {
  background: #f0f1f4;
  border-radius: 50%;
}
.result-name {
  flex: 1;
  font-weight: 600;
}
.result-id {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

/* ---------- Status ---------- */
.status {
  margin: 16px 0;
  color: var(--muted);
}
.status--error {
  color: #b3261e;
}
.status--hint {
  padding: 28px;
  text-align: center;
  border: 2px dashed var(--line);
  border-radius: 12px;
}

/* ---------- Card ---------- */
.pokemon-card {
  display: flex;
  align-items: stretch;
  gap: 28px;
  padding: 28px;
  background: color-mix(in srgb, var(--accent) 12%, #ffffff);
  border: 2px solid color-mix(in srgb, var(--accent) 55%, #ffffff);
  border-radius: 16px;
}

.art {
  flex: 0 0 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--accent) 38%, #ffffff) 0 58%,
    transparent 59%
  );
}
.art img {
  width: 100%;
  max-width: 240px;
  height: auto;
  filter: drop-shadow(0 8px 10px rgba(27, 34, 48, 0.25));
}
.art-empty {
  color: var(--muted);
  font-size: 14px;
}

.card-info {
  flex: 1;
  min-width: 0;
}
.title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.card-info h3 {
  margin: 0;
  font-size: 30px;
  letter-spacing: -0.02em;
}
.dex {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 16px;
}
.type-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.tag {
  padding: 3px 10px;
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.facts {
  display: flex;
  gap: 24px;
  margin: 0 0 16px;
}
.facts dt {
  font-size: 12px;
  color: var(--muted);
}
.facts dd {
  margin: 2px 0 0;
  font-weight: 700;
}

.card-info h4 {
  margin: 0 0 6px;
  font-size: 14px;
}
.abilities {
  margin-bottom: 16px;
}
.abilities ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.abilities small {
  margin-left: 4px;
  color: var(--muted);
  font-style: italic;
}

.stat-row {
  display: grid;
  grid-template-columns: 72px 36px 1fr;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 14px;
}
.stat-name {
  color: var(--muted);
}
.stat-value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.bar {
  height: 8px;
  background: color-mix(in srgb, var(--accent) 18%, #ffffff);
  border-radius: 999px;
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
}
.stat-row--total {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--accent) 35%, #ffffff);
}

.cry-btn {
  margin-top: 16px;
  padding: 8px 16px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  background: #ffffff;
  border: 2px solid var(--ink);
  border-radius: 8px;
  cursor: pointer;
}
.cry-btn:hover {
  background: var(--ink);
  color: #ffffff;
}
.cry-btn:focus-visible {
  outline: 3px solid #483dca55;
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .pokemon-card {
    flex-direction: column;
    padding: 20px;
  }
  .art {
    flex-basis: auto;
    min-height: 200px;
  }
  .art img {
    max-width: 200px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2s;
  }
}
</style>
