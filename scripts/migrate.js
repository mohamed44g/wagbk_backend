const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

// Simple .env parser to load DB credentials if environment variables aren't set
try {
  const envContent = require('node:fs').readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
} catch (e) {
  // .env file optional
}

async function main() {
  const migrationsDirectory = path.join(__dirname, '..', 'database', 'migrations');
  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = new Client({
    host: process.env.HOMEWORK_DB_HOST || 'localhost',
    port: Number(process.env.HOMEWORK_DB_PORT || 5432),
    user: process.env.HOMEWORK_DB_USER || 'postgres',
    password: process.env.HOMEWORK_DB_PASSWORD,
    database: process.env.HOMEWORK_DB_NAME || 'homework_management',
  });

  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  for (const file of files) {
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [file]);
    if (applied.rowCount > 0) continue;

    const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  await client.end();
  console.log('Migrations complete.');
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});
