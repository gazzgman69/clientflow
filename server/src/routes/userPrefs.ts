import { Router } from 'express';
import { z } from 'zod';
import { userPrefsService } from '../services/userPrefs';

const router = Router();

// Validation schemas
const getUserPrefsSchema = z.object({
  keys: z.string().optional().transform(val => val ? val.split(',') : undefined)
});

const setUserPrefSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(0, 'Value is required')
});

// Middleware for authentication (using existing pattern)
const requireAuth = (req: any, res: any, next: any) => {
  // Get user ID from header (same pattern as other routes)
  const userId = req.headers['user-id'] || 'test-user';
  req.user = { id: userId };
  next();
};

/**
 * GET /api/user/prefs?keys=emailViewMode
 * Get user preferences, optionally filtered by keys
 */
router.get('/prefs', requireAuth, async (req, res) => {
  try {
    const { keys } = getUserPrefsSchema.parse(req.query);
    const userId = req.user.id;

    console.log('🔧 Getting user prefs:', { userId, keys });

    const prefs = await userPrefsService.getUserPrefs(userId, keys);
    
    res.json(prefs);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    console.error('Error getting user preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user preferences'
    });
  }
});

/**
 * POST /api/user/prefs
 * Set a user preference
 */
router.post('/prefs', requireAuth, async (req, res) => {
  try {
    const { key, value } = setUserPrefSchema.parse(req.body);
    const userId = req.user.id;

    console.log('💾 Setting user pref:', { userId, key, value });

    const success = await userPrefsService.setUserPref(userId, key, value);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save preference'
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: error.errors
      });
    }

    console.error('Error setting user preference:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set user preference'
    });
  }
});

/**
 * DELETE /api/user/prefs/:key
 * Delete a specific user preference
 */
router.delete('/prefs/:key', requireAuth, async (req, res) => {
  try {
    const key = req.params.key;
    const userId = req.user.id;

    console.log('🗑️ Deleting user pref:', { userId, key });

    const success = await userPrefsService.deleteUserPref(userId, key);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete preference'
      });
    }

  } catch (error) {
    console.error('Error deleting user preference:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user preference'
    });
  }
});

export default router;