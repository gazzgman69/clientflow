import { db } from '../../db';
import { userPrefs, type UserPref, type InsertUserPref } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class UserPrefsService {
  /**
   * Get a specific user preference by key
   */
  async getUserPref(userId: string, key: string): Promise<string | null> {
    try {
      const [pref] = await db
        .select()
        .from(userPrefs)
        .where(and(eq(userPrefs.userId, userId), eq(userPrefs.key, key)))
        .limit(1);
      
      return pref?.value || null;
    } catch (error) {
      console.error('Error fetching user preference:', error);
      return null;
    }
  }

  /**
   * Get multiple user preferences by keys
   */
  async getUserPrefs(userId: string, keys?: string[]): Promise<Record<string, string>> {
    try {
      const query = db
        .select()
        .from(userPrefs)
        .where(eq(userPrefs.userId, userId));
      
      const prefs = await query;
      
      const result: Record<string, string> = {};
      
      for (const pref of prefs) {
        if (!keys || keys.includes(pref.key)) {
          result[pref.key] = pref.value;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      return {};
    }
  }

  /**
   * Set a user preference (upsert operation)
   */
  async setUserPref(userId: string, key: string, value: string): Promise<boolean> {
    try {
      await db
        .insert(userPrefs)
        .values({
          userId,
          key,
          value,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [userPrefs.userId, userPrefs.key],
          set: {
            value,
            updatedAt: new Date()
          }
        });
      
      return true;
    } catch (error) {
      console.error('Error setting user preference:', error);
      return false;
    }
  }

  /**
   * Delete a user preference
   */
  async deleteUserPref(userId: string, key: string): Promise<boolean> {
    try {
      await db
        .delete(userPrefs)
        .where(and(eq(userPrefs.userId, userId), eq(userPrefs.key, key)));
      
      return true;
    } catch (error) {
      console.error('Error deleting user preference:', error);
      return false;
    }
  }

  /**
   * Delete all user preferences for a user
   */
  async deleteAllUserPrefs(userId: string): Promise<boolean> {
    try {
      await db
        .delete(userPrefs)
        .where(eq(userPrefs.userId, userId));
      
      return true;
    } catch (error) {
      console.error('Error deleting all user preferences:', error);
      return false;
    }
  }
}

export const userPrefsService = new UserPrefsService();