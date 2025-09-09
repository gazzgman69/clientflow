import { Request, Response, Router } from "express";

const router = Router();

// Allowed properties for rule updates (security: prevent prototype pollution)
const ALLOWED_RULE_PROPERTIES = [
  'name', 'enabled', 'fromStatus', 'toStatus', 'triggerType', 
  'triggerConfig', 'ifConflictBlock', 'requireNoManualSinceMinutes', 
  'actionEmailTemplateId'
];

// Safe object property extraction
const extractAllowedProperties = (obj: any, allowedProps: string[]) => {
  const result: any = {};
  for (const prop of allowedProps) {
    if (obj.hasOwnProperty(prop)) {
      result[prop] = obj[prop];
    }
  }
  return result;
};

// Middleware to require authentication (simplified)
const requireAuth = (req: Request, res: Response, next: Function) => {
  const userId = req.headers['user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Mock data for demonstration
let mockRules = [
  {
    id: "rule-1",
    name: "Auto-contact after 2 hours",
    enabled: true,
    fromStatus: "new",
    toStatus: "contacted",
    triggerType: "TIME_SINCE_CREATED",
    triggerConfig: JSON.stringify({ minutes: 120 }),
    ifConflictBlock: false,
    requireNoManualSinceMinutes: 30,
    actionEmailTemplateId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// GET /api/admin/lead-automation/rules
router.get('/rules', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(mockRules);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// POST /api/admin/lead-automation/rules
router.post('/rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const safeBody = extractAllowedProperties(req.body, ALLOWED_RULE_PROPERTIES);
    const rule = {
      id: `rule-${Date.now()}`,
      ...safeBody,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockRules.push(rule);
    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(400).json({ error: 'Invalid rule data' });
  }
});

// PATCH /api/admin/lead-automation/rules/:id
router.patch('/rules/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ruleIndex = mockRules.findIndex(r => r.id === id);
    
    if (ruleIndex === -1) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    const safeBody = extractAllowedProperties(req.body, ALLOWED_RULE_PROPERTIES);
    mockRules[ruleIndex] = {
      ...mockRules[ruleIndex],
      ...safeBody,
      updatedAt: new Date().toISOString(),
    };
    
    res.json(mockRules[ruleIndex]);
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(400).json({ error: 'Invalid rule data' });
  }
});

// DELETE /api/admin/lead-automation/rules/:id
router.delete('/rules/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ruleIndex = mockRules.findIndex(r => r.id === id);
    
    if (ruleIndex === -1) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    mockRules.splice(ruleIndex, 1);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// POST /api/admin/lead-automation/run
router.post('/run', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('🤖 Manual automation run triggered');
    res.json({ message: 'Automation tick completed (mock)', rulesProcessed: mockRules.length });
  } catch (error) {
    console.error('Error running automation:', error);
    res.status(500).json({ error: 'Failed to run automation' });
  }
});

// GET /api/admin/lead-automation/summary
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const summary = {
      new: mockRules.some(r => r.toStatus === 'new' && r.enabled),
      contacted: mockRules.some(r => r.toStatus === 'contacted' && r.enabled),
      qualified: mockRules.some(r => r.toStatus === 'qualified' && r.enabled),
      archived: mockRules.some(r => r.toStatus === 'archived' && r.enabled),
    };
    res.json(summary);
  } catch (error) {
    console.error('Error getting automation summary:', error);
    res.status(500).json({ error: 'Failed to get automation summary' });
  }
});

export default router;