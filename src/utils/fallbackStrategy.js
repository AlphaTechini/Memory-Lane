/**
 * Fallback Strategy Utility
 * 
 * Implements automatic retry logic, fallback mechanisms, and circuit breaker pattern
 * for API reliability
 */

import logger from './logger.js';
import { logRetry, logFallback } from './apiLogger.js';
import { isRetryableError, shouldFallback } from './errorHandler.js';

/**
 * Circuit breaker states
 */
const CircuitState = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit breaker for each API
 */
const circuitBreakers = new Map();

/**
 * Circuit breaker configuration
 */
const circuitBreakerConfig = {
  failureThreshold: 5,        // Number of failures before opening circuit
  successThreshold: 2,        // Number of successes to close circuit from half-open
  timeout: 60000,             // Time to wait before trying half-open (ms)
  monitoringPeriod: 10000     // Period to track failures (ms)
};

/**
 * Retry configuration
 */
const retryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,         // Initial delay in ms
  maxDelay: 10000,            // Maximum delay in ms
  backoffMultiplier: 2,       // Exponential backoff multiplier
  jitterFactor: 0.1           // Random jitter factor (0-1)
};

/**
 * Get or create circuit breaker for an API
 * @param {string} apiSource - The API source
 * @returns {object} Circuit breaker instance
 */
function getCircuitBreaker(apiSource) {
  if (!circuitBreakers.has(apiSource)) {
    circuitBreakers.set(apiSource, {
      state: CircuitState.CLOSED,
      failures: [],
      successes: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    });
  }
  return circuitBreakers.get(apiSource);
}

/**
 * Check if circuit breaker allows request
 * @param {string} apiSource - The API source
 * @returns {object} Result with allowed status and reason
 */
export const checkCircuitBreaker = (apiSource) => {
  const breaker = getCircuitBreaker(apiSource);
  const now = Date.now();
  
  switch (breaker.state) {
    case CircuitState.CLOSED:
      // Normal operation
      return { allowed: true, state: breaker.state };
      
    case CircuitState.OPEN:
      // Check if timeout has passed
      if (breaker.nextAttemptTime && now >= breaker.nextAttemptTime) {
        // Transition to half-open
        breaker.state = CircuitState.HALF_OPEN;
        breaker.successes = 0;
        logger.info(`Circuit breaker transitioning to HALF_OPEN: ${apiSource}`);
        return { allowed: true, state: breaker.state };
      }
      // Circuit is still open
      return {
        allowed: false,
        state: breaker.state,
        reason: 'Circuit breaker is OPEN',
        nextAttemptTime: breaker.nextAttemptTime
      };
      
    case CircuitState.HALF_OPEN:
      // Allow request to test if service recovered
      return { allowed: true, state: breaker.state };
      
    default:
      return { allowed: true, state: breaker.state };
  }
};

/**
 * Record success for circuit breaker
 * @param {string} apiSource - The API source
 */
export const recordSuccess = (apiSource) => {
  const breaker = getCircuitBreaker(apiSource);
  
  if (breaker.state === CircuitState.HALF_OPEN) {
    breaker.successes++;
    
    if (breaker.successes >= circuitBreakerConfig.successThreshold) {
      // Close the circuit
      breaker.state = CircuitState.CLOSED;
      breaker.failures = [];
      breaker.successes = 0;
      breaker.lastFailureTime = null;
      breaker.nextAttemptTime = null;
      logger.info(`Circuit breaker CLOSED: ${apiSource}`);
    }
  } else if (breaker.state === CircuitState.CLOSED) {
    // Clean up old failures
    const cutoff = Date.now() - circuitBreakerConfig.monitoringPeriod;
    breaker.failures = breaker.failures.filter(time => time > cutoff);
  }
};

/**
 * Record failure for circuit breaker
 * @param {string} apiSource - The API source
 */
