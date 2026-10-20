// pokemonBattle.ts – Kampflogik + API-Adapter (kein Vue-Code)

export const API_URL = 'http://localhost:3000'
export const POOL_MAX = 1025 // höchste Pokemon-ID, die zufällig gezogen wird (ggf. anpassen)
export const TEAM_SIZE = 5
export const LEVEL = 50

export type DamageClass = 'physical' | 'special' | 'status'

export interface Stats {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

export interface PokemonCardData {
  id: number
  name: string
  types: string[]
  image: string
  stats: Stats
}

export interface Move {
  id: number
  name: string
  power: number | null
  accuracy: number | null // null = trifft immer
  pp: number
  priority: number
  type: string
  damageClass: DamageClass
  isStruggle?: boolean
}

export interface BattleMove extends Move {
  ppLeft: number
}

export interface Fighter {
  card: PokemonCardData
  moves: BattleMove[]
  maxHp: number
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

export interface AttackResult {
  missed: boolean
  damage: number
  crit: boolean
  effectiveness: number
  stab: boolean
}

/* ------------------------------------------------------------------ */
/* Typen                                                               */
/* ------------------------------------------------------------------ */

export const TYPE_COLORS: Record<string, string> = {
  normal: '#a1a87a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c',
  grass: '#7ac74c', ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1',
  ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746',
  steel: '#b7b7ce', fairy: '#d685ad'
}

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type?.toLowerCase()] ?? '#7a7c90'
}

// Angreifer -> Verteidiger -> Multiplikator
const CHART: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fighting: { normal: 2, flying: 0.5, poison: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, ice: 2, steel: 2, fairy: 0.5 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
}

export function typeMultiplier(moveType: string, defenderTypes: string[]): number {
  const row = CHART[moveType?.toLowerCase()]
  if (!row) return 1
  return defenderTypes.reduce((m, t) => m * (row[t.toLowerCase()] ?? 1), 1)

}

// Fallback, solange die API keine damage class liefert (Gen-1-Regel: Typ bestimmt die Klasse)
const PHYSICAL_TYPES = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'])

/* ------------------------------------------------------------------ */
/* API-Adapter – hier anpassen, falls dein Backend anders antwortet    */
/* ------------------------------------------------------------------ */

async function getJson(path: string): Promise<any> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return res.json()
}

function pickName(v: any): string | undefined {
  if (!v) return undefined
  if (typeof v === 'string') return v
  return v.name ?? v.type?.name ?? v.type ?? undefined
}

function camel(key: string): string {
  return key.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase())
}

function normalizeStats(raw: any): Stats {
  const out: Stats = { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 }
  const set = (k: string, v: any) => {
    const key = camel(k) as keyof Stats
    if (key in out && Number.isFinite(Number(v))) out[key] = Number(v)
  }
  if (Array.isArray(raw)) {
    raw.forEach((s) => set(s.stat?.name ?? s.name, s.base_stat ?? s.baseStat ?? s.value))
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([k, v]) => set(k, v))
  }
  return out
}

function unwrapList(raw: any): any[] {
  if (Array.isArray(raw)) return raw
  return raw?.moves ?? raw?.data ?? raw?.results ?? []
}

function normalizePokemon(raw: any): PokemonCardData {
  const id = Number(raw.id)
  return {
    id,
    name: raw.name,
    types: (raw.types ?? []).map(pickName).filter(Boolean) as string[],
    image:
      raw.image ??
      raw.sprite ??
      raw.sprites?.other?.['official-artwork']?.front_default ??
      raw.sprites?.front_default ??
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
    stats: normalizeStats(raw.stats)
  }
}

function normalizeMove(raw: any, ownTypes: string[]): Move {
  const type = (pickName(raw.type) ?? ownTypes[0] ?? 'normal').toLowerCase() // Fallback: Typ des Pokemon
  const dc = (pickName(raw.damageClass ?? raw.damage_class ?? raw.damageClassName) ?? '').toLowerCase()
  const damageClass: DamageClass =
    dc === 'physical' || dc === 'special' || dc === 'status'
      ? dc
      : raw.power
        ? PHYSICAL_TYPES.has(type) ? 'physical' : 'special'
        : 'status'
  return {
    id: Number(raw.id ?? raw.moveId ?? raw.move_id),
    name: raw.move_name,
    power: raw.power ?? null,
    accuracy: raw.accuracy ?? null,
    pp: raw.pp ?? 10,
    priority: raw.priority ?? 0,
    type: raw.type_name ?? "unknown",
    damageClass: raw.damage_class_name ?? null
  }
}

const TACKLE: Move = { id: -1, name: 'tackle', power: 40, accuracy: 100, pp: 35, priority: 0, type: 'normal', damageClass: 'physical' }
export const STRUGGLE: BattleMove = {
  id: 0, name: 'struggle', power: 50, accuracy: null, pp: 1, ppLeft: 1,
  priority: 0, type: '???', damageClass: 'physical', isStruggle: true
}

/* ------------------------------------------------------------------ */
/* Pokemon + Moves laden und Fighter bauen                             */
/* ------------------------------------------------------------------ */

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)

