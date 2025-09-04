import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Image Upload Service
 * Handles image uploads, deletions, and transformations
 */

// Configure Cloudinary (assuming credentials are in environment variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload image to Cloudinary
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {Object} options - Upload options (folder, transformation, etc.)
 * @returns {Promise<Object>} - { url, public_id }
 */
export const uploadImage = async (fileBuffer, options = {}) => {
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
 * Delete image from Cloudinary
 * @param {String} publicId - Cloudinary public_id of the image
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteImage = async (publicId) => {
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

export default {
  uploadImage,
  deleteImage,
  uploadMultipleImages,
  deleteMultipleImages,
  getTransformedImageUrl,
  validateImageFile
};
