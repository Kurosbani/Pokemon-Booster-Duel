<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { cardVars, formatName, getTypeColor, readableOn, typeIcon } from './cardStyle'

interface Ability { name: string; is_hidden: boolean; slot: number }
interface Stat { name: string; base_stat: number }

const props = withDefaults(
  defineProps<{
    name: string
    types: string[]
    image?: string | null
    /** Max HP, shown in the card header. */
    hp?: number | null
    /** When set, an HP bar (currentHp / hp) is shown on the card. */
    currentHp?: number | null
    hpLabel?: string
    dex?: number | null
    height?: number | null // decimetres
    weight?: number | null // hectograms
    baseExp?: number | null
    abilities?: Ability[]
    stats?: Stat[]
    /** Rarity tags such as "Legendary". Any tag makes the card foil. */
    tags?: string[]
    variant?: 'full' | 'compact'
    /** Tilt + holo shine that follows the mouse. */
    interactive?: boolean
  }>(),
  {
    image: null,
    hp: null,
    currentHp: null,
    hpLabel: 'HP',
    dex: null,
    height: null,
    weight: null,
    baseExp: undefined,
    abilities: () => [],
    stats: () => [],
    tags: () => [],
    variant: 'full',
    interactive: true,
  },
)

// ---------- Display ----------
const imageFailed = ref(false)
const vars = computed(() => cardVars(props.types))
const displayName = computed(() => formatName(props.name))
const isRare = computed(() => props.tags.length > 0)

const dexLabel = computed(() => (props.dex != null ? String(props.dex).padStart(4, '0') : null))
const heightLabel = computed(() => (props.height != null ? `${(props.height / 10).toFixed(1)} m` : '—'))
const weightLabel = computed(() => (props.weight != null ? `${(props.weight / 10).toFixed(1)} kg` : '—'))
const hasStrip = computed(() => props.dex != null || props.height != null || props.weight != null)

const STAT_LABELS: Record<string, string> = {
  hp: 'HP', attack: 'Attack', defense: 'Defense',
  'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', speed: 'Speed',
}
const statLabel = (name: string) => STAT_LABELS[name] ?? formatName(name)
const STAT_MAX = 180 // bar is full at this value
const statWidth = (v: number) => `${Math.min(100, (v / STAT_MAX) * 100)}%`
const totalStats = computed(() => props.stats.reduce((sum, s) => sum + s.base_stat, 0))

const showHpBar = computed(() => props.currentHp != null && !!props.hp)
const hpPct = computed(() =>
  showHpBar.value ? Math.max(0, Math.min(100, Math.round((props.currentHp! / props.hp!) * 100))) : 0,
)
const hpColor = computed(() => (hpPct.value > 50 ? '#3fb950' : hpPct.value > 20 ? '#e8b92f' : '#d9473a'))

const slots = useSlots()
const hasPanel = computed(
  () => props.abilities.length > 0 || props.stats.length > 0 || showHpBar.value || !!slots.default,
)

