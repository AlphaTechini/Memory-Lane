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

      // Upsert Patient document scoped to this caretaker
      try {
        // If a User exists for this email, link it
        let linkedUser = await findUserByEmail(normalizedEmail);
        
        // If no user exists, optionally create one automatically (role='patient')
        if (!linkedUser && deps.autoCreatePatientUsers !== false) {
          try {
            const UserModel = deps.UserModel || (await import('../models/User.js')).default;
            // Create minimal patient user with temporary password
            linkedUser = new UserModel({
              email: normalizedEmail,
              password: 'temp-password-' + Math.random().toString(36),
              role: 'patient',
              isVerified: false,
              firstName: normalizedEmail.split('@')[0] // Use email prefix as name
            });
            await linkedUser.save();
            // eslint-disable-next-line no-console
            console.log(`Auto-created patient User for ${normalizedEmail}`);
          } catch (createErr) {
            // Non-fatal: if user creation fails, continue without linking
            // eslint-disable-next-line no-console
            console.warn(`Failed to auto-create patient User for ${normalizedEmail}:`, createErr.message);
          }
        }
        
        const patientFilter = { email: normalizedEmail, caretaker: user._id };
        const update = {
          $set: { userId: linkedUser ? linkedUser._id : undefined, updatedAt: new Date() },
          $addToSet: { allowedReplicas: replicaId }
        };
        if (PatientModel && typeof PatientModel.findOneAndUpdate === 'function') {
          await PatientModel.findOneAndUpdate(patientFilter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
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

  // Persist user changes only if any Sensay updates succeeded
  if (anySuccess) {
    if (!user.whitelistedPatients) user.whitelistedPatients = [];
    if (!user.whitelistedPatients.includes(normalizedEmail)) user.whitelistedPatients.push(normalizedEmail);
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
