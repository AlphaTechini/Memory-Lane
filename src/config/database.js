import mongoose from 'mongoose';

/**
 * MongoDB connection configuration
 */
class DatabaseConfig {
  constructor() {
    // Default to MongoDB Atlas connection string format
    this.connectionString = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@<cluster>.mongodb.net/sensay-ai?retryWrites=true&w=majority';
    this.options = {
      // Connection pool settings optimized for Atlas
      maxPoolSize: 50, // Maintain up to 50 socket connections for cluster
      minPoolSize: 5, // Maintain minimum 5 connections
      serverSelectionTimeoutMS: 30000, // 30 seconds for Atlas connection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      connectTimeoutMS: 30000, // 30 seconds connection timeout
      
      // Atlas specific options
      retryWrites: true,
      w: 'majority',
      
      // Helpful for development and Atlas
  family: 4 // Use IPv4, skip trying IPv6 (modern driver defaults handle parser & topology)

  // NOTE: Removed deprecated options `useNewUrlParser` and `useUnifiedTopology`.
  // They are defaults since MongoDB Node Driver >=4 and produce warnings if supplied.
    };
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      console.log('Connecting to MongoDB...');
      
      await mongoose.connect(this.connectionString, this.options);
      
      console.log('✅ MongoDB connected successfully');
      console.log(`📊 Database: ${mongoose.connection.name}`);
      console.log(`🔗 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      
      // Handle connection events
      this.setupEventListeners();
      
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      console.log('⚠️ Server will continue without database functionality');
      console.log('💡 To enable database features, please start MongoDB and restart the server');
      
      // Don't exit the process, just log the error
      return false;
    }
  }

  /**
   * Setup MongoDB event listeners
   */
  setupEventListeners() {
    const db = mongoose.connection;

    db.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    db.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    db.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // Handle application termination
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
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return {
      status: states[mongoose.connection.readyState],
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  /**
   * Health check for database
   */
  async healthCheck() {
    try {
      const status = this.getConnectionStatus();
      
      if (status.status === 'connected') {
        // Test a simple operation
        await mongoose.connection.db.admin().ping();
        return {
          healthy: true,
          status: status.status,
          database: status.name,
          host: `${status.host}:${status.port}`,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          healthy: false,
          status: status.status,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default new DatabaseConfig();
