export interface PokemonStats {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

export interface PokemonTypeEffectiveness {
  [type: string]: { doubleDamageFrom: string[]; halfDamageFrom: string[] }
}

export interface PokemonCard {
  id: number
  apiId: number
  name: string
  types: string[]
  stats: PokemonStats
  image: string
  battleScore: number
}

export interface BattleResult {
  playerCards: PokemonCard[]
  botCards: PokemonCard[]
  comparisons: ComparisonResult[]
  winner: 'player' | 'bot'
}

export interface ComparisonResult {
  playerIndex: number
  botIndex: number
  playerScore: number
  botScore: number
  playerWinner: boolean
  typeAdvantage: string | null
}
