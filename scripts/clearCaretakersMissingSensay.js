#!/usr/bin/env node
/**
 * Safe admin script to list and optionally delete caretakers missing sensayUserId.
 * Usage:
 *   # Dry run (lists affected users)
 *   node scripts/clearCaretakersMissingSensay.js
 *
 *   # To actually delete them (be careful!)
 *   CONFIRM=1 node scripts/clearCaretakersMissingSensay.js
 *
 * The script will NEVER run deletions unless CONFIRM=1 is set in the environment.
 */
import databaseConfig from '../src/config/database.js';

const prisma = databaseConfig.prisma;

async function run() {
  console.log('Scanning for caretakers without sensayUserId (dry run)...');
  const users = await prisma.user.findMany({ where: { role: 'caretaker', sensayUserId: null } });
  console.log(`Found ${users.length} caretakers without sensayUserId`);
  users.forEach(u => console.log(`- ${u.id} ${u.email} createdAt=${u.createdAt}`));

  if (process.env.CONFIRM !== '1') {
    console.log('\nDry run complete. To delete these users, re-run with CONFIRM=1');
    process.exit(0);
  }

  console.log('\nCONFIRM=1 detected. Deleting users now...');
  for (const u of users) {
    try {
      await prisma.user.delete({ where: { id: u.id } });
      console.log(`Deleted ${u.id} ${u.email}`);
    } catch (err) {
      console.error(`Failed to delete ${u.email}:`, err.message || err);
    }
  }

  console.log('Deletion complete.');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
