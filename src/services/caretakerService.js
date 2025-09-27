/**
 * Helper to add a patient email to multiple replicas for a caretaker.
 * This function isolates the business logic so it can be unit-tested with mocked deps.
 */
export async function addPatientEmailToReplicas(user, patientEmail, replicaIds, deps = {}) {
  if (!patientEmail || !Array.isArray(replicaIds) || replicaIds.length === 0) {
    throw new Error('patientEmail and replicaIds array are required');
  }

  const normalizedEmail = patientEmail.toLowerCase().trim();
  const results = [];
  let anySuccess = false;

  const updateReplicaFn = deps.updateReplica || (async (replicaId, updateData) => {
    const mod = await import('./sensayService.js');
    return mod.updateReplica(replicaId, updateData);
  });

  const PatientModel = deps.PatientModel || (await import('../models/Patient.js')).default;
  const findUserByEmail = deps.findUserByEmail || (async (email) => {
    const U = await import('../models/User.js');
    return U.default.findByEmail(email);
  });

  for (const replicaId of replicaIds) {
    try {
      const userReplica = user.replicas?.find(r => r.replicaId === replicaId);
      if (!userReplica) {
        results.push({ replicaId, success: false, error: 'Replica not found or not owned by user' });
        continue;
      }

      if (!userReplica.whitelistEmails) userReplica.whitelistEmails = [];
      if (!userReplica.whitelistEmails.includes(normalizedEmail)) {
        userReplica.whitelistEmails.push(normalizedEmail);
      }

      const updateData = {
        name: userReplica.name,
        shortDescription: userReplica.description,
        greeting: `Hi! I'm ${userReplica.name}. ${userReplica.description}`,
        slug: `${userReplica.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        ownerID: user.sensayUserId,
        private: userReplica.whitelistEmails.length > 0,
        whitelistEmails: userReplica.whitelistEmails,
        llm: { model: 'gpt-4o' }
      };

      await updateReplicaFn(replicaId, updateData);

      results.push({ replicaId, success: true, message: 'Successfully updated' });
      anySuccess = true;

      // Create/update Patient document with caretaker reference
      try {
        const patientFilter = { email: normalizedEmail, caretaker: user._id };
        const update = {
          $set: { 
            caretakerEmail: user.email,
            firstName: normalizedEmail.split('@')[0], // Use email prefix as default name
            updatedAt: new Date(),
            isActive: true
          },
          $addToSet: { allowedReplicas: replicaId }
        };
        
        if (PatientModel && typeof PatientModel.findOneAndUpdate === 'function') {
          const patientDoc = await PatientModel.findOneAndUpdate(
            patientFilter, 
            update, 
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          // eslint-disable-next-line no-console
          console.log(`Created/updated Patient record for ${normalizedEmail} under caretaker ${user.email}`);
        }
      } catch (pErr) {
        // Don't fail the whole flow on patient upsert errors
        // eslint-disable-next-line no-console
        console.warn(pErr, `Failed to upsert Patient doc for ${normalizedEmail}`);
      }

    } catch (error) {
      // Log and continue
      results.push({ replicaId, success: false, error: error.message || 'Update failed' });
    }
  }

  // Update caretaker's patient list only if any Sensay updates succeeded
  if (anySuccess) {
    if (!user.patientWhitelist) user.patientWhitelist = [];
    const existingPatient = user.patientWhitelist.find(p => p.email === normalizedEmail);
    if (!existingPatient) {
      user.patientWhitelist.push({
        email: normalizedEmail,
        addedAt: new Date()
      });
    }
    if (typeof user.save === 'function') {
      await user.save();
    }
  }

  const successful = results.filter(r => r.success).length;
  const total = results.length;

  return {
    success: true,
    message: `Updated ${successful}/${total} replicas`,
    results,
    patientEmail: normalizedEmail,
    summary: { total, successful, failed: total - successful }
  };
}

export default { addPatientEmailToReplicas };
