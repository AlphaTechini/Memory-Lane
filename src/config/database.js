import { PrismaClient } from '@prisma/client';

/**
 * Postgres connection configuration via Prisma
 */
class DatabaseConfig {
  constructor() {
    this.connectionString = process.env.DATABASE_URL || '';
    
    // Enhanced Prisma client configuration for better connection handling
    const prismaConfig = {
      log: ['warn', 'error'], // Reduce logging noise in production
      errorFormat: 'minimal'
    };
    
    // Add connection pool settings if using a connection string
    if (this.connectionString) {
      // Ensure connection string has proper pool settings for Fly.io
      const enhancedConnectionString = this.enhanceConnectionString(this.connectionString);
      prismaConfig.datasources = { 
        db: { 
          url: enhancedConnectionString 
        } 
      };
    }
    
    this.client = new PrismaClient(prismaConfig);
    this.connected = false;
    this.registeredSignals = false;
    this.connectionInfo = this.parseConnectionInfo(this.connectionString);
  }

  enhanceConnectionString(connectionString) {
    try {
      const url = new URL(connectionString);
      
      // Add connection pool parameters if not already present
      const params = new URLSearchParams(url.search);
      
      // Set reasonable defaults for Fly.io deployment
      if (!params.has('connection_limit')) {
        params.set('connection_limit', '10'); // Limit concurrent connections
      }
      if (!params.has('pool_timeout')) {
        params.set('pool_timeout', '10'); // Connection timeout in seconds
      }
      if (!params.has('connect_timeout')) {
        params.set('connect_timeout', '5'); // Initial connection timeout
      }
      
      url.search = params.toString();
      return url.toString();
    } catch (error) {
      console.warn('Could not enhance connection string:', error.message);
      return connectionString;
    }
  }

  parseConnectionInfo(connectionString) {
    if (!connectionString) {
      return { host: 'unknown', port: 'unknown', database: 'unknown' };
    }

    try {
      const url = new URL(connectionString);
      return {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.replace(/^\//, '') || 'unknown'
      };
    } catch (error) {
      console.warn('Unable to parse DATABASE_URL for logging:', error.message);
      return { host: 'unknown', port: 'unknown', database: 'unknown' };
    }
  }

  get prisma() {
    return this.client;
  }

  /**
   * Connect to Postgres
   */
  async connect() {
    if (this.connected) {
      return this.client;
    }

    try {
      console.log('Connecting to Postgres via Prisma...');
      await this.client.$connect();
      this.connected = true;

      console.log('✅ Postgres connected successfully');
      console.log(`📊 Database: ${this.connectionInfo.database}`);
      console.log(`🔗 Host: ${this.connectionInfo.host}:${this.connectionInfo.port}`);

      this.setupEventListeners();

      return this.client;
    } catch (error) {
      console.error('❌ Postgres connection error:', error.message);
      console.log('⚠️ Server will continue without database functionality');
      console.log('💡 Ensure DATABASE_URL is set and reachable, then restart the server');
      return false;
    }
  }

  setupEventListeners() {
    if (this.registeredSignals) return;

    process.on('SIGINT', async () => {
      try {
        await this.disconnect();
        console.log('👋 Postgres connection closed through app termination');
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
      await this.client.$disconnect();
      this.connected = false;
      console.log('Postgres disconnected');
    } catch (error) {
      console.error('Error disconnecting from Postgres:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      host: this.connectionInfo.host,
      port: this.connectionInfo.port,
      name: this.connectionInfo.database
    };
  }

  async healthCheck() {
    try {
      if (!this.connected) {
        await this.client.$connect();
        this.connected = true;
      }

      await this.client.$queryRaw`SELECT 1`;

      const status = this.getConnectionStatus();
      return {
        healthy: true,
        status: status.status,
        database: status.name,
        host: `${status.host}:${status.port}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // If health check fails, try to reconnect
      this.connected = false;
      try {
        await this.client.$disconnect();
      } catch (disconnectError) {
        console.warn('Error during disconnect in health check:', disconnectError.message);
      }
      
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Ensure database connection is active, reconnect if needed
   */
  async ensureConnection() {
    try {
      if (!this.connected) {
        await this.client.$connect();
        this.connected = true;
      }
      
      // Quick health check
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.warn('Database connection lost, attempting reconnection:', error.message);
      this.connected = false;
      
      try {
        await this.client.$disconnect();
        await this.client.$connect();
        this.connected = true;
        return true;
      } catch (reconnectError) {
        console.error('Failed to reconnect to database:', reconnectError.message);
        return false;
      }
    }
  }
}

export default new DatabaseConfig();
