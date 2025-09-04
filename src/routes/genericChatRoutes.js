import { authenticateToken } from '../middleware/auth.js';

/**
 * Generic chat routes for fallback when no replica is selected
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance
 * @param {object} options - Plugin options
 */
async function genericChatRoutes(fastify, options) {
  
  /**
   * Generic chat endpoint (protected route)
   */
  fastify.post('/api/chat/generic', { 
    preHandler: authenticateToken 
  }, async (request, reply) => {
    try {
      const { message, context = [] } = request.body;
      
      // Simple fallback response - you can integrate with any LLM service here
      const responses = [
        "I'm a generic AI assistant. To get personalized responses, please create and select one of your replicas.",
        "I can help with general questions, but for responses tailored to your personality, try chatting with your trained replica.",
        "This is a generic response. Your trained replicas will provide much more personalized interactions.",
        "I'm here to help! For the full Sensay experience, create a replica trained on your personality.",
        "I can assist you with basic questions. Your personalized replicas will offer much more engaging conversations."
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      return { 
        success: true, 
        message: randomResponse,
        isGeneric: true
      };
    } catch (error) {
      fastify.log.error(error, 'Error in generic chat');
      
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to process message' 
      });
    }
  });
}

export default genericChatRoutes;
