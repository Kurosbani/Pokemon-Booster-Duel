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

// --- Endpoints ---

app.get('/pokemon', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pokemon ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/pokemon/:value', async (req, res) => {
  const query = req.params.value;

  // 🔍 Parse & sanitize query parameters
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  let sortField = req.query.sort || 'id';

  // 🔍 Whitelist allowed sort columns to prevent SQL injection
  const allowedSortFields = ['id', 'name', 'value'];
  if (!allowedSortFields.includes(sortField)) {
    sortField = 'id'; // Fallback to safe default
  }

  try {
    let result;

    // 🔄 Base query with LEFT JOIN to pokemonspecies table
    const baseQuery = `SELECT p.*, ps.* FROM pokemon p LEFT JOIN pokemonspecies ps ON p.pokemon_species_id = ps.id WHERE p.is_default = true`;

    if (/^\d+$/.test(query)) {
      // Exact ID lookup
      result = await pool.query(
        `${baseQuery} AND p.id = $1 ORDER BY p.${sortField} ASC LIMIT $2 OFFSET $3`,
        [parseInt(query), limit, offset]
      );
    } else {
      // Name search (partial match)
      result = await pool.query(
        `${baseQuery} AND p.name ILIKE $1 ORDER BY p.${sortField} ASC LIMIT $2 OFFSET $3`,
        [`%${query}%`, limit, offset]
      );
    }

    // Return array (empty if nothing matches)
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
