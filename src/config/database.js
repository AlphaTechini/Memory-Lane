import mongodbConfig from './mongodb.js';

/**
 * Database configuration - now using MongoDB
 */
class DatabaseConfig {
  constructor() {
    // Delegate to MongoDB configuration
    this.mongoConfig = mongodbConfig;
  }

  get mongoose() {
    return this.mongoConfig.mongoose;
  }

  get connected() {
    return this.mongoConfig.connected;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    return this.mongoConfig.connect();
  }

  async disconnect() {
    return this.mongoConfig.disconnect();
  }

  getConnectionStatus() {
    return this.mongoConfig.getConnectionStatus();
  }

  async healthCheck() {
    const result = await this.mongoConfig.healthCheck();
    return {
      ok: result.healthy,
      ...result
    };
  }

  /**
   * Ensure database connection is active, reconnect if needed
   */
  async ensureConnection() {
    return this.mongoConfig.ensureConnection();
  }
}

export default new DatabaseConfig();
