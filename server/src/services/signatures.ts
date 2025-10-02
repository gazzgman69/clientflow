import { eq, and } from 'drizzle-orm';
import { storage } from '../../storage';
import { emailSignatures, type EmailSignature, type InsertEmailSignature } from '@shared/schema';

export class SignaturesService {
  /**
   * Get all signatures for a user
   */
  async getUserSignatures(userId: string, tenantId: string): Promise<EmailSignature[]> {
    return await storage.getUserSignatures(userId, tenantId);
  }

  /**
   * Get a specific signature by ID
   */
  async getSignature(id: string, userId: string, tenantId: string): Promise<EmailSignature | null> {
    return await storage.getSignature(id, userId, tenantId);
  }

  /**
   * Get the default signature for a user
   */
  async getDefaultSignature(userId: string, tenantId: string): Promise<EmailSignature | null> {
    return await storage.getDefaultSignature(userId, tenantId);
  }

  /**
   * Create a new signature
   */
  async createSignature(data: InsertEmailSignature, tenantId: string): Promise<EmailSignature> {
    // If this is set as default, remove default from other signatures
    if (data.isDefault && data.userId) {
      await storage.clearDefaultSignatures(data.userId, tenantId);
    }

    return await storage.createSignature(data, tenantId);
  }

  /**
   * Update an existing signature
   */
  async updateSignature(id: string, userId: string, data: Partial<InsertEmailSignature>, tenantId: string): Promise<EmailSignature | null> {
    const existing = await storage.getSignature(id, userId, tenantId);
    if (!existing) {
      return null;
    }

    // If this is being set as default, remove default from other signatures
    if (data.isDefault) {
      await storage.clearDefaultSignatures(userId, tenantId);
    }

    return await storage.updateSignature(id, userId, data, tenantId);
  }

  /**
   * Delete a signature
   */
  async deleteSignature(id: string, userId: string, tenantId: string): Promise<boolean> {
    const existing = await storage.getSignature(id, userId, tenantId);
    if (!existing) {
      return false;
    }

    return await storage.deleteSignature(id, userId, tenantId);
  }

  /**
   * Set a signature as default
   */
  async setDefaultSignature(id: string, userId: string, tenantId: string): Promise<EmailSignature | null> {
    const existing = await storage.getSignature(id, userId, tenantId);
    if (!existing) {
      return null;
    }

    // Clear all other defaults for this user
    await storage.clearDefaultSignatures(userId, tenantId);

    // Set this one as default
    return await storage.updateSignature(id, userId, { isDefault: true }, tenantId);
  }
}

export const signaturesService = new SignaturesService();