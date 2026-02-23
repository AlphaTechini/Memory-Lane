/**
 * Health Check API Routes
 * 
 * Provides health check endpoints for the server and RAG engine.
 */

import logger from '../utils/logger.js';

/**
 * Register health check routes
 * @param {object} fastify - Fastify instance
 */
async function healthRoutes(fastify) {

  /**
   * GET /health — Basic server health
   */
  fastify.get('/health', { logLevel: 'error' }, async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().rss,
    };
  });

  /**
   * GET /health/detailed — Detailed health with RAG engine + Groq status
   */
  fastify.get('/health/detailed', async (request, reply) => {
    try {
      const { healthCheck } = await import('../services/ragClient.js');
      const { getConfigSummary } = await import('../services/groqService.js');

      const ragHealth = await healthCheck();
      const groqConfig = getConfigSummary();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          ragEngine: {
            status: ragHealth.reachable ? 'healthy' : 'unreachable',
            backend: ragHealth.storage_backend || null,
            version: ragHealth.version || null,
            error: ragHealth.error || null,
          },
          groq: {
            configured: groqConfig.configured,
            model: groqConfig.model,
            toolCount: groqConfig.toolCount,
          },
        },
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        },
      };
    } catch (error) {
      logger.error('Error in detailed health check:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  /**
   * GET /health/rag — RAG Engine health
   */
  fastify.get('/health/rag', async (request, reply) => {
    try {
      const { healthCheck } = await import('../services/ragClient.js');
      const health = await healthCheck();
      return {
        status: health.reachable ? 'healthy' : 'unreachable',
        timestamp: new Date().toISOString(),
        ...health,
      };
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });
}

export default healthRoutes;
