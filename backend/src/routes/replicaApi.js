import { uploadText, listFiles, sendChatMessage, deleteFile, searchKnowledgeBase, overwriteText, resyncFile } from '../services/supavecService.js';
import { authenticateToken, requireCaretaker, requirePatient, validatePatientCaretakerRelationship, validateSupavecNamespace } from '../middleware/auth.js';
import * as replicaAbstraction from '../services/replicaAbstractionService.js';
import User from '../models/User.js';
import crypto from 'crypto';
import Patient from '../models/Patient.js';
import Conversation from '../models/Conversation.js';
import { REQUIRED_QUESTIONS, OPTIONAL_SEGMENTS, getQuestionText } from '../utils/questionBank.js';

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
      preHandler: [authenticateToken, requireCaretaker]
    }, async (request, reply) => {
      try {
    const { name, description, template, relationship, requiredAnswers, optionalAnswers, selectedSegments, profileImage, coverageScore, greeting: userGreeting, preferredQuestion } = request.body;
        
        // Load user and check permissions
        const user = request.user; // User is already loaded by middleware
        const userId = user.id;
        
        // Disallow patient role from creating replicas
        if (user?.role === 'patient') {
          return reply.status(403).send({ success: false, error: 'Access denied: patients cannot create replicas' });
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
  
        const allTrainingText = trainingTexts.map(t => t.content).join('\n\n');
  
        // Use abstraction service to create replica
        // This will route to Supavec based on migration config
        const abstractionResult = await replicaAbstraction.createReplica(
          {
            name,
            description,
            greeting: userGreeting || `Hello! I'm ${name}.`,
            textContent: [
              {
                title: name,
                content: allTrainingText
              }
            ]
          },
          userId,
          user.email
        );
  
        const replicaData = {
          fileId: abstractionResult.replicaId,
          name,
          description,
          createdAt: new Date(),
          apiSource: abstractionResult.apiSource,
          supavecNamespace: abstractionResult.namespace,
          migrationStatus: 'COMPLETED',
          selectedSegments: selectedSegments || []
        };
        
        await User.findByIdAndUpdate(
          userId,
          { $push: { replicas: replicaData } },
          { new: true }
        );
        
        fastify.log.info(`Replica created via ${abstractionResult.apiSource}`, {
          replicaId: abstractionResult.replicaId,
          userId,
          namespace: abstractionResult.namespace
        });
        
        return { 
          success: true, 
          replica: {
            id: abstractionResult.replicaId,
            ...replicaData,
            migrationStatus: 'COMPLETED'
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
   * Reconcile local replicas with remote API state
   */
  fastify.post('/api/replicas/reconcile', { preHandler: [authenticateToken, requireCaretaker] }, async (request, reply) => {
    try {
      const userId = getValidatedRequestUserId(request, reply);
      if (!userId) return;
      const user = await User.findById(userId).select('email role replicas deletedReplicas');
      
      // For patients, we don't update their replica list - they use accessible-replicas endpoint
      if (user.role === 'patient') {
        const patientReplicas = [];
        return reply.send({ 
          success: true, 
          message: 'Patient replicas reconciled', 
          replicas: patientReplicas,
          added: 0,
          updated: 0,
          removed: 0 
        });
      }
      
      // Use abstraction layer to reconcile with remote API
      fastify.log.info(`Reconciling replicas for user ${userId} via abstraction layer`);
      
      const reconcileResult = await replicaAbstraction.reconcileReplicaState(
        userId,
        user.replicas || []
      );
      
      const now = new Date();
      const added = [];
      const updated = [];
      const removed = [];
      
      user.replicas = user.replicas || [];
      user.deletedReplicas = user.deletedReplicas || [];
      
      // Process replicas missing in local (add them)
      for (const remoteReplica of reconcileResult.missingInLocal) {
        const replicaId = remoteReplica.id || remoteReplica.fileId;
        
        // Check if this replica was recently deleted
        const recentlyDeleted = user.deletedReplicas?.find(dr => dr.replicaId === replicaId);
        if (recentlyDeleted) {
          fastify.log.info(`Skipping re-add of recently deleted replica ${replicaId}`);
          continue;
        }
        
        user.replicas.push({
          fileId: replicaId,
          name: remoteReplica.name || 'Replica',
          description: remoteReplica.description || '',
          apiSource: remoteReplica.apiSource,
          supavecNamespace: remoteReplica.namespace,
          migrationStatus: 'COMPLETED',
          status: 'CREATED',
          lastSyncAt: now,
          selectedSegments: []
        });
        added.push(replicaId);
      }
      
      // Process replicas missing in remote (mark as deleted)
      for (const localReplica of reconcileResult.missingInRemote) {
        const replicaId = localReplica.fileId || localReplica.sensayReplicaId;
        
        // Remove from replicas array
        user.replicas = user.replicas.filter(r => r.fileId !== replicaId);
        
        // Add to deleted tracking
        const alreadyTracked = user.deletedReplicas.find(dr => dr.replicaId === replicaId);
        if (!alreadyTracked) {
          user.deletedReplicas.push({ replicaId, deletedAt: now });
        }
        removed.push(replicaId);
      }
      
      // Update replicas that are in sync
      for (const localReplica of reconcileResult.inSync) {
        const replicaId = localReplica.fileId || localReplica.sensayReplicaId;
        const replicaIndex = user.replicas.findIndex(r => r.fileId === replicaId);
        
        if (replicaIndex >= 0) {
          // Update sync timestamp and migration status
          user.replicas[replicaIndex].lastSyncAt = now;
          user.replicas[replicaIndex].migrationStatus = 'COMPLETED';
          updated.push(replicaId);
        }
      }
      
      await user.save({ validateBeforeSave: false });
      
      fastify.log.info(`Reconciliation complete for user ${userId}`, {
        added: added.length,
        updated: updated.length,
        removed: removed.length,
        total: user.replicas.length
      });
      
      return { 
        success: true, 
        added, 
        updated, 
        removed, 
        total: user.replicas.length,
        summary: reconcileResult.summary
      };
    } catch (err) {
      request.log.error(err, 'Reconcile error');
      return reply.status(500).send({ success: false, error: 'Failed to reconcile' });
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
          patientData.allowedReplicas.includes(replica.fileId)
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
      
      // Use abstraction layer to get replicas from remote API
      // This will sync with Supavec based on migration config
      try {
        const remoteReplicas = await replicaAbstraction.listUserReplicas(userId, user.email);
        
        // Merge remote replicas with local database
        const localReplicasMap = new Map((user.replicas || []).map(r => [r.fileId, r]));
        const mergedReplicas = [];
        
        // Add/update from remote
        for (const remoteReplica of remoteReplicas) {
          const localReplica = localReplicasMap.get(remoteReplica.id || remoteReplica.fileId);
          
          if (localReplica) {
            // Merge local and remote data
            mergedReplicas.push({
              ...localReplica.toObject(),
              apiSource: remoteReplica.apiSource,
              migrationStatus: 'COMPLETED',
              lastSyncAt: new Date()
            });
            localReplicasMap.delete(remoteReplica.id || remoteReplica.fileId);
          } else {
            // Add new replica from remote
            mergedReplicas.push({
              fileId: remoteReplica.id || remoteReplica.fileId,
              name: remoteReplica.name,
              description: remoteReplica.description || '',
              apiSource: remoteReplica.apiSource,
              supavecNamespace: remoteReplica.namespace,
              migrationStatus: 'COMPLETED',
              createdAt: remoteReplica.createdAt || new Date(),
              lastSyncAt: new Date(),
              selectedSegments: []
            });
          }
        }
        
        // Add remaining local replicas (not in remote)
        for (const [, localReplica] of localReplicasMap) {
          mergedReplicas.push({
            ...localReplica.toObject(),
            migrationStatus: localReplica.migrationStatus || 'PENDING'
          });
        }
        
        fastify.log.info(`Fetched ${mergedReplicas.length} replicas for user ${userId}`, {
          remote: remoteReplicas.length,
          local: user.replicas?.length || 0
        });
        
        return reply.send({ 
          success: true, 
          replicas: mergedReplicas
        });
      } catch (remoteError) {
        fastify.log.warn('Failed to fetch remote replicas, falling back to local', {
          error: remoteError.message
        });
        
        // Fallback to local replicas only
        return reply.send({ 
          success: true, 
          replicas: user?.replicas || [] 
        });
      }
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
        const caretaker = await User.findById(patient.caretaker).select('id email replicas');
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
            if (patient.allowedReplicas.includes(replica.fileId)) {
              accessibleReplicas.push({
                ...replica.toObject(),
                isPatientAccess: true
              });
            }
          }
        }
        
        // Use abstraction layer to sync from remote API using caretaker's namespace
        if (caretaker.id) {
          try {
            fastify.log.info(`Fetching replicas for patient ${patient.email} using caretaker's namespace: ${caretaker.id}`);
            
            // Get caretaker's replicas via abstraction layer
            const remoteReplicas = await replicaAbstraction.listUserReplicas(
              caretaker.id,
              caretaker.email
            );
            
            // Filter remote replicas based on patient's allowed replicas
            const remoteAccessible = remoteReplicas.filter(replica => {
              const replicaId = replica.id || replica.fileId;
              return patient.allowedReplicas.includes(replicaId);
            });

            // Merge or update local replicas with remote data
            for (const remoteReplica of remoteAccessible) {
              const replicaId = remoteReplica.id || remoteReplica.fileId;
              const existingIndex = accessibleReplicas.findIndex(r => r.fileId === replicaId);
              
              if (existingIndex >= 0) {
                // Update existing replica with fresh remote data
                accessibleReplicas[existingIndex] = {
                  ...accessibleReplicas[existingIndex],
                  name: remoteReplica.name || accessibleReplicas[existingIndex].name,
                  description: remoteReplica.description || accessibleReplicas[existingIndex].description,
                  apiSource: remoteReplica.apiSource,
                  migrationStatus: 'COMPLETED',
                  status: 'AVAILABLE'
                };
              } else {
                // Add new replica from remote
                accessibleReplicas.push({
                  fileId: replicaId,
                  name: remoteReplica.name,
                  description: remoteReplica.description,
                  apiSource: remoteReplica.apiSource,
                  supavecNamespace: remoteReplica.namespace,
                  migrationStatus: 'COMPLETED',
                  status: 'AVAILABLE',
                  isPatientAccess: true
                });
              }
            }
            
            fastify.log.info(`Patient ${patient.email} has access to ${accessibleReplicas.length} replicas`);
          } catch (error) {
            fastify.log.warn(error, 'Failed to sync replicas from remote API for patient');
            // Continue with local replicas only
          }
        }
        
        return { 
          success: true, 
          replicas: accessibleReplicas 
        };
      }      
      
      // Non-patient users should use /api/user/replicas instead
      return { 
        success: true, 
        replicas: [] 
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
      let replica = user?.replicas?.find(r => r.fileId === replicaId);
      let isOwner = Boolean(replica);
      
      // If not found and user is a patient, check if they have access via whitelist
      if (!replica && user.role === 'patient') {
        // Check via Patient model
        const patientRecord = await Patient.findByEmail(user.email);
        if (patientRecord && patientRecord.allowedReplicas.includes(replicaId)) {
          // Find the caretaker's replica
          const caretaker = await User.findById(patientRecord.caretaker).select('replicas');
          if (caretaker) {
            replica = caretaker.replicas?.find(r => r.fileId === replicaId);
          }
        }
        
        // Fallback: check if patient is whitelisted in any caretaker's replica
        if (!replica) {
          const caretakerWithReplica = await User.findOne({
            'replicas.fileId': replicaId,
            'replicas.whitelistEmails': user.email.toLowerCase()
          }).select('replicas');
          
          if (caretakerWithReplica) {
            replica = caretakerWithReplica.replicas?.find(r =>
              r.fileId === replicaId &&
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
    preHandler: [authenticateToken, validateSupavecNamespace]
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        fastify.log.error(`[CHAT DEBUG] Invalid replica ID: ${replicaId}`);
        return reply.status(400).send({ success: false, error: 'Invalid replica id' });
      }
      const { message, context = [], conversationId } = request.body;
      const userId = request.user?.id;
      
      fastify.log.info(`[CHAT DEBUG] Step 1: User ID from token: ${userId}`);
      
      if (!userId) {
        fastify.log.error(`[CHAT DEBUG] 401 - No user ID in token`);
        return reply.status(401).send({ success: false, error: 'User ID not found in token' });
      }
      
      // Get user details for conversation saving
      // Support both caretaker User records and Patient tokens (request.isPatient)
      let user;
      if (request.isPatient) {
        // For patient tokens, authenticateToken already populated request.user with patient info.
        // Refresh from DB where possible; if missing, fall back to token-provided data.
        const patient = await Patient.findById(userId);
        if (!patient) {
          fastify.log.warn(`[CHAT DEBUG] Patient DB lookup returned null for ${userId}; falling back to token data`);
          const tokenPatient = request.user || {};
          user = {
            id: tokenPatient.id || tokenPatient._id || userId,
            email: tokenPatient.email || null,
            role: 'patient',
            firstName: tokenPatient.firstName || null,
            lastName: tokenPatient.lastName || null,
            caretakerId: tokenPatient.caretakerId || tokenPatient.caretaker || null,
            allowedReplicas: tokenPatient.allowedReplicas || []
          };
        } else {
          // Ensure the patient has a linked User record for DB FK constraints.
          if (!patient.userId) {
            fastify.log.info(`[CHAT DEBUG] Patient ${patient.email} missing linked User; creating one`);
            try {
              // Generate a random password for linked user
              const randomPassword = crypto.randomBytes(16).toString('hex');
              const created = await User.create({
                email: patient.email,
                role: 'patient',
                firstName: patient.firstName,
                lastName: patient.lastName,
                password: randomPassword
              });
              patient.userId = created.id;
              await patient.save();
              fastify.log.info(`[CHAT DEBUG] Linked User ${created.id} created for patient ${patient.email}`);
            } catch (err) {
              fastify.log.error(err, `Failed to create linked User for patient ${patient.email}`);
              return reply.status(500).send({ success: false, error: 'Failed to create linked user for patient' });
            }
          }

          user = {
            id: patient._id,
            email: patient.email,
            role: 'patient',
            firstName: patient.firstName,
            lastName: patient.lastName,
            caretakerId: patient.caretaker,
            linkedUserId: patient.userId
          };
        }
      } else {
        user = await User.findById(userId).select('email role firstName lastName sensayUserId');
        if (!user) {
          fastify.log.error(`[CHAT DEBUG] 401 - User not found in database: ${userId}`);
          return reply.status(401).send({ success: false, error: 'User not found' });
        }
      }
      fastify.log.info(`[CHAT DEBUG] Step 2: User lookup result: ${user ? `${user.email} (${user.role})` : 'null'}`);

      
      // The user ID (caretaker's) is the namespace for Supabase.
      // For patients, we need to find the caretaker who owns the replica.
      let namespace = userId; // Default to current user's ID
      if (user.role === 'patient' && user.caretakerId) {
        namespace = user.caretakerId.toString();
      }
      fastify.log.info(`[CHAT DEBUG] Step 3: Supavec namespace resolved: ${namespace}`);
      fastify.log.info(`Chat request: ${user.email} (${user.role}) -> replica ${replicaId} in namespace ${namespace}`);
      
      // Get replica data for API routing
      let replicaData = null;
      if (user.role === 'patient' && user.caretakerId) {
        // For patients, get replica from caretaker's profile
        const caretaker = await User.findById(user.caretakerId).select('replicas');
        replicaData = caretaker?.replicas?.find(r => r.fileId === replicaId);
      } else {
        // For caretakers, get from their own profile
        const caretakerUser = await User.findById(userId).select('replicas');
        replicaData = caretakerUser?.replicas?.find(r => r.fileId === replicaId);
      }
      
      fastify.log.info(`[CHAT DEBUG] Step 4: Calling abstraction layer with API source: ${replicaData?.apiSource || 'default'}`);
      
      // Use abstraction layer to send chat message
      const chatContext = {
        conversationHistory: context,
        conversationId
      };
      
      const chatResponse = await replicaAbstraction.sendChatMessage(
        replicaId,
        message,
        chatContext,
        namespace, // Use namespace (caretaker's ID) for proper routing
        replicaData,
        {
          streaming: false
        }
      );
      
      fastify.log.info(`[CHAT DEBUG] Step 5: Abstraction layer response received:`, {
        success: chatResponse.success,
        apiSource: chatResponse.apiSource,
        fallbackUsed: chatResponse.fallbackUsed
      });
      
      // Extract reply text from abstraction layer response
      let replyText;
      if (chatResponse.response?.choices?.[0]?.message?.content) {
        // Supavec format
        replyText = chatResponse.response.choices[0].message.content;
      } else if (chatResponse.response?.message) {
        // Alternative format
        replyText = chatResponse.response.message;
      } else if (typeof chatResponse.response === 'string') {
        // Direct string response
        replyText = chatResponse.response;
      } else {
        replyText = 'Sorry, I could not process that.';
      }
      
      fastify.log.info(`[CHAT DEBUG] Step 6: Extracted reply text from ${chatResponse.apiSource}`);
      
      // Determine owner user id for DB FK operations.
      // For patients use the linked User id (created above) so Conversation.userId FK points to an actual User row.
      let ownerUserId = userId;
      if (user.role === 'patient') {
        ownerUserId = user.linkedUserId || user.userId || ownerUserId;
      }

      // Save conversation to database - each user (patient/caretaker) has separate conversations
      let conversation;
      if (conversationId && typeof conversationId === 'string' && /^[0-9a-fA-F\-]{36}$/.test(conversationId)) {
        // Continue existing conversation (conversationId validated as UUID)
        // Note: This automatically ensures user can only access their own conversations
        conversation = await Conversation.findOne({ 
          _id: conversationId, 
          userId: ownerUserId, // Critical: user can only access their own conversations
          replicaId 
        });
        
        fastify.log.info(`[CHAT DEBUG] Found existing conversation: ${conversationId} for ${user.email} (${user.role})`);
      }
      
      if (!conversation) {
        // Create new conversation - separate for each user (patient and caretaker have independent chats)
        conversation = new Conversation({
          userId: ownerUserId, // Each user gets their own conversation history (linked User id for patients)
          replicaId,
          messages: [],
          isActive: true,
          lastMessageAt: new Date(),
          title: null, // Will be set from first message
          apiSource: chatResponse.apiSource // Track which API was used
        });
        
        fastify.log.info(`[CHAT DEBUG] Created new conversation for ${user.email} (${user.role}) with replica ${replicaId} using ${chatResponse.apiSource}`);
      } else {
        // Update API source for existing conversation if it changed
        if (!conversation.apiSource) {
          conversation.apiSource = chatResponse.apiSource;
        }
      }
      
      // Add user message with metadata
      const userMessage = {
        id: Date.now().toString(),
        text: message,
        sender: 'user',
        timestamp: new Date(),
        userRole: user.role // Track whether message came from patient or caretaker
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
      
      // Update conversation metadata
      conversation.lastMessageAt = new Date();
      
      // Set conversation title from first message if not set
      if (!conversation.title && message.trim()) {
        conversation.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      }
      
      fastify.log.info(`[CHAT DEBUG] Saving conversation with ${conversation.messages.length} messages for ${user.email} (${user.role})`);
      
      await conversation.save();
      
      fastify.log.info(`[CHAT DEBUG] Successfully saved conversation ${conversation._id} for ${user.email} using ${chatResponse.apiSource}`);
      
      return { 
        success: true, 
        message: replyText,
        conversationId: conversation._id,
        apiSource: chatResponse.apiSource,
        fallbackUsed: chatResponse.fallbackUsed || false,
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
   * Get conversation history for a user with a specific replica
   * Each user (patient/caretaker) has separate conversation history
   */
  fastify.get('/api/replicas/:replicaId/conversations', { 
    preHandler: [authenticateToken]
  }, async (request, reply) => {
    try {
      const { replicaId } = request.params;
      if (!replicaId || typeof replicaId !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(replicaId)) {
        return reply.status(400).send({ success: false, error: 'Invalid replica id' });
      }
      
      const tokenUserId = request.user?.id;
      if (!tokenUserId) {
        return reply.status(401).send({ success: false, error: 'User ID not found in token' });
      }

      // Resolve ownerUserId for DB queries: for patients use patient.userId (linked User), otherwise token id
      let ownerUserId = tokenUserId;
      let user = await User.findById(tokenUserId).select('email role');
      if (!user && request.isPatient) {
        // Try to resolve patient and its linked user
        const patient = await Patient.findById(tokenUserId);
        if (patient && patient.userId) {
          ownerUserId = patient.userId;
          user = await User.findById(ownerUserId).select('email role');
        }
      }

      if (!user) {
        return reply.status(401).send({ success: false, error: 'User not found' });
      }

      // Get all conversations for this user with this replica
      const conversations = await Conversation.find({
        userId: ownerUserId,
        replicaId,
        isActive: true
      }).sort({ lastMessageAt: -1, createdAt: -1 });
      
      fastify.log.info(`[CONVERSATIONS] Retrieved ${conversations.length} conversations for ${user.email} (${user.role}) with replica ${replicaId}`);
      
      // Format conversations for client
      const formattedConversations = conversations.map(conv => ({
        id: conv._id,
        conversationId: conv._id,
        title: conv.title || 'Untitled Conversation',
        messages: conv.messages || [],
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        messageCount: (conv.messages || []).length,
        userRole: user.role, // Include user role for client context
        apiSource: conv.apiSource || 'SUPAVEC' // Track which API was used
      }));
      
      return { 
        success: true,
        conversations: formattedConversations,
        totalCount: formattedConversations.length,
        userInfo: {
          role: user.role,
          email: user.email
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error retrieving conversations');
      return reply.status(500).send({ 
        success: false,
        error: 'Internal server error while retrieving conversations'
      });
    }
  });

  /**
   * Get all conversations for a user (across all replicas they have access to)
   */
  fastify.get('/api/conversations', { 
    preHandler: [authenticateToken]
  }, async (request, reply) => {
    try {
      const tokenUserId = request.user?.id;
      if (!tokenUserId) {
        return reply.status(401).send({ success: false, error: 'User ID not found in token' });
      }

      // Resolve ownerUserId for DB queries
      let ownerUserId = tokenUserId;
      let user = await User.findById(tokenUserId).select('email role');
      if (!user && request.isPatient) {
        const patient = await Patient.findById(tokenUserId);
        if (patient && patient.userId) {
          ownerUserId = patient.userId;
          user = await User.findById(ownerUserId).select('email role');
        }
      }

      if (!user) {
        return reply.status(401).send({ success: false, error: 'User not found' });
      }

      const conversations = await Conversation.find({
        userId: ownerUserId,
        isActive: true
      }).sort({ lastMessageAt: -1, createdAt: -1 });
      
      fastify.log.info(`[ALL CONVERSATIONS] Retrieved ${conversations.length} total conversations for ${user.email} (${user.role})`);
      
      // Format conversations for client
      const formattedConversations = conversations.map(conv => ({
        id: conv._id,
        conversationId: conv._id,
        replicaId: conv.replicaId,
        title: conv.title || 'Untitled Conversation',
        lastMessage: conv.messages && conv.messages.length > 0 
          ? conv.messages[conv.messages.length - 1] 
          : null,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        messageCount: (conv.messages || []).length,
        userRole: user.role,
        apiSource: conv.apiSource || 'SUPAVEC' // Track which API was used
      }));
      
      return { 
        success: true,
        conversations: formattedConversations,
        totalCount: formattedConversations.length,
        userInfo: {
          role: user.role,
          email: user.email
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error retrieving all conversations');
      return reply.status(500).send({ 
        success: false,
        error: 'Internal server error while retrieving conversations'
      });
    }
  });

  /**
   * Get a specific conversation by ID
   * Users can only access their own conversations (automatic separation by userId)
   */
  fastify.get('/api/conversations/:conversationId', { 
    preHandler: [authenticateToken]
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params;
      if (!conversationId || typeof conversationId !== 'string' || !/^[0-9a-fA-F\-]{36}$/.test(conversationId)) {
        return reply.status(400).send({ success: false, error: 'Invalid conversation id' });
      }
      
      const tokenUserId = request.user?.id;
      if (!tokenUserId) {
        return reply.status(401).send({ success: false, error: 'User ID not found in token' });
      }

      // Resolve ownerUserId for DB queries
      let ownerUserId = tokenUserId;
      let user = await User.findById(tokenUserId).select('email role');
      if (!user && request.isPatient) {
        const patient = await Patient.findById(tokenUserId);
        if (patient && patient.userId) {
          ownerUserId = patient.userId;
          user = await User.findById(ownerUserId).select('email role');
        }
      }

      if (!user) {
        return reply.status(401).send({ success: false, error: 'User not found' });
      }

      // Get conversation - user can only access their own conversations
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: ownerUserId, // Critical: ensures users can only access their own conversations
        isActive: true
      });
      
      if (!conversation) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Conversation not found or access denied' 
        });
      }
      
      fastify.log.info(`[CONVERSATION] Retrieved conversation ${conversationId} for ${user.email} (${user.role})`);
      
      // Format conversation for client
      const formattedConversation = {
        id: conversation._id,
        conversationId: conversation._id,
        replicaId: conversation.replicaId,
        title: conversation.title || 'Untitled Conversation',
        messages: conversation.messages || [],
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        messageCount: (conversation.messages || []).length,
        userRole: user.role,
        apiSource: conversation.apiSource || 'SUPAVEC' // Track which API was used
      };
      
      return { 
        success: true,
        conversation: formattedConversation,
        userInfo: {
          role: user.role,
          email: user.email
        }
      };
    } catch (error) {
      fastify.log.error(error, 'Error retrieving conversation');
      return reply.status(500).send({ 
        success: false,
        error: 'Internal server error while retrieving conversation'
      });
    }
  });

  /**
   * Compatibility endpoint: just return messages for a conversation
   * Users can only access their own conversations (automatic separation by userId)
   */
  fastify.get('/api/conversations/:conversationId/messages', {
    preHandler: [authenticateToken]
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params;
      if (!conversationId || typeof conversationId !== 'string' || !/^[0-9a-fA-F\-]{36}$/.test(conversationId)) {
        return reply.status(400).send({ success: false, error: 'Invalid conversation id' });
      }
      
      const tokenUserId = request.user?.id;
      if (!tokenUserId) {
        return reply.status(401).send({ success: false, error: 'User ID not found in token' });
      }
      
      // Resolve ownerUserId for DB queries
      let ownerUserId = tokenUserId;
      let user = await User.findById(tokenUserId).select('email role');
      if (!user && request.isPatient) {
        const patient = await Patient.findById(tokenUserId);
        if (patient && patient.userId) {
          ownerUserId = patient.userId;
          user = await User.findById(ownerUserId).select('email role');
        }
      }
      
      if (!user) {
        return reply.status(401).send({ success: false, error: 'User not found' });
      }
      
      // Get conversation - user can only access their own conversations
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: ownerUserId, // Critical: ensures users can only access their own conversations
        isActive: true
      });
      
      if (!conversation) {
        return reply.status(404).send({ success: false, error: 'Conversation not found or access denied' });
      }
      
      fastify.log.info(`[CONVERSATION MESSAGES] Retrieved messages for conversation ${conversationId} for ${user.email} (${user.role})`);
      
      return {
        success: true,
        conversationId: conversation._id,
        replicaId: conversation.replicaId,
        messages: conversation.messages || [],
        messageCount: (conversation.messages || []).length,
        apiSource: conversation.apiSource || 'SUPAVEC' // Track which API was used
      };
    } catch (err) {
      fastify.log.error(err, 'Error retrieving conversation messages');
      return reply.status(500).send({ success: false, error: 'Internal server error while retrieving messages' });
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
      const user = await User.findById(userId).select('role email replicas');
      
      // Restrict patients from deleting replicas
      if (user?.role === 'patient') {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: patients cannot delete replicas' 
        });
      }
      
      // Find the replica in user's profile to validate ownership
      const replicaEntry = user.replicas.find(r => r.fileId === replicaId);
      if (!replicaEntry) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Replica not found in your account' 
        });
      }
      
      // Use abstraction layer to delete from remote API
      fastify.log.info(`Attempting to delete replica ${replicaId} via abstraction layer for user ${userId}`);
      
      const deleteResult = await replicaAbstraction.deleteReplica(
        replicaId,
        userId,
        replicaEntry.toObject()
      );
      
      fastify.log.info(`Abstraction layer delete result:`, {
        success: deleteResult.success,
        apiSource: deleteResult.apiSource,
        replicaId: deleteResult.replicaId
      });
      
      // Remove replica from user's profile and add to deleted tracking
      const updateResult = await User.findByIdAndUpdate(
        userId,
        { 
          $pull: { replicas: { fileId: replicaId } },
          $push: { deletedReplicas: { replicaId, deletedAt: new Date() } }
        },
        { new: true }
      );
      
      fastify.log.info(`Replica ${replicaId} deleted by user ${userId}. Removed from database:`, !!updateResult);
      
      return { 
        success: true, 
        message: 'Replica deleted successfully',
        apiSource: deleteResult.apiSource,
        deletedFromRemote: deleteResult.success,
        deletedFromDatabase: !!updateResult,
        migrationStatus: replicaEntry.migrationStatus || 'COMPLETED'
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
   * Get training status
   */
  fastify.get('/api/replicas/:replicaId/kb/:entryId/status', async (request, reply) => {
    try {
      const { replicaId, entryId } = request.params;
      // This concept doesn't directly map to Supavec's file-based system.
      // We can check if the file exists.
      const status = { id: entryId, status: 'READY', message: 'File is available in knowledge base.' };
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
      if (!user?.replicas?.some(r => r.fileId === replicaId)) {
        return reply.status(403).send({ success:false, error:'Replica not owned' });
      }
      const files = await listFiles(userId, null, null, { file_id: replicaId });
      return { success:true, entries: files.files || [] };
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
      if (!user?.replicas?.some(r => r.fileId === replicaId)) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      // With Supavec, getting an "entry" is just searching for the file.
      const searchResult = await searchKnowledgeBase(null, 1, userId, { file_id: entryId });
      const entry = searchResult?.results?.[0] || { success: false, error: 'Not found' };
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
      // In Supavec, an "entry" is a file. Deleting an entry is deleting the file.
      const resp = await deleteFile(entryId, request.user.id);
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
      if (!user?.replicas?.some(r => r.fileId === replicaId)) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }

      // Add API version header as per specification
      // Update the knowledge base entry
      const result = { success: false, message: "Updating a file's content directly is not supported via this endpoint. Please re-upload." };
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
      const userReplica = user?.replicas?.find(r => r.fileId === replicaId);
      
      if (!userReplica) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Access denied: Replica not found or not owned by user' 
        });
      }
      
      // Also update the local User model
      userReplica.whitelistEmails = whitelistEmails || [];
      await user.save();
      
      return { 
        success: true, 
        message: 'Replica updated successfully',
        replica: userReplica
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
