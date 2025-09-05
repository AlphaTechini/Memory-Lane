import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Image Upload Service
 * Handles image uploads, deletions, and transformations
 */

// Check if Cloudinary is properly configured
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET &&
  !process.env.CLOUDINARY_CLOUD_NAME.includes('placeholder') &&
  !process.env.CLOUDINARY_API_KEY.includes('placeholder') &&
  !process.env.CLOUDINARY_API_SECRET.includes('placeholder')
);

if (isCloudinaryConfigured) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('✅ Cloudinary configured successfully');
} else {
  console.warn('⚠️ Cloudinary not configured - using fallback mock service');
}

/**
 * Upload image to Cloudinary or fallback service
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {Object} options - Upload options (folder, transformation, etc.)
 * @returns {Promise<Object>} - { url, public_id }
 */
export const uploadImage = async (fileBuffer, options = {}) => {
  // If Cloudinary is not configured, use fallback
  if (!isCloudinaryConfigured) {
    return mockUploadImage(fileBuffer, options);
  }

  try {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: 'image',
        folder: options.folder || 'sensay-uploads',
        transformation: options.transformation || [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto:good' },
          { format: 'auto' }
        ],
        ...options
      };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            resolve({
              url: result.secure_url,
              public_id: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes
            });
          }
        }
      ).end(fileBuffer);
    });
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary or fallback service
 * @param {String} publicId - Cloudinary public_id of the image
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteImage = async (publicId) => {
  // If Cloudinary is not configured, use fallback
  if (!isCloudinaryConfigured) {
    return mockDeleteImage(publicId);
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result !== 'ok') {
      throw new Error(`Failed to delete image: ${result.result}`);
    }
    
    return {
      success: true,
      result: result.result,
      public_id: publicId
    };
  } catch (error) {
    throw new Error(`Image deletion failed: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array<Buffer>} fileBuffers - Array of image file buffers
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} - Array of upload results
 */
export const uploadMultipleImages = async (fileBuffers, options = {}) => {
  try {
    const uploadPromises = fileBuffers.map(buffer => 
      uploadImage(buffer, options)
    );
    
    return await Promise.all(uploadPromises);
  } catch (error) {
    throw new Error(`Multiple image upload failed: ${error.message}`);
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array<String>} publicIds - Array of Cloudinary public_ids
 * @returns {Promise<Array>} - Array of deletion results
 */
export const deleteMultipleImages = async (publicIds) => {
  try {
    const deletePromises = publicIds.map(publicId => 
      deleteImage(publicId)
    );
    
    return await Promise.all(deletePromises);
  } catch (error) {
    throw new Error(`Multiple image deletion failed: ${error.message}`);
  }
};

/**
 * Generate transformation URL for existing image
 * @param {String} publicId - Cloudinary public_id
 * @param {Array} transformations - Array of transformation objects
 * @returns {String} - Transformed image URL
 */
export const getTransformedImageUrl = (publicId, transformations = []) => {
  try {
    return cloudinary.url(publicId, {
      transformation: transformations,
      secure: true
    });
  } catch (error) {
    throw new Error(`URL generation failed: ${error.message}`);
  }
};

/**
 * Validate image file
 * @param {Object} file - File object from multipart
 * @returns {Boolean} - True if valid image
 */
export const validateImageFile = (file) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
  }
  
  if (file.file && file.file.bytesRead > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }
  
  return true;
};

/**
 * Mock image upload for when Cloudinary is not configured
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Mock upload result
 */
const mockUploadImage = async (fileBuffer, options = {}) => {
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate mock URL and public ID
  const mockId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const mockUrl = `https://via.placeholder.com/500x500/4F46E5/FFFFFF?text=Profile+Image`;
  
  console.log('📸 Mock image upload successful (Cloudinary not configured)');
  
  return {
    url: mockUrl,
    public_id: mockId,
    width: 500,
    height: 500,
    format: 'png',
    bytes: fileBuffer.length
  };
};

/**
 * Mock image deletion for when Cloudinary is not configured
 * @param {String} publicId - Mock public ID
 * @returns {Promise<Object>} - Mock deletion result
 */
const mockDeleteImage = async (publicId) => {
  console.log('🗑️ Mock image deletion successful (Cloudinary not configured)');
  return {
    success: true,
    result: 'ok',
    public_id: publicId
  };
};

export default {
  uploadImage,
  deleteImage,
  uploadMultipleImages,
  deleteMultipleImages,
  getTransformedImageUrl,
  validateImageFile
};
