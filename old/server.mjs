import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.DB_PORT) || 5432,
});

// --- Helpers ---

// Pick the best image out of the pokemonsprites.sprites jsonb.
// Assumes the PokeAPI layout (other.official-artwork.front_default, front_default, ...)
// and falls back to "first image URL found anywhere in the object" so a slightly
// different layout still produces something.
function firstUrl(value) {
  if (typeof value === 'string') return /^https?:\/\//.test(value) ? value : null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = firstUrl(v);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      const found = firstUrl(v);
      if (found) return found;
    }
  }
  return null;
}

function pickImage(sprites) {
  if (!sprites) return null;
  return (
    sprites.other?.['official-artwork']?.front_default ??
    sprites.other?.home?.front_default ??
    sprites.front_default ??
    firstUrl(sprites)
  );
}

function pickCry(cries) {
  if (!cries) return null;
  return cries.latest ?? cries.legacy ?? firstUrl(cries);
}

// --- Endpoints ---

// All pokemon (raw rows)
app.get('/pokemon', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pokemon ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Full detail for ONE pokemon (types, stats, abilities, image, cry, species info).
// Declared with an extra path segment so it never collides with /pokemon/:value.
app.get('/pokemon/:id/details', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'id must be a number' });
  }

  try {
    const result = await pool.query(
      `SELECT
         p.id, p.name, p.height, p.weight, p.base_experience,
         p.pokemon_species_id,
         ps.is_legendary, ps.is_mythical, ps.is_baby,
         ps.capture_rate, ps.base_happiness,
         pc.name  AS color,
         psh.name AS shape,
         COALESCE((
           SELECT json_agg(json_build_object('slot', pt.slot, 'name', t.name) ORDER BY pt.slot)
           FROM pokemontype pt JOIN type t ON t.id = pt.type_id
           WHERE pt.pokemon_id = p.id
         ), '[]'::json) AS types,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'name', s.name, 'base_stat', st.base_stat, 'effort', st.effort
                  ) ORDER BY s.game_index)
           FROM pokemonstat st JOIN stat s ON s.id = st.stat_id
           WHERE st.pokemon_id = p.id
         ), '[]'::json) AS stats,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'name', a.name, 'is_hidden', pa.is_hidden, 'slot', pa.slot
                  ) ORDER BY pa.slot)
           FROM pokemonability pa JOIN ability a ON a.id = pa.ability_id
           WHERE pa.pokemon_id = p.id
         ), '[]'::json) AS abilities,
         (SELECT s.sprites FROM pokemonsprites s WHERE s.pokemon_id = p.id LIMIT 1) AS sprites,
         (SELECT c.cries   FROM pokemoncries  c WHERE c.pokemon_id = p.id LIMIT 1) AS cries
       FROM pokemon p
       LEFT JOIN pokemonspecies ps  ON ps.id  = p.pokemon_species_id
       LEFT JOIN pokemoncolor   pc  ON pc.id  = ps.pokemon_color_id
       LEFT JOIN pokemonshape   psh ON psh.id = ps.pokemon_shape_id
       WHERE p.id = $1`,
      [parseInt(req.params.id, 10)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pokemon not found' });
    }

    const { sprites, cries, ...row } = result.rows[0];
    res.json({ ...row, image: pickImage(sprites), cry: pickCry(cries) });
  } catch (err) {
    console.error('❌ Detail error:', err.message);
    res.status(500).json({ error: 'Detail lookup failed' });
  }
});

// Search: numeric -> exact id, otherwise partial name match.
// Returns a lightweight list: [{ id, name, thumbnail }]
app.get('/pokemon/:value', async (req, res) => {
  const query = req.params.value;

  // Parse & sanitize query parameters
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  let sortField = req.query.sort || 'id';

  // Whitelist allowed sort columns to prevent SQL injection
  // (the old list had 'value', which isn't a column and would have thrown a 500)
  const allowedSortFields = ['id', 'name'];
  if (!allowedSortFields.includes(sortField)) {
    sortField = 'id';
  }

  try {
    // Explicit columns: the old `SELECT p.*, ps.*` made pokemon and species
    // columns (id, name, "order") overwrite each other in the JSON result.
    const baseQuery = `
      SELECT p.id, p.name,
        (SELECT s.sprites->>'front_default'
           FROM pokemonsprites s WHERE s.pokemon_id = p.id LIMIT 1) AS thumbnail
      FROM pokemon p
      WHERE p.is_default = true`;

    let result;
    if (/^\d+$/.test(query)) {
      result = await pool.query(
        `${baseQuery} AND p.id = $1 ORDER BY p.${sortField} ASC LIMIT $2 OFFSET $3`,
        [parseInt(query, 10), limit, offset]
      );
    } else {
      // Escape LIKE wildcards so "%" or "_" typed by a user are treated literally
      const escaped = query.replace(/[\\%_]/g, '\\$&');
      result = await pool.query(
        `${baseQuery} AND p.name ILIKE $1 ORDER BY p.${sortField} ASC LIMIT $2 OFFSET $3`,
        [`%${escaped}%`, limit, offset]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
pool.query('SELECT 1').then(() => { // Test connection first
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => {
  console.error('smh smh smh could not connect to PostgreSQL:', err.message);
});
