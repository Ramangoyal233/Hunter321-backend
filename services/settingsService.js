const Settings = require('../models/Settings');

class SettingsService {
  static async getSettings() {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return settings;
  }

  static async updateSettings(newSettings) {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(newSettings);
    } else {
      Object.assign(settings, newSettings);
      await settings.save();
    }
    return settings;
  }

  static async applySettings() {
    const settings = await this.getSettings();
    
    // Apply maintenance mode
    if (settings.maintenanceMode) {
      // Implement maintenance mode logic
     
    }

    // Apply security settings
    if (settings.security.requireEmailVerification) {
      // Implement email verification requirement
     
    }

    if (settings.security.requireAdminApproval) {
      // Implement admin approval requirement
   
    }

    // Apply user settings
    if (!settings.enableUserRegistration) {
      // Implement registration restriction
     
    }

    if (!settings.enableComments) {
      // Implement comment restriction
    
    }

    if (!settings.enableRatings) {
      // Implement rating restriction
     
    }

    return settings;
  }

  static async validateSettings(settings) {
    const errors = [];

    // Validate site name
    if (!settings.siteName || settings.siteName.length < 3) {
      errors.push('Site name must be at least 3 characters long');
    }

    // Validate contact email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!settings.contactEmail || !emailRegex.test(settings.contactEmail)) {
      errors.push('Invalid contact email format');
    }

    // Validate numeric values
    if (settings.maxWriteupsPerUser < 1) {
      errors.push('Max writeups per user must be at least 1');
    }

    if (settings.maxReadsPerDay < 1) {
      errors.push('Max reads per day must be at least 1');
    }

    if (settings.security.maxLoginAttempts < 1) {
      errors.push('Max login attempts must be at least 1');
    }

    if (settings.security.sessionTimeout < 1) {
      errors.push('Session timeout must be at least 1 hour');
    }

    if (settings.security.passwordMinLength < 8) {
      errors.push('Password minimum length must be at least 8 characters');
    }

    // Validate file settings
    if (settings.maxFileSize < 1) {
      errors.push('Max file size must be at least 1 MB');
    }

    if (!Array.isArray(settings.allowedFileTypes) || settings.allowedFileTypes.length === 0) {
      errors.push('At least one file type must be allowed');
    }

    return errors;
  }
}

module.exports = SettingsService; 