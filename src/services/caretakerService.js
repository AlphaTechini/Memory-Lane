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

      // Create/update Patient document with caretaker reference using Prisma-compatible approach
      try {
        // Retry logic for Patient model operations
        let patientAttempts = 0;
        const maxPatientAttempts = 3;
        
        while (patientAttempts < maxPatientAttempts) {
          try {
            // Ensure we have a valid user ID for the caretaker foreign key relationship
            const caretakerId = user.id || user._id;
            if (!caretakerId) {
              throw new Error(`Invalid user object - missing id field: ${JSON.stringify(user)}`);
            }

            console.log(`Patient DB operation attempt ${patientAttempts + 1} for ${normalizedEmail}, caretakerId: ${caretakerId}`);

            // First, try to find existing patient for this caretaker-email combination
            let patient = await PatientModel.findByEmail(normalizedEmail);
            
            // If we find a patient, make sure it belongs to the current caretaker
            if (patient && patient.caretakerId !== caretakerId) {
              console.warn(`Patient ${normalizedEmail} exists but belongs to different caretaker (${patient.caretakerId} vs ${caretakerId})`);
              // Create a new patient record for this caretaker since Prisma schema allows multiple patients with same email for different caretakers
              patient = null;
            }
            
            if (patient) {
              // Patient exists for this caretaker, update allowedReplicas if not already included
              if (!patient.allowedReplicas.includes(replicaId)) {
                patient.allowedReplicas.push(replicaId);
                patient.caretakerEmail = user.email;
                patient.caretakerId = caretakerId;
                patient.isActive = true;
                await patient.save();
                console.log(`Updated existing Patient record for ${normalizedEmail} under caretaker ${user.email}`);
              } else {
                console.log(`Patient ${normalizedEmail} already has access to replica ${replicaId}`);
              }
            } else {
              // Patient doesn't exist for this caretaker, create new one
              console.log(`Creating new Patient record for ${normalizedEmail} with caretakerId: ${caretakerId}`);
              patient = new PatientModel({
                email: normalizedEmail,
                caretakerId: caretakerId,
                caretakerEmail: user.email,
                firstName: normalizedEmail.split('@')[0], // Use email prefix as default name
                allowedReplicas: [replicaId],
                isActive: true
              });
              
              await patient.save();
              console.log(`Successfully created new Patient record for ${normalizedEmail} under caretaker ${user.email}`);
            }
            break; // Success, exit retry loop
          } catch (patientRetryError) {
            patientAttempts++;
            console.error(`Patient DB operation attempt ${patientAttempts} failed:`, {
              error: patientRetryError.message,
              code: patientRetryError.code,
              stack: patientRetryError.stack?.split('\n').slice(0, 3).join('\n')
            });
            
            // Retry on connection errors
            if (patientAttempts < maxPatientAttempts && (
              patientRetryError.code === 'P1017' || 
              patientRetryError.code === 'P1001' ||
              patientRetryError.message?.includes('connection') ||
              patientRetryError.message?.includes('timeout')
            )) {
              const backoffMs = 300 * Math.pow(2, patientAttempts - 1);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            
            // If max attempts reached or non-retryable error, log and continue
            throw patientRetryError;
          }
        }
      } catch (pErr) {
        // Don't fail the whole flow on patient upsert errors
        // eslint-disable-next-line no-console
        console.error(`CRITICAL: Failed to upsert Patient doc for ${normalizedEmail} after retries:`, {
          error: pErr.message,
          code: pErr.code,
          stack: pErr.stack,
          userInfo: {
            userId: user.id || user._id,
            userEmail: user.email,
            patientEmail: normalizedEmail,
            replicaId
          }
        });
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
    
    // Save with retry logic for database connection issues
    if (typeof user.save === 'function') {
      let saveAttempts = 0;
      const maxAttempts = 3;
      
      while (saveAttempts < maxAttempts) {
        try {
          await user.save();
          break; // Success, exit retry loop
        } catch (saveError) {
          saveAttempts++;
          console.warn(`Database save attempt ${saveAttempts} failed:`, saveError.message);
          
          // If it's a connection error and we have attempts left, wait and retry
          if (saveAttempts < maxAttempts && (
            saveError.code === 'P1017' || // Server has closed the connection
            saveError.code === 'P1001' || // Can't reach database server
            saveError.message?.includes('connection') ||
            saveError.message?.includes('timeout')
          )) {
            // Exponential backoff: 500ms, 1000ms, 2000ms
            const backoffMs = 500 * Math.pow(2, saveAttempts - 1);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
          
          // If not a retryable error or max attempts reached, throw
          throw saveError;
        }
      }
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
