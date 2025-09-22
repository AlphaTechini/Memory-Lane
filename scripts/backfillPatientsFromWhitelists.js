#!/usr/bin/env node
import mongoose from 'mongoose';
import DatabaseConfig from '../src/config/database.js';
import User from '../src/models/User.js';
import Patient from '../src/models/Patient.js';

async function run() {
  try {
    await DatabaseConfig.connect();
    console.log('Connected to DB');

    const caretakers = await User.find({ role: 'caretaker' }).select('replicas whitelistedPatients email');
    let created = 0;
    for (const c of caretakers) {
      const replicaList = c.replicas || [];
      const seen = new Set();
      for (const r of replicaList) {
        const emails = r.whitelistEmails || [];
        for (const e of emails) {
          const normalized = e.toLowerCase().trim();
          if (seen.has(normalized)) continue;
          seen.add(normalized);
          // Find existing user by email
          const linked = await User.findByEmail(normalized);
          const filter = { email: normalized, caretaker: c._id };
          const update = {
            $set: { userId: linked ? linked._id : undefined, updatedAt: new Date() },
            $addToSet: { allowedReplicas: r.replicaId }
          };
          await Patient.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
          created++;
        }
      }
    }

    console.log(`Backfilled ${created} patient records`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed', err);
    process.exit(2);
  }
}

run();
