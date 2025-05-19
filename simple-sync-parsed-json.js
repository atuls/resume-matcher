/**
 * Simple script to sync and extract structured data from analysis_results
 * This script uses direct database queries to avoid issues with migrations
 */

// Use the direct import of the db connection
const { db } = require('./server/db');
const { eq, and, isNotNull } = require('drizzle-orm');
const { analysisResults } = require('./shared/schema');

const JOB_ID = 'f17e9b1c-9e63-4ed5-9cae-a307b37c95ff'; // Replace with your job ID

/**
 * Extract structured data from a raw response object
 */
function extractParsedJson(rawResponse) {
  if (!rawResponse) return null;
  
  // Initialize result
  const result = {
    skills: [],
    workHistory: [],
    redFlags: [],
    summary: "",
    score: 0
  };
  
  try {
    console.log("Processing raw response...");
    
    // Try multiple paths to find the data
    let parsedJson = null;
    
    // CASE 1: Extract from parsedJson at root level
    if (rawResponse.parsedJson && typeof rawResponse.parsedJson === 'object') {
      console.log("Found parsedJson at root level");
      parsedJson = rawResponse.parsedJson;
    }
    // CASE 2: Extract from nested rawResponse.parsedJson
    else if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
      console.log("Found parsedJson in nested rawResponse");
      parsedJson = rawResponse.rawResponse.parsedJson;
    }
    // CASE 3: Extract from rawText field as JSON
    else if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
      console.log("Found rawText field, attempting to parse as JSON");
      try {
        const jsonMatch = rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing rawText as JSON:", e);
      }
    }
    // CASE 4: Extract from nested rawText field
    else if (rawResponse.rawResponse && 
        rawResponse.rawResponse.rawText && 
        typeof rawResponse.rawResponse.rawText === 'string') {
      console.log("Found nested rawText field, attempting to parse as JSON");
      try {
        const jsonMatch = rawResponse.rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing nested rawText as JSON:", e);
      }
    }
    
    // Extract data from parsedJson if we found it
    if (parsedJson) {
      if (parsedJson.Skills && Array.isArray(parsedJson.Skills)) {
        result.skills = parsedJson.Skills;
      }
      
      if (parsedJson.Work_History && Array.isArray(parsedJson.Work_History)) {
        result.workHistory = parsedJson.Work_History;
      }
      
      if (parsedJson.Red_Flags && Array.isArray(parsedJson.Red_Flags)) {
        result.redFlags = parsedJson.Red_Flags;
      }
      
      if (parsedJson.Summary) {
        result.summary = parsedJson.Summary;
      }
      
      if (parsedJson.matching_score) {
        result.score = parsedJson.matching_score;
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error extracting parsedJson:", error);
    return result;
  }
}

/**
 * Main function to run the sync process
 */
async function main() {
  try {
    console.log(`Processing raw responses for job ID: ${JOB_ID}`);
    
    // Get all records with raw_response data for this job
    const results = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          eq(analysisResults.jobDescriptionId, JOB_ID),
          isNotNull(analysisResults.rawResponse)
        )
      );
    
    console.log(`Found ${results.length} records to process`);
    
    // Process each record
    let processed = 0;
    let skipped = 0;
    
    for (const result of results) {
      try {
        console.log(`Processing record ${result.id} (${processed + skipped + 1}/${results.length})...`);
        
        // Extract structured data
        const parsedJson = extractParsedJson(result.rawResponse);
        
        // Skip if no meaningful data was extracted
        if (!parsedJson || 
            (parsedJson.skills.length === 0 && 
             parsedJson.workHistory.length === 0 && 
             parsedJson.redFlags.length === 0 && 
             !parsedJson.summary)) {
          console.log(`No meaningful data extracted for record ${result.id}`);
          skipped++;
          continue;
        }
        
        // Update the database
        await db
          .update(analysisResults)
          .set({
            parsedJson,
            // Also update individual fields for backward compatibility
            parsedSkills: parsedJson.skills.length > 0 ? parsedJson.skills : null,
            parsedWorkHistory: parsedJson.workHistory.length > 0 ? parsedJson.workHistory : null,
            parsedRedFlags: parsedJson.redFlags.length > 0 ? parsedJson.redFlags : null,
            parsedSummary: parsedJson.summary || null,
            parsingStatus: "complete",
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, result.id));
        
        processed++;
        console.log(`Successfully processed record ${result.id}`);
        console.log(`- Skills: ${parsedJson.skills.length}`);
        console.log(`- Work History: ${parsedJson.workHistory.length}`);
        console.log(`- Red Flags: ${parsedJson.redFlags.length}`);
        console.log(`- Summary: ${parsedJson.summary ? 'Found' : 'Not found'}`);
      } catch (error) {
        console.error(`Error processing record ${result.id}:`, error);
        skipped++;
      }
      
      // Log progress every 10 records
      if ((processed + skipped) % 10 === 0) {
        console.log(`Progress: ${processed} processed, ${skipped} skipped, ${processed + skipped} total`);
      }
    }
    
    console.log(`
Processing complete:
- Total records: ${results.length}
- Successfully processed: ${processed}
- Skipped: ${skipped}
    `);
    
    return {
      processed,
      skipped,
      total: results.length
    };
  } catch (error) {
    console.error("Error syncing parsed JSON:", error);
    return {
      processed: 0,
      skipped: 0,
      total: 0
    };
  }
}

// Run the script
main()
  .then((result) => {
    console.log("Script completed successfully:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });