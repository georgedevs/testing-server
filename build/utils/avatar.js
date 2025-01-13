"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAvatarInCategory = exports.formatAvatarUrl = exports.getAvatarsByCategory = exports.getAvatarDetails = exports.clearAvatarCache = exports.validateAvatarId = exports.getAllAvatars = void 0;
const redis_1 = require("./redis");
const avatarOptions_1 = require("../config/avatarOptions");
/**
 * Gets all avatars across all categories
 */
const getAllAvatars = () => {
    // Explicitly type the accumulator and current value for type safety
    const allAvatars = Object.values(avatarOptions_1.avatarOptions).reduce((acc, categoryAvatars) => [...acc, ...categoryAvatars], []);
    return allAvatars;
};
exports.getAllAvatars = getAllAvatars;
/**
 * Validates if an avatar ID exists in the available options
 */
const validateAvatarId = async (avatarId) => {
    try {
        // First check redis cache
        const cachedData = await redis_1.redis.get('valid_avatars');
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            // Check if cache is less than 1 hour old
            if (Date.now() - parsedData.lastUpdated < 3600000) {
                return parsedData.validAvatars.includes(avatarId);
            }
        }
        // If no cache or cache is old, regenerate from avatarOptions
        const allAvatars = (0, exports.getAllAvatars)();
        const validAvatarIds = allAvatars.map(avatar => avatar.id);
        // Update redis cache
        const cacheData = {
            validAvatars: validAvatarIds,
            lastUpdated: Date.now()
        };
        await redis_1.redis.set('valid_avatars', JSON.stringify(cacheData));
        return validAvatarIds.includes(avatarId);
    }
    catch (error) {
        // If redis fails, fallback to direct check
        console.error('Redis error in validateAvatarId:', error);
        return (0, exports.getAllAvatars)().some(avatar => avatar.id === avatarId);
    }
};
exports.validateAvatarId = validateAvatarId;
/**
 * Clears the avatar cache in Redis
 */
const clearAvatarCache = async () => {
    await redis_1.redis.del('valid_avatars');
};
exports.clearAvatarCache = clearAvatarCache;
/**
 * Gets detailed information about a specific avatar
 */
const getAvatarDetails = (avatarId) => {
    const allAvatars = (0, exports.getAllAvatars)();
    return allAvatars.find(avatar => avatar.id === avatarId) || null;
};
exports.getAvatarDetails = getAvatarDetails;
/**
 * Gets avatars by category
 */
const getAvatarsByCategory = (category) => {
    return avatarOptions_1.avatarOptions[category];
};
exports.getAvatarsByCategory = getAvatarsByCategory;
/**
 * Validates and formats avatar URL
 */
const formatAvatarUrl = (imageUrl, frontendUrl) => {
    if (!imageUrl.startsWith('/')) {
        imageUrl = '/' + imageUrl;
    }
    return `${frontendUrl}/assets/avatars${imageUrl}`;
};
exports.formatAvatarUrl = formatAvatarUrl;
/**
 * Checks if an avatar belongs to a specific category
 */
const isAvatarInCategory = (avatarId, category) => {
    return avatarOptions_1.avatarOptions[category].some(avatar => avatar.id === avatarId);
};
exports.isAvatarInCategory = isAvatarInCategory;
