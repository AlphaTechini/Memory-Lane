// Load environment variables BEFORE any other imports that might read them
import './config/loadEnv.js';
import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import replicaRoutes from './routes/replicaApi.js';
import authRoutes from './routes/authRoutes.js';
import galleryRoutes from './routes/gallery/index.js';
import replicaImageRoutes from './routes/replicaImageRoutes.js';
import genericChatRoutes from './routes/genericChatRoutes.js';
import databaseConfig from './config/database.js';
import { validateMigrationConfig } from './config/migration.js';

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

// Track request start times for response-time logging
server.addHook('onRequest', (request, reply, done) => {
  request.logMeta = { startHrTime: process.hrtime.bigint() };
  done();
});

// Emit structured request logs (skip ultra-frequent health/root probes)
server.addHook('onResponse', (request, reply, done) => {
  const routePath = request.routeOptions?.url || request.routerPath || request.raw?.url || '';
  if (routePath === '/health' || routePath === '/') {
    done();
    return;
  }

  let responseTimeMs;
  if (request.logMeta?.startHrTime) {
    const diffNs = process.hrtime.bigint() - request.logMeta.startHrTime;
    responseTimeMs = Number(diffNs) / 1e6;
  }

  request.log.info({
    method: request.method,
    url: routePath,
    statusCode: reply.statusCode,
    responseTimeMs
  }, 'request completed');

  done();
});

// Global rate limiting
// Environment variables (optional):
// RATE_LIMIT_MAX=100  (max requests per window per IP)
// RATE_LIMIT_WINDOW=1 minute  (any ms or human time like '1 minute')
// RATE_LIMIT_TIMEFRAME (alias of window used by plugin) -> we map if provided
// RATE_LIMIT_SKIP_LIST=127.0.0.1,::1 (comma-separated IPs to skip)
// RATE_LIMIT_ALLOW_LIST=login:50,signup:20 (route-specific overrides handled later)
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '120', 10); // per window
const rateLimitWindow = process.env.RATE_LIMIT_WINDOW || process.env.RATE_LIMIT_TIMEFRAME || '1 minute';
const skipIps = (process.env.RATE_LIMIT_SKIP_LIST || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

await server.register(rateLimit, {
  max: rateLimitMax,
  timeWindow: rateLimitWindow,
  allowList: (req, key) => {
    // Skip explicit IPs
    if (skipIps.includes(key)) return true;
    return false; // Enforce otherwise
  },
  addHeadersOnSuccess: true,
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true
  }
});

// Register CORS plugin
// Build CORS allowedOrigins set from environment variables for flexible dev setups.
// FRONTEND_URLS (comma-separated) or FRONTEND_URL (single) populate the initial list.
// We also expose a protected endpoint that allows the frontend (or a dev script) to
// register its current exposed origin at runtime (useful when running with `--host`).
const defaultFrontendOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174', 
  'http://localhost:3000',
  'https://memorylane.cyberpunk.work'
];
const rawFrontend = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
const envOrigins = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = new Set([...envOrigins, ...defaultFrontendOrigins]);

// CORS origin as function: allow if no origin (curl/servers), if origin is in allowedOrigins,
// or if the origin appears to be a local development origin (localhost, 127.0.0.1, [::1], 0.0.0.0).
await server.register(cors, {
  origin: (origin, cb) => {
    // When origin is undefined (for same-origin or tools like curl), allow.
    if (!origin) return cb(null, true);

    // Exact-match allowed origins from env or defaults
    if (allowedOrigins.has(origin)) return cb(null, true);

    // Allow common local development origins (including IPv6 loopback).
    // Examples: http://localhost:5173, http://127.0.0.1:5173, http://[::1]:5173
    const localOriginRegex = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i;
    if (localOriginRegex.test(origin)) {
      // Add to the allowedOrigins set so future requests are accepted without regex test
      try {
        allowedOrigins.add(origin);
        // Log at info level that we dynamically allowed a dev origin
        server.log.info({ origin }, 'Allowing local development CORS origin');
      } catch (e) {
        // ignore logging errors here
      }
      return cb(null, true);
    }

    // Not allowed
    return cb(new Error('CORS origin not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Internal admin endpoints to manage origins at runtime.
// Protect these with ORIGIN_REGISTRATION_SECRET to avoid open registration.
const originRegistrationSecret = process.env.ORIGIN_REGISTRATION_SECRET || '';

server.post('/internal/register-origin', async (request, reply) => {
  try {
    const token = request.headers['x-origin-secret'] || '';
    if (!originRegistrationSecret || token !== originRegistrationSecret) {
      return reply.code(401).send({ success: false, message: 'Unauthorized' });
    }
    const { origin } = request.body || {};
    if (!origin || typeof origin !== 'string') {
      return reply.code(400).send({ success: false, message: 'Invalid origin' });
    }
    allowedOrigins.add(origin);
    request.log.info({ origin }, 'Registered new allowed CORS origin');
    return reply.send({ success: true, message: 'Origin registered', origin });
  } catch (err) {
    request.log.error(err, 'Failed to register origin');
    reply.code(500).send({ success: false, message: 'Internal error' });
  }
});

server.get('/internal/allowed-origins', async (request, reply) => {
  try {
    const token = request.headers['x-origin-secret'] || '';
    if (!originRegistrationSecret || token !== originRegistrationSecret) {
      return reply.code(401).send({ success: false, message: 'Unauthorized' });
    }
    return reply.send({ success: true, origins: Array.from(allowedOrigins) });
  } catch (err) {
    request.log.error(err, 'Failed to read allowed origins');
    reply.code(500).send({ success: false, message: 'Internal error' });
  }
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

// Validate migration configuration on startup
try {
  validateMigrationConfig();
} catch (err) {
  server.log.error({ err }, 'Migration configuration validation failed');
  process.exit(1);
}

// Connect to MongoDB before registering routes to ensure database is ready
try {
  await databaseConfig.connect();
  if (!databaseConfig.connected) {
    server.log.error('MongoDB connection failed - exiting');
    process.exit(1);
  }
} catch (err) {
  server.log.error({ err }, 'Failed to connect to MongoDB');
  process.exit(1);
}

// Register routes
await server.register(authRoutes);
await server.register(replicaRoutes);
await server.register(galleryRoutes);
await server.register(replicaImageRoutes);
await server.register(genericChatRoutes);
// Register API routes (feedback, etc)
const apiRoutes = (await import('./routes/api/index.js')).default;
await server.register(apiRoutes);
// Register health check routes with enhanced monitoring
const healthRoutes = (await import('./routes/healthApi.js')).default;
await server.register(healthRoutes);

// Admin routes (import conditionally to avoid loading in production accidentally)
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_ADMIN_ROUTES === 'true') {
  const adminRoutes = (await import('./routes/adminRoutes.js')).default;
  await server.register(adminRoutes);
}

// Health check endpoint is now handled by healthApi.js routes

// Root endpoint - simple ok response, keep log noise low
server.get('/', { logLevel: 'error' }, async (request, reply) => {
  reply.send({ status: 'ok', service: 'Sensay AI API' });
});

// Global error handler
server.setErrorHandler((error, request, reply) => {
  // Log full error with request context so stacks appear server-side for debugging
  try {
    server.log.error({ err: error, method: request.method, url: request.url, params: request.params }, 'Unhandled error');
  } catch (logErr) {
    // Fallback to simple error logging if structured logging fails
    server.log.error(error);
  }
  
  // Validation errors
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