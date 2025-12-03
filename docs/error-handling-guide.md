# Enhanced Error Handling System

## Overview

The enhanced error handling system provides standardized error mapping, comprehensive logging, automatic retry logic, fallback mechanisms, and circuit breaker patterns for improved API reliability during the Sensay to Supavec migration.

## Components

### 1. Error Handler (`src/utils/errorHandler.js`)

Provides standardized error codes and transformations for both Sensay and Supavec APIs.

**Key Features:**
- Standardized error codes across all APIs
- User-friendly error messages
- Error classification (retryable vs non-retryable)
- Fallback decision logic

**Usage Example:**
```javascript
import { transformError, createErrorResponse, isRetryableError } from './utils/errorHandler.js';

try {
  const result = await someApiCall();
} catch (error) {
  const standardizedError = transformError(error, 'SUPAVEC');
  
  if (isRetryableError(standardizedError)) {
    // Retry logic
  }
  
  return createErrorResponse(standardizedError, 'SUPAVEC', { userId });
}
```

### 2. API Logger (`src/utils/apiLogger.js`)

Provides structured logging for all API calls with performance metrics collection.

**Key Features:**
- Request/response logging with unique request IDs
- Performance metrics tracking (response times, error rates)
- Fallback event logging
- Metrics summary generation

**Usage Example:**
```javascript
import { logApiRequest, logApiResponse } from './utils/apiLogger.js';

const context = logApiRequest('SUPAVEC', 'createReplica', { userId, replicaName });

try {
  const result = await createReplica(data);
  logApiResponse(context, true, result);
  return result;
} catch (error) {
  logApiResponse(context, false, null, error);
  throw error;
}
```

### 3. Fallback Strategy (`src/utils/fallbackStrategy.js`)

Implements automatic retry logic, fallback mechanisms, and circuit breaker patterns.

**Key Features:**
- Exponential backoff with jitter for retries
- Automatic fallback from Supavec to Sensay
- Circuit breaker pattern to prevent cascading failures
- Configurable retry and circuit breaker settings

**Usage Example:**
```javascript
import { withRetry, withFallback, withRetryAndFallback } from './utils/fallbackStrategy.js';

// Simple retry
const result = await withRetry(
  () => apiCall(),
  { apiSource: 'SUPAVEC', operation: 'createReplica', maxAttempts: 3 }
);

// Retry with fallback
const result = await withRetryAndFallback(
  () => supavecCall(),
  () => sensayCall(),
  { primaryApi: 'SUPAVEC', fallbackApi: 'SENSAY', operation: 'chat' }
);
```

## Circuit Breaker Pattern

The circuit breaker prevents repeated calls to failing services:

**States:**
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Service is failing, requests fail fast
- **HALF_OPEN**: Testing if service recovered

**Configuration:**
```javascript
import { configureCircuitBreaker } from './utils/fallbackStrategy.js';

configureCircuitBreaker({
  failureThreshold: 5,      // Failures before opening circuit
  successThreshold: 2,      // Successes to close from half-open
  timeout: 60000,           // Time before trying half-open (ms)
  monitoringPeriod: 10000   // Period to track failures (ms)
});
```

## Health Check Endpoints

New health check endpoints provide visibility into system status:

### `/health`
Basic health check with minimal response.

### `/health/detailed`
Detailed health check including:
- API configuration status
- Circuit breaker states
- Overall system health

### `/health/metrics`
Performance metrics including:
- API call counts
- Response time statistics (min, max, avg, p50, p95, p99)
- Error counts
- Fallback usage

### `/health/circuit-breakers`
Current circuit breaker status for all APIs.

### `/health/config`
Current migration configuration summary.

## Integration with Existing Services

The error handling system is integrated into:

1. **replicaAbstractionService.js**: All replica operations use retry and fallback
2. **supavecService.js**: Core Supavec operations log requests/responses
3. **Migration routes**: All API endpoints benefit from standardized error handling

## Error Codes

Common error codes:
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Permission denied
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Too many requests
- `SERVICE_ERROR`: Internal service error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `TIMEOUT`: Request timed out
- `NETWORK_ERROR`: Network connectivity issue

## Best Practices

1. **Always use standardized error codes** instead of raw HTTP status codes
2. **Log API requests and responses** for debugging and monitoring
3. **Use retry logic for transient failures** (timeouts, rate limits, service unavailable)
4. **Implement fallback for critical operations** when migrating between APIs
5. **Monitor circuit breaker status** to detect service degradation early
6. **Review metrics regularly** to identify performance issues

## Testing

A test script is provided at `test-error-handling.js` to verify the error handling system:

```bash
node test-error-handling.js
```

This tests:
- Error code mapping
- Retry logic
- Fallback mechanisms
- API logging
- Metrics collection
- Circuit breaker functionality
- Error classification