export const recordFailure = (apiSource) => {
  const breaker = getCircuitBreaker(apiSource);
  const now = Date.now();
  
  breaker.lastFailureTime = now;
  breaker.failures.push(now);
  
  // Clean up old failures outside monitoring period
  const cutoff = now - circuitBreakerConfig.monitoringPeriod;
  breaker.failures = breaker.failures.filter(time => time > cutoff);
  
  if (breaker.state === CircuitState.HALF_OPEN) {
    // Failed during half-open, reopen circuit
    breaker.state = CircuitState.OPEN;
    breaker.successes = 0;
    breaker.nextAttemptTime = now + circuitBreakerConfig.timeout;
    logger.warn(`Circuit breaker reopened: ${apiSource}`);
  } else if (breaker.state === CircuitState.CLOSED) {
    // Check if we should open the circuit
    if (breaker.failures.length >= circuitBreakerConfig.failureThreshold) {
      breaker.state = CircuitState.OPEN;
      breaker.nextAttemptTime = now + circuitBreakerConfig.timeout;
      logger.warn(`Circuit breaker OPENED: ${apiSource} (${breaker.failures.length} failures)`);
    }
  }
};

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param {number} attemptNumber - The current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attemptNumber) {
  // Exponential backoff
  let delay = Math.min(
    retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber),
    retryConfig.maxDelay
  );
  
  // Add jitter to prevent thundering herd
  const jitter = delay * retryConfig.jitterFactor * (Math.random() * 2 - 1);
  delay = Math.max(0, delay + jitter);
  
  return Math.floor(delay);
}

/**
 * Execute function with automatic retry logic
 * @param {Function} fn - The async function to execute
 * @param {object} options - Retry options
 * @param {number} [options.maxAttempts] - Maximum retry attempts
 * @param {string} [options.apiSource] - API source for logging
 * @param {string} [options.operation] - Operation name for logging
 * @param {Function} [options.shouldRetry] - Custom function to determine if should retry
 * @returns {Promise<any>} Result of the function
 */
