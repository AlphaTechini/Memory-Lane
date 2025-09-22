import assert from 'assert';
import { addPatientEmailToReplicas } from '../src/services/caretakerService.js';

(async function run() {
  // Mock user object with minimal shape and a save() implementation
  const user = {
    _id: 'mockUserId',
    sensayUserId: 'sensayUser_mock',
    role: 'caretaker',
    replicas: [
      { replicaId: 'replica-1', name: 'R1', description: 'D1', whitelistEmails: [] },
      { replicaId: 'replica-2', name: 'R2', description: 'D2', whitelistEmails: ['existing@example.com'] }
    ],
    whitelistedPatients: [],
    async save() { this._saved = true; }
  };

  // Track calls to mock updateReplica
  const called = [];
  const mockUpdateReplica = async (replicaId, updateData) => {
    called.push({ replicaId, updateData });
    // simulate success
    return { id: replicaId, updated: true };
  };

  // Mock Patient model with findOneAndUpdate
  const patientStore = {};
  const MockPatient = {
    async findOneAndUpdate(filter, update, opts) {
      const key = `${filter.email}-${filter.caretaker}`;
      patientStore[key] = patientStore[key] || { email: filter.email, caretaker: filter.caretaker, allowedReplicas: [] };
      if (update.$addToSet && update.$addToSet.allowedReplicas) {
        patientStore[key].allowedReplicas = Array.from(new Set([...patientStore[key].allowedReplicas, update.$addToSet.allowedReplicas]));
      }
      return patientStore[key];
    }
  };

  // Run the function
  try {
    const res = await addPatientEmailToReplicas(user, 'NewPatient@Example.com', ['replica-1', 'replica-2'], {
      updateReplica: mockUpdateReplica,
      PatientModel: MockPatient,
      findUserByEmail: async (email) => null // simulate no linked user
    });

    console.log('Result:', JSON.stringify(res, null, 2));

    // Assertions
    assert.strictEqual(res.success, true, 'success flag');
    assert.strictEqual(res.summary.total, 2);
    assert.strictEqual(res.summary.successful, 2);
    assert.strictEqual(user.whitelistedPatients.includes('newpatient@example.com'), true, 'patient email persisted on user');
    assert.strictEqual(called.length, 2, 'updateReplica called for each replica');

    console.log('PASS: caretaker.add-patient.test');
    process.exit(0);
  } catch (err) {
    console.error('FAIL:', err);
    process.exit(2);
  }
})();
