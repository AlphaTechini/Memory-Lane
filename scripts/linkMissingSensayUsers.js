#!/usr/bin/env node
/**
 * One-off admin script to find caretakers missing sensayUserId and attempt to create/link Sensay users.
 * Usage: node scripts/linkMissingSensayUsers.js
 */
import databaseConfig from '../src/config/database.js';
import { createSensayUser } from '../src/services/sensayService.js';

const prisma = databaseConfig.prisma;

async function run() {
  console.log('Scanning for caretakers without sensayUserId...');
  const users = await prisma.user.findMany({ where: { role: 'caretaker', sensayUserId: null } });
  console.log(`Found ${users.length} caretakers without sensayUserId`);

  for (const u of users) {
    try {
      const email = u.email;
      const name = (u.firstName || u.lastName) ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : email.split('@')[0];
      console.log(`Attempting to create Sensay user for ${email}`);
      const resp = await createSensayUser({ email, name });
      if (resp && resp.id) {
        await prisma.user.update({ where: { id: u.id }, data: { sensayUserId: resp.id } });
        console.log(`Linked ${email} -> ${resp.id}`);
      } else if (resp && resp.conflict) {
        console.warn(`Conflict for ${email}. resp:`, resp.error || resp);
        // Optionally, you could try to search for existing Sensay users here
      } else {
        console.warn(`No id returned for ${email}. resp:`, resp);
      }
    } catch (err) {
      console.error(`Failed for ${u.email}:`, err.message || err);
    }
  }

  console.log('Done');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
