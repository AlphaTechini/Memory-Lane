/**
 * Error Handler Utility
 * 
 * Provides standardized error mapping, transformation, and user-friendly messages
 * for both Sensay and Supavec APIs.
 */

import logger from './logger.js';

/**
 * Standardized error codes used across the application
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Rate limiting & quotas
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Service errors
  SERVICE_ERROR: 'SERVICE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  
  // API-specific errors
  API_ERROR: 'API_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  
  // Migration-specific errors
  MIGRATION_ERROR: 'MIGRATION_ERROR',
  FALLBACK_FAILED: 'FALLBACK_FAILED',
  API_NOT_CONFIGURED: 'API_NOT_CONFIGURED',
  
  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * HTTP status code to standardized error code mapping
 */
const httpStatusToErrorCode = {
  400: ErrorCodes.INVALID_INPUT,
  401: ErrorCodes.UNAUTHORIZED,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  409: ErrorCodes.ALREADY_EXISTS,
  422: ErrorCodes.INVALID_FORMAT,
  429: ErrorCodes.RATE_LIMITED,
  500: ErrorCodes.SERVICE_ERROR,
  502: ErrorCodes.SERVICE_UNAVAILABLE,
  503: ErrorCodes.SERVICE_UNAVAILABLE,
  504: ErrorCodes.TIMEOUT
};

/**
 * User-friendly error messages for each error code
 */
const errorMessages = {
  [ErrorCodes.UNAUTHORIZED]: 'Authentication required. Please log in and try again.',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCodes.INVALID_TOKEN]: 'Your session has expired. Please log in again.',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.ALREADY_EXISTS]: 'This resource already exists.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCodes.QUOTA_EXCEEDED]: 'You have exceeded your usage quota. Please contact support.',
  [ErrorCodes.INVALID_INPUT]: 'The provided input is invalid. Please check your data and try again.',
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Required information is missing. Please provide all required fields.',
  [ErrorCodes.INVALID_FORMAT]: 'The data format is incorrect. Please check and try again.',
  [ErrorCodes.SERVICE_ERROR]: 'An internal error occurred. Please try again later.',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again later.',
  [ErrorCodes.TIMEOUT]: 'The request timed out. Please try again.',
  [ErrorCodes.NETWORK_ERROR]: 'A network error occurred. Please check your connection and try again.',
  [ErrorCodes.CONNECTION_FAILED]: 'Failed to connect to the service. Please try again later.',
  [ErrorCodes.API_ERROR]: 'An API error occurred. Please try again.',
  [ErrorCodes.EXTERNAL_API_ERROR]: 'An external service error occurred. Please try again later.',
  [ErrorCodes.MIGRATION_ERROR]: 'A migration error occurred. Please contact support.',
  [ErrorCodes.FALLBACK_FAILED]: 'Primary and fallback services failed. Please try again later.',
  [ErrorCodes.API_NOT_CONFIGURED]: 'The service is not properly configured. Please contact support.',
  [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
};

/**
 * Map Supavec API error to standardized error
 * @param {Error} error - The error from Supavec API
 * @returns {object} Standardized error object
 */
export const mapSupavecError = (error) => {
  const statusCode = error.response?.status;
  const errorData = error.response?.data;
  
  // Map HTTP status to error code
  let errorCode = httpStatusToErrorCode[statusCode] || ErrorCodes.UNKNOWN_ERROR;
  
  // Check for specific Supavec error patterns
  if (errorData) {
    if (errorData.error?.includes('namespace')) {
      errorCode = ErrorCodes.FORBIDDEN;
    } else if (errorData.error?.includes('not found')) {
      errorCode = ErrorCodes.NOT_FOUND;
    } else if (errorData.error?.includes('invalid')) {
      errorCode = ErrorCodes.INVALID_INPUT;
    } else if (errorData.error?.includes('quota') || errorData.error?.includes('limit')) {
      errorCode = ErrorCodes.QUOTA_EXCEEDED;
    }
  }
  
  // Check for network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    errorCode = ErrorCodes.CONNECTION_FAILED;
  } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    errorCode = ErrorCodes.TIMEOUT;
  }
  
  return {
    code: errorCode,
    message: errorMessages[errorCode],
    originalError: error.message,
    statusCode,
    apiSource: 'SUPAVEC',
    details: errorData,
    timestamp: new Date().toISOString()
  };
};

/**
 * Map Sensay API error to standardized error
 * @param {Error} error - The error from Sensay API
 * @returns {object} Standardized error object
 */
export const mapSensayError = (error) => {
  const statusCode = error.response?.status;
  const errorData = error.response?.data;
  
  // Map HTTP status to error code
  let errorCode = httpStatusToErrorCode[statusCode] || ErrorCodes.UNKNOWN_ERROR;
  
  // Check for specific Sensay error patterns
  if (errorData) {
    if (errorData.message?.includes('unauthorized') || errorData.message?.includes('authentication')) {
      errorCode = ErrorCodes.UNAUTHORIZED;
    } else if (errorData.message?.includes('not found')) {
      errorCode = ErrorCodes.NOT_FOUND;
    } else if (errorData.message?.includes('invalid')) {
      errorCode = ErrorCodes.INVALID_INPUT;
    } else if (errorData.message?.includes('rate limit')) {
      errorCode = ErrorCodes.RATE_LIMITED;
    }
  }
  
  // Check for network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    errorCode = ErrorCodes.CONNECTION_FAILED;
  } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    errorCode = ErrorCodes.TIMEOUT;
  }
  
  return {
    code: errorCode,
    message: errorMessages[errorCode],
    originalError: error.message,
    statusCode,
    apiSource: 'SENSAY',
    details: errorData,
    timestamp: new Date().toISOString()
  };
};

