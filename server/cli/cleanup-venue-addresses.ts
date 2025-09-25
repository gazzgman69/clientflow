#!/usr/bin/env tsx
/**
 * CLI tool for cleaning up venue addresses with duplication issues
 * 
 * Usage:
 *   npm run cleanup:venues                  # Check for issues
 *   npm run cleanup:venues --fix           # Actually fix the issues
 *   npm run cleanup:venues --help          # Show help
 */

import { cleanupAllVenueAddresses, findVenuesWithAddressIssues } from '../src/scripts/cleanupVenueAddresses';

interface CliOptions {
  fix: boolean;
  help: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  return {
    fix: args.includes('--fix'),
    help: args.includes('--help')
  };
}

function showHelp(): void {
  console.log(`
Venue Address Cleanup Tool

This tool helps identify and fix venue addresses with duplication issues.

Usage:
  npm run cleanup:venues                  Check for address duplication issues
  npm run cleanup:venues --fix           Fix all detected issues  
  npm run cleanup:venues --help          Show this help message

Examples:
  npm run cleanup:venues                  # Dry run - shows what would be fixed
  npm run cleanup:venues --fix           # Actually fixes the issues

What it does:
- Detects venues with duplicate address information
- Cleans addresses using the same logic as venue creation
- Prevents future address duplication issues
- Provides detailed logging of all changes

Safety:
- Dry run mode by default (use --fix to actually make changes)
- Preserves original data while cleaning duplicates
- Uses the same validation logic as the application
`);
}

async function main(): Promise<void> {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }

  console.log('🏢 Venue Address Cleanup Tool');
  console.log('===============================\n');

  try {
    if (options.fix) {
      console.log('🔧 FIXING MODE: Making actual changes to venue addresses\n');
      const results = await cleanupAllVenueAddresses();
      
      if (results.length === 0) {
        console.log('✅ No venues with address duplication issues found!');
      } else {
        console.log(`🎉 Successfully cleaned up ${results.length} venue(s):`);
        results.forEach((result, index) => {
          console.log(`\n${index + 1}. ${result.venueName}`);
          console.log(`   Original: "${result.originalAddress}"`);
          console.log(`   Cleaned:  "${result.cleanedAddress}"`);
        });
      }
    } else {
      console.log('🔍 DRY RUN MODE: Checking for issues (use --fix to make changes)\n');
      const issues = await findVenuesWithAddressIssues();
      
      if (issues.length === 0) {
        console.log('✅ No venues with address duplication issues found!');
      } else {
        console.log(`⚠️  Found ${issues.length} venue(s) with address duplication issues:`);
        issues.forEach((issue, index) => {
          console.log(`\n${index + 1}. ${issue.venueName}`);
          console.log(`   Address: "${issue.originalAddress}"`);
          console.log(`   Issue: Contains venue name duplication`);
        });
        console.log(`\n💡 Run with --fix to clean up these addresses`);
      }
    }
  } catch (error) {
    console.error('❌ Error during venue address cleanup:', error);
    process.exit(1);
  }
}

// Run the CLI tool
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}