// ---------- Tilt + holo ----------
const root = ref<HTMLElement | null>(null)
const reduceMotion =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function onMove(e: PointerEvent): void {
  const el = root.value
  if (!el || !props.interactive || reduceMotion || e.pointerType !== 'mouse') return
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  el.style.setProperty('--rx', `${((0.5 - y) * 12).toFixed(2)}deg`)
  el.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`)
  el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
  el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
}
function onLeave(): void {
  const el = root.value
  if (!el) return
  for (const k of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(k)
}
</script>

<template>
  <div
    ref="root"
    :class="['pk', `pk--${variant}`, { 'pk--live': interactive, 'pk--rare': isRare }]"
    :style="vars"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <article class="card">
      <div class="face">
        <!-- Name · HP · type orbs -->
        <header class="head">
          <h3 class="name">{{ displayName }}</h3>
          <div v-if="hp != null" class="hp">
            <small>{{ hpLabel }}</small>
            <strong>{{ hp }}</strong>
          </div>
          <div class="orbs">
            <span
              v-for="t in types"
              :key="t"
              class="orb"
              :style="{ '--o': getTypeColor(t) }"
              :title="formatName(t)"
            >{{ typeIcon(t) }}</span>
          </div>
        </header>

        <!-- Artwork window -->
        <div class="art">
          <div class="art-in">
            <img
              v-if="image && !imageFailed"
              :src="image"
              :alt="displayName"
              loading="lazy"
              @error="imageFailed = true"
            />
            <span v-else class="art-empty">No image available</span>
          </div>
        </div>

        <div v-if="variant === 'full'" class="kinds">
          <span
            v-for="t in types"
            :key="t"
            class="kind"
            :style="{ '--o': getTypeColor(t), color: readableOn(getTypeColor(t)) }"
          >{{ typeIcon(t) }} {{ formatName(t) }}</span>
        </div>

        <div v-if="variant === 'full' && hasStrip" class="strip">
          <span v-if="dexLabel">No. <b>{{ dexLabel }}</b></span>
          <span>Height <b>{{ heightLabel }}</b></span>
          <span>Weight <b>{{ weightLabel }}</b></span>
        </div>

        <div v-if="hasPanel" class="panel">
          <template v-if="variant === 'full'">
            <ul v-if="abilities.length" class="abilities">
              <li v-for="a in abilities" :key="a.slot + a.name">
                <span class="ab-tag">Ability</span>
                <span class="ab-name">{{ formatName(a.name) }}</span>
                <em v-if="a.is_hidden">hidden</em>
              </li>
            </ul>

            <div v-if="stats.length" class="stats">
              <div v-for="s in stats" :key="s.name" class="stat">
                <span class="stat-name">{{ statLabel(s.name) }}</span>
                <span class="bar"><span class="fill" :style="{ width: statWidth(s.base_stat) }"></span></span>
                <span class="stat-val">{{ s.base_stat }}</span>
              </div>
              <div class="stat stat--total">
                <span class="stat-name">Total</span>
                <span class="stat-val">{{ totalStats }}</span>
              </div>
            </div>
          </template>

          <!-- extra panel content, e.g. the attack list in battle -->
          <slot />

          <div v-if="showHpBar" class="hpbar">
            <div class="track">
              <div class="hpfill" :style="{ width: hpPct + '%', background: hpColor }"></div>
            </div>
            <span class="hptext">{{ currentHp }} / {{ hp }} {{ hpLabel }}</span>
          </div>
        </div>

        <footer v-if="variant === 'full' && (baseExp !== undefined || tags.length)" class="foot">
          <span v-if="baseExp !== undefined">Base EXP <b>{{ baseExp ?? '-' }}</b></span>
          <span class="tags">
            <span v-for="tag in tags" :key="tag" class="tag">★ {{ tag }}</span>
          </span>
        </footer>
      </div>

      <span class="foil" aria-hidden="true"></span>
    </article>
  </div>
</template>

<style scoped>
/* Everything is sized in cqw (1% of the card's width) so the same card
   works at 100px on the bench and 460px on the search page. */
.pk {
  --fd: var(--font-display, 'Fredoka', system-ui, sans-serif);
  --fu: var(--font-ui, 'Barlow Semi Condensed', system-ui, sans-serif);
  --ink: #1d1a2f;

  container-type: inline-size;
  width: 100%;
  color: var(--ink);
  font-family: var(--fu);
  text-align: left;
  transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform 0.25s ease-out, scale 0.25s ease-out;
}

/* ---------- Frame (type gradient) ---------- */
.card {
  position: relative;
  display: flex;
  /* real card ratio (63:88) as a minimum, so long content grows the card instead of spilling out */
  min-height: 139.7cqw;
  padding: 3.4cqw;
  border-radius: 5cqw;
  background: linear-gradient(145deg, var(--c1), var(--c2));
  box-shadow:
    0 2cqw 6cqw -1cqw rgba(0, 0, 0, 0.55),
    inset 0 0 0 0.5cqw rgba(255, 255, 255, 0.4);
}
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.38), transparent 32%, transparent 68%, rgba(0, 0, 0, 0.2));
  pointer-events: none;
}

/* ---------- Face (lightened version of the same gradient) ---------- */
.face {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1.7cqw;
  padding: 3.4cqw 3.6cqw;
  border-radius: 2.8cqw;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--c1) 66%, #ffffff),
    color-mix(in srgb, var(--c2) 66%, #ffffff)
  );
  box-shadow:
    inset 0 0 0 0.35cqw rgba(0, 0, 0, 0.22),
    inset 0 0.8cqw 1.6cqw rgba(255, 255, 255, 0.55);
}

/* ---------- Header ---------- */
.head {
  display: flex;
  align-items: center;
  gap: 1.8cqw;
}
.name {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: var(--fd);
  font-size: 7.2cqw;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hp {
  display: flex;
  align-items: baseline;
  gap: 0.8cqw;
  font-family: var(--fd);
  color: #c3162f;
}
.hp small { font-size: 3.4cqw; font-weight: 700; }
.hp strong { font-size: 7cqw; font-weight: 700; }

.orbs { display: flex; gap: 1cqw; }
.orb {
  display: grid;
  place-items: center;
  width: 7.6cqw;
  height: 7.6cqw;
  border-radius: 50%;
  font-size: 4.2cqw;
  line-height: 1;
  background: radial-gradient(
    circle at 35% 30%,
    color-mix(in srgb, var(--o) 50%, #ffffff),
    var(--o) 58%,
    color-mix(in srgb, var(--o) 68%, #000000)
  );
  box-shadow: 0 0 0 0.5cqw #ffffff, 0 0.7cqw 1.3cqw rgba(0, 0, 0, 0.35);
}

/* ---------- Art window (gold frame like the real thing) ---------- */
.art {
  padding: 1cqw;
  border-radius: 2.2cqw;
  background: linear-gradient(135deg, #fff3b0, #d4a82a 35%, #fff0a0 55%, #b98a1c);
  box-shadow: 0 0.7cqw 1.4cqw rgba(0, 0, 0, 0.3);
}
.art-in {
  position: relative;
  aspect-ratio: 1.7;
  border-radius: 1.5cqw;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 46%, rgba(255, 255, 255, 0.8), transparent 62%),
    linear-gradient(
      150deg,
      color-mix(in srgb, var(--c1) 92%, #ffffff),
      color-mix(in srgb, var(--c2) 92%, #ffffff)
    );
  box-shadow: inset 0 0 3.2cqw rgba(0, 0, 0, 0.3);
}
.art-in::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(55deg, rgba(255, 255, 255, 0.14) 0 0.6cqw, transparent 0.6cqw 2.4cqw);
}
.art-in img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.6cqw;
  filter: drop-shadow(0 1.2cqw 1.2cqw rgba(0, 0, 0, 0.35));
}
.art-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 3.4cqw;
  font-weight: 600;
  opacity: 0.7;
}

/* ---------- Type pills ---------- */
.kinds { display: flex; flex-wrap: wrap; gap: 1.4cqw; }
.kind {
  padding: 0.7cqw 2.8cqw;
  border-radius: 99px;
  font-size: 3.4cqw;
  font-weight: 700;
  line-height: 1.3;
  background: linear-gradient(180deg, color-mix(in srgb, var(--o) 85%, #ffffff), var(--o));
  box-shadow: inset 0 0 0 0.3cqw rgba(0, 0, 0, 0.25);
}

/* ---------- Pokédex strip ---------- */
.strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1cqw;
  padding: 0.9cqw 2.6cqw;
  border-radius: 99px;
  font-size: 3.1cqw;
  font-weight: 500;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.4));
  box-shadow: inset 0 0 0 0.3cqw rgba(0, 0, 0, 0.14);
}
.strip b { font-weight: 700; font-variant-numeric: tabular-nums; }

/* ---------- Body panel ---------- */
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2cqw;
  padding: 2.4cqw 2.8cqw;
  border-radius: 2cqw;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: inset 0 0 0 0.3cqw rgba(0, 0, 0, 0.12);
}

.abilities {
  display: flex;
  flex-direction: column;
  gap: 1cqw;
  margin: 0;
  padding: 0;
  list-style: none;
}
.abilities li {
  display: flex;
  align-items: center;
  gap: 1.6cqw;
  font-size: 3.7cqw;
  font-weight: 700;
}
.ab-tag {
  padding: 0.2cqw 1.8cqw;
  border-radius: 1cqw;
  font-size: 2.8cqw;
  line-height: 1.6;
  color: #ffffff;
  background: #d0213e;
}
.abilities em {
  font-size: 3cqw;
  font-weight: 500;
  opacity: 0.7;
}

.stats { display: grid; gap: 0.7cqw; }
.stat {
  display: grid;
  grid-template-columns: 15cqw 1fr 8cqw;
  align-items: center;
  gap: 2cqw;
  font-size: 3.4cqw;
  font-weight: 600;
}
.stat-name { opacity: 0.75; }
.stat-val {
  font-family: var(--fd);
  font-size: 3.9cqw;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bar {
  height: 2.2cqw;
  border-radius: 99px;
  background: rgba(29, 26, 47, 0.14);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--c1), var(--c2));
  box-shadow: inset 0 0 0 0.3cqw rgba(0, 0, 0, 0.25);
}
.stat--total {
  grid-template-columns: 15cqw 1fr;
  margin-top: 0.6cqw;
  padding-top: 1cqw;
  border-top: 0.3cqw solid rgba(29, 26, 47, 0.2);
}
.stat--total .stat-name { opacity: 1; font-weight: 700; }

/* HP bar (battle) */
.hpbar { display: grid; gap: 1.2cqw; }
.track {
  height: 3.8cqw;
  border-radius: 99px;
  background: rgba(29, 26, 47, 0.2);
  overflow: hidden;
  box-shadow: inset 0 0 0 0.3cqw rgba(0, 0, 0, 0.22);
}
.hpfill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease, background 0.4s ease;
}
.hptext {
  font-size: 4cqw;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* ---------- Footer ---------- */
.foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2cqw;
  font-size: 3cqw;
  font-weight: 500;
  opacity: 0.85;
}
.foot b { font-weight: 700; }
.tags { display: flex; gap: 1.4cqw; }
.tag {
  padding: 0.4cqw 2cqw;
  border-radius: 99px;
  font-weight: 700;
  color: #5a4300;
  background: linear-gradient(135deg, #fff3b0, #e2b53a);
  box-shadow: inset 0 0 0 0.3cqw rgba(90, 67, 0, 0.45);
}

/* ---------- Holo foil ---------- */
.foil {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
}
.foil::before,
.foil::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s;
}
.foil::before {
  background:
    linear-gradient(
      115deg,
      transparent 15%,
      rgba(255, 90, 200, 0.55) 30%,
      rgba(255, 235, 120, 0.55) 42%,
      rgba(90, 255, 200, 0.5) 54%,
      rgba(110, 150, 255, 0.55) 66%,
      transparent 82%
    ),
    repeating-linear-gradient(60deg, rgba(255, 255, 255, 0.2) 0 0.5cqw, transparent 0.5cqw 2.2cqw);
  background-size: 260% 260%, auto;
  background-position: var(--mx, 50%) var(--my, 50%), 0 0;
  mix-blend-mode: overlay;
}
.foil::after {
  background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255, 255, 255, 0.65), transparent 45%);
  mix-blend-mode: soft-light;
}
.pk--rare .foil::before { opacity: 0.45; }

@media (hover: hover) {
  .pk--live:hover { scale: 1.02; }
  .pk--live:hover .foil::before { opacity: 0.8; }
  .pk--live:hover .foil::after { opacity: 1; }
}

/* ---------- Compact (bench) ---------- */
.pk--compact .card { box-shadow: 0 1.6cqw 4cqw -1cqw rgba(0, 0, 0, 0.55), inset 0 0 0 0.5cqw rgba(255, 255, 255, 0.4); }
.pk--compact .face { gap: 1.6cqw; padding: 3cqw; }
.pk--compact .name { font-size: 11cqw; }
.pk--compact .hp small,
.pk--compact .orbs,
.pk--compact .hptext { display: none; }
.pk--compact .hp strong { font-size: 10cqw; }
.pk--compact .art { flex: 1; display: flex; padding: 1.8cqw; border-radius: 3cqw; }
.pk--compact .art-in { flex: 1; aspect-ratio: auto; border-radius: 2cqw; }
.pk--compact .panel { flex: none; padding: 0; background: none; box-shadow: none; }
.pk--compact .track { height: 5cqw; }

@media (prefers-reduced-motion: reduce) {
  .pk { transition: none; }
  .foil::before, .foil::after { transition: none; }
}
</style>
