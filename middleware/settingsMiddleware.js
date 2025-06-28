const SettingsService = require('../services/settingsService');

const settingsMiddleware = async (req, res, next) => {
  try {
    const settings = await SettingsService.getSettings();

    // Check maintenance mode
    if (settings.maintenanceMode) {
      // Allow access to admin routes, admin login, and auth endpoints
      if (req.path.startsWith('/api/admin') || 
          req.path === '/api/auth/login' || 
          req.path === '/api/auth/admin/login' ||
          req.path === '/api/auth/admin/verify') {
        return next();
      }
      
      // Return 503 for all other routes
      return res.status(503).json({
        status: 503,
        message: 'Site is under maintenance. Please try again later.',
        maintenanceMode: true
      });
    }

    // Check user registration
    if (!settings.enableUserRegistration && req.path === '/api/auth/register') {
      return res.status(403).json({
        message: 'User registration is currently disabled.'
      });
    }

    // Check comments
    if (!settings.enableComments && req.path.includes('/api/comments')) {
      return res.status(403).json({
        message: 'Comments are currently disabled.'
      });
    }

    // Check ratings
    if (!settings.enableRatings && req.path.includes('/api/ratings')) {
      return res.status(403).json({
        message: 'Ratings are currently disabled.'
      });
    }

    // Add settings to request object
    req.settings = settings;
    next();
  } catch (error) {
    console.error('Settings middleware error:', error);
    next();
  }
};

module.exports = settingsMiddleware; 