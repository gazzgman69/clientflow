import { Request, Response, Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { leadAutomationRules, leadStatusHistory } from "@shared/schema";
import { insertLeadAutomationRuleSchema } from "@shared/schema";
import leadAutomationService from "../services/lead-automation";

const router = Router();

// Middleware to require authentication (simplified)
const requireAuth = (req: Request, res: Response, next: Function) => {
  // TODO: Real authentication check
  const userId = req.headers['user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// GET /api/admin/lead-automation/rules
router.get('/rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const rules = await db
      .select()
      .from(leadAutomationRules)
      .orderBy(leadAutomationRules.createdAt);
      
    res.json(rules);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// POST /api/admin/lead-automation/rules
router.post('/rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const ruleData = insertLeadAutomationRuleSchema.parse(req.body);
    
    const [rule] = await db
      .insert(leadAutomationRules)
      .values(ruleData)
      .returning();
      
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
    const updateData = insertLeadAutomationRuleSchema.partial().parse(req.body);
    
    const [rule] = await db
      .update(leadAutomationRules)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(leadAutomationRules.id, id))
      .returning();
      
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(400).json({ error: 'Invalid rule data' });
  }
});

// DELETE /api/admin/lead-automation/rules/:id
router.delete('/rules/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [rule] = await db
      .delete(leadAutomationRules)
      .where(eq(leadAutomationRules.id, id))
      .returning();
      
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// POST /api/admin/lead-automation/run
router.post('/run', requireAuth, async (req: Request, res: Response) => {
  try {
    await leadAutomationService.runTick();
    res.json({ message: 'Automation tick completed' });
  } catch (error) {
    console.error('Error running automation:', error);
    res.status(500).json({ error: 'Failed to run automation' });
  }
});

// GET /api/admin/lead-automation/summary
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const summary = await leadAutomationService.getRuleSummary((req as any).tenantId);
    res.json(summary);
  } catch (error) {
    console.error('Error getting automation summary:', error);
    res.status(500).json({ error: 'Failed to get automation summary' });
  }
});

export default router;