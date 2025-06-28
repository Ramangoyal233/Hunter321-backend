const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settingsService');

// Get public settings
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