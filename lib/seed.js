'use strict';

/**
 * Seed the AMMIGE catalog (wipes existing data first).
 * Run: npm run seed
 * Against Turso: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run seed
 */
const { client, ready } = require('./db');
const { seedCatalog } = require('./catalog');

async function main() {
  await ready();
  const total = await seedCatalog(client(), true);
  console.log('Seeded AMMIGE products:', total);
}

main().catch((e) => { console.error(e); process.exit(1); });
