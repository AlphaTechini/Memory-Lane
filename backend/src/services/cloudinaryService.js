import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Image Upload Service
 * Handles image uploads, deletions, and transformations
 */

// Check if Cloudinary is properly configured
export const isCloudinaryConfigured = Boolean(
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
  const size = fileBuffer ? fileBuffer.length : 0;
  console.log(`📤 Starting image upload, buffer size: ${size} bytes`, { options });
  try {
    // Log a short preview of the buffer (first 16 bytes) for debugging non-sensitive issues
    if (fileBuffer && fileBuffer.length > 0) {
      const preview = fileBuffer.slice(0, Math.min(16, fileBuffer.length)).toString('hex');
      console.debug('📦 Buffer preview (first bytes hex):', preview);
    }
  } catch (dbgErr) {
    console.debug('⚠️ Failed to generate buffer preview', dbgErr && dbgErr.stack ? dbgErr.stack : dbgErr);
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    console.error('❌ uploadImage called with empty buffer');
    throw new Error('File buffer is empty or invalid');
  }

  // If Cloudinary is not configured, use fallback
  if (!isCloudinaryConfigured) {
    console.log('📸 Using mock upload service (Cloudinary not configured)');
    return mockUploadImage(fileBuffer, options);
  }

    try {
      console.log('🔄 Uploading to Cloudinary...');
      return await new Promise((resolve, reject) => {
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

        console.debug('📋 Prepared upload options:', {
          resource_type: uploadOptions.resource_type,
          folder: uploadOptions.folder,
          transformation: uploadOptions.transformation
        });

        try {
          const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                // Cloudinary returns rich error objects; log full details for debugging
                try {
                  console.error('❌ Cloudinary upload failed (full error):', JSON.stringify(error, Object.getOwnPropertyNames(error)));
                } catch (stringifyErr) {
                  console.error('❌ Cloudinary upload failed (non-serializable):', error, stringifyErr);
                }
                return reject(new Error(`Cloudinary upload failed: ${error && error.message ? error.message : String(error)}`));
              }

              console.log('✅ Cloudinary upload successful:', {
                public_id: result.public_id,
                url: result.secure_url,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes
              });
              return resolve({
                url: result.secure_url,
                public_id: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes
              });
            }
          );

          // Write buffer to stream and handle synchronous exceptions
          try {
            stream.end(fileBuffer);
          } catch (endErr) {
            console.error('❌ Failed to end Cloudinary upload stream:', endErr && endErr.stack ? endErr.stack : endErr);
            return reject(endErr);
          }
        } catch (streamErr) {
          console.error('❌ Error while initiating Cloudinary upload stream:', streamErr && streamErr.stack ? streamErr.stack : streamErr);
          return reject(streamErr);
        }
      });
    } catch (error) {
      console.error('❌ Image upload error:', error && error.stack ? error.stack : error);
      throw new Error(`Image upload failed: ${error && error.message ? error.message : String(error)}`);
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
export const mockUploadImage = async (fileBuffer, options = {}) => {
  console.log('📸 Mock upload starting...', { options, bufferSize: fileBuffer ? fileBuffer.length : 0 });
  try {
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
      bytes: fileBuffer ? fileBuffer.length : 0
    };

    console.log('✅ Mock image upload successful:', result);
    return result;
  } catch (err) {
    console.error('❌ Mock upload error:', err && err.stack ? err.stack : err);
    throw err;
  }
};

/**
 * Mock image deletion for when Cloudinary is not configured
 * @param {String} publicId - Mock public ID
 * @returns {Promise<Object>} - Mock deletion result
 */
export const mockDeleteImage = async (publicId) => {
  console.log(`🗑️ Mock deletion for: ${publicId}`);
  try {
    const result = {
      success: true,
      result: 'ok',
      public_id: publicId
    };
    console.log('✅ Mock image deletion successful:', result);
    return result;
  } catch (err) {
    console.error('❌ Mock delete error:', err && err.stack ? err.stack : err);
    throw err;
  }
};

export default {
  uploadImage,
  deleteImage,
  uploadMultipleImages,
  deleteMultipleImages,
  getTransformedImageUrl,
  validateImageFile
};