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
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100); // Default 50, max 100
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);           // Default 0
  let sortField = req.query.sort || 'id';                              // Default sort by ID

  // 🔍 Whitelist allowed sort columns to prevent SQL injection
  const allowedSortFields = ['id', 'name', 'value'];
  if (!allowedSortFields.includes(sortField)) {
    sortField = 'id'; // Fallback to safe default
  }

  try {
    let result;

    // 🐍 If purely numeric → exact ID lookup
    if (/^\d+$/.test(query)) {
      result = await pool.query(
        `SELECT * FROM pokemon WHERE id = $1 ORDER BY ${sortField} ASC LIMIT $2 OFFSET $3`,
        [parseInt(query), limit, offset]
      );
    } 
    // 🔍 Otherwise → case-insensitive name search (partial match)
    else {
      result = await pool.query(
        `SELECT * FROM pokemon WHERE name ILIKE $1 ORDER BY ${sortField} ASC LIMIT $2 OFFSET $3`,
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

app.post('/pokemon', async (req, res) => {
  const { name, value } = req.body;
  if (!name || typeof value === 'undefined') {
    return res.status(400).json({ error: 'Missing "name" or "value"' });
  }

  try {
    // $1 syntax is native to node-postgres for parameterized queries
    const result = await pool.query(
      'INSERT INTO pokemon (name, value) VALUES ($1, $2) RETURNING *',
      [String(name), parseFloat(value)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create pokemon' });
  }
});

app.delete('/pokemon/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await pool.query(
      'DELETE FROM pokemon WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0] || { status: 'deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
pool.query('SELECT 1').then(() => { // Test connection first
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => {
  console.error('smh smh smh could not connect to PostgreSQL:', err.message);
});
