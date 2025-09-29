(async () => {
  try {
    const mod = await import('./src/services/caretakerService.js');
    const { addPatientEmailToReplicas } = mod;

    const user = {
      _id: 'user-1',
      email: 'caretaker@example.com',
      replicas: [{ replicaId: 'r1', name: 'Rep', description: 'desc', whitelistEmails: [] }],
      patientWhitelist: [],
      save: async function () {
        console.log('user.save called');
      }
    };

    class PatientModel {
      constructor(data) {
        Object.assign(this, data);
        this.allowedReplicas = this.allowedReplicas || [];
      }
      async save() {
        this._id = this._id || 'patient-1';
        console.log('Patient.save called for', this.email, 'allowedReplicas=', this.allowedReplicas);
        return this;
      }
      static async findByEmail(email) {
        // Simulate not found initially so create branch is taken
        console.log('PatientModel.findByEmail called for', email);
        return null;
      }
    }

    const result = await addPatientEmailToReplicas(user, 'patient@example.com', ['r1'], {
      PatientModel,
      updateReplica: async (replicaId, updateData) => {
        console.log('updateReplica called for', replicaId);
        return true;
      },
      findUserByEmail: async (email) => null
    });

    console.log('Result:', result);
    console.log('User patientWhitelist:', user.patientWhitelist);
  } catch (err) {
    console.error('Error in test:', err);
    process.exitCode = 1;
  }
})();
