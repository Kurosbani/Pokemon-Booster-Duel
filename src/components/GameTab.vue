<script setup lang="ts">
import { ref } from 'vue'

interface PokemonCardData {
  id: number
  name: string
  types: string[]
  image: string
  stats: Record<string, number>
}

interface ComparisonResult {
  playerIndex: number
  botIndex: number
  playerScore: number
  botScore: number
  playerWinner?: boolean
  botWinner?: boolean
  typeAdvantage?: boolean
}

const battle = ref<{
  playerCards: PokemonCardData[]
  botCards: PokemonCardData[]
  comparisons: ComparisonResult[]
  winner: 'player' | 'bot' | null
} | null>(null)

const isFighting = ref(false)

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    red: '#e34f3d', orange: '#ea7a32', yellow: '#ececb4',
    green: '#5c9036', blue: '#483dca', purple: '#7b0f9d',
    pink: '#bdafb3', cyan: '#a5eacc', white: '#ddd9c8', gray: '#7a7c90'
  }
  return colors[type.toLowerCase()] || '#7a7c90'
}

function calculateScore(pokemon: PokemonCardData): number {
  const s = pokemon.stats
  if (!s) return 0
  return (s.hp || 0) * 1.5 + (s.attack || 0) * 2 + (s.defense || 0) * 1.5 +
         (s.speed || 0) * 2 + (s.specialAttack || 0) * 1.8 + (s.specialDefense || 0) * 1.3
}

async function startBattle(): Promise<void> {
  isFighting.value = true
  
  try {
    const response = await fetch('http://localhost:5432/api/battle', { method: 'POST' })
    
    if (response.ok) {
      const data = await response.json()
      
      battle.value = {
        playerCards: data.playerCards || [],
        botCards: data.botCards || [],
        comparisons: data.comparisons || [],
        winner: data.winner || null
      }
    }
  } catch (error) {
    console.error('Battle failed:', error)
  }
  
  isFighting.value = false
}

function getComparisonScore(index: number): ComparisonResult | undefined {
  return battle.value?.comparisons[index]
}

function isCardWinner(index: number): boolean {
  const comp = battle.value?.comparisons[index]
  return comp ? !!comp.playerWinner : false
}

function isBotCardWinner(index: number): boolean {
  const comp = battle.value?.comparisons[index]
  return comp ? !!comp.botWinner : false
}
</script>

<template>
  <div class="game-tab">
    <h2>Battle Arena</h2>
    
    <button :class="['fight-btn', { fighting: isFighting }]" @click="startBattle" :disabled="isFighting">
      {{ isFighting ? '⏳ Fighting...' : '⚔ Fight!' }}
    </button>
    
    <div v-if="battle" class="battle-results">
      <section class="cards-section player-section">
        <h3>Your Cards (Player)</h3>
        <div class="cards-container">
          <div
            v-for="(card, idx) in battle.playerCards"
            :key="'player-' + idx"
            :class="['pokemon-card', `type-${card.types[0]?.toLowerCase() || 'gray'}`, { winner: isCardWinner(idx) }]"
          >
            <img :src="card.image" :alt="card.name" />
            
            <div class="card-info">
              <strong>{{ card.name }}</strong>
              
              <div class="types">
                <span v-for="(type, tIdx) in card.types" :key="tIdx" class="type-badge" :style="{ backgroundColor: getTypeColor(type) }">
                  {{ type }}
                </span>
              </div>
              
              <div class="score-display">
                Score: {{ getComparisonScore(idx)?.playerScore || 0 }} / 100
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section class="cards-section bot-section">
        <h3>Bot Cards</h3>
        <div class="cards-container">
          <div
            v-for="(card, idx) in battle.botCards"
            :key="'bot-' + idx"
            :class="['pokemon-card', `type-${card.types[0]?.toLowerCase() || 'gray'}`, { winner: isBotCardWinner(idx) }]"
          >
            <img :src="card.image" :alt="card.name" />
            
            <div class="card-info">
              <strong>{{ card.name }}</strong>
              
              <div class="types">
                <span v-for="(type, tIdx) in card.types" :key="tIdx" class="type-badge" :style="{ backgroundColor: getTypeColor(type) }">
                  {{ type }}
                </span>
              </div>
              
              <div class="score-display">
                Score: {{ getComparisonScore(idx)?.botScore || 0 }} / 100
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <div v-if="battle.winner" class="winner-banner">
        <strong>{{ battle.winner === 'player' ? '🎉 You win!' : '⚔ Bot wins!' }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-tab { padding: 20px; }
.fight-btn {
  padding: 16px 48px; font-size: 20px;
  background: linear-gradient(135deg, #e366ea 0%, #a24b8b 100%);
  color: #fff; border-radius: 8px;
}
.fight-btn:hover { background: #7a3f9c; }
.fighting { cursor: wait; }
.battle-results { display: flex; flex-direction: column; gap: 24px; margin-top: 24px; }
.cards-section h3 { font-size: 18px; }
.cards-container { display: flex; flex-wrap: wrap; gap: 16px; }
.pokemon-card { border-radius: 12px; margin-top: 16px; }
.card-info strong { font-size: 14px; }
.type-badge { padding: 2px 8px; color: #fff; font-size: 10px; }
.score-display { font-size: 12px; }
.winner-banner {
  padding: 16px;
  background: linear-gradient(135deg, #4e7eea 0%, #764ba2 100%);
  color: #fff; font-size: 20px;
}
</style>