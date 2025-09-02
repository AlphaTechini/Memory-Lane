import { getStore, saveStore } from './datastore.js';
import crypto from 'crypto';

/**
 * Build the Sensay replica payload structure from a user profile.
 * This only constructs the payload — does NOT call Sensay.
 */
export function buildSensayReplicaPayload(profile) {
  // Example mapping: adapt to Sensay docs when ready
  return {
    // high-level information
    display_name: profile.name || 'Unnamed Replica',
    description: profile.bio || '',
    metadata: {
      email: profile.email || null,
      phone: profile.phone || null,
      dob: profile.dob || null
    },
    persona: {
      // persona can include system instructions, style preferences, etc.
      instructions: `Be conversational and helpful. This replica represents ${profile.name || 'a user'}.`,
      tone: 'friendly'
    },
    // training references will be attached separately
    training_refs: []
  };
}

export async function createReplica(profile) {
  const store = await getStore();
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
  const payload = buildSensayReplicaPayload(profile);

  store.replicas = store.replicas || {};
  store.replicas[id] = {
    id,
    profile,
    sensayPayload: payload,
    createdAt: Date.now(),
    training: []
  };

  await saveStore(store);
  return { id, payload };
}

export async function getReplica(id) {
  const store = await getStore();
  return store.replicas?.[id] ?? null;
}

export async function listReplicas() {
  const store = await getStore();
  return Object.values(store.replicas || {});
}