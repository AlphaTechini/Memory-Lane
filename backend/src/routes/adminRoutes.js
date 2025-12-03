import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Patient from '../models/Patient.js';

/**
 * Admin routes for database management (DANGEROUS - use with caution)
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function adminRoutes(fastify, options) {
  
  // Simple auth check using a secret header
  const authCheck = (request, reply) => {
    const secret = request.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SECRET || 'CHANGE_ME_IN_PRODUCTION';
    
    if (!secret || secret !== expectedSecret) {
      reply.code(401).send({ success: false, message: 'Unauthorized' });
      return false;
    }
    return true;
  };

  /**
   * GET /admin/db-status - Check database collection counts
   */
  fastify.get('/admin/db-status', async (request, reply) => {
    if (!authCheck(request, reply)) return;
    
    try {
      const userCount = await User.countDocuments();
      const conversationCount = await Conversation.find().then(results => results.length);
      const patientCount = await Patient.countDocuments();
      
      return {
        success: true,
        counts: {
          users: userCount,
          conversations: conversationCount,
          patients: patientCount
        }
      };
    } catch (error) {
      fastify.log.error('DB status check failed:', error);
      reply.code(500).send({ success: false, message: 'Database error' });
    }
  });

  /**
   * POST /admin/clear-user-data - Clear PII/auth fields while preserving documents
   */
  fastify.post('/admin/clear-user-data', async (request, reply) => {
    if (!authCheck(request, reply)) return;
    
    try {
      // Clear user PII/auth data while preserving documents
      const userUpdate = await User.updateMany(
        {},
        {
          $set: {
            email: null,
            password: null,
            isVerified: false,
            firstName: null,
            lastName: null,
            verificationToken: null,
            otpCode: null,
            otpExpires: null,
            passwordResetToken: null,
            passwordResetExpires: null,
            replicaImageUrl: null,
            replicaImageId: null,
            replicas: [],
            whitelistedPatients: [],
            patientWhitelist: null,
            gallery: null,
            updatedAt: new Date()
          }
        }
      );
      
      // Clear conversation messages
      const conversations = await Conversation.find();
      let conversationUpdateCount = 0;
      for (const conv of conversations) {
        conv.messages = [];
        conv.updatedAt = new Date();
        await conv.save();
        conversationUpdateCount++;
      }
      
      // Clear patient PII
      const patientUpdate = await Patient.updateMany(
        {},
        {
          $set: {
            userId: null,
            email: null,
            firstName: null,
            lastName: null,
            updatedAt: new Date()
          }
        }
      );
      
      return {
        success: true,
        message: 'User data cleared successfully',
        rowsUpdated: {
          users: userUpdate.modifiedCount,
          conversations: conversationUpdateCount,
          patients: patientUpdate.modifiedCount
        }
      };
    } catch (error) {
      fastify.log.error('Clear user data failed:', error);
      reply.code(500).send({ success: false, message: 'Database error' });
    }
  });
}

export default adminRoutes;