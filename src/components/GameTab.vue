<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  TEAM_SIZE, STRUGGLE, drawFighters, resolveAttack, chooseBotMove, actsFirst,
  formatName,
  type BattleMove, type Fighter
} from './pokemonBattle'
import PokemonCard from './PokemonCard.vue'
import { getTypeColor, typeIcon } from './cardStyle'

type Side = 'player' | 'bot'
type Phase = 'idle' | 'loading' | 'choose' | 'resolving' | 'finished'
type Mode = 'duel' | 'team'

const mode = ref<Mode>('duel')
const phase = ref<Phase>('idle')
const error = ref<string | null>(null)

const playerTeam = ref<Fighter[]>([])
const botTeam = ref<Fighter[]>([])
const pIdx = ref(0)
const bIdx = ref(0)
const duelResults = ref<Side[]>([])
const winner = ref<Side | null>(null)
const log = ref<string[]>([])
const logEl = ref<HTMLElement | null>(null)

const activeP = computed(() => playerTeam.value[pIdx.value])
const activeB = computed(() => botTeam.value[bIdx.value])
const noPpLeft = computed(() => !!activeP.value && activeP.value.moves.every((m) => m.ppLeft <= 0))
const playerWins = computed(() => duelResults.value.filter((r) => r === 'player').length)
const botWins = computed(() => duelResults.value.filter((r) => r === 'bot').length)

const sides = computed(() => [
  { key: 'bot' as Side, label: 'Bot', fighter: activeB.value },
  { key: 'player' as Side, label: 'Du', fighter: activeP.value }
])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const nameOf = (f: Fighter) => formatName(f.card.name)

function say(msg: string) {
  log.value.push(msg)
}

watch(log, async () => {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}, { deep: true })

async function startBattle(): Promise<void> {
  phase.value = 'loading'
  error.value = null
  log.value = []
  duelResults.value = []
  winner.value = null
  pIdx.value = 0
  bIdx.value = 0
  try {
    const all = await drawFighters(TEAM_SIZE * 2)
    playerTeam.value = all.slice(0, TEAM_SIZE)
    botTeam.value = all.slice(TEAM_SIZE)
    say(mode.value === 'duel'
      ? 'Fünf Duelle: Karte 1 gegen Karte 1, Karte 2 gegen Karte 2 …'
      : 'Team-Kampf: Besiegte Pokemon werden automatisch ersetzt.')
    say(`${nameOf(activeB.value)} (Bot) tritt gegen ${nameOf(activeP.value)} an!`)
    phase.value = 'choose'
  } catch (e) {
    console.error('Battle failed:', e)
    error.value = 'Pokemon konnten nicht geladen werden. Läuft das Backend auf Port 3000?'
    phase.value = 'idle'
  }
}

async function playTurn(choice: BattleMove | null): Promise<void> {
  if (phase.value !== 'choose') return
  phase.value = 'resolving'

  const p = activeP.value
  const b = activeB.value
  const actors = [
    { side: 'player' as Side, f: p, move: choice ?? STRUGGLE },
    { side: 'bot' as Side, f: b, move: chooseBotMove(b, p) }
  ]
  if (!actsFirst(actors[0], actors[1])) actors.reverse()

  for (const a of actors) {
    const user = a.f
    const target = a.side === 'player' ? b : p
    if (user.hp <= 0) continue

    await sleep(450)
    if (!a.move.isStruggle) a.move.ppLeft = Math.max(0, a.move.ppLeft - 1)
    say(`${nameOf(user)} setzt ${a.move.isStruggle ? 'Verzweifler' : formatName(a.move.name)} ein!`)

    const r = resolveAttack(user, target, a.move)
    await sleep(450)

    if (r.missed) {
      say('Die Attacke ging daneben!')
    } else if (r.effectiveness === 0) {
      say(`Es hat keine Wirkung auf ${nameOf(target)} …`)
    } else {
      target.hp = Math.max(0, target.hp - r.damage)
      if (r.crit) say('Ein Volltreffer!')
      if (r.effectiveness > 1) say('Das war sehr effektiv!')
      if (r.effectiveness < 1) say('Das war nicht sehr effektiv …')
      if (a.move.isStruggle) {
        user.hp = Math.max(0, user.hp - Math.max(1, Math.floor(user.maxHp / 4)))
        say(`${nameOf(user)} wird durch den Rückstoß verletzt!`)
      }
    }
    if (resolveFaints(a.side)) break
  }

  if (phase.value === 'resolving') phase.value = 'choose'
}