/**
 * Transform error to user-friendly format
 * @param {Error|object} error - The error to transform
 * @param {string} [apiSource] - The API source ('SUPAVEC' or 'SENSAY')
 * @returns {object} User-friendly error object
 */
export const transformError = (error, apiSource = null) => {
  // If already a standardized error, return as is
  if (error.code && errorMessages[error.code]) {
    return error;
  }
  
  // Map based on API source
  if (apiSource === 'SUPAVEC') {
    return mapSupavecError(error);
  } else if (apiSource === 'SENSAY') {
    return mapSensayError(error);
  }
  
  // Generic error transformation
  const statusCode = error.response?.status;
  const errorCode = httpStatusToErrorCode[statusCode] || ErrorCodes.UNKNOWN_ERROR;
  
  return {
    code: errorCode,
    message: errorMessages[errorCode],
    originalError: error.message || String(error),
    statusCode,
    apiSource: apiSource || 'UNKNOWN',
    timestamp: new Date().toISOString()
  };
};

/**
 * Get user-friendly error message
 * @param {string} errorCode - The error code
 * @param {object} [context] - Additional context for the message
 * @returns {string} User-friendly error message
 */
export const getUserFriendlyMessage = (errorCode, context = {}) => {
  let message = errorMessages[errorCode] || errorMessages[ErrorCodes.UNKNOWN_ERROR];
  
  // Add context-specific information
  if (context.resourceType) {
    message = message.replace('resource', context.resourceType);
  }
  
  if (context.action) {
    message = `Failed to ${context.action}: ${message}`;
  }
  
  return message;
};

/**
 * Determine if an error is retryable
 * @param {object} error - The standardized error object
 * @returns {boolean} True if the error is retryable
 */
export const isRetryableError = (error) => {
  const retryableCodes = [
    ErrorCodes.TIMEOUT,
    ErrorCodes.SERVICE_UNAVAILABLE,
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.CONNECTION_FAILED,
    ErrorCodes.RATE_LIMITED
  ];
  
  return retryableCodes.includes(error.code);
};

/**
 * Determine if an error should trigger fallback
 * @param {object} error - The standardized error object
 * @param {string} primaryApi - The primary API that failed
 * @returns {boolean} True if fallback should be attempted
 */
export const shouldFallback = (error, primaryApi) => {
  // Only fallback from Supavec to Sensay
  if (primaryApi !== 'SUPAVEC') {
    return false;
  }
  
  // Don't fallback for client errors (4xx except rate limiting)
  const noFallbackCodes = [
    ErrorCodes.UNAUTHORIZED,
    ErrorCodes.FORBIDDEN,
    ErrorCodes.NOT_FOUND,
    ErrorCodes.INVALID_INPUT,
    ErrorCodes.INVALID_FORMAT
  ];
  
  if (noFallbackCodes.includes(error.code)) {
    return false;
  }
  
  // Fallback for server errors and service issues
  return true;
};

/**
 * Create a standardized error response for API endpoints
 * @param {Error|object} error - The error to format
 * @param {string} [apiSource] - The API source
 * @param {object} [additionalContext] - Additional context to include
 * @returns {object} Formatted error response
 */
export const createErrorResponse = (error, apiSource = null, additionalContext = {}) => {
  const standardizedError = transformError(error, apiSource);
  
  logger.error('Error occurred:', {
    code: standardizedError.code,
    message: standardizedError.originalError,
    apiSource: standardizedError.apiSource,
    statusCode: standardizedError.statusCode,
    ...additionalContext
  });
  
  return {
    success: false,
    error: {
      code: standardizedError.code,
      message: standardizedError.message,
      timestamp: standardizedError.timestamp
    },
    ...additionalContext
  };
};

/**
 * Wrap an async function with error handling
 * @param {Function} fn - The async function to wrap
 * @param {string} [apiSource] - The API source for error mapping
 * @returns {Function} Wrapped function with error handling
 */
export const withErrorHandling = (fn, apiSource = null) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const standardizedError = transformError(error, apiSource);
      throw standardizedError;
    }
  };
};

/**
 * Log error with structured information
 * @param {Error|object} error - The error to log
 * @param {string} operation - The operation that failed
 * @param {object} [context] - Additional context
 */
export const logError = (error, operation, context = {}) => {
  const standardizedError = error.code ? error : transformError(error);
  
  logger.error(`Operation failed: ${operation}`, {
    errorCode: standardizedError.code,
    errorMessage: standardizedError.originalError || standardizedError.message,
    apiSource: standardizedError.apiSource,
    statusCode: standardizedError.statusCode,
    operation,
    ...context,
    timestamp: standardizedError.timestamp
  });
};

export default {
  ErrorCodes,
  mapSupavecError,
  mapSensayError,
  transformError,
  getUserFriendlyMessage,
  isRetryableError,
  shouldFallback,
  createErrorResponse,
  withErrorHandling,
  logError
};
