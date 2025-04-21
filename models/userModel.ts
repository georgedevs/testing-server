require('dotenv').config()
import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IAvatar {
  avatarId: string;
  imageUrl: string;
}

export interface INotification {
  title: string;
  message: string;
  type: "meeting" | "system" | "chat";
  read: boolean;
  createdAt: Date;
}



// Base user interface
export interface IUser extends Document {
    _id: Types.ObjectId;
  email: string;
  password: string;
  avatar: IAvatar;
  role: "client" | "admin" | "counselor";
  isVerified: boolean;
  isActive: boolean;
  notifications: INotification[];
  lastActive: Date;
  tourViewed: boolean;
  comparePassword(password: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

// Client specific interface
export interface IClient extends IUser {
  username?: string;
  marriageYears?: number;
  age?: number;
  issuesExperienced?: string[];
  preferredCounselorGender?: "male" | "female" | "no_preference";
  sessionHistory: Array<{
    counselorId: mongoose.Types.ObjectId;
    sessionDate: Date;
    sessionType: "virtual" | "physical";
    status: "scheduled" | "completed" | "cancelled";
    rating?: number;
    feedback?: string;
    issueDescription?: string;
  }>;
  currentCounselor?: mongoose.Types.ObjectId;
  unreadMessages: number;
  preferredLanguages?: string[];
  timezone?: string;
  lastBooking?: Date;
}

// Counselor specific interface
export interface ICounselor extends IUser {
  fullName: string;
  registrationToken?: string;
  specializations?: string[];
  marriageYears?: number;
  preferredAgeGroups?: string[];
  gender: "male" | "female";
  languages: string[];
  unavailableDates: Date[];
  maxDailyMeetings: number;
  rating: number;
  totalRatings: number;
  averageRating:number;
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  isAvailable: boolean;
  activeClients: number;
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  meetingPreferences: {
    maxConsecutiveMeetings: number;
  };
}

// Admin specific interface
export interface IAdmin extends IUser {
  fullName: string;
  permissions: {
    canManageCounselors: boolean;
    canManageClients: boolean;
    canAccessAnalytics: boolean;
    canManageSettings: boolean;
  };
  adminLevel: "super" | "regular";
  lastLogin: Date;
  activityLog: Array<{
    action: string;
    timestamp: Date;
    details: string;
  }>;
}

// Base user schema
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, "Please enter your email"],
    validate: {
      validator: function(email: string) {
        return emailRegexPattern.test(email);
      },
      message: "Please enter a valid email",
    },
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Please enter your password"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },
  avatar: {
    avatarId: String,
    imageUrl: String,
  },
  role: {
    type: String,
    enum: ["client", "admin", "counselor"],
    default: "client",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  notifications: [{
    title: String,
    message: String,
    type: {
      type: String,
      enum: ["meeting", "system", "chat"],
    },
    read: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  tourViewed: {
    type: Boolean,
    default: false
},
  lastActive: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Client schema
const clientSchema = new Schema<IClient>({
  username: {
    type: String,
    unique: true,
    sparse: true, // This allows multiple documents to have no username
    minlength: [3, "Username must be at least 3 characters"],
    maxlength: [30, "Username cannot exceed 30 characters"],
    trim: true,
    validate: {
      validator: function(username: string) {
        // Allow letters, numbers, underscores, and hyphens
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        return usernameRegex.test(username);
      },
      message: "Username can only contain letters, numbers, underscores, and hyphens"
    }
  },
  marriageYears: Number,
  age: Number,
  issuesExperienced: [String],
  preferredCounselorGender: {
    type: String,
    enum: ["male", "female", "no_preference"],
  },
  sessionHistory: [{
    counselorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counselor'
    },
    sessionDate: Date,
    sessionType: {
      type: String,
      enum: ["virtual", "physical"],
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    rating: Number,
    feedback: String,
    issueDescription: String,
  }],
  currentCounselor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counselor'
  },
  unreadMessages: {
    type: Number,
    default: 0,
  },
  preferredLanguages: [String],
  timezone: String,
  lastBooking: Date,
});

// Counselor schema
const counselorSchema = new Schema<ICounselor>({
  fullName: {
    type: String,
    required: true,
  },
  registrationToken: String,
  specializations: [String],
  marriageYears: Number,
  preferredAgeGroups: [String],
  gender: {
    type: String,
    enum: ["male", "female"],
  },
  languages: [String],
  unavailableDates: [Date],
  maxDailyMeetings: {
    type: Number,
    default: 8,
  },
  rating: {
    type: Number,
  },
  totalRatings: { 
    type: Number,
    default: 0
  },
  averageRating: { 
    type: Number,
  },
  totalSessions: {
    type: Number,
    default: 0,
  },
  completedSessions: {
    type: Number,
    default: 0,
  },
  cancelledSessions: {
    type: Number,
    default: 0,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },

  activeClients: {
    type: Number,
    default: 0,
  },
  workingHours: {
    start: {
      type: String,
      default: "09:00" // Default start time
    },
    end: {
      type: String,
      default: "17:00" // Default end time
    },
    timezone: String,
  },
  meetingPreferences: {
    maxConsecutiveMeetings: {
      type: Number,
      default: 4,
    },
  },
});

// Admin schema
const adminSchema = new Schema<IAdmin>({
  fullName: {
    type: String,
    required: true,
  },
  permissions: {
    canManageCounselors: {
      type: Boolean,
      default: true,
    },
    canManageClients: {
      type: Boolean,
      default: true,
    },
    canAccessAnalytics: {
      type: Boolean,
      default: true,
    },
    canManageSettings: {
      type: Boolean,
      default: true,
    },
  },
  adminLevel: {
    type: String,
    enum: ["super", "regular"],
    default: "regular",
  },
  lastLogin: Date,
  activityLog: [{
    action: String,
    timestamp: Date,
    details: String,
  }],
  
});


// Password hashing middleware
userSchema.pre<IUser>("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Update lastActive middleware
userSchema.pre<IUser>("save", function(next) {
  this.lastActive = new Date();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};


// Create the models
const User = mongoose.model<IUser>('User', userSchema);
const Client = User.discriminator<IClient>('Client', clientSchema);
const Counselor = User.discriminator<ICounselor>('Counselor', counselorSchema);
const Admin = User.discriminator<IAdmin>('Admin', adminSchema);

export { User, Client, Counselor, Admin };