import express from 'express';
import Stripe from 'stripe';
import { storage } from '../../storage';
import { insertPaymentSessionSchema } from '@shared/schema';

// Conditional Stripe initialization to prevent server crashes
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
  });
}

function ensureStripeInitialized(): Stripe {
  if (!stripe) {
    throw new Error('Stripe not configured - missing STRIPE_SECRET_KEY environment variable');
  }
  return stripe;
}

const router = express.Router();

// Get invoices for a contact in portal view
router.get("/invoices", async (req, res) => {
  try {
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists

    const invoices = await storage.getInvoicesByContactId(contactId);
    const formatted = invoices.map(invoice => ({
      ...invoice,
      // Format dates for dd/MM/yyyy display
      createdAt: invoice.createdAt?.toLocaleDateString('en-GB'),
      dueDate: invoice.dueDate?.toLocaleDateString('en-GB'),
      paidAt: invoice.paidAt?.toLocaleDateString('en-GB'),
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get payment history for a contact
router.get("/payment-history", async (req, res) => {
  try {
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists

    const paymentSessions = await storage.getPaymentSessionsByContactId(contactId);
    const formatted = paymentSessions.map(session => ({
      ...session,
      createdAt: session.createdAt?.toLocaleDateString('en-GB'),
      completedAt: session.completedAt?.toLocaleDateString('en-GB'),
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Create payment intent for invoice
router.post("/create-payment-intent", async (req, res) => {
  try {
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID required' });
    }

    // Get invoice details
    const invoice = await storage.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Verify ownership: invoice must belong to the authenticated contact
    if (invoice.contactId !== contactId) {
      return res.status(403).json({ error: 'Access denied - invoice does not belong to this contact' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' });
    }

    // Create Stripe payment intent
    const stripeClient = ensureStripeInitialized();
    const amount = Math.round(parseFloat(invoice.total || invoice.subtotal || '0') * 100); // Convert to cents
    
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        invoiceId,
        contactId,
      },
    });

    // Get contact to get tenantId
    const contact = await storage.getContactById(contactId, invoice.tenantId || 'default-tenant');
    if (!contact) {
      return res.status(403).json({ error: 'Contact not found' });
    }

    // Save payment session to database
    const paymentSession = insertPaymentSessionSchema.parse({
      invoiceId,
      contactId,
      provider: 'stripe',
      sessionId: paymentIntent.id,
      paymentIntentId: paymentIntent.id,
      amount: (amount / 100).toString(),
      currency: 'usd',
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: JSON.stringify({
        stripe_payment_intent_id: paymentIntent.id,
        invoice_number: invoice.invoiceNumber,
      }),
    });

    await storage.createPaymentSession(paymentSession, contact.tenantId);

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      sessionId: paymentIntent.id 
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Confirm payment completion
router.post("/confirm-payment", async (req, res) => {
  try {
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Get payment intent from Stripe
    const stripeClient = ensureStripeInitialized();
    const paymentIntent = await stripeClient.paymentIntents.retrieve(sessionId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update payment session status
      await storage.updatePaymentSession(sessionId, {
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
      }

      res.json({ status: 'success', paymentIntentId: sessionId });
    } else {
      res.json({ status: 'pending', paymentIntentId: sessionId });
    }
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

export default router;