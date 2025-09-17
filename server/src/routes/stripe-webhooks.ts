import express from 'express';
import Stripe from 'stripe';
import { storage } from '../../storage';
import { insertWebhookEventSchema } from '@shared/schema';

const router = express.Router();

// Conditional Stripe initialization
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });
}

function ensureStripeInitialized(): Stripe {
  if (!stripe) {
    throw new Error('Stripe not configured - missing STRIPE_SECRET_KEY environment variable');
  }
  return stripe;
}

// Stripe webhook endpoint with signature verification
// Note: Raw body parsing is handled globally for /api/stripe/webhook in server/index.ts
router.post('/webhook', async (req, res) => {
  try {
    const stripeClient = ensureStripeInitialized();
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return res.status(400).send('Webhook secret not configured');
    }

    if (!sig) {
      console.error('❌ Missing Stripe signature header');
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature for security
      event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log(`✅ Stripe webhook signature verified for event: ${event.type}`);
    } catch (err: any) {
      console.error(`❌ Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Check for idempotency - ensure we haven't already processed this event
    const existingEvent = await storage.getWebhookEventByProviderAndEventId('stripe', event.id);
    if (existingEvent) {
      if (existingEvent.processed) {
        console.log(`⚠️ Event ${event.id} (${event.type}) already processed - skipping (idempotent)`);
        return res.json({ received: true, status: 'already_processed' });
      } else {
        console.log(`♻️ Retrying failed event ${event.id} (${event.type})`);
      }
    } else {
      // Record new webhook event for idempotency tracking (handle race conditions)
      try {
        await storage.createWebhookEvent({
          provider: 'stripe',
          eventId: event.id,
          eventType: event.type,
          processed: false,
          payload: JSON.stringify(event, null, 2),
          retryCount: 0,
        });
      } catch (createError: any) {
        // Handle race condition - another concurrent request may have created this event
        if (createError.code === '23505' || createError.message?.includes('unique')) {
          console.log(`⚠️ Race condition detected for event ${event.id} - continuing with existing record`);
        } else {
          throw createError; // Re-throw unexpected errors
        }
      }
    }

    try {
      // Process webhook event based on type
      await processStripeWebhookEvent(event);

      // Mark event as successfully processed
      await storage.updateWebhookEvent(event.id, {
        processed: true,
        processedAt: new Date(),
        errorMessage: null,
      });

      console.log(`✅ Successfully processed Stripe webhook: ${event.type} (${event.id})`);
      res.json({ received: true, status: 'processed' });

    } catch (processingError: any) {
      console.error(`❌ Error processing webhook event ${event.id}:`, processingError);

      // Update retry count and error message
      const currentEvent = await storage.getWebhookEventByProviderAndEventId('stripe', event.id);
      const retryCount = (currentEvent?.retryCount || 0) + 1;

      await storage.updateWebhookEvent(event.id, {
        processed: false,
        errorMessage: processingError.message || 'Unknown processing error',
        retryCount,
      });

      // Return 500 to trigger Stripe retry mechanism
      res.status(500).json({ 
        received: true, 
        status: 'processing_failed',
        error: processingError.message,
        retryCount 
      });
    }

  } catch (error: any) {
    console.error('❌ Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Process different types of Stripe webhook events
async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
      
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;
      
    case 'payment_intent.canceled':
      await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
      break;
      
    default:
      console.log(`ℹ️ Unhandled Stripe webhook event type: ${event.type}`);
      // Don't throw error for unhandled events - just log and continue
      break;
  }
}

// Handle successful payment
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(`💰 Payment succeeded: ${paymentIntent.id} - Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
  
  // Update payment session status
  await storage.updatePaymentSession(paymentIntent.id, {
    status: 'completed',
    completedAt: new Date(),
  });

  // Update invoice status to paid
  const invoiceId = paymentIntent.metadata.invoiceId;
  if (invoiceId) {
    await storage.updateInvoice(invoiceId, {
      status: 'paid',
      paidAt: new Date(),
    });
    console.log(`📧 Invoice ${invoiceId} marked as paid`);
  } else {
    console.warn(`⚠️ Payment intent ${paymentIntent.id} has no associated invoiceId in metadata`);
  }
}

// Handle failed payment
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(`💸 Payment failed: ${paymentIntent.id} - ${paymentIntent.last_payment_error?.message || 'Unknown error'}`);
  
  // Update payment session status
  await storage.updatePaymentSession(paymentIntent.id, {
    status: 'failed',
    metadata: JSON.stringify({
      ...JSON.parse(paymentIntent.metadata as any || '{}'),
      failure_reason: paymentIntent.last_payment_error?.message || 'Unknown error',
      failure_code: paymentIntent.last_payment_error?.code,
    }),
  });

  // Keep invoice status as unpaid for failed payments
  console.log(`📧 Payment session ${paymentIntent.id} marked as failed`);
}

// Handle canceled payment
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log(`🚫 Payment canceled: ${paymentIntent.id}`);
  
  // Update payment session status
  await storage.updatePaymentSession(paymentIntent.id, {
    status: 'cancelled',
  });

  console.log(`📧 Payment session ${paymentIntent.id} marked as cancelled`);
}

export default router;