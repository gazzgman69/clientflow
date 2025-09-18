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
      
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;
      
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
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

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log(`💳 Processing checkout session completed: ${session.id}`);
  
  try {
    // Extract customer information
    const customerId = session.customer as string;
    const customerEmail = session.customer_details?.email;
    const paymentStatus = session.payment_status;
    const amount = session.amount_total; // Amount in cents
    const currency = session.currency;
    
    console.log(`💰 Checkout completed - Customer: ${customerEmail}, Amount: ${amount} ${currency}, Status: ${paymentStatus}`);
    
    // TODO: Implement your business logic here
    // Example actions:
    // 1. Update user subscription status
    // 2. Send confirmation email
    // 3. Activate premium features
    // 4. Record payment in database
    
    if (paymentStatus === 'paid') {
      console.log(`✅ Payment confirmed for session ${session.id}`);
      
      // Add your payment confirmation logic here
      // Example: await activateSubscription(customerId, session.metadata);
      
    } else {
      console.log(`⚠️ Payment not completed for session ${session.id} - Status: ${paymentStatus}`);
    }
    
  } catch (error: any) {
    console.error(`❌ Error processing checkout session ${session.id}:`, error);
    throw error;
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  console.log(`📄 Processing invoice paid: ${invoice.id}`);
  
  try {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;
    const amount = invoice.amount_paid; // Amount in cents
    const currency = invoice.currency;
    const customerEmail = invoice.customer_email;
    
    console.log(`💰 Invoice paid - Customer: ${customerEmail}, Amount: ${amount} ${currency}, Subscription: ${subscriptionId}`);
    
    // TODO: Implement your business logic here
    // Example actions:
    // 1. Update subscription billing status
    // 2. Send payment receipt
    // 3. Reset usage counters for metered billing
    // 4. Update tenant subscription status
    
    if (subscriptionId) {
      console.log(`🔄 Updating subscription ${subscriptionId} for successful payment`);
      
      // Add your subscription update logic here
      // Example: await updateSubscriptionStatus(subscriptionId, 'active');
      
    }
    
    // Record payment in webhook events for audit trail
    console.log(`✅ Invoice payment confirmed for ${invoice.id}`);
    
  } catch (error: any) {
    console.error(`❌ Error processing invoice payment ${invoice.id}:`, error);
    throw error;
  }
}

export default router;