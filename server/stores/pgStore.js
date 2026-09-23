// Postgres storage (used when DATABASE_URL is set, e.g. a Neon database).
// One row per (user, known word) — a normalized table instead of stuffing
// a JSON list into one column, so the database can enforce no duplicates.
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Neon suspends idle databases and drops their connections. Without this
// listener, an error on an idle pooled connection would crash the server.
pool.on('error', err => {
  console.error('Idle database connection error:', err.message);
});

export async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS known_words (
      user_id    uuid        NOT NULL,
      word_key   text        NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, word_key)
    )
  `);
}

export async function readKnown(userId) {
  // $1 is a query parameter: pg sends the value separately from the SQL,
  // so user input can never be run as SQL (no SQL injection).
  const { rows } = await pool.query(
    'SELECT word_key FROM known_words WHERE user_id = $1 ORDER BY created_at',
    [userId],
  );
  return rows.map(row => row.word_key);
}

export async function writeKnown(userId, known) {
  // A transaction makes the delete + insert all-or-nothing: if anything
  // fails halfway, ROLLBACK undoes it and the old progress stays intact.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM known_words WHERE user_id = $1 AND NOT (word_key = ANY($2::text[]))',
      [userId, known],
    );
    await client.query(
      `INSERT INTO known_words (user_id, word_key)
       SELECT $1, unnest($2::text[])
       ON CONFLICT DO NOTHING`,
      [userId, known],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always hand the connection back to the pool
  }
}
