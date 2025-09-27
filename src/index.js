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
const defaultFrontendOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
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

// Root landing page - helpful when visiting the app URL in a browser
server.get('/', async (request, reply) => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Sensay AI API</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;padding:2rem}</style>
      </head>
      <body>
        <h1>Sensay AI API</h1>
        <p>This server hosts the Sensay Memory Care API backend.</p>
        <ul>
          <li><a href="/health">Health check</a></li>
          <li><a href="/documentation">API documentation (if enabled)</a></li>
        </ul>
        <p>If you intended to view the frontend app, deploy or host the Svelte frontend separately and configure a reverse proxy to forward API calls to this service (see README).</p>
      </body>
    </html>
  `;

  reply.type('text/html').send(html);
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