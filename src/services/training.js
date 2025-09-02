import { getStore, saveStore } from '../database/datastore.js';
import crypto from 'crypto';

/**
 * Create training examples for a replica.
 * qaPairs: [{ question: string, answer: string }]
 * This function builds the Sensay-style training payload and stores it locally.
 */
export async function createTrainingData(replicaId, qaPairs = []) {
  const store = await getStore();
  store.replicas = store.replicas || {};
  const replica = store.replicas[replicaId];
  if (!replica) throw new Error('Replica not found');

  const trainingId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');

  const examples = qaPairs.map((p) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(6).toString('hex'),
    input: p.question,
    output: p.answer
  }));

  const trainingItem = {
    id: trainingId,
    createdAt: Date.now(),
    examples
  };

  replica.training = replica.training || [];
  replica.training.push(trainingItem);

  // also keep quick index
  store.training = store.training || {};
  store.training[trainingId] = { replicaId, examples, createdAt: trainingItem.createdAt };

  await saveStore(store);

  // Build payload you would send to Sensay's training endpoint (example format)
  const sensayTrainingPayload = {
    replica_id: replicaId,
    examples: examples.map(e => ({ input: e.input, output: e.output }))
  };

  return { trainingId, examples, sensayTrainingPayload };
}

/**
 * Update training examples for a given trainingId.
 * updates: { examples?: [{id?, input, output}], removeIds?: [id] }
 */
export async function updateTrainingData(trainingId, updates = {}) {
  const store = await getStore();
  store.replicas = store.replicas || {};
  store.training = store.training || {};

  const meta = store.training[trainingId];
  if (!meta) throw new Error('Training set not found');

  const replica = store.replicas[meta.replicaId];
  if (!replica) throw new Error('Replica not found');

  // find the training item in replica.training
  const tIndex = (replica.training || []).findIndex(t => t.id === trainingId);
  if (tIndex === -1) throw new Error('Training set missing from replica');

  // apply updates
  const tItem = replica.training[tIndex];

  if (updates.removeIds && Array.isArray(updates.removeIds)) {
    tItem.examples = tItem.examples.filter(e => !updates.removeIds.includes(e.id));
  }

  if (updates.examples && Array.isArray(updates.examples)) {
    // add or replace by id when provided
    updates.examples.forEach((ex) => {
      if (ex.id) {
        const idx = tItem.examples.findIndex(e => e.id === ex.id);
        if (idx !== -1) tItem.examples[idx] = { ...tItem.examples[idx], input: ex.input, output: ex.output };
        else tItem.examples.push({ id: ex.id, input: ex.input, output: ex.output });
      } else {
        tItem.examples.push({ id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(6).toString('hex'), input: ex.input, output: ex.output });
      }
    });
  }

  // update global training index
  store.training[trainingId] = { replicaId: meta.replicaId, examples: tItem.examples, updatedAt: Date.now() };

  await saveStore(store);

  // Build payload suitable for Sensay training update APIs
  const sensayUpdatePayload = {
    training: tItem.examples.map(e => ({ input: e.input, output: e.output }))
  };
  return { trainingId, examples: tItem.examples, sensayUpdatePayload };
}