export const withRetry = async (fn, options = {}) => {
  const maxAttempts = options.maxAttempts || retryConfig.maxAttempts;
  const apiSource = options.apiSource || 'UNKNOWN';
  const operation = options.operation || 'unknown';
  const shouldRetryFn = options.shouldRetry || ((error) => isRetryableError(error));
  
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check circuit breaker before attempt
      const circuitCheck = checkCircuitBreaker(apiSource);
      if (!circuitCheck.allowed) {
        throw new Error(`Circuit breaker is ${circuitCheck.state} for ${apiSource}`);
      }
      
      const result = await fn();
      
      // Record success for circuit breaker
      recordSuccess(apiSource);
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Record failure for circuit breaker
      recordFailure(apiSource);
      
      // Check if we should retry
      const isLastAttempt = attempt === maxAttempts - 1;
      const shouldRetryThis = shouldRetryFn(error);
      
      if (isLastAttempt || !shouldRetryThis) {
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateRetryDelay(attempt);
      
      logRetry(apiSource, operation, attempt + 1, maxAttempts, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Execute function with fallback to alternative API
 * @param {Function} primaryFn - Primary function to execute
 * @param {Function} fallbackFn - Fallback function to execute if primary fails
 * @param {object} options - Fallback options
 * @param {string} [options.primaryApi] - Primary API source
 * @param {string} [options.fallbackApi] - Fallback API source
 * @param {string} [options.operation] - Operation name
 * @param {Function} [options.shouldFallback] - Custom function to determine if should fallback
 * @returns {Promise<any>} Result from primary or fallback function
 */
export const withFallback = async (primaryFn, fallbackFn, options = {}) => {
  const primaryApi = options.primaryApi || 'PRIMARY';
  const fallbackApi = options.fallbackApi || 'FALLBACK';
  const operation = options.operation || 'unknown';
  const shouldFallbackFn = options.shouldFallback || ((error) => shouldFallback(error, primaryApi));
  
  try {
    // Try primary function
    const result = await primaryFn();
    return {
      ...result,
      apiUsed: primaryApi,
      fallbackUsed: false
    };
  } catch (primaryError) {
    // Check if we should fallback
    if (!shouldFallbackFn(primaryError)) {
      throw primaryError;
    }
    
    // Log fallback
    logFallback(primaryApi, fallbackApi, operation, primaryError.message);
    
    try {
      // Try fallback function
      const result = await fallbackFn();
      return {
        ...result,
        apiUsed: fallbackApi,
        fallbackUsed: true,
        primaryError: primaryError.message
      };
    } catch (fallbackError) {
      // Both failed
      logger.error(`Both primary and fallback failed for ${operation}`, {
        primaryApi,
        fallbackApi,
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
      
      // Throw the fallback error with context
      fallbackError.primaryError = primaryError;
      fallbackError.fallbackFailed = true;
      throw fallbackError;
    }
  }
};

/**
 * Execute function with both retry and fallback
 * @param {Function} primaryFn - Primary function to execute
 * @param {Function} fallbackFn - Fallback function to execute if primary fails
 * @param {object} options - Combined options
 * @returns {Promise<any>} Result from primary or fallback function
 */
export const withRetryAndFallback = async (primaryFn, fallbackFn, options = {}) => {
  const primaryApi = options.primaryApi || 'PRIMARY';
  const fallbackApi = options.fallbackApi || 'FALLBACK';
  const operation = options.operation || 'unknown';
  
  // Wrap primary function with retry
  const primaryWithRetry = () => withRetry(primaryFn, {
    maxAttempts: options.maxAttempts,
    apiSource: primaryApi,
    operation
  });
  
  // Wrap fallback function with retry
  const fallbackWithRetry = () => withRetry(fallbackFn, {
    maxAttempts: options.maxAttempts,
    apiSource: fallbackApi,
    operation
  });
  
  // Execute with fallback
  return withFallback(primaryWithRetry, fallbackWithRetry, {
    primaryApi,
    fallbackApi,
    operation,
    shouldFallback: options.shouldFallback
  });
};

/**
 * Get circuit breaker status for all APIs
 * @returns {object} Circuit breaker status
 */
export const getCircuitBreakerStatus = () => {
  const status = {};
  
  for (const [apiSource, breaker] of circuitBreakers.entries()) {
    status[apiSource] = {
      state: breaker.state,
      failureCount: breaker.failures.length,
      successCount: breaker.successes,
      lastFailureTime: breaker.lastFailureTime,
      nextAttemptTime: breaker.nextAttemptTime
    };
  }
  
  return status;
};

/**
 * Reset circuit breaker for an API
 * @param {string} apiSource - The API source
 */
export const resetCircuitBreaker = (apiSource) => {
  const breaker = getCircuitBreaker(apiSource);
  breaker.state = CircuitState.CLOSED;
  breaker.failures = [];
  breaker.successes = 0;
  breaker.lastFailureTime = null;
  breaker.nextAttemptTime = null;
  
  logger.info(`Circuit breaker reset: ${apiSource}`);
};

/**
 * Reset all circuit breakers
 */
export const resetAllCircuitBreakers = () => {
  for (const apiSource of circuitBreakers.keys()) {
    resetCircuitBreaker(apiSource);
  }
  
  logger.info('All circuit breakers reset');
};

/**
 * Configure retry settings
 * @param {object} config - Retry configuration
 */
export const configureRetry = (config) => {
  Object.assign(retryConfig, config);
  logger.info('Retry configuration updated', retryConfig);
};

/**
 * Configure circuit breaker settings
 * @param {object} config - Circuit breaker configuration
 */
export const configureCircuitBreaker = (config) => {
  Object.assign(circuitBreakerConfig, config);
  logger.info('Circuit breaker configuration updated', circuitBreakerConfig);
};

export default {
  CircuitState,
  checkCircuitBreaker,
  recordSuccess,
  recordFailure,
  withRetry,
  withFallback,
  withRetryAndFallback,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
  configureRetry,
  configureCircuitBreaker
};