/** Prüft KOs, wechselt ein bzw. beendet den Kampf. Gibt true zurück, wenn jemand besiegt wurde. */
function resolveFaints(attacker: Side): boolean {
  const p = activeP.value
  const b = activeB.value
  const pDown = p.hp <= 0
  const bDown = b.hp <= 0
  if (!pDown && !bDown) return false

  if (pDown) say(`${nameOf(p)} wurde besiegt!`)
  if (bDown) say(`${nameOf(b)} wurde besiegt!`)

  if (mode.value === 'duel') {
    const duelWinner: Side = pDown && bDown ? attacker : pDown ? 'bot' : 'player'
    duelResults.value.push(duelWinner)
    say(`Duell ${duelResults.value.length} geht an ${duelWinner === 'player' ? 'dich' : 'den Bot'}.`)
    pIdx.value++
    bIdx.value++
  } else {
    if (pDown) pIdx.value++
    if (bDown) bIdx.value++
  }

  const pOut = pIdx.value >= playerTeam.value.length
  const bOut = bIdx.value >= botTeam.value.length
  if (pOut || bOut) {
    finish(attacker, pOut, bOut)
  } else {
    if (pDown) say(`Du schickst ${nameOf(activeP.value)} in den Kampf!`)
    if (bDown) say(`Der Bot schickt ${nameOf(activeB.value)} in den Kampf!`)
  }
  return true
}

function finish(attacker: Side, pOut: boolean, bOut: boolean) {
  if (mode.value === 'duel') {
    winner.value = playerWins.value > botWins.value ? 'player' : 'bot'
  } else {
    winner.value = pOut && bOut ? attacker : pOut ? 'bot' : 'player'
  }
  phase.value = 'finished'
  say(winner.value === 'player' ? 'Du hast gewonnen!' : 'Der Bot hat gewonnen!')
}

</script>

