/**
 * API Logger Utility
 * 
 * Provides structured logging for all API calls with performance metrics collection
 */

import logger from './logger.js';

/**
 * Performance metrics storage
 * In production, this should be replaced with a proper metrics service
 */
const metrics = {
  apiCalls: new Map(), // Track API call counts
  responseTimes: new Map(), // Track response times
  errors: new Map(), // Track error counts
  fallbacks: new Map() // Track fallback usage
};

/**
 * Log an API request
 * @param {string} apiSource - The API being called ('SUPAVEC' or 'SENSAY')
 * @param {string} operation - The operation being performed
 * @param {object} params - Request parameters
 * @returns {object} Request context for tracking
 */
export const logApiRequest = (apiSource, operation, params = {}) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  logger.info(`API Request: ${apiSource} - ${operation}`, {
    requestId,
    apiSource,
    operation,
    params: sanitizeParams(params),
    timestamp: new Date().toISOString()
  });
  
  // Track metrics
  const key = `${apiSource}:${operation}`;
  metrics.apiCalls.set(key, (metrics.apiCalls.get(key) || 0) + 1);
  
  return {
    requestId,
    apiSource,
    operation,
    startTime
  };
};

/**
 * Log an API response
 * @param {object} context - Request context from logApiRequest
 * @param {boolean} success - Whether the request was successful
 * @param {object} [result] - Response data
 * @param {Error} [error] - Error if request failed
 */
export const logApiResponse = (context, success, result = null, error = null) => {
  const endTime = Date.now();
  const duration = endTime - context.startTime;
  
  const logData = {
    requestId: context.requestId,
    apiSource: context.apiSource,
    operation: context.operation,
    success,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  };
  
  if (success) {
    logger.info(`API Response: ${context.apiSource} - ${context.operation}`, {
      ...logData,
      resultSummary: summarizeResult(result)
    });
  } else {
    logger.error(`API Error: ${context.apiSource} - ${context.operation}`, {
      ...logData,
      error: error?.message || 'Unknown error',
      errorCode: error?.code,
      statusCode: error?.response?.status
    });
    
    // Track error metrics
    const errorKey = `${context.apiSource}:${context.operation}:error`;
    metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);
  }
  
  // Track response time metrics
  const timeKey = `${context.apiSource}:${context.operation}`;
  const times = metrics.responseTimes.get(timeKey) || [];
  times.push(duration);
  metrics.responseTimes.set(timeKey, times);
};

/**
 * Log a fallback event
 * @param {string} primaryApi - The primary API that failed
 * @param {string} fallbackApi - The fallback API being used
 * @param {string} operation - The operation being performed
 * @param {string} reason - Reason for fallback
 */
export const logFallback = (primaryApi, fallbackApi, operation, reason) => {
  logger.warn(`API Fallback: ${primaryApi} -> ${fallbackApi}`, {
    primaryApi,
    fallbackApi,
    operation,
    reason,
    timestamp: new Date().toISOString()
  });
  
  // Track fallback metrics
  const fallbackKey = `${primaryApi}->${fallbackApi}:${operation}`;
  metrics.fallbacks.set(fallbackKey, (metrics.fallbacks.get(fallbackKey) || 0) + 1);
};

/**
 * Log a retry attempt
 * @param {string} apiSource - The API being retried
 * @param {string} operation - The operation being retried
 * @param {number} attemptNumber - The retry attempt number
 * @param {number} maxAttempts - Maximum retry attempts
 * @param {string} reason - Reason for retry
 */
