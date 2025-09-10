import { Router } from 'express';
import { z } from 'zod';
import { tokenResolverService } from '../services/token-resolver';

const router = Router();

// Validation schemas
const previewRequestSchema = z.object({
  template: z.string().min(1, 'Template content is required'),
  contactId: z.string().optional(),
  projectId: z.string().optional()
});

// Middleware for authentication (using existing pattern)
const requireAuth = (req: any, res: any, next: any) => {
  // Get user ID from header (same pattern as other routes)
  const userId = req.headers['user-id'] || 'test-user';
  req.user = { id: userId as string };
  next();
};

/**
 * POST /api/tokens/preview
 * Preview template with token resolution
 */
router.post('/preview', requireAuth, async (req, res) => {
  try {
    const { template, contactId, projectId } = previewRequestSchema.parse(req.body);
    
    console.log('🔍 Token preview request:', { 
      templateLength: template.length,
      contactId: contactId || 'none', 
      projectId: projectId || 'none'
    });

    const context = {
      contactId,
      projectId
    };

    const result = await tokenResolverService.resolveTemplate(template, context);
    
    console.log('✅ Token resolution complete:', {
      unresolved: result.unresolved.length,
      unresolvedTokens: result.unresolved
    });

    res.json({
      rendered: result.rendered,
      unresolved: result.unresolved
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    console.error('Error during token preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview template'
    });
  }
});

/**
 * GET /api/tokens/list
 * Get available tokens with descriptions
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    console.log('📋 Getting available tokens list');

    const tokens = tokenResolverService.getAvailableTokens();
    
    res.json({
      success: true,
      tokens,
      total: Object.keys(tokens.contact).length + 
             Object.keys(tokens.project).length + 
             Object.keys(tokens.business).length
    });

  } catch (error) {
    console.error('Error getting tokens list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tokens list'
    });
  }
});

export default router;