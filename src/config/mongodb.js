import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * MongoDB connection configuration using Mongoose
 */
class MongoDBConfig {
  constructor() {
    this.connectionString = process.env.MONGODB_URL || process.env.DATABASE_URL || 'mongodb://localhost:27017/sensay';
    this.connected = false;
    this.registeredSignals = false;
    this.connectionInfo = this.parseConnectionInfo(this.connectionString);
    
    // Configure mongoose settings
    mongoose.set('strictQuery', false);
  }

  parseConnectionInfo(connectionString) {
    if (!connectionString) {
      return { host: 'unknown', port: 'unknown', database: 'unknown' };
    }

    try {
      const url = new URL(connectionString);
      return {
        host: url.hostname,
        port: url.port || '27017',
        database: url.pathname.replace(/^\//, '') || 'sensay'
      };
    } catch (error) {
      console.warn('Unable to parse MONGODB_URL for logging:', error.message);
      return { host: 'localhost', port: '27017', database: 'sensay' };
    }
  }

  get mongoose() {
    return mongoose;
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    if (this.connected) {
      return mongoose;
    }

    try {
      console.log('Connecting to MongoDB via Mongoose...');
      
      const options = {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        bufferCommands: false, // Disable mongoose buffering
      };

      await mongoose.connect(this.connectionString, options);
      this.connected = true;

      console.log('✅ MongoDB connected successfully');
      console.log(`📊 Database: ${this.connectionInfo.database}`);
      console.log(`🔗 Host: ${this.connectionInfo.host}:${this.connectionInfo.port}`);

      this.setupEventListeners();

      return mongoose;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      console.log('⚠️ Server will continue without database functionality');
      console.log('💡 Ensure MONGODB_URL is set and reachable, then restart the server');
      return false;
    }
  }

  setupEventListeners() {
    if (this.registeredSignals) return;

    // MongoDB connection events
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      this.connected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('MongoDB disconnected');
      this.connected = false;
    });

    // Process termination events
    process.on('SIGINT', async () => {
      try {
        await this.disconnect();
        console.log('👋 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    this.registeredSignals = true;
  }

  async disconnect() {
    if (!this.connected) return;

    try {
      await mongoose.connection.close();
      this.connected = false;
      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      host: this.connectionInfo.host,
      port: this.connectionInfo.port,
      name: this.connectionInfo.database,
      readyState: mongoose.connection.readyState
    };
  }

  async healthCheck() {
    try {
      if (!this.connected || mongoose.connection.readyState !== 1) {
        return {
          healthy: false,
          error: 'MongoDB not connected',
          readyState: mongoose.connection.readyState,
          timestamp: new Date().toISOString()
        };
      }

      // Simple ping to check connection
      await mongoose.connection.db.admin().ping();

      const status = this.getConnectionStatus();
      return {
        healthy: true,
        status: status.status,
        database: status.name,
        host: `${status.host}:${status.port}`,
        readyState: status.readyState,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.connected = false;
      
      return {
        healthy: false,
        error: error.message,
        readyState: mongoose.connection.readyState,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Ensure database connection is active, reconnect if needed
   */
  async ensureConnection() {
    try {
      if (!this.connected || mongoose.connection.readyState !== 1) {
        await this.connect();
        return true;
      }
      
      // Quick health check
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      console.warn('Database connection lost, attempting reconnection:', error.message);
      this.connected = false;
      
      try {
        await this.connect();
        return true;
      } catch (reconnectError) {
        console.error('Failed to reconnect to database:', reconnectError.message);
        return false;
      }
    }
  }
}

export default new MongoDBConfig();