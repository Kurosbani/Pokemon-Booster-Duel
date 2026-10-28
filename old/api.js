async function getAllPokemon() {
  const initialRes = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1');
  const initialData = await initialRes.json();
  
  const fullRes = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${initialData.count}`);
  const fullData = await fullRes.json();

  return fullData.results;
}

// Hier das await vor den Aufruf setzen:
const allPokemon = await getAllPokemon();

// Alle URLs parallel abfragen:
const details = await Promise.all(
  allPokemon.map(async (pokemon) => {
    const res = await fetch(pokemon.url);
    return await res.json();
  })
);

console.log(details);