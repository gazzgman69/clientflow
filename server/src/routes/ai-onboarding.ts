import { Router } from 'express';
import { aiOnboardingWizard } from '../services/ai-onboarding-wizard';
import { z } from 'zod';

const router = Router();

// Schema for chat messages
const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty')
});

// POST /api/ai-onboarding/start - Start onboarding wizard
router.post('/start', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.authenticatedUserId!;

    const initialMessage = await aiOnboardingWizard.startOnboarding(tenantId, userId);

    res.json({
      success: true,
      message: initialMessage
    });
  } catch (error) {
    console.error('Error starting onboarding:', error);
    res.status(500).json({ error: 'Failed to start onboarding wizard' });
  }
});

// POST /api/ai-onboarding/chat - Send message to onboarding wizard
router.post('/chat', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { message } = chatMessageSchema.parse(req.body);

    const reply = await aiOnboardingWizard.chat(tenantId, message);

    res.json({
      success: true,
      message: reply
    });
  } catch (error) {
    console.error('Error in onboarding chat:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to process message' });
    }
  }
});

// GET /api/ai-onboarding/status - Get onboarding status
router.get('/status', async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    const status = await aiOnboardingWizard.getStatus(tenantId);

    res.json({
      success: true,
      status: status || null
    });
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
});

// POST /api/ai-onboarding/reset - Reset onboarding (useful for testing)
router.post('/reset', async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    aiOnboardingWizard.clearContext(tenantId);

    res.json({
      success: true,
      message: 'Onboarding context reset successfully'
    });
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    res.status(500).json({ error: 'Failed to reset onboarding' });
  }
});

export default router;
