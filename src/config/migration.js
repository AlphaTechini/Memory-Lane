/**
 * Migration configuration for Sensay to Supavec API transition
 */

import logger from '../utils/logger.js';

// Environment variables for migration configuration
const MIGRATION_MODE = process.env.MIGRATION_MODE || 'SUPAVEC_ONLY';
const USE_SUPAVEC_FOR_NEW_REPLICAS = process.env.USE_SUPAVEC_FOR_NEW_REPLICAS !== 'false';
const USE_SUPAVEC_FOR_CHAT = process.env.USE_SUPAVEC_FOR_CHAT !== 'false';
const ENABLE_SENSAY_FALLBACK = process.env.ENABLE_SENSAY_FALLBACK === 'true';
const NAMESPACE_STRATEGY = process.env.NAMESPACE_STRATEGY || 'USER_ID';

// Sensay API configuration
const SENSAY_ORGANIZATION_SECRET = process.env.SENSAY_ORGANIZATION_SECRET;
const SENSAY_BASE_URL = process.env.SENSAY_BASE_URL || 'https://api.sensay.io';
const SENSAY_FALLBACK_ENABLED = process.env.SENSAY_FALLBACK_ENABLED === 'true';

// Supavec API configuration
const SUPAVEC_API_KEY = process.env.SUPAVEC_API_KEY;
const SUPAVEC_BASE_URL = process.env.SUPAVEC_BASE_URL || 'https://api.supavec.com';
const SUPAVEC_TIMEOUT = parseInt(process.env.SUPAVEC_TIMEOUT) || 30000;

/**
 * Migration configuration object
 */
export const migrationConfig = {
  // Migration mode: 'DUAL', 'SENSAY_ONLY', 'SUPAVEC_ONLY'
  mode: MIGRATION_MODE,
  
  // Feature flags
  useSupavecForNewReplicas: USE_SUPAVEC_FOR_NEW_REPLICAS,
  useSupavecForChat: USE_SUPAVEC_FOR_CHAT,
  enableSensayFallback: ENABLE_SENSAY_FALLBACK,
  
  // Namespace strategy for Supavec
  namespaceStrategy: NAMESPACE_STRATEGY, // 'USER_ID', 'EMAIL', 'CUSTOM'
  
  // API configurations
  sensay: {
    organizationSecret: SENSAY_ORGANIZATION_SECRET,
    baseUrl: SENSAY_BASE_URL,
    enabled: Boolean(SENSAY_ORGANIZATION_SECRET) && SENSAY_FALLBACK_ENABLED,
    isConfigured: () => Boolean(SENSAY_ORGANIZATION_SECRET)
  },
  
  supavec: {
    apiKey: SUPAVEC_API_KEY,
    baseUrl: SUPAVEC_BASE_URL,
    timeout: SUPAVEC_TIMEOUT,
    enabled: Boolean(SUPAVEC_API_KEY),
    isConfigured: () => Boolean(SUPAVEC_API_KEY)
  },
  
  // Validation methods
  isProperlyConfigured: () => {
    const config = migrationConfig;
    
    switch (config.mode) {
      case 'SENSAY_ONLY':
        return config.sensay.isConfigured();
      case 'SUPAVEC_ONLY':
        return config.supavec.isConfigured();
      case 'DUAL':
        return config.sensay.isConfigured() && config.supavec.isConfigured();
      default:
        return false;
    }
  },
  
  // Get namespace for user
  getNamespaceForUser: (userId, userEmail) => {
    switch (NAMESPACE_STRATEGY) {
      case 'EMAIL':
        return userEmail;
      case 'USER_ID':
      default:
        return userId;
    }
  },
  
  // Determine which API to use for operation
  shouldUseSupavec: (operation) => {
    const config = migrationConfig;
    
    if (config.mode === 'SENSAY_ONLY') return false;
    if (config.mode === 'SUPAVEC_ONLY') return true;
    
    // DUAL mode - check specific operation flags
    switch (operation) {
      case 'CREATE_REPLICA':
        return config.useSupavecForNewReplicas;
      case 'CHAT':
        return config.useSupavecForChat;
      default:
        return true; // Default to Supavec for new operations
    }
  },
  
  // Check if fallback is available
  canFallbackToSensay: () => {
    return migrationConfig.enableSensayFallback && migrationConfig.sensay.enabled;
  }
};

/**
 * Validate migration configuration on startup
 */
