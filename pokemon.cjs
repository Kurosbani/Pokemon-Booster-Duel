require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: "localhost",
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

async function syncPokemonData() { 
  let client = await pool.connect();

  try {
    // 1. Übersicht abrufen (z. B. die ersten 20 oder alle)
    const listRes = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1500');
    const { results } = await listRes.json();

    // 2. Details parallel abfragen
    const pokemonDetails = await Promise.all(
      results.map(p => fetch(p.url).then(res => res.json()))
    );

    await client.query('BEGIN'); // Transaktion starten für maximale Performance

    for (const Pokemon of pokemonDetails) {
      // 3. Pokémon in 'pokemon' einfügen
      await client.query(`
        INSERT INTO public."Pokemon" (id, name, base_experience, height, is_default, "order", weight, abilities, forms, moves, sprites, cries, species, stats, types)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          base_experience = EXCLUDED.base_experience,
          height = EXCLUDED.height,
          is_default = EXCLUDED.is_default,
          "order" = EXCLUDED."order",
          weight = EXCLUDED.weight,
          abilities = EXCLUDED.abilities,
          forms = EXCLUDED.forms,
          moves = EXCLUDED.moves,
          sprites = EXCLUDED.sprites,
          cries = EXCLUDED.cries,
          species = EXCLUDED.species,
          stats = EXCLUDED.stats,
          types = EXCLUDED.types;
      `, [
        Pokemon.id, 
        Pokemon.name, 
        Pokemon.base_experience, 
        Pokemon.height, 
        Pokemon.is_default, 
        Pokemon.order, 
        Pokemon.weight, 
        JSON.stringify(Pokemon.abilities), 
        JSON.stringify(Pokemon.forms), 
        JSON.stringify(Pokemon.moves), 
        JSON.stringify(Pokemon.sprites), 
        JSON.stringify(Pokemon.cries), 
        JSON.stringify(Pokemon.species), 
        JSON.stringify(Pokemon.stats), 
        JSON.stringify(Pokemon.types)]);
    }

    await client.query('COMMIT'); // Transaktion abschließen
    console.log('Alle Pokemon erfolgreich gespeichert!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fehler beim Speichern:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

syncPokemonData();