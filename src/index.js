// Load environment variables BEFORE any other imports that might read them
import './config/loadEnv.js';
import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import replicaRoutes from './routes/replicaApi.js';
import authRoutes from './routes/authRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import replicaImageRoutes from './routes/replicaImageRoutes.js';
import genericChatRoutes from './routes/genericChatRoutes.js';
import databaseConfig from './config/database.js';

// (dotenv already loaded via loadEnv.js)

// Create Fastify instance
const server = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

// Register CORS plugin
await server.register(cors, {
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative dev server
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Register JWT plugin
await server.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
});

// Register multipart plugin for file uploads
await server.register(multipart, {
  limits: {
    fieldNameSize: 100, // Max field name size in bytes
    fieldSize: 100,     // Max field value size in bytes
    fields: 10,         // Max number of non-file fields
    fileSize: 10 * 1024 * 1024, // Max file size (10MB)
    files: 5,           // Max number of file fields
    headerPairs: 2000   // Max number of header key-value pairs
  }
});

// Connect to MongoDB
await databaseConfig.connect();

// Register routes
await server.register(authRoutes);
await server.register(replicaRoutes);
await server.register(galleryRoutes);
await server.register(replicaImageRoutes);
await server.register(genericChatRoutes);

// Health check endpoint
server.get('/health', async (request, reply) => {
  const dbHealth = await databaseConfig.healthCheck();
  
  reply.send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Sensay AI API',
    version: '1.0.0',
    database: dbHealth
  });
});

// Global error handler
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  
  // MongoDB/Mongoose errors
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    reply.code(400).send({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    reply.code(401).send({
      success: false,
      message: 'Invalid token',
      errors: ['Authentication failed']
    });
    return;
  }
  
  // Default error response
  reply.code(error.statusCode || 500).send({
    success: false,
    message: error.message || 'Internal Server Error',
    errors: [error.message || 'Something went wrong']
  });
});

const PORT = process.env.PORT || 4000;

try {
  await server.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📚 API Documentation available at http://localhost:${PORT}/documentation`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}