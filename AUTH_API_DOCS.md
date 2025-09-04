# Authentication API Documentation

## Overview
This API provides user authentication functionality including signup, login, and JWT-based session management.

## Base URL
```
http://localhost:4000
```

## Authentication Endpoints

### 1. User Signup
**POST** `/auth/signup`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Validation Rules:**
- `email`: Required, valid email format
- `password`: Required, minimum 6 characters, must contain uppercase, lowercase, and number
- `firstName`: Optional, letters only
- `lastName`: Optional, letters only

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "user": {
    "_id": "64a1b2c3d4e5f6789abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isVerified": false,
    "createdAt": "2024-09-04T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Email is already registered"
  ]
}
```

### 2. User Login
**POST** `/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "64a1b2c3d4e5f6789abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isVerified": true,
    "lastLogin": "2024-09-04T10:35:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- **401** - Invalid credentials
- **403** - Account not verified

### 3. Verify Account
**POST** `/auth/verify/:userId`

Verify user account (simulate email verification).

**Success Response (200):**
```json
{
  "success": true,
  "message": "User verified successfully",
  "user": {
    "_id": "64a1b2c3d4e5f6789abc123",
    "email": "user@example.com",
    "isVerified": true
  }
}
```

### 4. Get Current User
**GET** `/auth/me`

Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "user": {
    "_id": "64a1b2c3d4e5f6789abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isVerified": true
  }
}
```

### 5. Logout
**POST** `/auth/logout`

Logout user (client-side token removal).

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Usage Examples

### JavaScript/Fetch API

```javascript
// Signup
const signup = async (userData) => {
  const response = await fetch('http://localhost:4000/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData)
  });
  return response.json();
};

// Login
const login = async (email, password) => {
  const response = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  
  if (data.success) {
    // Store token in localStorage
    localStorage.setItem('authToken', data.token);
  }
  
  return data;
};

// Make authenticated request
const getUser = async () => {
  const token = localStorage.getItem('authToken');
  const response = await fetch('http://localhost:4000/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### cURL Examples

```bash
# Signup
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'

# Get user info (replace TOKEN with actual JWT)
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer TOKEN"

# Verify user (replace USER_ID with actual ID)
curl -X POST http://localhost:4000/auth/verify/USER_ID
```

## Error Codes

| Code | Description |
|------|-------------|
| 400  | Bad Request - Validation error |
| 401  | Unauthorized - Invalid/missing token |
| 403  | Forbidden - Account not verified |
| 404  | Not Found - User not found |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error |

## Security Features

1. **Password Hashing**: Bcrypt with salt rounds
2. **JWT Tokens**: Secure token generation with expiration
3. **Rate Limiting**: Login attempt limiting
4. **Email Verification**: Account verification requirement
5. **Input Validation**: Comprehensive request validation
6. **CORS Protection**: Configured for frontend domains

## Environment Variables

Required environment variables for the authentication system:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=7d

# Database
MONGODB_URI=mongodb://localhost:27017/sensay-ai

# Security
BCRYPT_ROUNDS=12
ADMIN_EMAILS=admin@sensay.ai

# Frontend
FRONTEND_URL=http://localhost:5173
```
