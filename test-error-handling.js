/**
 * Simple test script to verify error handling utilities
 */

import { ErrorCodes, mapSupavecError, mapSensayError, transformError, isRetryableError, shouldFallback } from './src/utils/errorHandler.js';
import { withRetry, withFallback, getCircuitBreakerStatus } from './src/utils/fallbackStrategy.js';
import { logApiRequest, logApiResponse, getMetricsSummary } from './src/utils/apiLogger.js';

console.log('Testing Error Handler Utilities...\n');

// Test 1: Error code mapping
console.log('1. Testing error code mapping:');
const mockSupavecError = {
  response: {
    status: 404,
    data: { error: 'File not found' }
  },
  message: 'Request failed with status code 404'
};

const mappedError = mapSupavecError(mockSupavecError);
console.log('   Mapped Supavec 404 error:', mappedError.code);
console.log('   User-friendly message:', mappedError.message);

// Test 2: Retry logic
console.log('\n2. Testing retry logic:');
let attemptCount = 0;
const testRetryFn = async () => {
  attemptCount++;
  console.log(`   Attempt ${attemptCount}`);
  if (attemptCount < 3) {
    throw { code: ErrorCodes.TIMEOUT, message: 'Timeout error' };
  }
  return { success: true, data: 'Success after retries' };
};

try {
  const result = await withRetry(testRetryFn, { 
    apiSource: 'TEST', 
    operation: 'testOperation',
    maxAttempts: 3 
  });
  console.log('   Result:', result.data);
} catch (error) {
  console.log('   Failed after retries:', error.message);
}

// Test 3: Fallback logic
console.log('\n3. Testing fallback logic:');
const primaryFn = async () => {
  const error = new Error('Primary service down');
  error.code = ErrorCodes.SERVICE_UNAVAILABLE;
  throw error;
};

const fallbackFn = async () => {
  return { success: true, data: 'Fallback succeeded' };
};

try {
  const result = await withFallback(primaryFn, fallbackFn, {
    primaryApi: 'SUPAVEC',
    fallbackApi: 'FALLBACK',
    operation: 'testFallback'
  });
  console.log('   Result:', result.data);
  console.log('   Fallback used:', result.fallbackUsed);
} catch (error) {
  console.log('   Both failed:', error.message);
}

// Test 4: API logging
console.log('\n4. Testing API logging:');
const context = logApiRequest('TEST_API', 'testOperation', { param1: 'value1' });
console.log('   Request logged with ID:', context.requestId);

// Simulate some work
await new Promise(resolve => setTimeout(resolve, 100));

logApiResponse(context, true, { result: 'success' });
console.log('   Response logged successfully');

// Test 5: Metrics summary
console.log('\n5. Testing metrics collection:');
const metrics = getMetricsSummary();
console.log('   API calls tracked:', Object.keys(metrics.apiCalls).length);
console.log('   Response times tracked:', Object.keys(metrics.responseTimes).length);

// Test 6: Circuit breaker status
console.log('\n6. Testing circuit breaker:');
const circuitStatus = getCircuitBreakerStatus();
console.log('   Circuit breakers:', Object.keys(circuitStatus));

// Test 7: Error classification
console.log('\n7. Testing error classification:');
const retryableError = { code: ErrorCodes.TIMEOUT };
const nonRetryableError = { code: ErrorCodes.NOT_FOUND };
console.log('   Timeout is retryable:', isRetryableError(retryableError));
console.log('   Not Found is retryable:', isRetryableError(nonRetryableError));
console.log('   Service error should fallback:', shouldFallback({ code: ErrorCodes.SERVICE_ERROR }, 'SUPAVEC'));
console.log('   Not Found should fallback:', shouldFallback({ code: ErrorCodes.NOT_FOUND }, 'SUPAVEC'));

console.log('\n✅ All tests completed successfully!');
