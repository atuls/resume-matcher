/**
 * Export raw responses from the database to a local JSON file
 * This avoids database connection issues when processing
 */

// Import necessary modules
const { db } = require('./server/db');
const { analysisResults } = require('./shared/schema');
const { eq, and, isNotNull } = require('drizzle-orm');
const fs = require('fs');

// Configuration
const JOB_ID = 'f17e9b1c-9e63-4ed5-9cae-a307b37c95ff'; // Change this to your job ID
const LIMIT = 100; // Number of records to export (increase if needed)
const OUTPUT_FILE = 'api_response.json';

/**
 * Export raw responses from the database to a local file
 */
async function exportRawResponses() {
  try {
    console.log(`Exporting raw responses for job ID: ${JOB_ID}`);
    console.log(`Limit: ${LIMIT} records`);
    
    // Query the database for records with raw responses
    const results = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          eq(analysisResults.jobDescriptionId, JOB_ID),
          isNotNull(analysisResults.rawResponse)
        )
      )
      .limit(LIMIT);
    
    console.log(`Found ${results.length} records with raw responses`);
    
    // Write the results to a file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
    
    console.log(`Successfully exported ${results.length} records to ${OUTPUT_FILE}`);
    
    return {
      count: results.length,
      fileName: OUTPUT_FILE
    };
  } catch (error) {
    console.error('Error exporting raw responses:', error);
    throw error;
  }
}

// Run the export function
exportRawResponses()
  .then(result => {
    console.log('Export completed successfully:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Export failed:', error);
    process.exit(1);
  });