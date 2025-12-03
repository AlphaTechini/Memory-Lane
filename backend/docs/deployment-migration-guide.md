# Sensay to Supavec Migration Deployment Guide

This document provides comprehensive deployment procedures for migrating from Sensay API to Supavec API, including environment variable requirements, migration procedures, and rollback strategies.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Migration Deployment Procedures](#migration-deployment-procedures)
4. [Health Check Validation](#health-check-validation)
5. [Rollback Procedures](#rollback-procedures)
6. [Troubleshooting](#troubleshooting)

## Environment Variables

### Required Environment Variables

#### Core Application Variables
```bash
# Server Configuration
PORT=4000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-characters
JWT_EXPIRES_IN=7d

# Database Configuration
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require

# Frontend Configuration
FRONTEND_URL=https://your-frontend-domain.com
FRONTEND_URLS=https://your-frontend-domain.com,https://staging.your-domain.com
```

#### Migration Configuration Variables
```bash
# Migration Mode: SENSAY_ONLY, SUPAVEC_ONLY, or DUAL
MIGRATION_MODE=SUPAVEC_ONLY

# Feature Flags
USE_SUPAVEC_FOR_NEW_REPLICAS=true
USE_SUPAVEC_FOR_CHAT=true
ENABLE_SENSAY_FALLBACK=false

# Namespace Strategy: USER_ID, EMAIL, or CUSTOM
NAMESPACE_STRATEGY=USER_ID
```

#### Supavec API Configuration
```bash
# Supavec API (Primary)
SUPAVEC_API_KEY=your-supavec-api-key
SUPAVEC_BASE_URL=https://api.supavec.com
SUPAVEC_TIMEOUT=30000
```

#### Sensay API Configuration (Legacy/Fallback)
```bash
# Sensay API (Legacy - required for fallback or dual mode)
SENSAY_ORGANIZATION_SECRET=your-sensay-organization-secret
SENSAY_BASE_URL=https://api.sensay.io
SENSAY_OWNER_ID=your-sensay-owner-id
SENSAY_FALLBACK_ENABLED=false
SENSAY_API_VERSION=2025-03-25
```

#### Optional Configuration Variables
```bash
# Logging
LOG_LEVEL=info

# Admin Configuration
ADMIN_EMAILS=admin@yourdomain.com,superadmin@yourdomain.com

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOGIN_WINDOW_MS=900000

# Email Configuration (if using email features)
EMAIL_FROM=noreply@yourdomain.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-app-password

# Cloudinary Configuration (if using image uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Environment Variable Validation

The application validates environment variables on startup. Check the logs for validation errors:

```bash
# Check application logs for configuration validation
docker logs your-container-name | grep "Migration configuration"
```

## Pre-Deployment Checklist

### 1. API Key Verification

Before deployment, verify that your API keys are valid:

```bash
# Test Supavec API connectivity
curl -H "Authorization: Bearer YOUR_SUPAVEC_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.supavec.com/view_files?limit=1

# Test Sensay API connectivity (if using fallback)
curl -H "X-ORGANIZATION-SECRET: YOUR_SENSAY_SECRET" \
     -H "X-API-Version: 2025-03-25" \
     -H "Content-Type: application/json" \
     https://api.sensay.io/v1/users/me
```

### 2. Database Migration

Ensure your database schema supports the migration:

```bash
# Run database migrations
npm run migrate

# Verify migration status
npm run migrate:status
```

### 3. Configuration Validation

Test your configuration locally before deployment:

```bash
# Set environment variables
export MIGRATION_MODE=SUPAVEC_ONLY
export SUPAVEC_API_KEY=your-key
# ... other variables

# Start application and check logs
npm start

# Check configuration endpoint
curl http://localhost:4000/health/config
```

## Migration Deployment Procedures

### Phase 1: Dual Mode Deployment (Recommended)

This approach allows for gradual migration with fallback capability.

#### Step 1: Deploy with Dual Configuration

```bash
# Environment configuration for dual mode
MIGRATION_MODE=DUAL
USE_SUPAVEC_FOR_NEW_REPLICAS=true
USE_SUPAVEC_FOR_CHAT=false
ENABLE_SENSAY_FALLBACK=true

# Both API keys required
SUPAVEC_API_KEY=your-supavec-key
SENSAY_ORGANIZATION_SECRET=your-sensay-secret
```

#### Step 2: Validate Dual Mode Operation

```bash
# Check health status
curl https://your-domain.com/health/detailed

# Verify both APIs are accessible
curl https://your-domain.com/health/supavec
curl https://your-domain.com/health/sensay

# Check migration status
curl https://your-domain.com/health/migration
```

#### Step 3: Gradually Enable Supavec Features

```bash
# Update configuration to enable chat migration
USE_SUPAVEC_FOR_CHAT=true

# Redeploy and monitor
```

#### Step 4: Migrate to Supavec-Only Mode

```bash
# Final configuration
MIGRATION_MODE=SUPAVEC_ONLY
USE_SUPAVEC_FOR_NEW_REPLICAS=true
USE_SUPAVEC_FOR_CHAT=true
ENABLE_SENSAY_FALLBACK=false

# Sensay configuration can be removed (but keep for rollback)
```

### Phase 2: Direct Migration (Advanced)

For experienced teams or when dual mode is not feasible.

#### Step 1: Backup Current State

```bash
# Backup database
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup current environment configuration
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
```

#### Step 2: Deploy Supavec-Only Configuration

```bash
# Set environment for Supavec-only mode
MIGRATION_MODE=SUPAVEC_ONLY
USE_SUPAVEC_FOR_NEW_REPLICAS=true
USE_SUPAVEC_FOR_CHAT=true
ENABLE_SENSAY_FALLBACK=false
SUPAVEC_API_KEY=your-supavec-key

# Deploy application
```

#### Step 3: Validate Migration

```bash
# Comprehensive health check
curl https://your-domain.com/health/detailed

# Test replica creation
curl -X POST https://your-domain.com/api/replicas \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Replica","description":"Migration test"}'

# Test chat functionality
curl -X POST https://your-domain.com/api/replicas/REPLICA_ID/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, test message"}'
```

## Health Check Validation

### Available Health Check Endpoints

```bash
# Basic health check
GET /health

# Detailed health with API status
GET /health/detailed

# Configuration summary
GET /health/config

# Supavec API specific health
GET /health/supavec

# Sensay API specific health
GET /health/sensay

# Migration status and recommendations
GET /health/migration

# Performance metrics
GET /health/metrics

# Circuit breaker status
GET /health/circuit-breakers
```

### Health Check Validation Script

```bash
#!/bin/bash
# health-check-validation.sh

BASE_URL="https://your-domain.com"
HEALTH_ENDPOINTS=(
  "/health"
  "/health/detailed"
  "/health/config"
  "/health/supavec"
  "/health/migration"
)

echo "Validating health endpoints..."

for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
  echo "Checking $endpoint..."
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
  
  if [ "$response" = "200" ]; then
    echo "✅ $endpoint - OK"
  else
    echo "❌ $endpoint - Failed (HTTP $response)"
    exit 1
  fi
done

echo "All health checks passed!"
```

### Expected Health Check Responses

#### Healthy Supavec-Only Mode
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "configuration": {
    "mode": "SUPAVEC_ONLY",
    "isProperlyConfigured": true
  },
  "apis": {
    "supavec": {
      "status": "healthy",
      "configured": true,
      "connected": true,
      "responseTime": 150
    },
    "sensay": {
      "status": "unhealthy",
      "configured": false,
      "message": "Sensay API not configured"
    }
  }
}
```

## Rollback Procedures

### Immediate Rollback (Emergency)

If critical issues are detected immediately after deployment:

#### Step 1: Revert Environment Configuration

```bash
# Restore previous environment configuration
cp .env.backup.TIMESTAMP .env

# Or set emergency rollback configuration
MIGRATION_MODE=SENSAY_ONLY
USE_SUPAVEC_FOR_NEW_REPLICAS=false
USE_SUPAVEC_FOR_CHAT=false
ENABLE_SENSAY_FALLBACK=false
SENSAY_ORGANIZATION_SECRET=your-sensay-secret
```

#### Step 2: Redeploy Previous Version

```bash
# Using Docker
docker pull your-registry/app:previous-tag
docker stop current-container
docker run -d --name new-container --env-file .env your-registry/app:previous-tag

# Using process manager
pm2 stop app
git checkout previous-commit
npm install
pm2 start app
```

#### Step 3: Validate Rollback

```bash
# Check application health
curl https://your-domain.com/health/detailed

# Verify Sensay functionality
curl https://your-domain.com/health/sensay

# Test critical user flows
```

### Gradual Rollback (Planned)

For planned rollbacks when issues are discovered over time:

#### Step 1: Switch to Dual Mode

```bash
# Enable dual mode with Sensay priority
MIGRATION_MODE=DUAL
USE_SUPAVEC_FOR_NEW_REPLICAS=false
USE_SUPAVEC_FOR_CHAT=false
ENABLE_SENSAY_FALLBACK=true
```

#### Step 2: Monitor and Validate

```bash
# Monitor application logs
tail -f /var/log/app.log | grep -E "(ERROR|WARN|Migration)"

# Check health endpoints
curl https://your-domain.com/health/migration
```

#### Step 3: Complete Rollback to Sensay-Only

```bash
# Final rollback configuration
MIGRATION_MODE=SENSAY_ONLY
USE_SUPAVEC_FOR_NEW_REPLICAS=false
USE_SUPAVEC_FOR_CHAT=false
ENABLE_SENSAY_FALLBACK=false
```

### Database Rollback

If database changes need to be reverted:

```bash
# Stop application
pm2 stop app

# Restore database from backup
psql your_database < backup_TIMESTAMP.sql

# Restart application with rollback configuration
pm2 start app
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Configuration Validation Errors

**Error**: `Migration configuration invalid: SUPAVEC_API_KEY is required when MIGRATION_MODE is SUPAVEC_ONLY`

**Solution**:
```bash
# Verify API key is set
echo $SUPAVEC_API_KEY

# Check for whitespace or invalid characters
export SUPAVEC_API_KEY=$(echo $SUPAVEC_API_KEY | tr -d '[:space:]')
```

#### 2. API Connectivity Issues

**Error**: `Supavec API unhealthy (required for current mode)`

**Solution**:
```bash
# Test API connectivity manually
curl -H "Authorization: Bearer $SUPAVEC_API_KEY" https://api.supavec.com/view_files?limit=1

# Check network connectivity
ping api.supavec.com

# Verify firewall rules allow outbound HTTPS
```

#### 3. Circuit Breaker Activation

**Error**: `Circuit breaker OPEN for supavec`

**Solution**:
```bash
# Check circuit breaker status
curl https://your-domain.com/health/circuit-breakers

# Wait for circuit breaker to reset (usually 60 seconds)
# Or restart application to reset circuit breakers
pm2 restart app
```

#### 4. Database Connection Issues

**Error**: Database connection failures during migration

**Solution**:
```bash
# Verify database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check database migrations
npm run migrate:status

# Run pending migrations
npm run migrate
```

### Monitoring and Alerting

#### Key Metrics to Monitor

1. **API Response Times**
   - Supavec API response time < 2000ms
   - Sensay API response time < 3000ms

2. **Error Rates**
   - API error rate < 1%
   - Circuit breaker activations = 0

3. **Health Check Status**
   - All health endpoints return 200
   - Overall status = "healthy"

#### Alerting Configuration

```bash
# Example monitoring script
#!/bin/bash
# monitor-migration.sh

HEALTH_URL="https://your-domain.com/health/detailed"
ALERT_EMAIL="alerts@yourdomain.com"

response=$(curl -s "$HEALTH_URL")
status=$(echo "$response" | jq -r '.status')

if [ "$status" != "healthy" ]; then
  echo "ALERT: Application health check failed" | mail -s "Migration Alert" "$ALERT_EMAIL"
  echo "$response" | mail -s "Migration Health Details" "$ALERT_EMAIL"
fi
```

### Support and Escalation

#### Log Collection

```bash
# Collect application logs
journalctl -u your-app-service --since "1 hour ago" > app-logs.txt

# Collect system logs
dmesg > system-logs.txt

# Collect configuration (sanitized)
env | grep -E "(MIGRATION|SUPAVEC|SENSAY)" | sed 's/=.*/=***/' > config-sanitized.txt
```

#### Emergency Contacts

- **Development Team**: dev-team@yourdomain.com
- **DevOps Team**: devops@yourdomain.com
- **On-Call Engineer**: +1-555-0123

#### Escalation Procedure

1. **Level 1**: Check health endpoints and logs
2. **Level 2**: Attempt immediate rollback
3. **Level 3**: Contact development team
4. **Level 4**: Contact on-call engineer for critical issues

---

## Appendix

### A. Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MIGRATION_MODE` | Yes | `SUPAVEC_ONLY` | Migration mode: SENSAY_ONLY, SUPAVEC_ONLY, DUAL |
| `SUPAVEC_API_KEY` | Conditional | - | Required for SUPAVEC_ONLY and DUAL modes |
| `SENSAY_ORGANIZATION_SECRET` | Conditional | - | Required for SENSAY_ONLY and DUAL modes |
| `USE_SUPAVEC_FOR_NEW_REPLICAS` | No | `true` | Use Supavec for new replica creation |
| `USE_SUPAVEC_FOR_CHAT` | No | `true` | Use Supavec for chat functionality |
| `ENABLE_SENSAY_FALLBACK` | No | `false` | Enable Sensay fallback on Supavec errors |
| `NAMESPACE_STRATEGY` | No | `USER_ID` | Namespace strategy: USER_ID, EMAIL, CUSTOM |

### B. API Endpoint Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/detailed` | GET | Detailed health with API status |
| `/health/config` | GET | Configuration summary |
| `/health/supavec` | GET | Supavec API health |
| `/health/sensay` | GET | Sensay API health |
| `/health/migration` | GET | Migration status |
| `/health/metrics` | GET | Performance metrics |
| `/health/circuit-breakers` | GET | Circuit breaker status |

### C. Migration Timeline Template

| Phase | Duration | Activities | Success Criteria |
|-------|----------|------------|------------------|
| **Preparation** | 1-2 days | API key setup, configuration testing | All health checks pass locally |
| **Dual Mode** | 1 week | Deploy dual mode, monitor performance | No increase in error rates |
| **Feature Migration** | 1-2 weeks | Gradually enable Supavec features | All features working correctly |
| **Supavec-Only** | 1 day | Switch to Supavec-only mode | All functionality maintained |
| **Cleanup** | 1 day | Remove Sensay configuration | Clean deployment achieved |

This deployment guide should be customized based on your specific infrastructure and requirements.