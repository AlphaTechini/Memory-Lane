# Cloudinary Image Management API Documentation

## Overview

This document covers the Cloudinary-powered image management system integrated into the Fastify + MongoDB application. The system provides gallery management and replica profile picture functionality.

## Prerequisites

1. **Cloudinary Account**: Sign up at [cloudinary.com](https://cloudinary.com)
2. **Environment Variables**: Configure your `.env` file with Cloudinary credentials
3. **Authentication**: All image routes require valid JWT authentication

## Environment Configuration

Add these variables to your `.env` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## API Endpoints

### Gallery Management

#### POST /gallery/upload
Upload multiple images to user's gallery.

**Authentication**: Required (Bearer token)
**Content-Type**: multipart/form-data
**File Limits**: Max 5 files, 10MB each

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer <jwt_token>" \
  -F "image1=@photo1.jpg" \
  -F "image2=@photo2.png" \
  http://localhost:4000/gallery/upload
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully uploaded 2 image(s)",
  "data": {
    "gallery": [
      {
        "imageUrl": "https://res.cloudinary.com/...",
        "imageId": "users/userId/gallery/abc123",
        "uploadedAt": "2025-09-04T10:30:00.000Z"
      }
    ],
    "uploaded": 2
  }
}
```

#### GET /gallery
Retrieve all gallery images for the authenticated user.

**Authentication**: Required (Bearer token)

**Example**:
```bash
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:4000/gallery
```

**Response**:
```json
{
  "success": true,
  "message": "Gallery retrieved successfully",
  "data": {
    "gallery": [
      {
        "imageUrl": "https://res.cloudinary.com/...",
        "imageId": "users/userId/gallery/abc123",
        "uploadedAt": "2025-09-04T10:30:00.000Z"
      }
    ],
    "count": 1
  }
}
```

#### DELETE /gallery/:imageId
Delete a specific image from the gallery.

**Authentication**: Required (Bearer token)

**Example**:
```bash
curl -X DELETE \
  -H "Authorization: Bearer <jwt_token>" \
  http://localhost:4000/gallery/users_userId_gallery_abc123
```

**Response**:
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": {
    "gallery": [],
    "count": 0
  }
}
```

#### DELETE /gallery/clear
Clear all images from the gallery.

**Authentication**: Required (Bearer token)

**Example**:
```bash
curl -X DELETE \
  -H "Authorization: Bearer <jwt_token>" \
  http://localhost:4000/gallery/clear
```

### Replica Profile Picture Management

#### POST /replica/upload
Upload a replica profile picture (single image).

**Authentication**: Required (Bearer token)
**Content-Type**: multipart/form-data
**File Limits**: Single file, 10MB max

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer <jwt_token>" \
  -F "image=@profile.jpg" \
  http://localhost:4000/replica/upload
```

**Response**:
```json
{
  "success": true,
  "message": "Replica profile picture uploaded successfully",
  "data": {
    "replicaImageUrl": "https://res.cloudinary.com/...",
    "replicaImageId": "users/userId/replica/def456"
  }
}
```

#### GET /replica
Get replica profile picture information.

**Authentication**: Required (Bearer token)

**Example**:
```bash
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:4000/replica
```

**Response**:
```json
{
  "success": true,
  "message": "Replica profile picture info retrieved successfully",
  "data": {
    "replicaImageUrl": "https://res.cloudinary.com/...",
    "replicaImageId": "users/userId/replica/def456",
    "hasImage": true
  }
}
```

#### DELETE /replica
Delete the replica profile picture.

**Authentication**: Required (Bearer token)

**Example**:
```bash
curl -X DELETE \
  -H "Authorization: Bearer <jwt_token>" \
  http://localhost:4000/replica
```

**Response**:
```json
{
  "success": true,
  "message": "Replica profile picture deleted successfully",
  "data": {
    "replicaImageUrl": null,
    "replicaImageId": null,
    "hasImage": false
  }
}
```

## File Upload Specifications

### Supported File Types
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### File Size Limits
- Maximum file size: 10MB per file
- Gallery uploads: Up to 5 files per request
- Replica uploads: Single file only

### Image Processing
Images are automatically optimized with:
- **Gallery images**: Max 1000x1000px, auto quality, auto format
- **Replica images**: 500x500px square crop with face detection, auto quality, auto format

## Error Handling

### Common Error Responses

#### 400 Bad Request - No Files
```json
{
  "success": false,
  "message": "No files provided",
  "errors": ["At least one image file is required"]
}
```

#### 400 Bad Request - Invalid File Type
```json
{
  "success": false,
  "message": "Invalid file",
  "errors": ["Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."]
}
```

#### 400 Bad Request - File Too Large
```json
{
  "success": false,
  "message": "Invalid file",
  "errors": ["File too large. Maximum size is 10MB."]
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access token required",
  "errors": ["No authorization header provided"]
}
```

#### 404 Not Found - Image Not Found
```json
{
  "success": false,
  "message": "Image not found",
  "errors": ["Image not found in gallery"]
}
```

## Database Schema Changes

### User Model Updates

The User schema has been extended with:

```javascript
// Gallery images array
gallery: [{
  imageUrl: {
    type: String,
    required: true
  },
  imageId: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}],

// Replica profile picture
replicaImageUrl: {
  type: String
},
replicaImageId: {
  type: String
}
```

## Testing Workflow

### 1. Authentication Setup
```bash
# Register user
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  http://localhost:4000/auth/signup

# Login to get token
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  http://localhost:4000/auth/login
```

### 2. Gallery Testing
```bash
# Upload images to gallery
curl -X POST \
  -H "Authorization: Bearer <jwt_token>" \
  -F "image1=@test1.jpg" \
  -F "image2=@test2.png" \
  http://localhost:4000/gallery/upload

# View gallery
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:4000/gallery

# Delete specific image
curl -X DELETE \
  -H "Authorization: Bearer <jwt_token>" \
  http://localhost:4000/gallery/<imageId>
```

### 3. Replica Profile Testing
```bash
# Upload replica profile picture
curl -X POST \
  -H "Authorization: Bearer <jwt_token>" \
  -F "image=@profile.jpg" \
  http://localhost:4000/replica/upload

# Get replica info
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:4000/replica

# Delete replica picture
curl -X DELETE \
  -H "Authorization: Bearer <jwt_token>" \
  http://localhost:4000/replica
```

## Cloudinary Features Used

### Image Transformations
- **Auto quality optimization**: Reduces file size while maintaining visual quality
- **Auto format selection**: Automatically chooses the best format (WebP, AVIF, etc.)
- **Responsive sizing**: Images are resized to optimal dimensions
- **Smart cropping**: Face detection for profile pictures

### Organization
- **Folder structure**: Images are organized by user ID and type
  - Gallery: `users/{userId}/gallery/`
  - Replica: `users/{userId}/replica/`

### Security
- **Secure URLs**: All image URLs use HTTPS
- **Public ID management**: Unique identifiers for easy deletion
- **User isolation**: Each user's images are stored in separate folders

## Security Considerations

1. **Authentication Required**: All image endpoints require valid JWT tokens
2. **User Isolation**: Users can only access their own images
3. **File Validation**: Strict validation on file types and sizes
4. **Error Handling**: Graceful handling of Cloudinary API failures
5. **Cleanup**: Automatic deletion from both Cloudinary and database

## Performance Optimization

1. **Image Compression**: Automatic optimization reduces bandwidth
2. **CDN Delivery**: Cloudinary's global CDN ensures fast loading
3. **Lazy Loading**: Frontend can implement lazy loading with Cloudinary URLs
4. **Caching**: Cloudinary handles image caching automatically
