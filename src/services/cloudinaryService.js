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
  console.log(`📤 Starting image upload, buffer size: ${fileBuffer ? fileBuffer.length : 0} bytes`);
  
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File buffer is empty or invalid');
  }

  // If Cloudinary is not configured, use fallback
  if (!isCloudinaryConfigured) {
    console.log('📸 Using mock upload service (Cloudinary not configured)');
    return mockUploadImage(fileBuffer, options);
  }

  try {
    console.log('🔄 Uploading to Cloudinary...');
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

      console.log(`📋 Upload options:`, {
        resource_type: uploadOptions.resource_type,
        folder: uploadOptions.folder,
        transformation: uploadOptions.transformation
      });

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload failed:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else {
            console.log('✅ Cloudinary upload successful:', {
              public_id: result.public_id,
              url: result.secure_url,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes
            });
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
    console.error('❌ Image upload error:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary or fallback service
 * @param {String} publicId - Cloudinary public_id of the image
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteImage = async (publicId) => {
  console.log(`🗑️ Starting image deletion for public_id: ${publicId}`);

  if (!publicId) {
    throw new Error('Public ID is required for deletion');
  }

  // If Cloudinary is not configured, use fallback
  if (!isCloudinaryConfigured) {
    console.log('🗑️ Using mock deletion service (Cloudinary not configured)');
    return mockDeleteImage(publicId);
  }

  try {
    console.log('🔄 Deleting from Cloudinary...');
    const result = await cloudinary.uploader.destroy(publicId);
    
    console.log('📋 Cloudinary deletion result:', result);
    
    if (result.result !== 'ok') {
      console.warn(`⚠️ Cloudinary deletion warning: ${result.result}`);
      throw new Error(`Failed to delete image: ${result.result}`);
    }
    
    console.log('✅ Cloudinary deletion successful');
    return {
      success: true,
      result: result.result,
      public_id: publicId
    };
  } catch (error) {
    console.error('❌ Image deletion error:', error);
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
  console.log(`📤 Starting multiple image upload, count: ${fileBuffers.length}`);
  
  try {
    const uploadPromises = fileBuffers.map((buffer, index) => {
      console.log(`📤 Queuing upload ${index + 1}/${fileBuffers.length}`);
      return uploadImage(buffer, options);
    });
    
    const results = await Promise.all(uploadPromises);
    console.log(`✅ Multiple upload successful, ${results.length} images uploaded`);
    return results;
  } catch (error) {
    console.error('❌ Multiple image upload error:', error);
    throw new Error(`Multiple image upload failed: ${error.message}`);
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array<String>} publicIds - Array of Cloudinary public_ids
 * @returns {Promise<Array>} - Array of deletion results
 */
export const deleteMultipleImages = async (publicIds) => {
  console.log(`🗑️ Starting multiple image deletion, count: ${publicIds.length}`);
  
  try {
    const deletePromises = publicIds.map((publicId, index) => {
      console.log(`🗑️ Queuing deletion ${index + 1}/${publicIds.length}: ${publicId}`);
      return deleteImage(publicId);
    });
    
    const results = await Promise.all(deletePromises);
    console.log(`✅ Multiple deletion successful, ${results.length} images deleted`);
    return results;
  } catch (error) {
    console.error('❌ Multiple image deletion error:', error);
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
  console.log(`🔗 Generating transformed URL for: ${publicId}`);
  
  if (!isCloudinaryConfigured) {
    console.warn('⚠️ Cloudinary not configured, returning mock URL');
    return `https://via.placeholder.com/500x500/4F46E5/FFFFFF?text=Transformed+Image`;
  }

  try {
    const url = cloudinary.url(publicId, {
      transformation: transformations,
      secure: true
    });
    console.log(`✅ Transformed URL generated: ${url}`);
    return url;
  } catch (error) {
    console.error('❌ URL generation error:', error);
    throw new Error(`URL generation failed: ${error.message}`);
  }
};

/**
 * Validate image file
 * @param {Object} file - File object with filename, mimetype, and optional buffer/size
 * @returns {Boolean} - True if valid image
 */
export const validateImageFile = (file) => {
  console.log(`🔍 Validating file: ${file.filename || 'unknown'}, mimetype: ${file.mimetype || 'unknown'}`);
  
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!file) {
    console.error('❌ Validation failed: No file provided');
    throw new Error('No file provided');
  }

  if (!file.filename) {
    console.error('❌ Validation failed: No filename provided');
    throw new Error('Filename is required');
  }

  if (!file.mimetype) {
    console.error('❌ Validation failed: No mimetype provided');
    throw new Error('File mimetype is required');
  }
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    console.error(`❌ Validation failed: Invalid mimetype ${file.mimetype}`);
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
  }
  
  // Check file size if available
  const fileSize = file.size || file.buffer?.length || file.file?.bytesRead;
  if (fileSize && fileSize > maxSize) {
    console.error(`❌ Validation failed: File too large ${fileSize} bytes (max ${maxSize})`);
    throw new Error('File too large. Maximum size is 10MB.');
  }
  
  console.log(`✅ File validation passed for ${file.filename}`);
  return true;
};

/**
 * Mock image upload for when Cloudinary is not configured
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Mock upload result
 */
const mockUploadImage = async (fileBuffer, options = {}) => {
  console.log('📸 Mock upload starting...');
  
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate mock URL and public ID
  const mockId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const mockUrl = `https://via.placeholder.com/500x500/4F46E5/FFFFFF?text=Profile+Image`;
  
  const result = {
    url: mockUrl,
    public_id: mockId,
    width: 500,
    height: 500,
    format: 'png',
    bytes: fileBuffer.length
  };

  console.log('✅ Mock image upload successful:', result);
  return result;
};

/**
 * Mock image deletion for when Cloudinary is not configured
 * @param {String} publicId - Mock public ID
 * @returns {Promise<Object>} - Mock deletion result
 */
const mockDeleteImage = async (publicId) => {
  console.log(`🗑️ Mock deletion for: ${publicId}`);
  
  const result = {
    success: true,
    result: 'ok',
    public_id: publicId
  };

  console.log('✅ Mock image deletion successful:', result);
  return result;
};

export default {
  uploadImage,
  deleteImage,
  uploadMultipleImages,
  deleteMultipleImages,
  getTransformedImageUrl,
  validateImageFile
};