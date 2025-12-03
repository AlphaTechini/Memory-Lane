import databaseConfig from '../config/database.js';
import AuthService from '../services/authService.js';

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
   * GET /admin/db-status - Check database table counts
   */
  fastify.get('/admin/db-status', async (request, reply) => {
    if (!authCheck(request, reply)) return;
    
    try {
      const prisma = databaseConfig.prisma;
      
      const userCount = await prisma.user.count();
      const conversationCount = await prisma.conversation.count();
      const patientCount = await prisma.patient.count();
      
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
   * POST /admin/clear-user-data - Clear PII/auth fields while preserving rows
   */
  fastify.post('/admin/clear-user-data', async (request, reply) => {
    if (!authCheck(request, reply)) return;
    
    try {
      const prisma = databaseConfig.prisma;
      
      // Clear user PII/auth data while preserving rows
      const userUpdate = await prisma.user.updateMany({
        data: {
          email: null,
          password: null,
          sensayUserId: null,
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
          deletedReplicas: [],
          whitelistedPatients: [],
          patientWhitelist: [],
          gallery: null,
          updatedAt: new Date()
        }
      });
      
      // Clear conversation messages
      const conversationUpdate = await prisma.conversation.updateMany({
        data: {
          messages: [],
          updatedAt: new Date()
        }
      });
      
      // Clear patient PII
      const patientUpdate = await prisma.patient.updateMany({
        data: {
          userId: null,
          caretaker: null,
          email: null,
          firstName: null,
          lastName: null,
          updatedAt: new Date()
        }
      });
      
      return {
        success: true,
        message: 'User data cleared successfully',
        rowsUpdated: {
          users: userUpdate.count,
          conversations: conversationUpdate.count,
          patients: patientUpdate.count
        }
      };
    } catch (error) {
      fastify.log.error('Clear user data failed:', error);
      reply.code(500).send({ success: false, message: 'Database error' });
    }
  });
}

export default adminRoutes;