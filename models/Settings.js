const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    required: true,
    default: 'CTF Writeups Platform'
  },
  siteDescription: {
    type: String,
    required: true,
    default: 'A platform for sharing and discovering CTF writeups'
  },
  contactEmail: {
    type: String,
    required: true,
    default: 'admin@example.com'
  },
  maxWriteupsPerUser: {
    type: Number,
    required: true,
    default: 10
  },
  maxReadsPerDay: {
    type: Number,
    required: true,
    default: 50
  },
  enableUserRegistration: {
    type: Boolean,
    required: true,
    default: true
  },
  enableComments: {
    type: Boolean,
    required: true,
    default: true
  },
  enableRatings: {
    type: Boolean,
    required: true,
    default: true
  },
  maintenanceMode: {
    type: Boolean,
    required: true,
    default: false
  },
  defaultUserRole: {
    type: String,
    required: true,
    enum: ['user', 'admin'],
    default: 'user'
  },
  allowedFileTypes: {
    type: [String],
    required: true,
    default: ['image/jpeg', 'image/png', 'image/gif']
  },
  maxFileSize: {
    type: Number,
    required: true,
    default: 5 // in MB
  },
  emailNotifications: {
    newUser: {
      type: Boolean,
      required: true,
      default: true
    },
    newWriteup: {
      type: Boolean,
      required: true,
      default: true
    },
    newComment: {
      type: Boolean,
      required: true,
      default: true
    },
    reportFlag: {
      type: Boolean,
      required: true,
      default: true
    }
  },
  security: {
    requireEmailVerification: {
      type: Boolean,
      required: true,
      default: true
    },
    requireAdminApproval: {
      type: Boolean,
      required: true,
      default: false
    },
    maxLoginAttempts: {
      type: Number,
      required: true,
      default: 5
    },
    sessionTimeout: {
      type: Number,
      required: true,
      default: 24 // in hours
    },
    passwordMinLength: {
      type: Number,
      required: true,
      default: 8
    },
    requireStrongPassword: {
      type: Boolean,
      required: true,
      default: true
    }
  },
  appearance: {
    theme: {
      type: String,
      required: true,
      enum: ['light', 'dark'],
      default: 'dark'
    },
    primaryColor: {
      type: String,
      required: true,
      default: '#3b82f6'
    },
    secondaryColor: {
      type: String,
      required: true,
      default: '#10b981'
    },
    accentColor: {
      type: String,
      required: true,
      default: '#8b5cf6'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema); 