function pickFourMoves(all: Move[], ownTypes: string[]): Move[] {
  const damaging = all.filter((m) => (m.power ?? 0) > 0 && m.damageClass !== 'status')
  if (!damaging.length) return [TACKLE]
  const pool = shuffle(damaging)
  // bis zu 2 STAB-Moves bevorzugen, damit das Moveset nicht komplett nutzlos ist
  const stab = pool.filter((m) => ownTypes.includes(m.type)).slice(0, 2)
  const rest = pool.filter((m) => !stab.includes(m))
  return [...stab, ...rest].slice(0, 4)
}

export function buildFighter(card: PokemonCardData, moves: Move[]): Fighter {
  const s = card.stats
  const other = (base: number) => Math.floor((2 * base * LEVEL) / 100) + 5
  const maxHp = Math.floor((2 * s.hp * LEVEL) / 100) + LEVEL + 10
  return {
    card,
    moves: moves.map((m) => ({ ...m, ppLeft: m.pp })),
    maxHp,
    hp: maxHp,
    atk: other(s.attack),
    def: other(s.defense),
    spa: other(s.specialAttack),
    spd: other(s.specialDefense),
    spe: other(s.speed)
  }
}

async function loadFighter(id: number): Promise<Fighter> {
  const [rawPokemon, rawMoves] = await Promise.all([
    getJson(`/pokemon/${id}/details`),
    getJson(`/pokemon/${id}/moves`)
  ])
  const card = normalizePokemon(rawPokemon)
  const moves = unwrapList(rawMoves).map((m) => normalizeMove(m, card.types))
  return buildFighter(card, pickFourMoves(moves, card.types))
}

/** Lädt `count` verschiedene zufällige Pokemon parallel (mit Retry bei fehlenden IDs). */
export async function drawFighters(count: number): Promise<Fighter[]> {
  const used = new Set<number>()
  const result: Fighter[] = []
  for (let round = 0; round < 4 && result.length < count; round++) {
    const ids: number[] = []
    while (ids.length < count - result.length) {
      const id = randInt(1, POOL_MAX)
      if (!used.has(id)) { used.add(id); ids.push(id) }
    }
    const settled = await Promise.allSettled(ids.map(loadFighter))
    settled.forEach((r) => { if (r.status === 'fulfilled') result.push(r.value) })
  }
  if (result.length < count) throw new Error('Nicht genug Pokemon vom Backend erhalten')
  return result
}

/* ------------------------------------------------------------------ */
/* Kampfberechnung                                                     */
/* ------------------------------------------------------------------ */

function baseDamage(att: Fighter, def: Fighter, move: Move): number {
  const physical = move.damageClass === 'physical'
  const A = physical ? att.atk : att.spa
  const D = physical ? def.def : def.spd
  return Math.floor((((2 * LEVEL) / 5 + 2) * (move.power ?? 0) * A) / D / 50) + 2
}

const hasStab = (att: Fighter, move: Move) => att.card.types.includes(move.type)

/** Führt einen Angriff aus (Genauigkeit, Crit, STAB, Typ-Effektivität, Zufallsfaktor). */
export function resolveAttack(att: Fighter, def: Fighter, move: Move): AttackResult {
  const effectiveness = typeMultiplier(move.type, def.card.types)
  const stab = hasStab(att, move)
  if (move.accuracy !== null && Math.random() * 100 >= move.accuracy) {
    return { missed: true, damage: 0, crit: false, effectiveness, stab }
  }
  if (effectiveness === 0) return { missed: false, damage: 0, crit: false, effectiveness, stab }
  const crit = Math.random() < 1 / 16
  const rand = 0.85 + Math.random() * 0.15
  const dmg = baseDamage(att, def, move) * (stab ? 1.5 : 1) * effectiveness * (crit ? 1.5 : 1) * rand
  return { missed: false, damage: Math.max(1, Math.floor(dmg)), crit, effectiveness, stab }
}


/** Bot-KI: erwarteter Schaden (inkl. Trefferchance, STAB, Typ); bevorzugt KO-Moves; 50 % Zufall. */
export function chooseBotMove(bot: Fighter, target: Fighter): BattleMove {
  const usable = bot.moves.filter((m) => m.ppLeft > 0)
  if (!usable.length) return STRUGGLE
  if (Math.random() < 0.50) return usable[randInt(0, usable.length - 1)]
  const score = (m: BattleMove) => {
    const eff = typeMultiplier(m.type, target.card.types)
    const dmg = baseDamage(bot, target, m) * (hasStab(bot, m) ? 1.5 : 1) * eff
    const acc = (m.accuracy ?? 100) / 100
    const ko = dmg >= target.hp ? 2 : 1
    return dmg * acc * ko + m.priority * 0.01
  }
  return usable.reduce((best, m) => (score(m) > score(best) ? m : best))
}

/** Reihenfolge: Priorität, dann Initiative, bei Gleichstand Zufall. */
export function actsFirst(a: { f: Fighter; move: Move }, b: { f: Fighter; move: Move }): boolean {
  if (a.move.priority !== b.move.priority) return a.move.priority > b.move.priority
  if (a.f.spe !== b.f.spe) return a.f.spe > b.f.spe
  return Math.random() < 0.5
}

export function formatName(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

