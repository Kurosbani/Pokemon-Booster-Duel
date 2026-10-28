// Shared colour + naming helpers for everything that looks like a Pokémon card.

export const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c',
  grass: '#7ac74c', ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1',
  ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746',
  steel: '#9ea7ba', fairy: '#d685ad',
}
export const FALLBACK_COLOR = '#7a7c90'

export const TYPE_ICONS: Record<string, string> = {
  normal: '✦', fire: '🔥', water: '💧', electric: '⚡', grass: '🍃', ice: '❄️',
  fighting: '👊', poison: '☠️', ground: '⛰️', flying: '🕊️', psychic: '🔮',
  bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉', dark: '🌙', steel: '⚙️',
  fairy: '✨',
}

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? FALLBACK_COLOR
}

export function typeIcon(type: string): string {
  return TYPE_ICONS[type.toLowerCase()] ?? '●'
}

/** Black or white text, depending on how light the background is. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1b2230' : '#ffffff'
}

/**
 * CSS variables that drive a card's colours.
 *  - two types  -> --c1 / --c2 are the two type colours (e.g. red fading into grey)
 *  - one type   -> --c2 is a deeper shade of --c1 so the card still has depth
 */
export function cardVars(types: string[]): Record<string, string> {
  const c1 = getTypeColor(types[0] ?? '')
  const c2 = types[1]
    ? getTypeColor(types[1])
    : `color-mix(in srgb, ${c1} 72%, #1b1030)`
  return { '--c1': c1, '--c2': c2 }
}

export function formatName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