<template>
  <div class="game-tab">
    <header class="game-head">
      <h2>Battle Arena</h2>

      <div class="setup">
        <div class="modes">
          <label class="mode">
            <input v-model="mode" type="radio" value="duel" :disabled="phase === 'loading' || phase === 'resolving'" />
            <span>5 Duelle (1:1)</span>
          </label>
          <label class="mode">
            <input v-model="mode" type="radio" value="team" :disabled="phase === 'loading' || phase === 'resolving'" />
            <span>5v5 Team-Kampf</span>
          </label>
        </div>
        <button
          :class="['fight-btn', { fighting: phase === 'loading' }]"
          :disabled="phase === 'loading' || phase === 'resolving'"
          @click="startBattle"
        >
          {{ phase === 'loading' ? '⏳ Lade Kampf …' : phase === 'idle' ? 'Battle!' : 'Neues Spiel' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="phase !== 'idle' && phase !== 'loading'" class="battle-results">
      <div v-if="phase === 'finished'" :class="['winner-banner', `winner-banner--${winner}`]">
        <strong>{{ winner === 'player' ? 'Du hast Gewonnen!' : 'Bot hat Gewonnen!' }}</strong>
      </div>

      <div class="battle">
        <div class="main">
          <section
            v-for="team in [{ k: 'bot', label: 'Bot Cards', t: botTeam, i: bIdx }, { k: 'player', label: 'Your Cards', t: playerTeam, i: pIdx }]"
            :key="team.k"
            :class="['bench', `bench--${team.k}`]"
          >
            <h3>{{ team.label }}</h3>
            <div class="bench-cards">
              <div
                v-for="(f, idx) in team.t"
                :key="team.k + idx"
                :class="['mini', { active: idx === team.i && phase !== 'finished', fainted: f.hp <= 0 }]"
                :title="nameOf(f)"
              >
                <PokemonCard
                  variant="compact"
                  :interactive="false"
                  :name="f.card.name"
                  :types="f.card.types"
                  :image="f.card.image"
                  :hp="f.maxHp"
                  :current-hp="f.hp"
                  hp-label="KP"
                />
              </div>
            </div>
          </section>

          <div v-if="activeP && activeB" class="arena">
            <template v-for="(s, i) in sides" :key="s.key">
              <div :class="['seat', `seat--${s.key}`]">
                <span class="seat-label">{{ s.label }}</span>
                <PokemonCard
                  :name="s.fighter.card.name"
                  :types="s.fighter.card.types"
                  :image="s.fighter.card.image"
                  :hp="s.fighter.maxHp"
                  :current-hp="s.fighter.hp"
                  hp-label="KP"
                >
                  <ul v-if="s.fighter.moves.length" class="attacks">
                    <li
                      v-for="m in s.fighter.moves"
                      :key="m.id"
                      :class="{ spent: m.ppLeft <= 0 }"
                      :style="{ '--c': getTypeColor(m.type) }"
                    >
                      <span class="atk-orb" aria-hidden="true">{{ typeIcon(m.type) }}</span>
                      <span class="atk-name">{{ formatName(m.name) }}</span>
                      <b class="atk-power">{{ m.power ?? '–' }}</b>
                    </li>
                  </ul>
                </PokemonCard>
              </div>
              <span v-if="i === 0" class="vs" aria-hidden="true">VS</span>
            </template>
          </div>

          <div v-if="phase === 'choose' || phase === 'resolving'" class="moves">
            <h3>Wähle eine Attacke</h3>
            <div class="move-grid">
              <button
                v-for="m in activeP.moves"
                :key="m.id"
                class="move-btn"
                :style="{ '--c': getTypeColor(m.type) }"
                :disabled="phase !== 'choose' || m.ppLeft <= 0"
                @click="playTurn(m)"
              >
                <span class="move-orb" aria-hidden="true">{{ typeIcon(m.type) }}</span>
                <span class="move-body">
                  <strong>{{ formatName(m.name) }}</strong>
                  <small>{{ m.type }} · {{ m.damageClass === 'physical' ? 'physisch' : 'spezial' }}</small>
                  <small>Genauigkeit {{ m.accuracy ?? '–' }} · AP {{ m.ppLeft }}/{{ m.pp }}</small>
                </span>
                <span class="move-power">
                  <small>Stärke</small>
                  <b>{{ m.power }}</b>
                </span>
              </button>
              <button v-if="noPpLeft" class="move-btn" :disabled="phase !== 'choose'" @click="playTurn(null)">
                <span class="move-orb" aria-hidden="true">💥</span>
                <span class="move-body">
                  <strong>Verzweifler</strong>
                  <small>Alle AP aufgebraucht – Rückstoß</small>
                </span>
              </button>
            </div>
          </div>
        </div>

        <aside class="side">
          <div class="scoreline">
            <template v-if="mode === 'duel'">
              <span class="score-head">Duell {{ Math.min(duelResults.length + 1, playerTeam.length) }} / {{ playerTeam.length }}</span>
              <span class="score-main">
                <span class="who">Du</span>
                <b>{{ playerWins }}</b><i>:</i><b>{{ botWins }}</b>
                <span class="who">Bot</span>
              </span>
            </template>
            <template v-else>
              <span class="score-head">Übrig</span>
              <span class="score-main">
                <span class="who">Du</span>
                <b>{{ playerTeam.length - pIdx }}</b><i>:</i><b>{{ botTeam.length - bIdx }}</b>
                <span class="who">Bot</span>
              </span>
            </template>
          </div>

          <div ref="logEl" class="log">
            <p v-for="(line, i) in log" :key="i" :class="{ latest: i === log.length - 1 }">{{ line }}</p>
          </div>
        </aside>
      </div>
    </div>

    <!-- Before the first battle: a fan of face-down cards -->
    <div v-else class="lobby">
      <div :class="['fan', { shuffling: phase === 'loading' }]" aria-hidden="true">
        <span class="card-back" style="--r: -15deg; --x: -42px; --d: 0s"></span>
        <span class="card-back" style="--r: 0deg; --x: 0px; --d: 0.15s"></span>
        <span class="card-back" style="--r: 15deg; --x: 42px; --d: 0.3s"></span>
      </div>
      <p>Wähle einen Modus und drücke „Battle!“, um fünf Karten zu ziehen.</p>
    </div>
  </div>
</template>

<style scoped>
.game-tab {
  width: 100%;
  padding: 28px clamp(12px, 3vw, 32px) 64px;
  color: var(--text);
  font-family: var(--font-ui);
}

/* ---------- Header / setup ---------- */
.game-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 28px;
}
.game-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 700;
  line-height: 1.1;
}
.setup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 20px;
}

