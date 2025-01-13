export type AvatarCategory = 'male' | 'female' | 'neutral';

export interface AvatarOption {
  id: string;
  label: string;
  category: AvatarCategory;
  imageUrl: string;
}

// Helper function to generate DiceBear URL
const getDiceBearUrl = (style: string, seed: string, options: Record<string, any> = {}) => {
  const optionsString = Object.entries(options)
    .map(([key, value]) => `&${key}=${value}`)
    .join('');
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}${optionsString}`;
};

// Avatar configuration using DiceBear
export const avatarOptions: Record<AvatarCategory, AvatarOption[]> = {
  male: [
    {
      id: 'male-personas-professional',
      label: 'Business Professional',
      category: 'male',
      imageUrl: getDiceBearUrl('personas', 'mp1', { 
        backgroundColor: '#F5F7FA',
        mood: ['happy'],
        hair: ['short', 'crew'],
        accessories: ['glasses'],
      })
    },
    {
      id: 'male-personas-casual',
      label: 'Business Casual',
      category: 'male',
      imageUrl: getDiceBearUrl('personas', 'mp2', {
        backgroundColor: '#F5F7FA',
        mood: ['calm'],
        hair: ['shortCombover', 'shortWaved'],
      })
    },
    {
      id: 'male-notionists-modern',
      label: 'Modern Professional',
      category: 'male',
      imageUrl: getDiceBearUrl('notionists', 'mp3', {
        backgroundColor: '#F8FAFC',
        style: 'circle'
      })
    },
    {
      id: 'male-micah-minimal',
      label: 'Minimal Style',
      category: 'male',
      imageUrl: getDiceBearUrl('micah', 'mp4', {
        backgroundColor: '#F8FAFC',
        baseColor: ['navy', 'indigo']
      })
    },
    {
      id: 'male-avataaars-corporate',
      label: 'Corporate Style',
      category: 'male',
      imageUrl: getDiceBearUrl('avataaars', 'mp5', {
        backgroundColor: '#F5F7FA',
        top: ['shortHair', 'straightHair'],
        accessories: ['round'],
        clothingColor: ['blue', 'black', 'gray']
      })
    },
  ],
  female: [
    {
      id: 'female-personas-professional',
      label: 'Business Professional',
      category: 'female',
      imageUrl: getDiceBearUrl('personas', 'fp1', {
        backgroundColor: '#F5F7FA',
        mood: ['happy'],
        hair: ['long', 'bob'],
        accessories: ['glasses']
      })
    },
    {
      id: 'female-personas-casual',
      label: 'Business Casual',
      category: 'female',
      imageUrl: getDiceBearUrl('personas', 'fp2', {
        backgroundColor: '#F5F7FA',
        mood: ['calm'],
        hair: ['medium', 'shoulder']
      })
    },
    {
      id: 'female-notionists-modern',
      label: 'Modern Professional',
      category: 'female',
      imageUrl: getDiceBearUrl('notionists', 'fp3', {
        backgroundColor: '#F8FAFC',
        style: 'circle'
      })
    },
    {
      id: 'female-micah-minimal',
      label: 'Minimal Style',
      category: 'female',
      imageUrl: getDiceBearUrl('micah', 'fp4', {
        backgroundColor: '#F8FAFC',
        baseColor: ['navy', 'indigo']
      })
    },
    {
      id: 'female-avataaars-corporate',
      label: 'Corporate Style',
      category: 'female',
      imageUrl: getDiceBearUrl('avataaars', 'fp5', {
        backgroundColor: '#F5F7FA',
        top: ['longHair', 'straightHair'],
        accessories: ['round'],
        clothingColor: ['blue', 'black', 'gray']
      })
    }
  ],
  neutral: [
    {
      id: 'neutral-initials-corporate',
      label: 'Corporate Initials',
      category: 'neutral',
      imageUrl: getDiceBearUrl('initials', 'n1', {
        backgroundColor: '#F5F7FA',
        bold: true
      })
    },
    {
      id: 'neutral-shapes-minimal',
      label: 'Minimal Shapes',
      category: 'neutral',
      imageUrl: getDiceBearUrl('shapes', 'n2', {
        backgroundColor: '#F8FAFC',
        colors: ['blue', 'indigo'],
        shape1: ['circle'],
        shape2: ['square'],
        shape3: ['triangle']
      })
    },
    {
      id: 'neutral-marble-elegant',
      label: 'Elegant Marble',
      category: 'neutral',
      imageUrl: getDiceBearUrl('marble', 'n3', {
        backgroundColor: '#F5F7FA'
      })
    },
    {
      id: 'neutral-rings-professional',
      label: 'Professional Rings',
      category: 'neutral',
      imageUrl: getDiceBearUrl('rings', 'n4', {
        backgroundColor: '#F8FAFC',
        colors: ['blue', 'indigo']
      })
    },
    {
      id: 'neutral-identicon-modern',
      label: 'Modern Geometric',
      category: 'neutral',
      imageUrl: getDiceBearUrl('identicon', 'n5', {
        backgroundColor: '#F5F7FA',
        colors: ['blue', 'indigo']
      })
    }
  ]
};