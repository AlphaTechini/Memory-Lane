# Sensay API Configuration Guide

## Overview
This application integrates with the Sensay API to create and train AI replicas. Based on the official API documentation, here's how to properly configure the integration.

## Required Environment Variables

Add these to your `.env` file:

```bash
# Sensay API Configuration
SENSAY_ORGANIZATION_SECRET=your-organization-secret-from-sensay
SENSAY_OWNER_ID=your-sensay-user-id
SENSAY_API_VERSION=2025-03-25

# Optional - for development testing
SENSAY_ALLOW_PLACEHOLDER=false
```

## Getting Your Credentials

1. **Organization Secret**: Get this from your Sensay API dashboard
   - Visit: https://api.sensay.io/ui
   - Or request access: https://docs.google.com/forms/d/11ExevrfKClc7IfQf7kjEpIiLqHtHE_E42Y752KV7mYY/

2. **Owner ID**: This is your Sensay user ID (UUID format)

## API Endpoints Currently Implemented

### Replica Management
- ✅ `POST /v1/replicas` - Create replica (working)
- ✅ `GET /v1/replicas/{uuid}` - Get replica (working)
- ✅ `GET /v1/replicas?ownerID={id}` - List replicas (working)

### Knowledge Base / Training
- 🔄 Multiple endpoints being tested for training:
  - `/v1/replicas/{id}/training`
  - `/v1/replicas/{id}/knowledge`
  - `/v1/replicas/{id}/train`
  - `/v1/replicas/{id}/memories`

### User Management
- ✅ `POST /v1/users` - Create Sensay user (working)
- ✅ `GET /v1/users/{id}` - Get user (working)

## Current Status

### ✅ Working Features
1. **Template System**: 8 relationship templates with icons
2. **Replica Creation**: Successfully creates replicas in Sensay
3. **User Management**: Creates and manages Sensay users
4. **Gallery**: Works for authenticated users
5. **Authentication**: JWT-based auth with email verification

### ⚠️ Known Issues
1. **Knowledge Base Training**: 404 errors on training endpoints
   - Replica creation succeeds
   - Training is postponed until correct endpoint is identified
   - This doesn't break the application flow

### 🔧 Debugging Features
- Comprehensive logging for API calls
- Multiple endpoint fallbacks
- Graceful handling of missing API credentials
- Development mode skips training if API not configured

## Testing the Integration

1. **Without Credentials**: Application works in demo mode
   - Replicas are created locally only
   - Training is skipped with warnings

2. **With Credentials**: Full Sensay integration
   - Replicas created in Sensay system
   - Training attempted with multiple endpoint patterns

## Template System

The application now includes 8 pre-built templates:
- 👤 Self
- 👨‍👔 Dad  
- 👩‍💼 Mom
- 👦 Brother
- 👧 Sister
- 💕 Lover
- 👯 Best Friend
- 🤝 Close Relation

Each template has customized questions to capture the specific relationship dynamics.

## Next Steps

1. **Verify Credentials**: Ensure your Sensay API credentials are correct
2. **Check Training Endpoints**: Work with Sensay support to identify correct training/knowledge endpoints
3. **Test Complete Flow**: Try creating a replica end-to-end
4. **Monitor Logs**: Check console for detailed API interaction logs