export const logRetry = (apiSource, operation, attemptNumber, maxAttempts, reason) => {
  logger.info(`API Retry: ${apiSource} - ${operation}`, {
    apiSource,
    operation,
    attemptNumber,
    maxAttempts,
    reason,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log migration event
 * @param {string} eventType - Type of migration event
 * @param {object} details - Event details
 */
export const logMigrationEvent = (eventType, details = {}) => {
  logger.info(`Migration Event: ${eventType}`, {
    eventType,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log namespace operation
 * @param {string} operation - The namespace operation
 * @param {string} namespace - The namespace
 * @param {string} userId - The user ID
 * @param {object} [details] - Additional details
 */
export const logNamespaceOperation = (operation, namespace, userId, details = {}) => {
  logger.info(`Namespace Operation: ${operation}`, {
    operation,
    namespace,
    userId,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log access control event
 * @param {string} action - The access control action
 * @param {string} userId - The user ID
 * @param {string} resourceId - The resource being accessed
 * @param {boolean} granted - Whether access was granted
 * @param {string} [reason] - Reason for decision
 */
export const logAccessControl = (action, userId, resourceId, granted, reason = null) => {
  const logLevel = granted ? 'info' : 'warn';
  
  logger[logLevel](`Access Control: ${action}`, {
    action,
    userId,
    resourceId,
    granted,
    reason,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get performance metrics summary
 * @returns {object} Performance metrics
 */
export const getMetricsSummary = () => {
  const summary = {
    apiCalls: {},
    responseTimes: {},
    errors: {},
    fallbacks: {},
    timestamp: new Date().toISOString()
  };
  
  // API call counts
  for (const [key, count] of metrics.apiCalls.entries()) {
    summary.apiCalls[key] = count;
  }
  
  // Response time statistics
  for (const [key, times] of metrics.responseTimes.entries()) {
    if (times.length > 0) {
      const sorted = [...times].sort((a, b) => a - b);
      summary.responseTimes[key] = {
        count: times.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }
  }
  
  // Error counts
  for (const [key, count] of metrics.errors.entries()) {
    summary.errors[key] = count;
  }
  
  // Fallback counts
  for (const [key, count] of metrics.fallbacks.entries()) {
    summary.fallbacks[key] = count;
  }
  
  return summary;
};

/**
 * Reset metrics (useful for testing or periodic resets)
 */
export const resetMetrics = () => {
  metrics.apiCalls.clear();
  metrics.responseTimes.clear();
  metrics.errors.clear();
  metrics.fallbacks.clear();
  
  logger.info('Performance metrics reset', {
    timestamp: new Date().toISOString()
  });
};

/**
 * Log metrics summary
 */
export const logMetricsSummary = () => {
  const summary = getMetricsSummary();
  
  logger.info('Performance Metrics Summary', summary);
  
  return summary;
};

/**
 * Create a performance tracking wrapper for async functions
 * @param {Function} fn - The async function to wrap
 * @param {string} apiSource - The API source
 * @param {string} operation - The operation name
 * @returns {Function} Wrapped function with performance tracking
 */
export const withPerformanceTracking = (fn, apiSource, operation) => {
  return async (...args) => {
    const context = logApiRequest(apiSource, operation, { argsCount: args.length });
    
    try {
      const result = await fn(...args);
      logApiResponse(context, true, result);
      return result;
    } catch (error) {
      logApiResponse(context, false, null, error);
      throw error;
    }
  };
};

// ===== HELPER FUNCTIONS =====

/**
 * Generate a unique request ID
 * @returns {string} Request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize parameters for logging (remove sensitive data)
 * @param {object} params - Parameters to sanitize
 * @returns {object} Sanitized parameters
 */
function sanitizeParams(params) {
  const sanitized = { ...params };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  // Truncate long strings
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
      sanitized[key] = sanitized[key].substring(0, 200) + '... [truncated]';
    }
  }
  
  return sanitized;
}

/**
 * Summarize result for logging
 * @param {any} result - Result to summarize
 * @returns {object} Result summary
 */
function summarizeResult(result) {
  if (!result) return null;
  
  const summary = {
    type: typeof result
  };
  
  if (Array.isArray(result)) {
    summary.isArray = true;
    summary.length = result.length;
  } else if (typeof result === 'object') {
    summary.keys = Object.keys(result).slice(0, 10); // First 10 keys
    if (result.success !== undefined) {
      summary.success = result.success;
    }
  }
  
  return summary;
}

export default {
  logApiRequest,
  logApiResponse,
  logFallback,
  logRetry,
  logMigrationEvent,
  logNamespaceOperation,
  logAccessControl,
  getMetricsSummary,
  resetMetrics,
  logMetricsSummary,
  withPerformanceTracking
};