export const validateMigrationConfig = () => {
  const config = migrationConfig;
  const errors = [];
  const warnings = [];
  
  // Check migration mode
  const validModes = ['DUAL', 'SENSAY_ONLY', 'SUPAVEC_ONLY'];
  if (!validModes.includes(config.mode)) {
    errors.push(`Invalid MIGRATION_MODE: ${config.mode}. Must be one of: ${validModes.join(', ')}`);
  }
  
  // Check API configurations based on mode
  switch (config.mode) {
    case 'SENSAY_ONLY':
      if (!config.sensay.isConfigured()) {
        errors.push('SENSAY_ORGANIZATION_SECRET is required when MIGRATION_MODE is SENSAY_ONLY');
      }
      if (!config.supavec.isConfigured()) {
        warnings.push('SUPAVEC_API_KEY not configured. Migration to Supavec will not be possible.');
      }
      break;
      
    case 'SUPAVEC_ONLY':
      if (!config.supavec.isConfigured()) {
        errors.push('SUPAVEC_API_KEY is required when MIGRATION_MODE is SUPAVEC_ONLY');
      }
      if (config.enableSensayFallback && !config.sensay.isConfigured()) {
        warnings.push('ENABLE_SENSAY_FALLBACK is true but SENSAY_ORGANIZATION_SECRET not configured');
      }
      break;
      
    case 'DUAL':
      if (!config.sensay.isConfigured()) {
        errors.push('SENSAY_ORGANIZATION_SECRET is required when MIGRATION_MODE is DUAL');
      }
      if (!config.supavec.isConfigured()) {
        errors.push('SUPAVEC_API_KEY is required when MIGRATION_MODE is DUAL');
      }
      break;
  }
  
  // Check namespace strategy
  const validStrategies = ['USER_ID', 'EMAIL', 'CUSTOM'];
  if (!validStrategies.includes(config.namespaceStrategy)) {
    warnings.push(`Unknown NAMESPACE_STRATEGY: ${config.namespaceStrategy}. Using USER_ID as default.`);
  }
  
  // Validate Supavec configuration details
  if (config.supavec.isConfigured()) {
    if (config.supavec.timeout < 5000) {
      warnings.push('SUPAVEC_TIMEOUT is less than 5 seconds, which may cause timeouts for large operations');
    }
    if (config.supavec.timeout > 120000) {
      warnings.push('SUPAVEC_TIMEOUT is greater than 2 minutes, which may cause client timeouts');
    }
    
    // Validate base URL format
    try {
      new URL(config.supavec.baseUrl);
    } catch (error) {
      errors.push(`Invalid SUPAVEC_BASE_URL format: ${config.supavec.baseUrl}`);
    }
  }
  
  // Validate Sensay configuration details
  if (config.sensay.isConfigured()) {
    try {
      new URL(config.sensay.baseUrl);
    } catch (error) {
      errors.push(`Invalid SENSAY_BASE_URL format: ${config.sensay.baseUrl}`);
    }
  }
  
  // Check for conflicting configurations
  if (config.mode === 'SUPAVEC_ONLY' && !config.useSupavecForNewReplicas) {
    warnings.push('MIGRATION_MODE is SUPAVEC_ONLY but USE_SUPAVEC_FOR_NEW_REPLICAS is false');
  }
  
  if (config.mode === 'SUPAVEC_ONLY' && !config.useSupavecForChat) {
    warnings.push('MIGRATION_MODE is SUPAVEC_ONLY but USE_SUPAVEC_FOR_CHAT is false');
  }
  
  // Log results
  if (errors.length > 0) {
    logger.error('Migration configuration errors:', errors);
    throw new Error(`Migration configuration invalid: ${errors.join('; ')}`);
  }
  
  if (warnings.length > 0) {
    logger.warn('Migration configuration warnings:', warnings);
  }
  
  logger.info('Migration configuration validated successfully', {
    mode: config.mode,
    supavecEnabled: config.supavec.enabled,
    sensayEnabled: config.sensay.enabled,
    fallbackEnabled: config.enableSensayFallback,
    namespaceStrategy: config.namespaceStrategy
  });
  
  return {
    valid: true,
    errors,
    warnings,
    config: {
      mode: config.mode,
      supavecEnabled: config.supavec.enabled,
      sensayEnabled: config.sensay.enabled,
      fallbackEnabled: config.enableSensayFallback,
      namespaceStrategy: config.namespaceStrategy,
      supavecTimeout: config.supavec.timeout
    }
  };
};

/**
 * Get configuration summary for health checks
 */
export const getConfigurationSummary = () => {
  const config = migrationConfig;
  
  return {
    mode: config.mode,
    apis: {
      supavec: {
        configured: config.supavec.isConfigured(),
        enabled: config.supavec.enabled,
        baseUrl: config.supavec.baseUrl
      },
      sensay: {
        configured: config.sensay.isConfigured(),
        enabled: config.sensay.enabled,
        baseUrl: config.sensay.baseUrl
      }
    },
    features: {
      useSupavecForNewReplicas: config.useSupavecForNewReplicas,
      useSupavecForChat: config.useSupavecForChat,
      enableSensayFallback: config.enableSensayFallback
    },
    namespaceStrategy: config.namespaceStrategy,
    isProperlyConfigured: config.isProperlyConfigured()
  };
};