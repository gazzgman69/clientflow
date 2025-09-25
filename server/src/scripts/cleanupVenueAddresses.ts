/**
 * Script to cleanup existing venue addresses that may have duplication issues
 * This can be run as a one-time cleanup or periodically to maintain data quality
 */

import { storage } from '../../storage';
import { validateAndCleanVenueAddress, hasAddressDuplication } from '@shared/addressUtils';

interface VenueCleanupResult {
  venueId: string;
  venueName: string;
  originalAddress: string;
  cleanedAddress: string;
  hadIssues: boolean;
}

export async function cleanupAllVenueAddresses(): Promise<VenueCleanupResult[]> {
  console.log('🧹 Starting venue address cleanup...');
  
  const venues = await storage.getVenues();
  const results: VenueCleanupResult[] = [];
  
  for (const venue of venues) {
    if (!venue.address) continue;
    
    const originalAddress = venue.address;
    const hadDuplication = hasAddressDuplication(originalAddress, venue.name);
    
    if (!hadDuplication) {
      // No issues detected, skip
      continue;
    }
    
    console.log(`🔍 Checking venue: ${venue.name}`);
    console.log(`   Original address: "${originalAddress}"`);
    
    // Clean the address
    const cleanedData = validateAndCleanVenueAddress({
      venueName: venue.name,
      address: originalAddress,
      city: venue.city || undefined,
      state: venue.state || undefined,
      zipCode: venue.zipCode || undefined,
      country: venue.country || undefined
    });
    
    const cleanedAddress = cleanedData.address || '';
    
    if (cleanedAddress !== originalAddress) {
      console.log(`   ✨ Cleaned address: "${cleanedAddress}"`);
      
      // Update the venue
      try {
        await storage.updateVenue(venue.id, { address: cleanedAddress });
        console.log(`   ✅ Updated venue ${venue.name}`);
        
        results.push({
          venueId: venue.id,
          venueName: venue.name,
          originalAddress,
          cleanedAddress,
          hadIssues: true
        });
      } catch (error) {
        console.error(`   ❌ Failed to update venue ${venue.name}:`, error);
        results.push({
          venueId: venue.id,
          venueName: venue.name,
          originalAddress,
          cleanedAddress: originalAddress, // Keep original if update failed
          hadIssues: true
        });
      }
    } else {
      console.log(`   ℹ️  No cleaning needed for ${venue.name}`);
    }
  }
  
  console.log(`🎉 Cleanup complete! Processed ${results.length} venues with issues.`);
  return results;
}

export async function findVenuesWithAddressIssues(): Promise<VenueCleanupResult[]> {
  const venues = await storage.getVenues();
  const results: VenueCleanupResult[] = [];
  
  for (const venue of venues) {
    if (!venue.address) continue;
    
    const hadIssues = hasAddressDuplication(venue.address, venue.name);
    
    if (hadIssues) {
      results.push({
        venueId: venue.id,
        venueName: venue.name,
        originalAddress: venue.address,
        cleanedAddress: '', // Not cleaned yet
        hadIssues: true
      });
    }
  }
  
  return results;
}