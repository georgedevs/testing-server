// utils/avatar.ts
import { redis } from "./redis";
import { 
  avatarOptions, 
  AvatarOption, 
  AvatarCategory 
} from "../config/avatarOptions";

// Type for cached avatar data
interface CachedAvatarData {
  validAvatars: string[];
  lastUpdated: number;
}


export const getAllAvatars = (): AvatarOption[] => {
  const allAvatars: AvatarOption[] = Object.values(avatarOptions).reduce(
    (acc: AvatarOption[], categoryAvatars) => [...acc, ...categoryAvatars],
    []
  );
  return allAvatars;
};

/**
 * Validates if an avatar ID exists in the available options
 */
export const validateAvatarId = async (avatarId: string): Promise<boolean> => {
  try {
    // First check redis cache
    const cachedData = await redis.get('valid_avatars');
    
    if (cachedData) {
      const parsedData: CachedAvatarData = JSON.parse(cachedData);
      // Check if cache is less than 1 hour old
      if (Date.now() - parsedData.lastUpdated < 3600000) {
        return parsedData.validAvatars.includes(avatarId);
      }
    }

    // If no cache or cache is old, regenerate from avatarOptions
    const allAvatars = getAllAvatars();
    const validAvatarIds = allAvatars.map(avatar => avatar.id);

    // Update redis cache
    const cacheData: CachedAvatarData = {
      validAvatars: validAvatarIds,
      lastUpdated: Date.now()
    };
    
    await redis.set('valid_avatars', JSON.stringify(cacheData));
    
    return validAvatarIds.includes(avatarId);
  } catch (error) {
    // If redis fails, fallback to direct check
    console.error('Redis error in validateAvatarId:', error);
    return getAllAvatars().some(avatar => avatar.id === avatarId);
  }
};

export const clearAvatarCache = async () => {
  await redis.del('valid_avatars');
};
/**
 * Gets detailed information about a specific avatar
 */
export const getAvatarDetails = (avatarId: string): AvatarOption | null => {
  const allAvatars = getAllAvatars();
  return allAvatars.find(avatar => avatar.id === avatarId) || null;
};

/**
 * Gets avatars by category
 */
export const getAvatarsByCategory = (category: AvatarCategory): AvatarOption[] => {
  return avatarOptions[category];
};

/**
 * Validates and formats avatar URL
 */
export const formatAvatarUrl = (imageUrl: string, frontendUrl: string): string => {
  if (!imageUrl.startsWith('/')) {
    imageUrl = '/' + imageUrl;
  }
  return `${frontendUrl}/assets/avatars${imageUrl}`;
};

/**
 * Checks if an avatar belongs to a specific category
 */
export const isAvatarInCategory = (
  avatarId: string,
  category: AvatarCategory
): boolean => {
  return avatarOptions[category].some(avatar => avatar.id === avatarId);
};