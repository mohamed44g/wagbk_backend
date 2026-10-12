const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

async function main() {
  loadEnv();
  const [email, password, name = 'System Admin'] = process.argv.slice(2);
  if (!email || !password) {
    throw new Error('Usage: npm run db:create-admin -- admin@example.com StrongPassword "Admin name"');
  }

  const client = new Client({
    host: process.env.HOMEWORK_DB_HOST || 'localhost',
    port: Number(process.env.HOMEWORK_DB_PORT || 5432),
    user: process.env.HOMEWORK_DB_USER || 'postgres',
    password: process.env.HOMEWORK_DB_PASSWORD,
    database: process.env.HOMEWORK_DB_NAME || 'homework_management',
  });
  await client.connect();
  const passwordHash = await bcrypt.hash(password, 12);
  await client.query(
    `INSERT INTO super_admins (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash`,
    [name, email, passwordHash],
  );
  await client.end();
  console.log(`Super admin is ready: ${email}`);
}

main().catch((error) => {
  console.error('Admin creation failed:', error.message);
  process.exitCode = 1;
});
