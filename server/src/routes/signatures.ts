import { Router } from 'express';
import { z } from 'zod';
import { signaturesService } from '../services/signatures';
import { insertEmailSignatureSchema } from '@shared/schema';

const router = Router();

/**
 * Get all signatures for current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const signatures = await signaturesService.getUserSignatures(userId);
    res.json(signatures);
  } catch (error) {
    console.error('Failed to get signatures:', error);
    res.status(500).json({ error: 'Failed to get signatures' });
  }
});

/**
 * Get a specific signature
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const signature = await signaturesService.getSignature(id, userId);
    
    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json(signature);
  } catch (error) {
    console.error('Failed to get signature:', error);
    res.status(500).json({ error: 'Failed to get signature' });
  }
});

/**
 * Get default signature for current user
 */
router.get('/default/current', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const signature = await signaturesService.getDefaultSignature(userId);
    res.json(signature);
  } catch (error) {
    console.error('Failed to get default signature:', error);
    res.status(500).json({ error: 'Failed to get default signature' });
  }
});

/**
 * Create a new signature
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Validate request body
    const validationSchema = insertEmailSignatureSchema.extend({
      userId: z.string().optional(),
    });

    const validatedData = validationSchema.parse({
      ...req.body,
      userId,
    });

    const signature = await signaturesService.createSignature(validatedData);
    res.status(201).json(signature);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }

    console.error('Failed to create signature:', error);
    res.status(500).json({ error: 'Failed to create signature' });
  }
});

/**
 * Update a signature
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Validate request body (partial update)
    const validationSchema = insertEmailSignatureSchema.partial();
    const validatedData = validationSchema.parse(req.body);

    const signature = await signaturesService.updateSignature(id, userId, validatedData);
    
    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json(signature);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }

    console.error('Failed to update signature:', error);
    res.status(500).json({ error: 'Failed to update signature' });
  }
});

/**
 * Set a signature as default
 */
router.post('/:id/default', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const signature = await signaturesService.setDefaultSignature(id, userId);
    
    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json(signature);
  } catch (error) {
    console.error('Failed to set default signature:', error);
    res.status(500).json({ error: 'Failed to set default signature' });
  }
});

/**
 * Delete a signature
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const success = await signaturesService.deleteSignature(id, userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete signature:', error);
    res.status(500).json({ error: 'Failed to delete signature' });
  }
});

export default router;