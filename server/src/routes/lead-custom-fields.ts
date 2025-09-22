import { Router, type Request, type Response } from 'express';
import { 
  insertLeadCustomFieldSchema, 
  insertLeadCustomFieldResponseSchema 
} from '@shared/schema';
import { storage } from '../../storage';

const router = Router();

// GET /api/lead-custom-fields - Get all custom field definitions for tenant/user
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const userId = req.headers['x-user-id'] as string;
    
    const fields = await storage.getLeadCustomFields(tenantId, userId);
    res.json(fields);
  } catch (error) {
    console.error('Error fetching lead custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// GET /api/lead-custom-fields/:id - Get specific custom field
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const { id } = req.params;
    
    const field = await storage.getLeadCustomField(id, tenantId);
    if (!field) {
      return res.status(404).json({ error: 'Custom field not found' });
    }
    
    res.json(field);
  } catch (error) {
    console.error('Error fetching lead custom field:', error);
    res.status(500).json({ error: 'Failed to fetch custom field' });
  }
});

// GET /api/lead-custom-fields/by-key/:key - Get custom field by key
router.get('/by-key/:key', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const userId = req.headers['x-user-id'] as string;
    const { key } = req.params;
    
    const field = await storage.getLeadCustomFieldByKey(key, tenantId, userId);
    if (!field) {
      return res.status(404).json({ error: 'Custom field not found' });
    }
    
    res.json(field);
  } catch (error) {
    console.error('Error fetching lead custom field by key:', error);
    res.status(500).json({ error: 'Failed to fetch custom field' });
  }
});

// POST /api/lead-custom-fields - Create new custom field
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const userId = req.headers['x-user-id'] as string;
    
    const fieldData = insertLeadCustomFieldSchema.parse(req.body);
    
    // Add user ID to the field data if provided
    const newFieldData = userId ? { ...fieldData, userId } : fieldData;
    
    const field = await storage.createLeadCustomField(newFieldData, tenantId);
    res.status(201).json(field);
  } catch (error) {
    console.error('Error creating lead custom field:', error);
    res.status(400).json({ error: 'Invalid custom field data' });
  }
});

// PUT /api/lead-custom-fields/:id - Update custom field
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const { id } = req.params;
    
    const updateData = insertLeadCustomFieldSchema.partial().parse(req.body);
    
    const field = await storage.updateLeadCustomField(id, updateData, tenantId);
    if (!field) {
      return res.status(404).json({ error: 'Custom field not found' });
    }
    
    res.json(field);
  } catch (error) {
    console.error('Error updating lead custom field:', error);
    res.status(400).json({ error: 'Invalid custom field data' });
  }
});

// DELETE /api/lead-custom-fields/:id - Delete custom field
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const { id } = req.params;
    
    const deleted = await storage.deleteLeadCustomField(id, tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Custom field not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lead custom field:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

// Lead Custom Field Responses endpoints

// GET /api/lead-custom-fields/responses/:leadId - Get all responses for a lead
router.get('/responses/:leadId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const { leadId } = req.params;
    
    const responses = await storage.getLeadCustomFieldResponses(leadId, tenantId);
    res.json(responses);
  } catch (error) {
    console.error('Error fetching lead custom field responses:', error);
    res.status(500).json({ error: 'Failed to fetch custom field responses' });
  }
});

// GET /api/lead-custom-fields/responses/:leadId/:fieldKey - Get specific response
router.get('/responses/:leadId/:fieldKey', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const { leadId, fieldKey } = req.params;
    
    const response = await storage.getLeadCustomFieldResponse(leadId, fieldKey, tenantId);
    if (!response) {
      return res.status(404).json({ error: 'Custom field response not found' });
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching lead custom field response:', error);
    res.status(500).json({ error: 'Failed to fetch custom field response' });
  }
});

// POST /api/lead-custom-fields/responses - Create/update custom field response
router.post('/responses', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    
    const responseData = insertLeadCustomFieldResponseSchema.parse(req.body);
    
    const response = await storage.upsertLeadCustomFieldResponse(responseData, tenantId);
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating/updating lead custom field response:', error);
    res.status(400).json({ error: 'Invalid custom field response data' });
  }
});

// PUT /api/lead-custom-fields/responses/:leadId/:fieldKey - Update specific response
router.put('/responses/:leadId/:fieldKey', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const { leadId, fieldKey } = req.params;
    
    const updateData = insertLeadCustomFieldResponseSchema.partial().parse(req.body);
    
    const response = await storage.updateLeadCustomFieldResponse(leadId, fieldKey, updateData, tenantId);
    if (!response) {
      return res.status(404).json({ error: 'Custom field response not found' });
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error updating lead custom field response:', error);
    res.status(400).json({ error: 'Invalid custom field response data' });
  }
});

// DELETE /api/lead-custom-fields/responses/:leadId/:fieldKey - Delete specific response
router.delete('/responses/:leadId/:fieldKey', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string || 'default';
    const { leadId, fieldKey } = req.params;
    
    const deleted = await storage.deleteLeadCustomFieldResponse(leadId, fieldKey, tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Custom field response not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lead custom field response:', error);
    res.status(500).json({ error: 'Failed to delete custom field response' });
  }
});

export default router;