#!/usr/bin/env node

import mongoose from 'mongoose';
import User from '../src/models/User.js';
import '../src/config/loadEnv.js';

// Baseline persona definitions (copied from replicaApi.js)
const BASELINE_PERSONAS = {
  dad: `Persona Role: Father\nTone: Supportive, steady, pragmatic with occasional gentle humor.\nPrimary Motivations: Protect family well-being, impart life lessons, encourage resilience.\nInteraction Style: Offers guidance through analogies from work or past experiences, listens first then gives structured advice.\nBoundaries: Avoids over-indulgence, prefers fostering independence.\nCore Values: Responsibility, integrity, patience, long-term thinking.`,
  mom: `Persona Role: Mother\nTone: Warm, nurturing, emotionally perceptive, proactive.\nPrimary Motivations: Emotional security of family, harmony, growth.\nInteraction Style: Affirms feelings first, then suggests practical nurturing actions.\nBoundaries: Dislikes emotional stonewalling; encourages healthy expression.\nCore Values: Empathy, care, stability, unconditional support.`,
  brother: `Persona Role: Older Brother\nTone: Casual, loyal, sometimes teasing but protective.\nPrimary Motivations: Shared growth, mutual respect, keeping things grounded.\nInteraction Style: Mix of humor and candid advice, challenges you to level up.\nBoundaries: Rejects excessive formality; prefers directness.\nCore Values: Loyalty, honesty, personal improvement, camaraderie.`,
  sister: `Persona Role: Sister\nTone: Encouraging, emotionally intuitive, playful.\nPrimary Motivations: Mutual emotional validation, shared experiences, empowerment.\nInteraction Style: Balances empathy with motivational nudges.\nBoundaries: Dislikes dismissiveness of feelings.\nCore Values: Expression, growth, trust, encouragement.`,
  lover: `Persona Role: Romantic Partner\nTone: Affectionate, attentive, emotionally attuned.\nPrimary Motivations: Deep connection, mutual growth, emotional safety.\nInteraction Style: Reflective listening, shared vision framing, reassurance.\nBoundaries: Dislikes avoidance and vague emotional responses.\nCore Values: Trust, intimacy, commitment, mutual evolution.`,
  self: `Persona Role: Mirror Self (autobiographical AI)\nTone: Authentic, reflective, congruent with source personality.\nPrimary Motivations: Preserve continuity of identity, offer self-aligned reasoning.\nInteraction Style: Internal narrative reconstruction, clarifying motivations & patterns.\nBoundaries: Avoids fabrication outside provided knowledge.\nCore Values: Authenticity, self-awareness, coherence.`
};

async function backfillReplicaPersonas() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sensay-ai');
    console.log('✅ Connected to MongoDB');

    // Find all users with replicas that need backfilling
    console.log('🔍 Finding users with replicas to backfill...');
    const users = await User.find({
      'replicas.0': { $exists: true } // Users with at least one replica
    });

    console.log(`📊 Found ${users.length} users with replicas`);

    let totalReplicas = 0;
    let updatedReplicas = 0;

    for (const user of users) {
      console.log(`👤 Processing user: ${user.email} (${user.replicas.length} replicas)`);
      
      let userUpdated = false;
      
      for (let i = 0; i < user.replicas.length; i++) {
        const replica = user.replicas[i];
        totalReplicas++;
        
        // Skip if already has baseline persona data
        if (replica.baselinePersona && replica.infoProfileSnapshot !== undefined) {
          console.log(`   ⏭️  Replica "${replica.name}" already has persona data, skipping`);
          continue;
        }

        console.log(`   🔧 Backfilling replica: "${replica.name}" (ID: ${replica.replicaId})`);

        // Determine template from existing data or guess from name patterns
        let template = replica.template;
        if (!template) {
          // Try to infer template from replica name or description
          const nameLC = replica.name.toLowerCase();
          const descLC = replica.description.toLowerCase();
          
          if (nameLC.includes('dad') || nameLC.includes('father') || descLC.includes('dad') || descLC.includes('father')) {
            template = 'dad';
          } else if (nameLC.includes('mom') || nameLC.includes('mother') || descLC.includes('mom') || descLC.includes('mother')) {
            template = 'mom';
          } else if (nameLC.includes('brother') || descLC.includes('brother')) {
            template = 'brother';
          } else if (nameLC.includes('sister') || descLC.includes('sister')) {
            template = 'sister';
          } else if (nameLC.includes('lover') || nameLC.includes('partner') || descLC.includes('lover') || descLC.includes('partner')) {
            template = 'lover';
          } else {
            template = 'self'; // Default fallback
          }
        }

        // Generate baseline persona
        const personaIntro = `You are to act as my ${template}, ${template}'s name is ${replica.name}.`;
        const baselinePersona = personaIntro + '\n' + BASELINE_PERSONAS[template];

        // Generate a placeholder informational profile since we don't have the original Q&A
        const infoProfileSnapshot = `${template}'s core traits and background: Information derived from training data and interactions.\n${template}'s personality: As reflected in conversations and uploaded content.\n${template}'s role context: ${replica.description}`;

        // Update the replica
        user.replicas[i].template = template;
        user.replicas[i].baselinePersona = baselinePersona;
        user.replicas[i].infoProfileSnapshot = infoProfileSnapshot;
        
        userUpdated = true;
        updatedReplicas++;
        
        console.log(`   ✅ Updated replica "${replica.name}" with template: ${template}`);
      }
      
      if (userUpdated) {
        await user.save({ validateBeforeSave: false });
        console.log(`💾 Saved updates for user: ${user.email}`);
      }
    }

    console.log('\n📈 Backfill Summary:');
    console.log(`   Total replicas processed: ${totalReplicas}`);
    console.log(`   Replicas updated: ${updatedReplicas}`);
    console.log(`   Replicas already had data: ${totalReplicas - updatedReplicas}`);
    
    if (updatedReplicas > 0) {
      console.log('\n🎉 Backfill completed successfully!');
    } else {
      console.log('\n✨ All replicas already had persona data - no updates needed');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the backfill
backfillReplicaPersonas();