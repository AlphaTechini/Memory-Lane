import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Search the user's gallery photos for a match against the query.
 * @param {string} userId - User ID to search photos for
 * @param {string} query - Search query to match against description or originalName
 * @returns {Promise<object>} Result containing the best matching photo URL and description or an error message
 */
export const searchUserPhotos = async (userId, query) => {
    try {
        const user = await User.findById(userId).select('photos');
        if (!user || (!user.photos || user.photos.length === 0)) {
            return {
                success: false,
                message: "User has no photos in their gallery.",
            };
        }

        const normalizedQuery = query.toLowerCase();

        // 1. Try to find a photo where the word exists in the description or originalName
        // simple scoring: exact partial match > any partial match
        let bestMatch = null;
        let highestScore = 0;

        for (const photo of user.photos) {
            let score = 0;
            const desc = (photo.description || '').toLowerCase();
            const name = (photo.originalName || '').toLowerCase();

            if (desc.includes(normalizedQuery)) score += 5;
            if (name.includes(normalizedQuery)) score += 3;

            // Extra points for exact term match (prevent 'dog' matching 'hotdog')
            const words = normalizedQuery.split(' ');
            for (const word of words) {
                if (desc.split(/[\s,.-]+/).includes(word)) score += 2;
                if (name.split(/[\s,.-]+/).includes(word)) score += 1;
            }

            if (score > highestScore) {
                highestScore = score;
                bestMatch = photo;
            }
        }

        if (!bestMatch) {
            return {
                success: false,
                message: `No photos found matching the description "${query}".`,
            };
        }

        logger.info(`Found photo match for query "${query}"`, { userId, photoId: bestMatch.id || bestMatch._id });

        return {
            success: true,
            imageUrl: bestMatch.imageUrl,
            description: bestMatch.description || bestMatch.originalName || 'A photo from your gallery',
        };

    } catch (err) {
        logger.error('Error searching user photos:', err.message);
        return {
            success: false,
            message: "An error occurred while searching your gallery.",
            error: err.message
        };
    }
};

export default { searchUserPhotos };
