/**
 * Health Check API Routes
 * 
 * Provides health check endpoints with circuit breaker status and performance metrics
 */

import { getConfigurationSummary } from '../config/migration.js';
import { getCircuitBreakerStatus } from '../utils/fallbackStrategy.js';
import { getMetricsSummary } from '../utils/apiLogger.js';
import logger from '../utils/logger.js';

/**
 * Register health check routes
 * @param {object} fastify - Fastify instance
 */
export default async function healthRoutes(fastify) {
  /**
   * Basic health check
   */
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  /**
   * Detailed health check with API status
   */
  fastify.get('/health/detailed', async (request, reply) => {
    try {
      const config = getConfigurationSummary();
      const circuitBreakers = getCircuitBreakerStatus();
      
      // Import API health check functions
      const { healthCheck: supavecHealthCheck } = await import('../services/supavecService.js');
      const { healthCheck: sensayHealthCheck } = await import('../services/sensayService.js');
      
      // Check API connectivity
      const apiHealthChecks = await Promise.allSettled([
        supavecHealthCheck(5000),
        sensayHealthCheck(5000)
      ]);
      
      const supavecHealth = apiHealthChecks[0].status === 'fulfilled' ? apiHealthChecks[0].value : { status: 'error', error: apiHealthChecks[0].reason?.message };
      const sensayHealth = apiHealthChecks[1].status === 'fulfilled' ? apiHealthChecks[1].value : { status: 'error', error: apiHealthChecks[1].reason?.message };
      
      // Determine overall health
      let overallStatus = 'healthy';
      let issues = [];
      
      // Check if any circuit breakers are open
      for (const [api, status] of Object.entries(circuitBreakers)) {
        if (status.state === 'OPEN') {
          overallStatus = 'degraded';
          issues.push(`Circuit breaker OPEN for ${api}`);
        }
      }
      
      // Check API configuration
      if (!config.isProperlyConfigured) {
        overallStatus = 'unhealthy';
        issues.push('API not properly configured');
      }
      
      // Check API health based on migration mode
      if (config.mode === 'SUPAVEC_ONLY' && supavecHealth.status !== 'healthy') {
        overallStatus = 'unhealthy';
        issues.push('Supavec API unhealthy (required for current mode)');
      } else if (config.mode === 'SENSAY_ONLY' && sensayHealth.status !== 'healthy') {
        overallStatus = 'unhealthy';
        issues.push('Sensay API unhealthy (required for current mode)');
      } else if (config.mode === 'DUAL') {
        if (supavecHealth.status !== 'healthy' && sensayHealth.status !== 'healthy') {
          overallStatus = 'unhealthy';
          issues.push('Both APIs unhealthy (dual mode requires at least one)');
        } else if (supavecHealth.status !== 'healthy' || sensayHealth.status !== 'healthy') {
          overallStatus = 'degraded';
          issues.push('One API unhealthy in dual mode');
        }
      }
      
      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        configuration: config,
        apis: {
          supavec: supavecHealth,
          sensay: sensayHealth
        },
        circuitBreakers,
        issues: issues.length > 0 ? issues : undefined
      };
    } catch (error) {
      logger.error('Error in detailed health check:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  /**
   * Performance metrics endpoint
   */
  fastify.get('/health/metrics', async (request, reply) => {
    try {
      const metrics = getMetricsSummary();
      
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        metrics
      };
    } catch (error) {
      logger.error('Error retrieving metrics:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  /**
   * Circuit breaker status endpoint
   */
  fastify.get('/health/circuit-breakers', async (request, reply) => {
    try {
      const circuitBreakers = getCircuitBreakerStatus();
      
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        circuitBreakers
      };
    } catch (error) {
      logger.error('Error retrieving circuit breaker status:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  /**
   * API configuration endpoint
   */
  fastify.get('/health/config', async (request, reply) => {
    try {
      const config = getConfigurationSummary();
      
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        configuration: config
      };
    } catch (error) {
      logger.error('Error retrieving configuration:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  /**
   * Supavec API health check endpoint
   */
  fastify.get('/health/supavec', async (request, reply) => {
    try {
      const { getServiceStatus } = await import('../services/supavecService.js');
      const status = await getServiceStatus();
      
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        service: status
      };
    } catch (error) {
      logger.error('Error checking Supavec health:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  /**
   * Sensay API health check endpoint
   */
  fastify.get('/health/sensay', async (request, reply) => {
    try {
      const { getServiceStatus } = await import('../services/sensayService.js');
      const status = await getServiceStatus();
      
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        service: status
      };
    } catch (error) {
      logger.error('Error checking Sensay health:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  /**
   * Migration status endpoint
   */
  fastify.get('/health/migration', async (request, reply) => {
    try {
      const config = getConfigurationSummary();
      
      // Get migration-specific status
      const migrationStatus = {
        mode: config.mode,
        migrationProgress: {
          supavecReady: config.apis.supavec.configured && config.apis.supavec.enabled,
          sensayFallbackAvailable: config.apis.sensay.configured && config.features.enableSensayFallback,
          configurationValid: config.isProperlyConfigured
        },
        recommendations: []
      };
      
      // Add recommendations based on current state
      if (config.mode === 'DUAL' && !config.apis.supavec.configured) {
        migrationStatus.recommendations.push('Configure Supavec API to enable migration');
      }
      
      if (config.mode === 'SUPAVEC_ONLY' && config.features.enableSensayFallback && !config.apis.sensay.configured) {
        migrationStatus.recommendations.push('Configure Sensay API for fallback support or disable fallback');
      }
      
      if (config.mode === 'SENSAY_ONLY') {
        migrationStatus.recommendations.push('Consider migrating to DUAL mode to test Supavec integration');
      }
      
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        migration: migrationStatus
      };
    } catch (error) {
      logger.error('Error retrieving migration status:', error.message);
      return reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });
}
