import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { storage } from '../../storage';
import { emailDispatcher } from '../services/email-dispatcher';
import { z } from 'zod';

const router = Router();

// Rate limiters
const requestOtpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute per IP
  message: 'Too many OTP requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyOtpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute per IP
  message: 'Too many verification attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const requestOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  token: z.string().length(6, 'Code must be 6 digits'),
});

// Helper: Generate 6-digit OTP
function generateOtp(): string {
  const min = 100000;
  const max = 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * POST /api/portal/request-otp
 * Request a one-time password for portal login
 *
 * Body: { email: string }
 * Response: { success: boolean; message: string; expiresIn: number }
 */
router.post('/request-otp', requestOtpLimiter, async (req, res) => {
  try {
    const { email } = requestOtpSchema.parse(req.body);

    // Find contact by email globally (no tenant context on initial request)
    // This follows the same pattern as the existing request-access endpoint
    const contact = await (storage as any).getContactByEmail(email);
    if (!contact) {
      // Don't reveal whether email exists for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a code.',
        expiresIn: 600 // 10 minutes
      });
    }

    // Generate 6-digit OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store token in database
    await storage.createPortalToken({
      tenantId: contact.tenantId,
      contactEmail: email,
      token: otp,
      expiresAt,
    });

    // Send email with OTP
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Your Client Portal Access Code</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 24px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #1a1a1a;">${otp}</p>
          </div>
          <p>This code expires in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `;

      await emailDispatcher.sendEmail({
        to: email,
        subject: 'Your Client Portal Access Code',
        text: `Your access code is: ${otp}\n\nThis code expires in 10 minutes.`,
        html: emailHtml,
        tenantId: contact.tenantId,
      });

      console.log(`📧 Portal OTP sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Still return success to avoid revealing email sending issues
    }

    return res.json({
      success: true,
      message: 'A verification code has been sent to your email',
      expiresIn: 600, // 10 minutes
    });
  } catch (error) {
    console.error('Error in request-otp:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process OTP request'
    });
  }
});

/**
 * POST /api/portal/auth/verify-otp
 * Verify OTP and create portal session
 *
 * Body: { email: string; token: string }
 * Response: { success: boolean; contact?: { id, name, email } }
 * Sets: express-session cookie
 */
router.post('/verify-otp', verifyOtpLimiter, async (req, res) => {
  try {
    const { email, token } = verifyOtpSchema.parse(req.body);

    // Find contact by email globally
    const contact = await (storage as any).getContactByEmail(email);
    if (!contact) {
      return res.status(401).json({
        error: 'Contact not found',
        message: 'No account found for this email'
      });
    }

    // Verify OTP matches and is not expired
    const portalToken = await storage.getPortalTokenByCode(token, email, contact.tenantId);
    if (!portalToken) {
      return res.status(401).json({
        error: 'Invalid or expired code',
        message: 'The code is invalid or has expired'
      });
    }

    // Mark token as used
    await storage.markPortalTokenUsed(portalToken.id);

    // Regenerate session for security
    req.session.regenerate((err: any) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({
          error: 'Session error',
          message: 'Failed to create portal session'
        });
      }

      // Store contact and tenant info in new session
      req.session.portalContactId = contact.id;
      req.session.tenantId = contact.tenantId;

      return res.json({
        success: true,
        contact: {
          id: contact.id,
          name: contact.fullName || contact.firstName,
          email: contact.email
        }
      });
    });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify OTP'
    });
  }
});

/**
 * POST /api/portal/auth/logout
 * Clear portal session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({
        error: 'Logout failed',
        message: 'Failed to clear session'
      });
    }
    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

/**
 * GET /api/portal/auth/session
 * Get current portal session info
 */
router.get('/session', (req, res) => {
  if (!req.session?.portalContactId) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'No active portal session'
    });
  }

  return res.json({
    contactId: req.session.portalContactId,
    tenantId: req.session.tenantId,
  });
});

export default router;
