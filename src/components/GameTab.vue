<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  TEAM_SIZE, STRUGGLE, drawFighters, resolveAttack, chooseBotMove, actsFirst,
  getTypeColor, formatName,
  type BattleMove, type Fighter
} from './pokemonBattle'

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
const hpPct = (f: Fighter) => Math.max(0, Math.round((f.hp / f.maxHp) * 100))
const hpColor = (f: Fighter) => (hpPct(f) > 50 ? '#4caf50' : hpPct(f) > 20 ? '#e8b92f' : '#d9473a')

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
    <h2>Battle Arena</h2>

    <div class="setup">
      <label><input v-model="mode" type="radio" value="duel" :disabled="phase === 'loading' || phase === 'resolving'" /> 5 Duelle (1:1)</label>
      <label><input v-model="mode" type="radio" value="team" :disabled="phase === 'loading' || phase === 'resolving'" /> 5v5 Team-Kampf</label>
      <button
        :class="['fight-btn', { fighting: phase === 'loading' }]"
        :disabled="phase === 'loading' || phase === 'resolving'"
        @click="startBattle"
      >
        {{ phase === 'loading' ? '⏳ Lade Kampf …' : phase === 'idle' ? 'Battle!' : 'Neues Spiel' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="phase !== 'idle' && phase !== 'loading'" class="battle-results">
      <div class="scoreline">
        <template v-if="mode === 'duel'">
          Duell {{ Math.min(duelResults.length + 1, playerTeam.length) }} / {{ playerTeam.length }}
          · Du {{ playerWins }} : {{ botWins }} Bot
        </template>
        <template v-else>
          Übrig: Du {{ playerTeam.length - pIdx }} · Bot {{ botTeam.length - bIdx }}
        </template>
      </div>

      <section v-for="team in [{ k: 'bot', label: 'Bot Cards', t: botTeam, i: bIdx }, { k: 'player', label: 'Your Cards', t: playerTeam, i: pIdx }]" :key="team.k" class="strip">
        <h3>{{ team.label }}</h3>
        <div class="strip-cards">
          <div
            v-for="(f, idx) in team.t"
            :key="team.k + idx"
            :class="['mini', { active: idx === team.i && phase !== 'finished', fainted: f.hp <= 0 }]"
            :title="nameOf(f)"
          >
            <img :src="f.card.image" :alt="f.card.name" />
            <span>{{ nameOf(f) }}</span>
          </div>
        </div>
      </section>

      <div v-if="activeP && activeB" class="arena">
        <div v-for="s in sides" :key="s.key" class="pokemon-card" :style="{ '--type-color': getTypeColor(s.fighter.card.types[0] ?? '') }">
          <img :src="s.fighter.card.image" :alt="s.fighter.card.name" />
          <div class="card-info">
            <strong>{{ nameOf(s.fighter) }}</strong>
            <span class="who">{{ s.label }}</span>
            <div class="types">
              <span v-for="t in s.fighter.card.types" :key="t" class="type-badge" :style="{ backgroundColor: getTypeColor(t) }">{{ t }}</span>
            </div>
            <div class="hp-bar"><div class="hp-fill" :style="{ width: hpPct(s.fighter) + '%', background: hpColor(s.fighter) }" /></div>
            <div class="score-display">{{ s.fighter.hp }} / {{ s.fighter.maxHp }} KP</div>
          </div>
        </div>
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
            <strong>{{ formatName(m.name) }}</strong>
            <small>{{ m.type }} · {{ m.damageClass === 'physical' ? 'physisch' : 'spezial' }}</small>
            <small>Stärke {{ m.power }} · Genauigkeit {{ m.accuracy ?? '–' }} · AP {{ m.ppLeft }}/{{ m.pp }}</small>
          </button>
          <button v-if="noPpLeft" class="move-btn" :disabled="phase !== 'choose'" @click="playTurn(null)">
            <strong>Verzweifler</strong>
            <small>Alle AP aufgebraucht – Rückstoß</small>
          </button>
        </div>
      </div>

      <div ref="logEl" class="log">
        <p v-for="(line, i) in log" :key="i">{{ line }}</p>
      </div>

      <div v-if="phase === 'finished'" class="winner-banner">
        <strong>{{ winner === 'player' ? 'Du hast Gewonnen!' : 'Bot hat Gewonnen!' }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-tab { padding: 20px; }
.setup { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.fight-btn {
  padding: 16px 48px; font-size: 20px;
  background: linear-gradient(135deg, #e366ea 0%, #a24b8b 100%);
  color: #fff; border-radius: 8px; border: 0; cursor: pointer;
}
.fight-btn:hover:not(:disabled) { background: #7a3f9c; }
.fight-btn:disabled { opacity: 0.7; }
.fighting { cursor: wait; }
.error { color: #d9473a; margin-top: 12px; }

.battle-results { display: flex; flex-direction: column; gap: 20px; margin-top: 24px; }
.scoreline { font-weight: 600; }
.strip h3, .moves h3 { font-size: 16px; margin: 0 0 8px; }
.strip-cards { display: flex; flex-wrap: wrap; gap: 8px; }
.mini { display: flex; flex-direction: column; align-items: center; width: 76px; font-size: 11px; padding: 4px; border-radius: 8px; border: 2px solid transparent; }
.mini img { width: 56px; height: 56px; object-fit: contain; }
.mini.active { border-color: #a24b8b; }
.mini.fainted { opacity: 0.35; filter: grayscale(1); }

.arena { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.pokemon-card {
  display: flex; gap: 12px; align-items: center; padding: 12px;
  border-radius: 12px; border: 3px solid var(--type-color);
  background: color-mix(in srgb, var(--type-color) 14%, transparent);
}
.pokemon-card img { width: 110px; height: 110px; object-fit: contain; }
.card-info { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.card-info strong { font-size: 16px; }
.who { font-size: 12px; opacity: 0.7; }
.types { display: flex; gap: 4px; }
.type-badge { padding: 2px 8px; color: #fff; font-size: 11px; border-radius: 10px; }
.hp-bar { height: 10px; background: rgba(128, 128, 128, 0.3); border-radius: 5px; overflow: hidden; }
.hp-fill { height: 100%; transition: width 0.4s ease, background 0.4s ease; }
.score-display { font-size: 12px; }

.move-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.move-btn {
  display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 10px 12px;
  border-radius: 8px; border: 2px solid var(--c, #7a7c90); background: transparent;
  color: inherit; cursor: pointer;
}
.move-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--c, #7a7c90) 22%, transparent); }
.move-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.move-btn small { font-size: 11px; opacity: 0.8; }

.log { max-height: 180px; overflow-y: auto; padding: 10px 12px; border-radius: 8px; background: rgba(128, 128, 128, 0.12); font-size: 13px; }
.log p { margin: 2px 0; }

.winner-banner {
  padding: 16px; text-align: center; border-radius: 8px;
  background: linear-gradient(135deg, #e366ea 0%, #a24b8b 100%);
  color: #fff; font-size: 20px;
}
</style>
