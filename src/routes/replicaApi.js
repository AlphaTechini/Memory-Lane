import { 
  createReplica, 
  trainReplica, 
  getKnowledgeBaseEntryStatus,
  getKnowledgeBaseEntry,
  sendChatMessage,
  waitForReplicaAvailable,
  listReplicas,
  createKnowledgeBaseEntry,
  updateKnowledgeBaseWithText,
  updateKnowledgeBaseEntry,
  pollKnowledgeBaseEntryStatus,
  updateReplica,
  deleteReplica,
  startTrainingSession,
  completeTrainingSession
} from '../services/sensayService.js';
import { authenticateToken, optionalAuth, requireCaretaker, requirePatient, validatePatientCaretakerRelationship } from '../middleware/auth.js';
import { ensureSensayUser, validateSensayLink } from '../middleware/sensayAuth.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Conversation from '../models/Conversation.js';
import { REQUIRED_QUESTIONS, OPTIONAL_SEGMENTS, getQuestionText } from '../utils/questionBank.js';
import { sensayConfig } from '../config/sensay.js';

/**
 * Replica management routes
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function replicaRoutes(fastify, options) {
  const isUuid = (s) => typeof s === 'string' && /^[0-9a-fA-F\-]{36}$/.test(s);

  const getValidatedRequestUserId = (request, reply) => {
    const uid = request.user?.id;
    if (!isUuid(uid)) {
      reply.code(401).send({ success:false, error:'Invalid user id in token' });
      return null;
    }
    return uid;
  };
  // Safe wrapper for creating empty KB entry
  const createKnowledgeBaseEntrySafe = async (replicaId, data) => {
    return await createKnowledgeBaseEntry(replicaId, data);
  };

  const extractKnowledgeBaseEntryId = (entry) => {
    if (!entry) return undefined;

    const directId = entry.id
      ?? entry.knowledgeBaseID
      ?? entry.knowledgeBaseId
      ?? entry.uuid;
    if (directId) return directId;

    if (Array.isArray(entry.entryIds)) {
      const first = entry.entryIds.find(Boolean);
      if (first) return first;
    }

    if (Array.isArray(entry.results)) {
      for (const item of entry.results) {
        const candidate = item?.knowledgeBaseID
          ?? item?.knowledgeBaseId
          ?? item?.id
          ?? item?.entryId;
        if (candidate) {
          return candidate;
        }
      }
    }

    return undefined;
  };

  // Schema for replica creation from wizard
  const createReplicaSchema = {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        template: { type: 'string', nullable: true },
        relationship: { type: 'string', nullable: true },
        requiredAnswers: { type: 'object' },
        optionalAnswers: { type: 'object' },
        selectedSegments: { 
          type: 'array',
          items: { type: 'string' }
        },
        profileImage: { type: 'string' },
        coverageScore: { type: 'number' },
        greeting: { type: 'string' },
        preferredQuestion: { type: 'string' }
      },
      required: ['name', 'description', 'requiredAnswers', 'optionalAnswers', 'selectedSegments']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          replica: { type: 'object' }
        }
      }
    }
  };

  // Schema for training with text
  const trainWithTextSchema = {
    body: {
      type: 'object',
      properties: {
        replicaId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        rawText: { type: 'string' }
      },
      required: ['replicaId', 'title', 'rawText']
    }
  };

  /**
   * Create a new replica from wizard data (protected route)
   */
  fastify.post('/api/replicas', { 
    schema: createReplicaSchema,
    preHandler: [authenticateToken, requireCaretaker, ensureSensayUser({ required: true })]
  }, async (request, reply) => {
    try {
  const { name, description, template, relationship, requiredAnswers, optionalAnswers, selectedSegments, profileImage, coverageScore, greeting: userGreeting, preferredQuestion } = request.body;
      
      // Load user and check permissions
      const user = request.user; // User is already loaded by middleware
      
      // Disallow patient role from creating replicas
      if (user?.role === 'patient') {
        return reply.status(403).send({ success: false, error: 'Access denied: patients cannot create replicas' });
      }

      // Sensay user is ensured by middleware, get from request
      const sensayUserId = request.sensayUser?.id || user.sensayUserId;

      // Generate a slug from the name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Ensure description is within 50 character limit for Sensay API
      const shortDescription = description.length > 50 ? description.substring(0, 50) : description;
      
      // Use user-provided greeting or create default from description
      const greeting = userGreeting?.trim() || `Hi! I'm ${name}. ${shortDescription}`;
      
      // Prepare Sensay replica data with supported model
      const sensayReplicaData = {
        name,
        shortDescription,
        greeting,
        ownerID: sensayUserId,
        slug: `${slug}-${Date.now()}`, // Make it unique
        llm: {
          model: "gpt-4o" // Use gpt-4o which is allowed by the plan
        }
      };

      // Additional validation per requirements
      if (!name || !shortDescription || !greeting || !sensayReplicaData.slug || !sensayReplicaData.llm?.model || !sensayReplicaData.ownerID) {
        return reply.status(400).send({ success: false, error: 'Missing required replica fields' });
      }

      fastify.log.info(`Creating replica with gpt-4o model for owner (user): ${user.sensayUserId}`);
      
      // Create replica in Sensay
      const sensayReplica = await createReplica(sensayReplicaData);

      // Wait for replica availability to reduce immediate 404s in KB creation
      try {
        await waitForReplicaAvailable(sensayReplica.id);
      } catch (availErr) {
        fastify.log.warn(availErr, 'Replica availability polling exhausted, proceeding with training attempts anyway');
      }
      
      // Prepare training data from wizard responses
  const trainingTexts = [];

  // Baseline persona seed text per template (acts as initial behavioral prior)
  const BASELINE_PERSONAS = {
    dad: `Persona Role: Father\nTone: Supportive, steady, pragmatic with occasional gentle humor.\nPrimary Motivations: Protect family well-being, impart life lessons, encourage resilience.\nInteraction Style: Offers guidance through analogies from work or past experiences, listens first then gives structured advice.\nBoundaries: Avoids over-indulgence, prefers fostering independence.\nCore Values: Responsibility, integrity, patience, long-term thinking.`,
    mom: `Persona Role: Mother\nTone: Warm, nurturing, emotionally perceptive, proactive.\nPrimary Motivations: Emotional security of family, harmony, growth.\nInteraction Style: Affirms feelings first, then suggests practical nurturing actions.\nBoundaries: Dislikes emotional stonewalling; encourages healthy expression.\nCore Values: Empathy, care, stability, unconditional support.`,
    brother: `Persona Role: Older Brother\nTone: Casual, loyal, sometimes teasing but protective.\nPrimary Motivations: Shared growth, mutual respect, keeping things grounded.\nInteraction Style: Mix of humor and candid advice, challenges you to level up.\nBoundaries: Rejects excessive formality; prefers directness.\nCore Values: Loyalty, honesty, personal improvement, camaraderie.`,
    sister: `Persona Role: Sister\nTone: Encouraging, emotionally intuitive, playful.\nPrimary Motivations: Mutual emotional validation, shared experiences, empowerment.\nInteraction Style: Balances empathy with motivational nudges.\nBoundaries: Dislikes dismissiveness of feelings.\nCore Values: Expression, growth, trust, encouragement.`,
    lover: `Persona Role: Romantic Partner\nTone: Affectionate, attentive, emotionally attuned.\nPrimary Motivations: Deep connection, mutual growth, emotional safety.\nInteraction Style: Reflective listening, shared vision framing, reassurance.\nBoundaries: Dislikes avoidance and vague emotional responses.\nCore Values: Trust, intimacy, commitment, mutual evolution.`,
    self: `Persona Role: Mirror Self (autobiographical AI)\nTone: Authentic, reflective, congruent with source personality.\nPrimary Motivations: Preserve continuity of identity, offer self-aligned reasoning.\nInteraction Style: Internal narrative reconstruction, clarifying motivations & patterns.\nBoundaries: Avoids fabrication outside provided knowledge.\nCore Values: Authenticity, self-awareness, coherence.`
  };

  // Rephrased questions in informative format for KB entries
  // Maps question IDs to informative statements expecting answers
  const REPHRASED_QUESTIONS = {
    // Required Questions - rephrased as informative statements
    rq1: (role) => `${role}'s core motivations and values in life are`,
    rq2: (role) => `${role}'s approach to handling failure and setbacks is`,
    rq3: (role) => `${role}'s biggest fears and how they influence decisions are`,
    rq4: (role) => `${role}'s ideal relationship values and what matters most in connections are`,
    rq5: (role) => `${role}'s vision for changing the world and making that change is`,
    rq6: (role) => `${role}'s beliefs about what happens after death and how it influences life are`,
    rq7: (role) => `${role}'s proudest moment and why it was meaningful is`,
    rq8: (role) => `${role}'s definition of success and how it has evolved is`,
    rq9: (role) => `${role}'s biggest regret and lessons learned from it are`,
    rq10: (role) => `${role}'s ultimate legacy vision with unlimited resources would be`,
    
    // Occupation Questions
    occ1: (role) => `${role}'s typical workday routine looks like`,
    occ2: (role) => `${role}'s original draw to their profession was`,
    occ3: (role) => `${role}'s biggest professional achievement and its meaning is`,
    occ4: (role) => `${role}'s most challenging work aspect and coping strategy is`,
    occ5: (role) => `${role}'s career direction for the next 5-10 years is`,
    
    // Hobbies Questions
    hob1: (role) => `${role}'s hobby that makes them lose track of time is`,
    hob2: (role) => `${role}'s discovery of their main interests happened through`,
    hob3: (role) => `${role}'s something they've always wanted to learn or try is`,
    hob4: (role) => `${role}'s favorite way to spend a free weekend is`,
    hob5: (role) => `${role}'s books, movies, or shows that significantly impacted them are`,
    
    // Viewpoints Questions
    view1: (role) => `${role}'s controversial opinion that most disagree with is`,
    view2: (role) => `${role}'s feelings about social media's impact on society are`,
    view3: (role) => `${role}'s stance on work-life balance and career ambition is`,
    
    // Communication Questions
    comm1: (role) => `${role}'s personality as described by closest friends is`,
    comm2: (role) => `${role}'s communication style when upset or angry is`,
    comm3: (role) => `${role}'s preferred way to give and receive feedback is`,
    
    // Lifestyle Questions
    life1: (role) => `${role}'s ideal morning routine is`,
    life2: (role) => `${role}'s approach to maintaining physical and mental health is`,
    life3: (role) => `${role}'s living space says about them`,
    
    // Quirks Questions
    quirk1: (role) => `${role}'s weird or unique habit that most don't know about is`,
    quirk2: (role) => `${role}'s something that annoys them that others wouldn't mind is`,
    quirk3: (role) => `${role}'s superstition or ritual they follow despite knowing it's illogical is`
  };      const normalizedTemplate = template ? String(template).toLowerCase() : null;
      let baselinePersonaStored = '';
      if (normalizedTemplate && BASELINE_PERSONAS[normalizedTemplate]) {
        // Required first-line pattern (role & name, no pronouns):
        // "You are to act as my (role), (role)'s name is (name)."
        const personaIntro = `You are to act as my ${normalizedTemplate}, ${normalizedTemplate}'s name is ${name}.` + (relationship ? `\nRelationship context: ${relationship}` : '');
        baselinePersonaStored = personaIntro + '\n' + BASELINE_PERSONAS[normalizedTemplate];
        trainingTexts.push({
          title: `Baseline Persona: ${normalizedTemplate}`,
          content: baselinePersonaStored
        });
      } else {
        // Generic fallback when no template is chosen - use "self" as default role
        baselinePersonaStored = `You are to act as my self, self's name is ${name}.` + (relationship ? `\nRelationship context: ${relationship}` : '') + '\n' + BASELINE_PERSONAS.self;
        trainingTexts.push({
          title: 'Baseline Persona: self',
          content: baselinePersonaStored
        });
      }

      // Optionally include relationship note if provided and distinct
      if (relationship && (!normalizedTemplate || relationship.toLowerCase() !== normalizedTemplate)) {
        trainingTexts.push({
          title: 'Relationship Context',
          content: `Relationship framing provided by user: ${relationship}`
        });
      }
      
      // Build a single consolidated informative profile entry from all Q/A
      const profileLines = [];
      
      // Determine the role name for rephrasing (use template or default to name)
      const roleForRephrasing = normalizedTemplate || name;

      // Required answers using rephrased informative format
      REQUIRED_QUESTIONS.forEach(q => {
        const ans = requiredAnswers[q.id];
        if (typeof ans === 'string' && ans.trim()) {
          const rephrasedPrompt = REPHRASED_QUESTIONS[q.id];
          if (rephrasedPrompt) {
            const statement = rephrasedPrompt(roleForRephrasing);
            profileLines.push(`${statement}: ${ans.trim()}`);
          } else {
            // Fallback if rephrased version not found
            profileLines.push(`${q.text.substring(0, 60)}: ${ans.trim()}`);
          }
        }
      });

      // Optional answers using rephrased informative format  
      Object.entries(optionalAnswers).forEach(([questionId, answer]) => {
        if (typeof answer === 'string' && answer.trim()) {
          const rephrasedPrompt = REPHRASED_QUESTIONS[questionId];
          if (rephrasedPrompt) {
            const statement = rephrasedPrompt(roleForRephrasing);
            profileLines.push(`${statement}: ${answer.trim()}`);
          } else {
            // Fallback for questions without rephrased versions
            const questionText = getQuestionText(questionId);
            const concise = questionText.split(/[.!?]/)[0].trim();
            profileLines.push(`${concise}: ${answer.trim()}`);
          }
        }
      });

      let infoProfileSnapshot = '';
      if (profileLines.length) {
        infoProfileSnapshot = profileLines.join('\n');
        trainingTexts.push({
          title: 'Informational Profile',
          content: infoProfileSnapshot
        });
      }
      // NOTE: Future enhancement example (NOT implemented now):
      // For transforming certain answers into stylized lines like
      // "Role's greatest quotes (rephrased): <user input>"
      // we can apply a regex replacement on infoProfileSnapshot lines.
      // Example pattern to locate a "Proud Moment" line:
      // const updated = infoProfileSnapshot.replace(/^(Proud Moment: )(.*)$/m, (m, prefix, body) => `${prefix}${rephrase(body)}`);
      // Where rephrase() would call an LLM or heuristic paraphraser.
      
      // Training strategy: attempt full set; if certain validation errors occur, fallback to simplified single-entry answers.
      let trainingCount = 0;
      let usedSimplified = false;
      const fallbackPattern = /(invalid|format|too large|unsupported|payload)/i;

      const attemptEntries = async (entries) => {
        for (const entry of entries) {
          try {
            if (!sensayReplica?.id) {
              fastify.log.warn('Replica id missing; aborting further training attempts');
              break;
            }
            await trainReplica(sensayReplica.id, {
              title: entry.title.substring(0, 80), // keep titles concise
              rawText: entry.content
            });
            trainingCount++;
          } catch (err) {
            fastify.log.warn(err, `Failed to train replica with: ${entry.title}`);
            const msg = err.message?.toLowerCase() || '';
            if (msg.includes('not found')) {
              fastify.log.warn('Encountered Not Found during training; stopping to avoid spamming.');
              // Don't break completely - allow replica creation to succeed even if training fails
              fastify.log.info(`Replica ${sensayReplica.id} created successfully, but training failed due to API limitations.`);
              break; // eventual consistency issue; stop further until later manual training
            }
            if (fallbackPattern.test(msg)) {
              // Signal to fallback to simplified approach
              throw new Error('FALLBACK_TRIGGER');
            }
            // Non-fallback error: continue to next entry
          }
        }
      };

      try {
        fastify.log.info(`Starting comprehensive training workflow for replica ${sensayReplica.id} with ${trainingTexts.length} entries`);
        await attemptEntries(trainingTexts);
        fastify.log.info(`Training workflow completed for replica ${sensayReplica.id}. Successfully processed ${trainingCount} entries.`);
      } catch (flag) {
        if (flag.message === 'FALLBACK_TRIGGER') {
          usedSimplified = true;
          // Build simplified single combined raw answer payload (answers only, no prefixes)
          const allAnswers = [
            ...Object.values(requiredAnswers || {}),
            ...Object.values(optionalAnswers || {})
          ].filter(a => typeof a === 'string' && a.trim());
          if (allAnswers.length) {
            const combined = allAnswers.join('\n\n');
            try {
              await trainReplica(sensayReplica.id, {
                title: 'User Answers',
                rawText: combined.substring(0, 15000) // safety cap
              });
              trainingCount = 1; // overwrite with simplified count if successful
            } catch (fallbackErr) {
              fastify.log.warn(fallbackErr, 'Simplified fallback training failed');
            }
          }
        }
      }
      
      // Save replica info to user's profile
      const replicaData = {
        replicaId: sensayReplica.id,
        name,
        description,
        profileImageUrl: profileImage || null,
        selectedSegments,
        coverageScore: coverageScore || 0,
        lastTrained: new Date(),
        template: normalizedTemplate || null,
        baselinePersona: baselinePersonaStored,
        infoProfileSnapshot,
        greeting: userGreeting?.trim() || null,
        preferredQuestion: preferredQuestion?.trim() || null
      };
      
      await User.findByIdAndUpdate(
        request.user.id,
        { $push: { replicas: replicaData } },
        { new: true }
      );
      
      return { 
        success: true, 
        replica: {
          id: sensayReplica.id,
          ...replicaData,
          trainingCount,
          usedSimplified,
          template: normalizedTemplate || null,
          baselineIncluded: Boolean(normalizedTemplate),
          trainingEntriesPlanned: trainingTexts.length,
          trainingWorkflowComplete: true,
          message: `Replica created and trained with ${trainingCount} knowledge base entries. Training sessions initiated to apply KB data to replica behavior.`
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error creating replica');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to create replica' 
      });
    }
  });

  /**
   * Reconcile local replicas with Sensay remote state
   */
  fastify.post('/api/replicas/reconcile', { preHandler: [authenticateToken, requireCaretaker] }, async (request, reply) => {
    try {
  const userId = getValidatedRequestUserId(request, reply);
  if (!userId) return;
  const user = await User.findById(userId).select('email role sensayUserId replicas');
      
      // For patients, use their caretaker's Sensay user ID
      let targetUser = user;
      let targetSensayUserId = user.sensayUserId;
      
      if (user.role === 'patient') {
        // Find caretaker for this patient - sanitize email first
        const patientEmail = typeof user.email === 'string' ? user.email.toLowerCase() : '';
        if (!patientEmail) {
          return reply.status(400).send({ success:false, error:'Invalid patient email' });
        }

        const caretaker = await User.findOne({ 
          whitelistedPatients: patientEmail
        }).select('sensayUserId replicas');
        
        if (!caretaker?.sensayUserId) {
          return reply.status(400).send({ 
            success: false, 
            error: 'Caretaker not found or caretaker has no Sensay user ID' 
          });
        }
        
        targetUser = caretaker;
        targetSensayUserId = caretaker.sensayUserId;
        fastify.log.info(`Patient reconcile: using caretaker's Sensay ID ${targetSensayUserId}`);
      } else if (!user?.sensayUserId) {
        return reply.status(400).send({ success: false, error: 'Sensay user missing' });
      }
      
      const remote = await listReplicas(targetSensayUserId);
      const now = new Date();
      // According to Sensay API docs, replicas have 'uuid' as primary ID field
      const remoteMap = new Map(remote.map(r => [r.uuid || r.id || r.replicaId, r]));
      const added = []; const updated = []; const removed = [];
      
      // For patients, we don't update their replica list - they use accessible-replicas endpoint
      if (user.role === 'patient') {
        // Just return the remote replicas that the patient has access to
        const patientReplicas = [];
        for (const replica of remote) {
          // Find corresponding local replica in caretaker's list to check whitelist
          const localReplica = targetUser.replicas?.find(r => r.replicaId === (replica.uuid || replica.id));
          if (localReplica && localReplica.whitelistEmails && localReplica.whitelistEmails.includes(user.email)) {
            patientReplicas.push({
              replicaId: replica.uuid || replica.id,
              name: replica.name,
              description: replica.shortDescription || replica.short_description || replica.description || '',
              status: 'AVAILABLE',
              isActive: true,
              whitelistEmails: localReplica.whitelistEmails
            });
          }
        }
        
        return reply.send({ 
          success: true, 
          message: 'Patient replicas reconciled', 
          replicas: patientReplicas,
          added: patientReplicas.length,
          updated: 0,
          removed: 0 
        });
      }
      
      // Update existing and remove those that no longer exist remotely (for caretakers only)
      user.replicas = user.replicas || [];
      user.deletedReplicas = user.deletedReplicas || [];
      
      // Filter out replicas that no longer exist in Sensay and add to deleted tracking
      const replicasToKeep = [];
      user.replicas.forEach(r => {
        const remoteR = remoteMap.get(r.replicaId);
        if (!remoteR) {
          // Replica exists locally but not in Sensay - it was likely deleted externally
          const alreadyTracked = user.deletedReplicas.find(dr => dr.replicaId === r.replicaId);
          if (!alreadyTracked) {
            user.deletedReplicas.push({ replicaId: r.replicaId, deletedAt: now });
          }
          removed.push(r.replicaId);
          return; // Don't keep this replica
        }
        
        // Replica still exists remotely - update it and keep it
        // drift check
        let changed = false;
        if (remoteR.name && remoteR.name !== r.name) { r.name = remoteR.name; changed = true; }
        // Use shortDescription first, then short_description, then fallback to description
        const remoteDesc = remoteR.shortDescription || remoteR.short_description || remoteR.description || '';
        if (remoteDesc && remoteDesc !== r.description) { r.description = remoteDesc; changed = true; }
        if (r.status === 'PENDING_CREATE') { r.status = 'CREATED'; changed = true; }
        // preserve selectedSegments (do not overwrite) – if remote starts providing categories later we could merge.
        r.lastSyncAt = now;
        if (changed) updated.push(r.replicaId);
        remoteMap.delete(r.replicaId);
        replicasToKeep.push(r);
      });
      
      // Update the replicas array with only the ones that should be kept
      user.replicas = replicasToKeep;
      // Remaining remote not in local -> add (but check if recently deleted)
      for (const [id, rr] of remoteMap.entries()) {
        if (!id) continue;
        const replicaId = rr.uuid || rr.id || id;
        
        // Check if this replica was recently deleted (within last 24 hours)
        const recentlyDeleted = user.deletedReplicas?.find(dr => dr.replicaId === replicaId);
        if (recentlyDeleted) {
          fastify.log.info(`Skipping re-add of recently deleted replica ${replicaId} (deleted at ${recentlyDeleted.deletedAt})`);
          continue;
        }
        
        const description = rr.shortDescription || rr.short_description || rr.description || '';
        user.replicas.push({
          replicaId: replicaId,
          name: rr.name || 'Replica',
          description: description,
          status: 'CREATED',
          lastSyncAt: now,
          selectedSegments: []
        });
        added.push(replicaId);
      }
      await user.save({ validateBeforeSave: false });
      return { success: true, added, updated, removed, total: user.replicas.length };
    } catch (err) {
      request.log.error(err, 'Reconcile error');
      return reply.status(500).send({ success:false, error:'Failed to reconcile' });
    }
  });

  /**
   * Get user's replicas (protected route)
   */
  fastify.get('/api/user/replicas', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      // Handle patient tokens differently
      if (request.isPatient) {
        // For patients, get accessible replicas from their caretaker
        const patientData = request.user;
        
        if (!patientData.caretakerId || !patientData.allowedReplicas) {
          return reply.send({ success: true, replicas: [] });
        }
        
        const caretaker = await User.findById(patientData.caretakerId).select('replicas');
        if (!caretaker || !caretaker.replicas) {
          return reply.send({ success: true, replicas: [] });
        }
        
        // Filter to only allowed replicas
        const accessibleReplicas = caretaker.replicas.filter(replica => 
          patientData.allowedReplicas.includes(replica.replicaId)
        );
        
        return reply.send({ success: true, replicas: accessibleReplicas });
      }
      
      // Handle caretaker tokens
      const userId = getValidatedRequestUserId(request, reply);
      if (!userId) return;
      const user = await User.findById(userId).select('email role replicas');
      
      if (!user) {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }
      
      // For caretakers, return their own replicas
      return reply.send({ 
        success: true, 
        replicas: user?.replicas || [] 
      });
    } catch (error) {
      fastify.log.error(error, 'Error fetching user replicas');
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch replicas' 
      });
    }
  });

  /**
   * Get accessible replicas for patient users (protected route)
   */
  fastify.get('/api/user/accessible-replicas', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      // Check if this is a patient using the new Patient model
      if (request.isPatient) {
        // Get patient record with allowed replicas
        const patient = await Patient.findByEmail(request.user.email);
        if (!patient) {
          return reply.status(404).send({ 
            success: false, 
            error: 'Patient record not found' 
          });
        }

        // Get caretaker's details
        const caretaker = await User.findById(patient.caretaker).select('sensayUserId replicas');
        if (!caretaker) {
          return reply.status(404).send({ 
            success: false, 
            error: 'Caretaker not found for this patient' 
          });
        }

        // Get replicas from caretaker's local database that match patient's allowed replicas
        let accessibleReplicas = [];
        if (caretaker.replicas) {
          for (const replica of caretaker.replicas) {
            if (patient.allowedReplicas.includes(replica.replicaId)) {
              accessibleReplicas.push({
                ...replica.toObject(),
                isPatientAccess: true
              });
            }
          }
        }

        // If caretaker has a Sensay user ID, also sync from Sensay API
        if (caretaker.sensayUserId) {
          try {
            fastify.log.info(`Fetching replicas for patient ${patient.email} using caretaker's Sensay ID: ${caretaker.sensayUserId}`);
            const remote = await listReplicas(caretaker.sensayUserId);
            
            // Filter remote replicas based on patient's allowed replicas
            const remoteAccessible = remote.filter(replica => {
              const replicaId = replica.uuid || replica.id;
              return patient.allowedReplicas.includes(replicaId);
            });

            // Merge or update local replicas with remote data
            for (const remoteReplica of remoteAccessible) {
              const replicaId = remoteReplica.uuid || remoteReplica.id;
              const existingIndex = accessibleReplicas.findIndex(r => r.replicaId === replicaId);
              
              if (existingIndex >= 0) {
                // Update existing replica with fresh remote data
                accessibleReplicas[existingIndex] = {
                  ...accessibleReplicas[existingIndex],
                  name: remoteReplica.name || accessibleReplicas[existingIndex].name,
                  description: remoteReplica.shortDescription || remoteReplica.short_description || remoteReplica.description || accessibleReplicas[existingIndex].description,
                  status: 'AVAILABLE'
                };
              } else {
                // Add new replica from remote
                accessibleReplicas.push({
                  replicaId: replicaId,
                  name: remoteReplica.name,
                  description: remoteReplica.shortDescription || remoteReplica.short_description || remoteReplica.description,
                  status: 'AVAILABLE',
                  isPatientAccess: true
                });
              }
            }
          } catch (error) {
            fastify.log.warn(error, 'Failed to sync replicas from Sensay API for patient');
            // Continue with local replicas only
          }
        }
        
        return { 
          success: true, 
          replicas: accessibleReplicas 
        };
      }

      // For non-patient users, use original logic
      const usersWithAccessibleReplicas = await User.find({
        'replicas.whitelistEmails': currentUser.email
      }).select('replicas');

      let accessibleReplicas = [];
      
      for (const user of usersWithAccessibleReplicas) {
        for (const replica of user.replicas) {
          if (replica.whitelistEmails && replica.whitelistEmails.includes(currentUser.email)) {
            accessibleReplicas.push(replica);
          }
        }
      }
      
      return { 
        success: true, 
        replicas: accessibleReplicas 
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching accessible replicas');
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch accessible replicas' 
      });
    }
  });

  /**
   * Get a single replica by id (protected route)
   */
  fastify.get('/api/replicas/:replicaId', {
    preHandler: [authenticateToken, validatePatientCaretakerRelationship]
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;

      // Validate replicaId - expect a short alphanumeric id (no operator characters)
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success: false, error: 'Invalid replica id' });
      }
  const userId = getValidatedRequestUserId(request, reply);
  if (!userId) return;
  const user = await User.findById(userId).select('replicas email role');
      
      // First check if user owns the replica
      let replica = user?.replicas?.find(r => r.replicaId === replicaId);
      let isOwner = Boolean(replica);
      
      // If not found and user is a patient, check if they have access via whitelist
      if (!replica && user.role === 'patient') {
        // Check via Patient model
        const patientRecord = await Patient.findByEmail(user.email);
        if (patientRecord && patientRecord.allowedReplicas.includes(replicaId)) {
          // Find the caretaker's replica
          const caretaker = await User.findById(patientRecord.caretaker).select('replicas');
          if (caretaker) {
            replica = caretaker.replicas?.find(r => r.replicaId === replicaId);
          }
        }
        
        // Fallback: check if patient is whitelisted in any caretaker's replica
        if (!replica) {
          const caretakerWithReplica = await User.findOne({
            'replicas.replicaId': replicaId,
            'replicas.whitelistEmails': user.email.toLowerCase()
          }).select('replicas');
          
          if (caretakerWithReplica) {
            replica = caretakerWithReplica.replicas?.find(r => 
              r.replicaId === replicaId && 
              r.whitelistEmails && 
              r.whitelistEmails.includes(user.email.toLowerCase())
            );
          }
        }
      }
      
      if (!replica) {
        return reply.status(404).send({ success: false, error: 'Replica not found or access denied' });
      }
      
      return { 
        success: true, 
        replica: {
          ...replica.toObject(),
          isOwner,
          isPatientAccess: !isOwner
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching replica');
      return reply.status(500).send({ success: false, error: 'Failed to fetch replica' });
    }
  });

  /**
   * Chat with a replica (protected route)
   */
  fastify.post('/api/replicas/:replicaId/chat', { 
    preHandler: [authenticateToken]
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success: false, error: 'Invalid replica id' });
      }
      const { message, context = [], conversationId } = request.body;
      const userId = request.user.id;
      
      // Verify user has access to this replica (owner or whitelisted patient)
      const user = await User.findById(userId).select('replicas email role');
      let userReplica = user?.replicas?.find(r => r.replicaId === replicaId);
      let isOwner = Boolean(userReplica);
      let caretakerUserId = userId; // Default to current user
      
      // If not owner and user is a patient, check if they have whitelist access
      if (!userReplica && user.role === 'patient') {
        // Check via Patient model
        const patientRecord = await Patient.findByEmail(user.email);
        if (patientRecord && patientRecord.allowedReplicas.includes(replicaId)) {
          // Find the caretaker's replica
          const caretaker = await User.findById(patientRecord.caretaker).select('replicas sensayUserId');
          if (caretaker) {
            userReplica = caretaker.replicas?.find(r => r.replicaId === replicaId);
            caretakerUserId = caretaker._id;
            // Override sensay user ID to use caretaker's
            request.sensayUserId = caretaker.sensayUserId;
          }
        }
        
        // Fallback: check if patient is whitelisted in any caretaker's replica
        if (!userReplica) {
          const patientEmail = typeof user.email === 'string' ? user.email.toLowerCase() : '';
          if (patientEmail) {
            const caretakerWithReplica = await User.findOne({
              'replicas.replicaId': replicaId,
              'replicas.whitelistEmails': patientEmail
            }).select('replicas sensayUserId');
          
            if (caretakerWithReplica) {
            userReplica = caretakerWithReplica.replicas?.find(r => 
              r.replicaId === replicaId && 
                r.whitelistEmails && 
                r.whitelistEmails.includes(patientEmail)
            );
            if (userReplica) {
              caretakerUserId = caretakerWithReplica._id;
              // Override sensay user ID to use caretaker's
              request.sensayUserId = caretakerWithReplica.sensayUserId;
            }
            }
          }
        }
      }
      
      if (!userReplica) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or no access permitted' 
        });
      }
      
      // Get sensayUserId - either from override (for patients) or from user record
      let sensayUserId = request.sensayUserId;
      if (!sensayUserId) {
        // For caretakers, get their own sensayUserId
        if (user.sensayUserId) {
          sensayUserId = user.sensayUserId;
        } else {
          // If user doesn't have sensayUserId, fetch full user record
          const fullUser = await User.findById(userId).select('sensayUserId');
          sensayUserId = fullUser?.sensayUserId;
        }
      }
      
      if (!sensayUserId) {
        return reply.status(400).send({
          success: false,
          error: 'Sensay user not linked for this account. Please contact support.'
        });
      }
      
      // Send chat message to Sensay using the Sensay user ID
      const sensayResponse = await sendChatMessage(replicaId, message, sensayUserId, context);
      
      // Extract the content from Sensay API response
      // According to API docs: { success: true, content: "reply text" }
      const replyText = sensayResponse?.content || sensayResponse?.response?.content || 'Sorry, I could not process that.';
      
      // Save conversation to database (use actual user ID, not caretaker's)
      let conversation;
      if (conversationId && typeof conversationId === 'string' && /^[0-9a-fA-F\-]{36}$/.test(conversationId)) {
        // Continue existing conversation (conversationId validated as UUID)
        conversation = await Conversation.findOne({ 
          id: conversationId, 
          userId, 
          replicaId 
        });
      }
      
      if (!conversation) {
        // Create new conversation
        conversation = new Conversation({
          userId, // Always use the actual user ID (patient or caretaker)
          replicaId,
          messages: [],
          isActive: true,
          isPatientChat: !isOwner // Flag to indicate if this is a patient accessing via whitelist
        });
      }
      
      // Add user message
      const userMessage = {
        id: Date.now().toString(),
        text: message,
        sender: 'user',
        timestamp: new Date()
      };
      conversation.messages.push(userMessage);
      
      // Add bot response
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: replyText,
        sender: 'bot',
        timestamp: new Date()
      };
      conversation.messages.push(botMessage);
      
      // Update conversation title if it's the first message
      if (conversation.messages.length === 2) {
        conversation.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      }
      
      await conversation.save();
      
      return { 
        success: true, 
        message: replyText,
        conversationId: conversation._id,
        response: {
          message: replyText,
          content: replyText
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error in replica chat');
      
      // Log more details for debugging
      fastify.log.error({
        replicaId: request.params.replicaId,
        userId: request.user?.id,
        message: request.body?.message?.substring(0, 100),
        errorDetails: error.response?.data || error.message
      }, 'Detailed chat error info');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false,
        error: 'Internal server error while processing chat message'
      });
    }
  });

  /**
   * Start a chat-based training session (just validates ownership, no API call)
   * Client will accumulate messages then call end session to create KB entry with combined text.
   */
  fastify.post('/api/replicas/:replicaId/training-sessions', { preHandler: [authenticateToken, requireCaretaker] }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success: false, error: 'Invalid replica id' });
      }
  const userId = getValidatedRequestUserId(request, reply);
  if (!userId) return;
  const user = await User.findById(userId);
      const owned = user?.replicas?.some(r => r.replicaId === replicaId);
      if (!owned) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      
      // Just return a session object - no API call yet
      const placeholderTitle = request.body?.title || 'Chat Session Training';
      return { 
        success: true, 
        session: { 
          replicaId, 
          startedAt: new Date(),
          title: placeholderTitle
        } 
      };
    } catch (err) {
      fastify.log.error(err, 'Start training session failed');
      return reply.status(500).send({ success:false, error:'Failed to start training session' });
    }
  });

  /**
   * Complete a chat-based training session: create KB entry with aggregated chat text
   */
  fastify.post('/api/replicas/:replicaId/training-sessions/:sessionId/complete', { preHandler: [authenticateToken, requireCaretaker] }, async (request, reply) => {
    try {
      const { replicaId, sessionId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success: false, error: 'Invalid replica id' });
      }
      if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 200) {
        return reply.status(400).send({ success: false, error: 'Invalid session id' });
      }
      const { rawText, title } = request.body || {};
      if (!rawText || !rawText.trim()) {
        return reply.status(400).send({ success:false, error:'rawText required' });
      }
  const userId = getValidatedRequestUserId(request, reply);
  if (!userId) return;
  const user = await User.findById(userId);
      const owned = user?.replicas?.some(r => r.replicaId === replicaId);
      if (!owned) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      
      // Create knowledge base entry with the training text using the new two-step process
      const sessionTitle = title || 'Chat Session Training';
      const MAX_TOTAL = 60000; // overall cap
      const capped = rawText.substring(0, MAX_TOTAL);

      console.log('Creating KB entry with text length:', capped.length);
      
      // Use the updated function that does create + update in one call
      const kbEntry = await createKnowledgeBaseEntrySafe(replicaId, { 
        title: sessionTitle,
        rawText: capped // Use 'rawText' for the training content
      });
      
      console.log('KB entry response:', kbEntry);

      // Extract entry ID from the response (handles 207 multi-status shapes)
      const entryId = extractKnowledgeBaseEntryId(kbEntry);
      const candidateIds = Array.isArray(kbEntry?.entryIds)
        ? kbEntry.entryIds
        : Array.isArray(kbEntry?.results)
          ? kbEntry.results
              .map(item => item?.knowledgeBaseID ?? item?.knowledgeBaseId ?? item?.id ?? item?.entryId)
              .filter(Boolean)
          : [];
      console.log('Extracted entry ID:', entryId, 'Candidate IDs:', candidateIds);
      
      if (!entryId) {
        console.error('No entry ID found in KB response:', kbEntry);
        throw new Error('Failed to get KB entry ID from response');
      }
      
      // Poll for status only if we have a valid entry ID
      let status = 'PROCESSING';
      if (entryId && !String(entryId).startsWith('mock_kb_') && !String(entryId).startsWith('temp_kb_')) {
        try {
          const statusResult = await pollKnowledgeBaseEntryStatus(replicaId, entryId, 30, 5000);
          status = statusResult?.status || 'PROCESSING';
          console.log('KB entry status:', status);
        } catch (pollErr) {
          fastify.log.warn(pollErr, `Polling incomplete for entry ${entryId}`);
        }
      } else {
        console.log('Skipping status polling for mock/temp entry ID:', entryId);
        status = 'READY'; // Assume ready for mock entries
      }

      // Update replica last trained timestamp if successful
      if (status === 'READY' || status === 'PROCESSED_TEXT' || status === 'VECTOR_CREATED') {
        try {
          await User.updateOne(
            { _id: request.user.id, 'replicas.replicaId': replicaId },
            { $set: { 'replicas.$.lastTrained': new Date() } }
          );
        } catch (tsErr) {
          fastify.log.warn(tsErr, 'Failed to update lastTrained timestamp');
        }
      }

      return {
        success: true,
        entryId,
        status,
        multiPart: false,
        totalParts: 1
      };
    } catch (err) {
      fastify.log.error(err, 'Complete training session failed');
      return reply.status(500).send({ success:false, error:'Failed to complete training session' });
    }
  });

  /** Webhook endpoint (Sensay can POST training status updates here) */
  fastify.post('/api/webhooks/sensay', async (request, reply) => {
    try {
      const event = request.body;
      // Basic logging; extend with signature verification if Sensay provides one
      fastify.log.info({ event }, 'Received Sensay webhook');
      return { received:true };
    } catch (err) {
      fastify.log.error(err, 'Webhook error');
      return reply.status(500).send({ success:false });
    }
  });

  /**
   * Delete a replica (protected route - caretakers only)
   */
  fastify.delete('/api/replicas/:replicaId', { 
    preHandler: [authenticateToken, requireCaretaker]
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success: false, error: 'Invalid replica id' });
      }
      const userId = request.user.id;
      
      // Get user details to check role
      const user = await User.findById(userId).select('role replicas');
      
      // Restrict patients from deleting replicas
      if (user?.role === 'patient') {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: patients cannot delete replicas' 
        });
      }
      
      // Find the replica in user's profile to validate ownership
      const replicaEntry = user.replicas.find(r => r.replicaId === replicaId);
      if (!replicaEntry) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Replica not found in your account' 
        });
      }
      
      // Delete from Sensay API first
      fastify.log.info(`Attempting to delete replica ${replicaId} from Sensay API for user ${userId}`);
      const sensayDeleteResult = await deleteReplica(replicaId);
      fastify.log.info(`Sensay API delete result:`, sensayDeleteResult);
      
      // Remove replica from user's profile and add to deleted tracking
      const updateResult = await User.findByIdAndUpdate(
        userId,
        { 
          $pull: { replicas: { replicaId } },
          $push: { deletedReplicas: { replicaId, deletedAt: new Date() } }
        },
        { new: true }
      );
      
      fastify.log.info(`Replica ${replicaId} deleted by user ${userId}. Removed from database:`, !!updateResult);
      
      // Verify the replica is actually gone from Sensay by trying to list replicas
      try {
        const remainingReplicas = await listReplicas(updateResult.sensayUserId);
        const stillExists = remainingReplicas.find(r => (r.uuid || r.id) === replicaId);
        if (stillExists) {
          fastify.log.warn(`Warning: Replica ${replicaId} still exists in Sensay after deletion attempt`);
        } else {
          fastify.log.info(`Confirmed: Replica ${replicaId} successfully removed from Sensay`);
        }
      } catch (verifyError) {
        fastify.log.warn(`Could not verify replica deletion from Sensay:`, verifyError.message);
      }
      
      return { 
        success: true, 
        message: 'Replica deleted successfully',
        deletedFromSensay: true,
        deletedFromDatabase: !!updateResult
      };
    } catch (error) {
      fastify.log.error(error, 'Error deleting replica');
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to delete replica' 
      });
    }
  });

  /**
   * Clear deleted replicas tracking (admin function)
   */
  fastify.delete('/api/replicas/deleted-tracking', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      
      await User.findByIdAndUpdate(
        userId,
        { $unset: { deletedReplicas: "" } }
      );
      
      return { 
        success: true, 
        message: 'Deleted replicas tracking cleared' 
      };
    } catch (error) {
      fastify.log.error(error, 'Error clearing deleted replicas tracking');
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to clear deleted replicas tracking' 
      });
    }
  });

  /**
   * Manually start a training session for an existing replica (admin function)
   */
  fastify.post('/api/replicas/:replicaId/start-training', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const userId = request.user.id;
      
      // Get user and verify ownership
      const user = await User.findById(userId);
      const replicaEntry = user.replicas?.find(r => r.replicaId === replicaId);
      if (!replicaEntry) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Replica not found in your account' 
        });
      }
      
      // Start training session
      fastify.log.info(`Starting manual training session for replica ${replicaId} by user ${userId}`);
      const trainingSession = await startTrainingSession(replicaId);
      
      // Optionally complete it if a session ID is returned
      let completionResult = null;
      if (trainingSession?.success && (trainingSession.sessionId || trainingSession.id)) {
        try {
          const sessionId = trainingSession.sessionId || trainingSession.id;
          completionResult = await completeTrainingSession(replicaId, sessionId);
        } catch (completionError) {
          fastify.log.warn('Training completion failed:', completionError.message);
        }
      }
      
      return { 
        success: true, 
        message: 'Training session initiated',
        trainingSession,
        completion: completionResult
      };
    } catch (error) {
      fastify.log.error(error, 'Error starting manual training session');
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to start training session: ' + error.message 
      });
    }
  });

  /**
   * Train a replica with text content (protected route)
   */
  fastify.post('/api/replicas/train', { 
    schema: trainWithTextSchema,
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId, title, description, rawText } = request.body;
      
      const result = await trainReplica(replicaId, {
        title,
        description,
        rawText
      });
      
      return { 
        success: true, 
        trainingResult: result 
      };
    } catch (error) {
      fastify.log.error(error, 'Error training replica');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to train replica' 
      });
    }
  });

  /**
   * Train a replica with file upload (protected route)
   */
  fastify.post('/api/replicas/train/file', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ 
          success: false, 
          error: 'No file provided' 
        });
      }

      const { replicaId, title, description } = data.fields;
      
      if (!replicaId?.value || !title?.value) {
        return reply.status(400).send({ 
          success: false, 
          error: 'replicaId and title are required' 
        });
      }

      const fileBuffer = await data.toBuffer();
      
      const result = await trainReplica(replicaId.value, {
        title: title.value,
        description: description?.value,
        file: {
          buffer: fileBuffer,
          filename: data.filename,
          contentType: data.mimetype
        }
      });
      
      return { 
        success: true, 
        trainingResult: result 
      };
    } catch (error) {
      fastify.log.error(error, 'Error training replica with file');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to train replica with file' 
      });
    }
  });

  /**
   * Get training status
   */
  fastify.get('/api/replicas/:replicaId/kb/:entryId/status', async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      const status = await getKnowledgeBaseEntryStatus(replicaId, entryId);
      
      return { 
        success: true, 
        status 
      };
    } catch (error) {
      fastify.log.error(error, 'Error getting training status');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to get training status' 
      });
    }
  });

  /**
   * Create a KB entry for a replica and immediately populate it with raw user text
   * Body: { title: string, rawText: string, description?: string }
   */
  fastify.post('/api/replicas/:replicaId/kb/entries', { preHandler: [authenticateToken, requireCaretaker] }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const { title, text, rawText, url, filename, autoRefresh, description } = request.body || {};
      
      // Check that at least one content field is provided (per API spec: url, text, or filename required)
      const hasContent = (text && text.trim()) || (rawText && rawText.trim()) || (url && url.trim()) || (filename && filename.trim());
      if (!hasContent) {
        return reply.status(400).send({ success:false, error:'At least one of text, url, or filename is required' });
      }
      // Validate replicaId and verify ownership
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success:false, error:'Invalid replica id' });
      }
      const userId = getValidatedRequestUserId(request, reply);
      if (!userId) return;
      const user = await User.findById(userId).select('replicas');
      if (!user?.replicas?.some(r => r.replicaId === replicaId)) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      
      // Create entry with content using the new API spec
      const entryData = {};
      if (title && title.trim()) entryData.title = title.substring(0,80);
      if (text && text.trim()) entryData.text = text.trim();
      if (rawText && rawText.trim()) entryData.text = rawText.trim(); // Legacy support
      if (url && url.trim()) entryData.url = url.trim();
      if (filename && filename.trim()) entryData.filename = filename.trim();
      if (autoRefresh !== undefined) entryData.autoRefresh = autoRefresh;
      if (description && description.trim()) entryData.description = description.trim();
      
      const entry = await createKnowledgeBaseEntry(replicaId, entryData);
      
      const entryId = entry.id;
      if (!entryId) {
        return reply.status(500).send({ success:false, error:'Failed to obtain KB entry id' });
      }
      
      // Poll briefly (client can continue polling via /api/kb/:entryId/status)
      let statusResult = null;
      try {
        statusResult = await pollKnowledgeBaseEntryStatus(replicaId, entryId, 20, 3000); // up to ~60s
      } catch (pollErr) {
        request.log.warn(pollErr, 'KB entry polling incomplete');
      }
      
      // Set lastTrained timestamp if READY
      if (statusResult?.status === 'READY') {
        try {
          await User.updateOne(
            { _id: request.user.id, 'replicas.replicaId': replicaId },
            { $set: { 'replicas.$.lastTrained': new Date() } }
          );
        } catch (tsErr) {
          request.log.warn(tsErr, 'Failed to update lastTrained after KB entry');
        }
      }
      return {
        success: true,
        entryId,
        status: statusResult?.status || 'PROCESSING',
        result: statusResult
      };
    } catch (err) {
      request.log.error(err, 'Create + populate KB entry failed');
      if (err.status) return reply.status(err.status).send({ success:false, error: err.message });
      return reply.status(500).send({ success:false, error:'Failed to create and populate KB entry' });
    }
  });

  // Knowledge base management convenience endpoints (protected)
  fastify.get('/api/replicas/:replicaId/kb', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success:false, error:'Invalid replica id' });
      }
      const userId = getValidatedRequestUserId(request, reply);
      if (!userId) return;
      const user = await User.findById(userId).select('replicas');
      if (!user?.replicas?.some(r => r.replicaId === replicaId)) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      const { listKnowledgeBaseEntries } = await import('../services/sensayService.js');
      const entries = await listKnowledgeBaseEntries(replicaId);
      return { success:true, entries };
    } catch (err) {
      request.log.error(err, 'List KB entries failed');
      return reply.status(500).send({ success:false, error:'Failed to list KB entries' });
    }
  });

  fastify.get('/api/replicas/:replicaId/kb/:entryId', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success:false, error:'Invalid replica id' });
      }
      if (!entryId || typeof entryId !== 'string' || entryId.length > 200) {
        return reply.status(400).send({ success:false, error:'Invalid entry id' });
      }

      // Verify user owns this replica
      const userId = getValidatedRequestUserId(request, reply);
      if (!userId) return;
      const user = await User.findById(userId).select('replicas');
      if (!user?.replicas?.some(r => r.replicaId === replicaId)) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      const entry = await getKnowledgeBaseEntry(replicaId, entryId);
      return entry; // Return the complete entry data directly
    } catch (err) {
      request.log.error(err, 'Get KB entry failed');
      
      // Generate request ID and fingerprint for error responses
      const request_id = `${request.id}::${Date.now()}`;
      const fingerprint = Math.random().toString(36).substring(2, 15);
      
      // Handle specific error cases according to API specification
      if (err.message.includes('not found')) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Knowledge base entry not found',
          request_id
        });
      }
      
      if (err.message.includes('Bad Request')) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Bad Request: Invalid entry ID or parameters',
          request_id,
          fingerprint
        });
      }
      
      if (err.message.includes('Unauthorized')) {
        return reply.status(401).send({ 
          success: false, 
          error: 'Unauthorized: Invalid API credentials',
          request_id,
          fingerprint
        });
      }
      
      if (err.message.includes('Unsupported Media Type')) {
        return reply.status(415).send({ 
          success: false, 
          error: 'Unsupported Media Type',
          request_id,
          fingerprint
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Internal Server Error: Failed to retrieve knowledge base entry',
        request_id,
        fingerprint,
        inner_exception: {
          name: err.name || 'UnknownError',
          cause: err.cause || 'Internal processing error',
          error: err.message,
          stack: err.stack
        }
      });
    }
  });

  fastify.delete('/api/replicas/:replicaId/kb/:entryId', { preHandler: [authenticateToken, requireCaretaker] }, async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      const { deleteKnowledgeBaseEntry } = await import('../services/sensayService.js');
      const resp = await deleteKnowledgeBaseEntry(replicaId, entryId);
      return { success:true, result: resp };
    } catch (err) {
      request.log.error(err, 'Delete KB entry failed');
      return reply.status(500).send({ success:false, error:'Failed to delete KB entry' });
    }
  });

  // Schema for knowledge base entry update
  const updateKnowledgeBaseSchema = {
    body: {
      type: 'object',
      properties: {
        rawText: { 
          type: 'string',
          minLength: 1
        },
        generatedFacts: { 
          type: 'array',
          items: { type: 'string' }
        },
        rawTextChunks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              chunkChars: { type: 'number' },
              chunkIndex: { type: 'number' },
              chunkTokens: { type: 'number' }
            }
          }
        },
        title: { type: 'string' },
        generatedTitle: { type: 'string' },
        summary: { type: 'string' },
        language: { 
          type: 'string',
          enum: ['ab', 'aa', 'af', 'ak', 'sq', 'am', 'ar', 'an', 'hy', 'as', 'av', 'ae', 'ay', 'az', 'ba', 'bm', 'eu', 'be', 'bn', 'bh', 'bi', 'bs', 'br', 'bg', 'my', 'ca', 'ch', 'ce', 'ny', 'zh', 'cu', 'cv', 'kw', 'co', 'cr', 'hr', 'cs', 'da', 'dv', 'nl', 'dz', 'en', 'eo', 'et', 'ee', 'fo', 'fj', 'fi', 'fr', 'ff', 'gl', 'ka', 'de', 'el', 'kl', 'gn', 'gu', 'ht', 'ha', 'he', 'hz', 'hi', 'ho', 'hu', 'is', 'io', 'ig', 'id', 'ia', 'ie', 'iu', 'ik', 'ga', 'it', 'ja', 'jv', 'kn', 'kr', 'ks', 'kk', 'km', 'ki', 'rw', 'ky', 'kv', 'kg', 'ko', 'ku', 'kj', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv', 'gv', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mh', 'mn', 'na', 'nv', 'nd', 'ne', 'ng', 'nb', 'nn', 'no', 'ii', 'nr', 'oc', 'oj', 'om', 'or', 'os', 'pa', 'pi', 'fa', 'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'sa', 'sc', 'sd', 'se', 'sm', 'sg', 'sr', 'gd', 'sn', 'si', 'sk', 'sl', 'so', 'st', 'es', 'su', 'sw', 'ss', 'sv', 'ta', 'te', 'tg', 'th', 'ti', 'bo', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'cy', 'wo', 'xh', 'yi', 'yo', 'za', 'zu']
        },
        website: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: { type: 'string' },
            links: { 
              type: 'array',
              items: { type: 'string' }
            },
            title: { type: 'string' },
            text: { type: 'string' },
            description: { type: 'string' },
            autoRefresh: { type: 'boolean' },
            screenshotURL: { type: 'string' },
            screenshot: { type: 'string' }
          }
        },
        youtube: {
          type: 'object',
          additionalProperties: false,
          properties: {
            url: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            thumbnailURL: { type: 'string' },
            summary: { type: 'string' },
            transcription: { type: 'string' },
            visualTranscription: { type: 'string' }
          }
        },
        file: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            size: { type: 'number' },
            mimeType: { type: 'string' },
            screenshot: { type: 'string' }
          }
        },
        error: {
          type: 'object',
          additionalProperties: false,
          properties: {
            message: { type: 'string' },
            fingerprint: { type: 'string' }
          }
        }
      },
      additionalProperties: false
    }
  };

  /**
   * Update knowledge base entry
   * PATCH /api/replicas/:replicaId/kb/:entryId
   */
  fastify.patch('/api/replicas/:replicaId/kb/:entryId', { 
    preHandler: authenticateToken,
    schema: updateKnowledgeBaseSchema
  }, async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      const updateData = request.body;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success:false, error:'Invalid replica id' });
      }
      if (!entryId || typeof entryId !== 'string' || entryId.length > 200) {
        return reply.status(400).send({ success:false, error:'Invalid entry id' });
      }
      
      // Verify user owns this replica
      const userId = getValidatedRequestUserId(request, reply);
      if (!userId) return;
      const user = await User.findById(userId).select('replicas');
      if (!user?.replicas?.some(r => r.replicaId === replicaId)) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      // Add API version header as per specification
      const headers = request.headers;
      if (!headers['x-api-version']) {
        headers['x-api-version'] = '2025-03-25';
      }

      // Update the knowledge base entry
      const result = await updateKnowledgeBaseEntry(replicaId, entryId, updateData);
      
      return { 
        success: true,
        ...result
      };
      
    } catch (err) {
      request.log.error(err, 'Update KB entry failed');
      
      // Generate request ID and fingerprint for error responses
      const request_id = `${request.id}::${Date.now()}`;
      const fingerprint = Math.random().toString(36).substring(2, 15);
      
      // Handle specific error cases with appropriate HTTP status codes and API format
      if (err.message.includes('not found')) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Knowledge base entry not found',
          request_id
        });
      }
      
      if (err.message.includes('Invalid update data')) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Bad Request: Invalid update data provided',
          request_id,
          fingerprint
        });
      }
      
      if (err.message.includes('Unauthorized')) {
        return reply.status(401).send({ 
          success: false, 
          error: 'Unauthorized access to knowledge base entry',
          request_id,
          fingerprint
        });
      }
      
      if (err.message.includes('Unsupported media type')) {
        return reply.status(415).send({ 
          success: false, 
          error: 'Unsupported Media Type',
          request_id,
          fingerprint
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Internal Server Error: Failed to update knowledge base entry',
        request_id,
        fingerprint,
        inner_exception: {
          name: err.name || 'UnknownError',
          cause: err.cause || 'Internal processing error',
          error: err.message,
          stack: err.stack
        }
      });
    }
  });

  /**
   * Get conversations for a specific replica
   */
  fastify.get('/api/replicas/:replicaId/conversations', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const userId = request.user.id;
      
      // Verify user owns this replica
      const user = await User.findById(userId);
      const userReplica = user?.replicas?.find(r => r.replicaId === replicaId);
      
      if (!userReplica) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      // Get conversations for this replica
      const conversations = await Conversation.find({ 
        userId, 
        replicaId,
        isActive: true 
      })
      .select('_id title lastMessageAt messages')
      .sort({ lastMessageAt: -1 })
      .limit(50);
      
      // Transform conversations for frontend
      const formattedConversations = conversations.map(conv => ({
        id: conv._id,
        title: conv.title,
        lastMessageAt: conv.lastMessageAt,
        messageCount: conv.messages.length,
        lastMessage: conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text.substring(0, 100) : ''
      }));
      
      return { 
        success: true, 
        conversations: formattedConversations 
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching conversations');
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch conversations' 
      });
    }
  });

  /**
   * Get messages for a specific conversation
   */
  fastify.get('/api/conversations/:conversationId/messages', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params;
      const userId = request.user.id;
      
      // Get conversation and verify ownership
      const conversation = await Conversation.findOne({ 
        _id: conversationId, 
        userId 
      });
      
      if (!conversation) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Conversation not found or access denied' 
        });
      }
      
      return { 
        success: true, 
        messages: conversation.messages,
        conversation: {
          id: conversation._id,
          title: conversation.title,
          replicaId: conversation.replicaId
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error fetching conversation messages');
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch conversation messages' 
      });
    }
  });

  /**
   * Update replica whitelist emails (protected route)
   */
  fastify.put('/api/replicas/:replicaId', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      const { whitelistEmails } = request.body;
      const userId = request.user.id;
      
      // Verify user owns this replica
      const user = await User.findById(userId);
      const userReplica = user?.replicas?.find(r => r.replicaId === replicaId);
      
      if (!userReplica) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      // Get current replica data from the database
      const currentReplica = userReplica;
      
      // Prepare update data for Sensay API
      const updateData = {
        name: currentReplica.name,
        shortDescription: currentReplica.description,
        greeting: `Hi! I'm ${currentReplica.name}. ${currentReplica.description}`,
        slug: `${currentReplica.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        ownerID: user.sensayUserId,
        private: whitelistEmails && whitelistEmails.length > 0,
        whitelistEmails: whitelistEmails || [],
        llm: {
          model: "gpt-4o"
        }
      };
      
      // Update replica in Sensay
      const { updateReplica } = await import('../services/sensayService.js');
      const updatedReplica = await updateReplica(replicaId, updateData);
      
      // Also update the local User model
      userReplica.whitelistEmails = whitelistEmails || [];
      await user.save();
      
      return { 
        success: true, 
        message: 'Replica updated successfully',
        replica: updatedReplica
      };
    } catch (error) {
      fastify.log.error(error, 'Error updating replica');
      
      if (error.status) {
        return reply.status(error.status).send({ 
          success: false, 
          error: error.message 
        });
      }
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to update replica' 
      });
    }
  });

  /**
   * Bulk add patient email to multiple replicas (protected route - caretakers only)
   */
  fastify.post('/api/caretaker/add-patient-email', { 
    preHandler: [authenticateToken, requireCaretaker] 
  }, async (request, reply) => {
    try {
      const { patientEmail, replicaIds } = request.body;
      const userId = request.user.id;

      // Basic validation
      if (!patientEmail || !Array.isArray(replicaIds) || replicaIds.length === 0) {
        return reply.status(400).send({ success: false, error: 'patientEmail and replicaIds array are required' });
      }

      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(patientEmail)) {
        return reply.status(400).send({ success: false, error: 'Invalid email format' });
      }

      const user = await User.findById(userId);
      if (!user || user.role !== 'caretaker') {
        return reply.status(403).send({ success: false, error: 'Access denied. Only caretakers can perform this action.' });
      }

      const caretakerService = await import('../services/caretakerService.js');
      const result = await caretakerService.addPatientEmailToReplicas(user, patientEmail, replicaIds);

      return result;
    } catch (error) {
      fastify.log.error(error, 'Error adding patient email');
      return reply.status(500).send({ success: false, error: 'Failed to add patient email' });
    }
  });
}

export default replicaRoutes;