export type AvatarCategory = 'male' | 'female' | 'neutral';

export interface AvatarOption {
  id: string;
  label: string;
  category: AvatarCategory;
  imageUrl: string;
}

export const avatarOptions: Record<AvatarCategory, AvatarOption[]> = {
  male: [
    {
      id: 'male-pixel-art-1',
      label: 'Pixel Art Style',
      category: 'male',
      imageUrl: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=Adrian'
    },
    {
      id: 'male-avataaars-1',
      label: 'Modern Avatar',
      category: 'male',
      imageUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Chase'
    },
    {
      id: 'male-lorelei-1',
      label: 'Artistic Style',
      category: 'male',
      imageUrl: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Avery'
    },
    {
      id: 'male-notionists-1',
      label: 'Professional 1',
      category: 'male',
      imageUrl: 'https://api.dicebear.com/9.x/notionists/svg?seed=George'
    },
    {
      id: 'male-notionists-2',
      label: 'Professional 2',
      category: 'male',
      imageUrl: 'https://api.dicebear.com/9.x/notionists/svg?seed=Chase'
    },
    {
      id: 'male-notionists-3',
      label: 'Professional 3',
      category: 'male',
      imageUrl: 'https://api.dicebear.com/9.x/notionists/svg?seed=Caleb'
    }
  ],
  female: [
    {
      id: 'female-pixel-art-1',
      label: 'Pixel Art Style',
      category: 'female',
      imageUrl: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=Wyatt'
    },
    {
      id: 'female-avataaars-1',
      label: 'Modern Avatar',
      category: 'female',
      imageUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Katherine'
    },
    {
      id: 'female-lorelei-1',
      label: 'Artistic Style',
      category: 'female',
      imageUrl: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Caleb'
    },
    {
      id: 'female-notionists-1',
      label: 'Professional 1',
      category: 'female',
      imageUrl: 'https://api.dicebear.com/9.x/notionists/svg?seed=Leah'
    },
    {
      id: 'female-notionists-2',
      label: 'Professional 2',
      category: 'female',
      imageUrl: 'https://api.dicebear.com/9.x/notionists/svg?seed=Sophia'
    },
    {
      id: 'female-notionists-3',
      label: 'Professional 3',
      category: 'female',
      imageUrl: 'https://api.dicebear.com/9.x/notionists/svg?seed=Liliana'
    }
  ],
  neutral: [
    {
      id: 'neutral-bottts-1',
      label: 'Abstract 1',
      category: 'neutral',
      imageUrl: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=George'
    },
    {
      id: 'neutral-bottts-2',
      label: 'Abstract 2',
      category: 'neutral',
      imageUrl: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Leah'
    },
    {
      id: 'neutral-bottts-3',
      label: 'Abstract 3',
      category: 'neutral',
      imageUrl: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Mason'
    },
    {
      id: 'neutral-identicon-1',
      label: 'Geometric 1',
      category: 'neutral',
      imageUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=Emery'
    },
    {
      id: 'neutral-identicon-2',
      label: 'Geometric 2',
      category: 'neutral',
      imageUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=George'
    },
    {
      id: 'neutral-identicon-3',
      label: 'Geometric 3',
      category: 'neutral',
      imageUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=Christopher'
    }
  ]
};