.modes {
  display: inline-flex;
  padding: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
}
.mode {
  position: relative;
  cursor: pointer;
}
.mode input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.mode span {
  display: block;
  padding: 9px 20px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 999px;
  transition: background 0.15s, color 0.15s;
}
.mode input:checked + span {
  color: var(--ink);
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.mode input:focus-visible + span {
  outline: 3px solid var(--yellow);
  outline-offset: 2px;
}
.mode input:disabled + span {
  opacity: 0.55;
}
.mode input:disabled {
  cursor: not-allowed;
}

.fight-btn {
  padding: 14px 44px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
  background: linear-gradient(180deg, var(--yellow), var(--yellow-deep));
  border: 0;
  border-radius: 16px;
  box-shadow: 0 5px 0 #b97a00, 0 12px 26px rgba(255, 170, 0, 0.3);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}
.fight-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.fight-btn:active:not(:disabled) {
  transform: translateY(4px);
  box-shadow: 0 1px 0 #b97a00, 0 4px 12px rgba(255, 170, 0, 0.25);
}
.fight-btn:disabled {
  opacity: 0.7;
}
.fight-btn:focus-visible {
  outline: 3px solid #ffffff;
  outline-offset: 3px;
}
.fighting {
  cursor: wait;
}

.error {
  margin: 18px 0 0;
  padding: 12px 16px;
  color: #ffd3cd;
  background: rgba(217, 71, 58, 0.2);
  border: 1px solid rgba(255, 120, 110, 0.5);
  border-radius: 12px;
}

/* ---------- Lobby (idle / loading) ---------- */
.lobby {
  display: grid;
  justify-items: center;
  gap: 60px;
  padding: 56px 0 16px;
  text-align: center;
}
.lobby p {
  max-width: 38ch;
  margin: 0;
  font-size: 18px;
  color: var(--muted);
}
.fan {
  position: relative;
  width: 300px;
  height: 240px;
}
.card-back {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 150px;
  aspect-ratio: 63 / 88;
  margin-left: -75px;
  border: 5px solid #f4e9c1;
  border-radius: 12px;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.22), transparent 55%),
    linear-gradient(160deg, #3a56d4, #1a2370);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 3px rgba(0, 0, 0, 0.3);
  transform-origin: 50% 120%;
  transform: translateX(var(--x)) rotate(var(--r));
}
.card-back::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 62%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border: 4px solid #14142b;
  border-radius: 50%;
  background:
    radial-gradient(circle, #ffffff 0 13%, #14142b 14% 22%, transparent 23%),
    linear-gradient(#ee3b3b 0 47%, #14142b 47% 53%, #ffffff 53%);
}
@media (prefers-reduced-motion: no-preference) {
  .shuffling .card-back {
    animation: shuffle 0.7s ease-in-out infinite alternate;
    animation-delay: var(--d);
  }
}
@keyframes shuffle {
  from { transform: translateX(var(--x)) rotate(var(--r)); }
  to   { transform: translateX(calc(var(--x) * -1)) rotate(calc(var(--r) * -1)); }
}

/* ---------- Battle layout ---------- */
.battle-results {
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin-top: 26px;
}

.battle {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 26px;
  min-width: 0;
}
/* Bot bench, arena, your bench, your moves */
.bench--bot { order: 1; }
.arena { order: 2; }
.bench--player { order: 3; }
.moves { order: 4; }

@media (min-width: 1100px) {
  .battle {
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
  }
  .side {
    position: sticky;
    top: 16px;
  }
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

/* ---------- Arena ---------- */
.arena {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 18px clamp(14px, 3vw, 44px);
  padding: 8px 0;
}
.seat {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: clamp(230px, 26vw, 320px);
}
.seat-label {
  align-self: center;
  padding: 4px 18px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
}
.seat--player .seat-label {
  color: var(--ink);
  background: var(--yellow);
  border-color: transparent;
}
.vs {
  font-family: var(--font-display);
  font-size: clamp(30px, 4vw, 46px);
  font-weight: 700;
  color: var(--yellow);
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.35), 0 0 24px rgba(255, 203, 5, 0.5);
}

@media (max-width: 760px) {
  .seat { width: min(320px, 100%); }
  .vs { flex-basis: 100%; text-align: center; line-height: 1; }
}

/* attack list printed on the arena cards (sized in cqw, like the card itself) */
.attacks {
  display: flex;
  flex-direction: column;
  gap: 1.4cqw;
  margin: 0;
  padding: 0 0 2.4cqw;
  list-style: none;
  border-bottom: 0.3cqw solid rgba(29, 26, 47, 0.2);
}
.attacks li {
  display: flex;
  align-items: center;
  gap: 2cqw;
  font-size: 3.8cqw;
  font-weight: 700;
}
.attacks li.spent {
  opacity: 0.45;
}
.atk-orb {
  flex: none;
  display: grid;
  place-items: center;
  width: 6.4cqw;
  height: 6.4cqw;
  font-size: 3.4cqw;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 30%,
    color-mix(in srgb, var(--c) 50%, #ffffff),
    var(--c) 58%,
    color-mix(in srgb, var(--c) 68%, #000000)
  );
  box-shadow: 0 0 0 0.4cqw #ffffff, 0 0.5cqw 1cqw rgba(0, 0, 0, 0.3);
}
.atk-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.atk-power {
  font-family: var(--font-display);
  font-size: 4.4cqw;
  font-weight: 600;
}

/* ---------- Moves (attack strips) ---------- */
.move-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.move-btn {
  --c: #7a7c90;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px 10px 10px;
  font: inherit;
  color: var(--ink);
  text-align: left;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--c) 50%, #ffffff),
    color-mix(in srgb, var(--c) 20%, #ffffff)
  );
  border: 3px solid color-mix(in srgb, var(--c) 85%, #000000);
  border-radius: 14px;
  box-shadow: 0 4px 0 color-mix(in srgb, var(--c) 60%, #000000), 0 10px 20px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s, filter 0.15s;
}
.move-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.06);
}
.move-btn:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--c) 60%, #000000), 0 4px 10px rgba(0, 0, 0, 0.3);
}
.move-btn:focus-visible {
  outline: 3px solid #ffffff;
  outline-offset: 3px;
}
.move-btn:disabled {
  opacity: 0.45;
  filter: saturate(0.5);
  cursor: not-allowed;
}
.move-orb {
  flex: none;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  font-size: 22px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 30%,
    color-mix(in srgb, var(--c) 50%, #ffffff),
    var(--c) 58%,
    color-mix(in srgb, var(--c) 68%, #000000)
  );
  box-shadow: 0 0 0 3px #ffffff, 0 3px 6px rgba(0, 0, 0, 0.35);
}
.move-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.move-body strong {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}
.move-body small {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.8;
}
.move-power {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1;
}
.move-power small {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.75;
}
.move-power b {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
}

/* ---------- Side column ---------- */
.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.scoreline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
}
.score-head {
  font-size: 15px;
  font-weight: 600;
  color: var(--muted);
}
.score-main {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: var(--font-display);
}
.score-main b {
  min-width: 1ch;
  font-size: 44px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.score-main i {
  font-size: 30px;
  font-style: normal;
  color: var(--yellow);
}
.score-main .who {
  font-size: 18px;
  font-weight: 600;
}

.log {
  max-height: 340px;
  overflow-y: auto;
  padding: 12px 14px;
  font-size: 15px;
  line-height: 1.35;
  background: rgba(8, 4, 40, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
}
.log p {
  margin: 0;
  padding: 4px 0;
  color: var(--muted);
}
.log p + p {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.log p.latest {
  color: #ffffff;
  font-weight: 600;
}

/* ---------- Winner ---------- */
.winner-banner {
  padding: 18px;
  text-align: center;
  border-radius: 18px;
  font-family: var(--font-display);
  font-size: clamp(24px, 4vw, 34px);
  animation: pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.winner-banner--player {
  color: var(--ink);
  background: linear-gradient(100deg, #ffe45c, var(--yellow-deep));
  box-shadow: 0 6px 0 #b97a00, 0 16px 40px rgba(255, 170, 0, 0.35);
}
.winner-banner--bot {
  color: #ffffff;
  background: linear-gradient(100deg, #ff3d8b, #6a2bd9);
  box-shadow: 0 6px 0 #3d1580, 0 16px 40px rgba(177, 59, 255, 0.35);
}
@keyframes pop {
  from { transform: scale(0.9); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .winner-banner { animation: none; }
  .mini { transition: none; }
}
</style>
