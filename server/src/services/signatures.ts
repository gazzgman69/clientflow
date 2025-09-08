import { eq, and } from 'drizzle-orm';
import { storage } from '../../storage';
import { emailSignatures, type EmailSignature, type InsertEmailSignature } from '@shared/schema';

export class SignaturesService {
  /**
   * Get all signatures for a user
   */
  async getUserSignatures(userId: string): Promise<EmailSignature[]> {
    return await storage.getUserSignatures(userId);
  }

  /**
   * Get a specific signature by ID
   */
  async getSignature(id: string, userId: string): Promise<EmailSignature | null> {
    return await storage.getSignature(id, userId);
  }

  /**
   * Get the default signature for a user
   */
  async getDefaultSignature(userId: string): Promise<EmailSignature | null> {
    return await storage.getDefaultSignature(userId);
  }

  /**
   * Create a new signature
   */
  async createSignature(data: InsertEmailSignature): Promise<EmailSignature> {
    // If this is set as default, remove default from other signatures
    if (data.isDefault) {
      await storage.clearDefaultSignatures(data.userId);
    }

    return await storage.createSignature(data);
  }

  /**
   * Update an existing signature
   */
  async updateSignature(id: string, userId: string, data: Partial<InsertEmailSignature>): Promise<EmailSignature | null> {
    const existing = await storage.getSignature(id, userId);
    if (!existing) {
      return null;
    }

    // If this is being set as default, remove default from other signatures
    if (data.isDefault) {
      await storage.clearDefaultSignatures(userId);
    }

    return await storage.updateSignature(id, userId, data);
  }

  /**
   * Delete a signature
   */
  async deleteSignature(id: string, userId: string): Promise<boolean> {
    const existing = await storage.getSignature(id, userId);
    if (!existing) {
      return false;
    }

    return await storage.deleteSignature(id, userId);
  }

  /**
   * Set a signature as default
   */
  async setDefaultSignature(id: string, userId: string): Promise<EmailSignature | null> {
    const existing = await storage.getSignature(id, userId);
    if (!existing) {
      return null;
    }

    // Clear all other defaults for this user
    await storage.clearDefaultSignatures(userId);

    // Set this one as default
    return await storage.updateSignature(id, userId, { isDefault: true });
  }
}

export const signaturesService = new SignaturesService();