const { Client } = require('pg');

const databaseName = process.env.HOMEWORK_DB_NAME || 'homework_management';
const identifier = databaseName.replace(/"/g, '""');

async function main() {
  const client = new Client({
    host: process.env.HOMEWORK_DB_HOST || 'localhost',
    port: Number(process.env.HOMEWORK_DB_PORT || 5432),
    user: process.env.HOMEWORK_DB_USER || 'postgres',
    password: process.env.HOMEWORK_DB_PASSWORD,
    database: process.env.HOMEWORK_DB_ADMIN_DATABASE || 'postgres',
  });

  await client.connect();
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE "${identifier}"`);
    console.log(`Created database: ${databaseName}`);
  } else {
    console.log(`Database already exists: ${databaseName}`);
  }
  await client.end();
}

main().catch((error) => {
  console.error('Database creation failed:', error.message);
  process.exitCode = 1;
});
