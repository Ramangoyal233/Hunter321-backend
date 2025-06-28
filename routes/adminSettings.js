const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const SettingsService = require('../services/settingsService');

// Get all settings
router.get('/', adminAuth, async (req, res) => {
  try {
    const settings = await SettingsService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// Update settings
router.put('/', adminAuth, async (req, res) => {
  try {
    // Validate settings
    const validationErrors = await SettingsService.validateSettings(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Invalid settings',
        errors: validationErrors
      });
    }

    // Update settings
    const settings = await SettingsService.updateSettings(req.body);
    
    // Apply settings
    await SettingsService.applySettings();

    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// Get public settings (for non-admin users)
router.get('/public', async (req, res) => {
  try {
    const settings = await SettingsService.getSettings();
    
    // Only return public settings
    const publicSettings = {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      maintenanceMode: settings.maintenanceMode,
      enableUserRegistration: settings.enableUserRegistration,
      enableComments: settings.enableComments,
      enableRatings: settings.enableRatings,
      appearance: settings.appearance
    };

    res.json(publicSettings);
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

module.exports = router; 