/**
 * Sync script to process all analysis results and extract structured data
 * This script will populate the parsedJson field for all records
 */

import { db } from './server/db.js';
import { syncAllParsedJson } from './server/services/syncParsedJsonService.js';

async function main() {
  console.log("Starting sync for all analysis results...");
  
  try {
    // Run the sync process for all records (no limit)
    const result = await syncAllParsedJson();
    
    console.log(`Sync completed successfully!`);
    console.log(`Total records processed: ${result.processed}`);
    console.log(`Records skipped: ${result.skipped}`);
    console.log(`Total records: ${result.total}`);
    console.log(`Success rate: ${Math.round((result.processed / result.total) * 100)}%`);
  } catch (error) {
    console.error("Error running sync process:", error);
  } finally {
    console.log("Sync process completed.");
    process.exit(0);
  }
}

main();