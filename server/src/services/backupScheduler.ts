/**
 * Backup scheduler for daily encrypted backups at 02:00 Europe/London
 */

/**
 * Calculate milliseconds until next 02:00 Europe/London
 */
export function getMillisecondsUntilNext2AM(): number {
  const now = new Date();
  
  // Create a date for today at 02:00 Europe/London
  const target = new Date();
  target.setHours(2, 0, 0, 0); // Set to 02:00:00.000
  
  // If we've already passed 02:00 today, schedule for tomorrow
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }
  
  const msUntilTarget = target.getTime() - now.getTime();
  
  console.log(`⏰ Next backup scheduled for: ${target.toISOString()} (in ${Math.round(msUntilTarget / 1000 / 60)} minutes)`);
  
  return msUntilTarget;
}

/**
 * Schedule the daily backup job
 */
export async function scheduleDailyBackup(): Promise<void> {
  try {
    const { jobs } = await import('./jobsService');
    
    // Calculate delay until next 02:00
    const delayUntilFirst = getMillisecondsUntilNext2AM();
    
    // Schedule first backup with delay to 02:00, then every 24 hours
    const dailyInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Schedule the recurring backup job
    await jobs.enqueue('daily-backup', {}, {
      delay: delayUntilFirst,
      schedule: { type: 'interval', value: dailyInterval },
      tenantId: 'default-tenant' // SECURITY: System-level backup job
    });
    
    console.log('✅ Daily backup scheduled for 02:00 Europe/London');
    
  } catch (error) {
    console.error('❌ Failed to schedule daily backup:', error);
    throw error;
  }
}

/**
 * Get backup schedule status
 */
export async function getBackupScheduleStatus(): Promise<{
  nextBackupTime: string;
  hoursUntilNext: number;
  isScheduled: boolean;
}> {
  try {
    const msUntilNext = getMillisecondsUntilNext2AM();
    const nextBackupTime = new Date(Date.now() + msUntilNext);
    const hoursUntilNext = Math.round(msUntilNext / (1000 * 60 * 60));
    
    return {
      nextBackupTime: nextBackupTime.toISOString(),
      hoursUntilNext,
      isScheduled: true
    };
  } catch (error) {
    console.error('Failed to get backup schedule status:', error);
    return {
      nextBackupTime: 'Unknown',
      hoursUntilNext: 0,
      isScheduled: false
    };
  }
}