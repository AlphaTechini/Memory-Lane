# Protected Routes Documentation

This document outlines all the protected routes in the Sensay API that require authentication.

## Authentication Middleware

The authentication middleware (`authenticateToken`) performs the following checks:
- Extracts JWT token from `Authorization` header (Bearer token format)
- Verifies token using `jwt.verify()`
- Checks if user exists in database
- Verifies user's email is verified
- Attaches user object to `request.user`
- Returns 401 Unauthorized for invalid/missing tokens
- Returns 403 Forbidden for unverified users

## Protected Routes

### User Management Routes

#### GET /auth/me
- **Purpose**: Get current user information
- **Authentication**: Required (Bearer token)
- **Response**: User profile data
- **Example**:
```bash
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:4000/auth/me
```

#### GET /auth/dashboard
- **Purpose**: User dashboard (welcome message with user data)
- **Authentication**: Required (Bearer token)
- **Response**: Welcome message and user summary
- **Example**:
```bash
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:4000/auth/dashboard
```

#### GET /auth/profile
- **Purpose**: Get detailed user profile
- **Authentication**: Required (Bearer token)
- **Response**: Complete user profile information
- **Example**:
```bash
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:4000/auth/profile
```

#### PUT /auth/profile
- **Purpose**: Update user profile (firstName, lastName)
- **Authentication**: Required (Bearer token)
- **Body**: JSON with firstName and/or lastName
- **Example**:
```bash
curl -X PUT \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"firstName": "John", "lastName": "Doe"}' \
     http://localhost:4000/auth/profile
```

### Replica Management Routes

#### POST /api/replicas
- **Purpose**: Create a new replica
- **Authentication**: Required (Bearer token)
- **Body**: Replica creation data
- **Note**: User ID is automatically attached to replica
- **Example**:
```bash
curl -X POST \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "My Replica", "description": "Test replica"}' \
     http://localhost:4000/api/replicas
```

#### POST /api/replicas/train
- **Purpose**: Train a replica with text content
- **Authentication**: Required (Bearer token)
- **Body**: Training data (replicaId, title, description, rawText)
- **Example**:
```bash
curl -X POST \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"replicaId": "replica_id", "title": "Training", "rawText": "Content to train"}' \
     http://localhost:4000/api/replicas/train
```

#### POST /api/replicas/train/file
- **Purpose**: Train a replica with file upload
- **Authentication**: Required (Bearer token)
- **Body**: Multipart form data with file
- **Example**:
```bash
curl -X POST \
     -H "Authorization: Bearer <jwt_token>" \
     -F "file=@training_data.txt" \
     -F "replicaId=replica_id" \
     http://localhost:4000/api/replicas/train/file
```

### Chat Routes

#### POST /api/replicas/:replicaId/chat
- **Purpose**: Chat with a specific replica
- **Authentication**: Required (Bearer token)
- **Body**: Chat message and context
- **Note**: User ID is automatically extracted from token
- **Example**:
```bash
curl -X POST \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello!", "context": []}' \
     http://localhost:4000/api/replicas/replica_id/chat
```

## Public Routes (No Authentication Required)

### Authentication Routes
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/verify-otp` - Email OTP verification
- `POST /auth/resend-otp` - Resend OTP code
- `POST /auth/verify/:userId` - Email verification (legacy)
- `POST /auth/logout` - User logout (stateless, no auth needed)
- `GET /auth/health` - Health check

### Status Routes
- `GET /api/kb/:entryId/status` - Knowledge base entry status
- `GET /api/health` - API health check

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access token required",
  "errors": ["No authorization header provided"]
}
```

### 403 Forbidden (Unverified User)
```json
{
  "success": false,
  "message": "Account not verified",
  "errors": ["Please verify your email before accessing this resource"]
}
```

### 401 Invalid Token
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "errors": ["Please login again"]
}
```

## Testing Authentication Flow

1. **Register a user**:
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123", "firstName": "Test"}' \
     http://localhost:4000/auth/signup
```

2. **Verify email with OTP** (check email for code):
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "otpCode": "123456"}' \
     http://localhost:4000/auth/verify-otp
```

3. **Login to get token**:
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}' \
     http://localhost:4000/auth/login
```

4. **Use token for protected routes**:
```bash
curl -H "Authorization: Bearer <jwt_token_from_login>" \
     http://localhost:4000/auth/dashboard
```

## Security Notes

- All protected routes require a valid JWT token
- Tokens include user ID, email, and verification status
- Unverified users cannot access protected resources
- User ID is automatically attached to replica creation
- Profile updates only allow firstName and lastName changes
- Tokens expire based on JWT_EXPIRES_IN environment variable (default: 7 days)
