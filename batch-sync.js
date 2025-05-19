// Simple batch processor for raw responses
// This script processes a limited number of records at a time

import { db } from "./server/db";
import { analysisResults } from "./shared/schema";
import { eq, isNotNull, isNull, and } from "drizzle-orm";

// Configuration
const BATCH_SIZE = 10;  // Process 10 records at a time

/**
 * Extract structured data from raw response
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
    // Try multiple paths to find the data
    let parsedJson = null;
    
    // CASE 1: Extract from parsedJson at root level
    if (rawResponse.parsedJson && typeof rawResponse.parsedJson === 'object') {
      parsedJson = rawResponse.parsedJson;
    }
    // CASE 2: Extract from nested rawResponse.parsedJson
    else if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
      parsedJson = rawResponse.rawResponse.parsedJson;
    }
    // CASE 3: Extract from rawText field as JSON
    else if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
      try {
        const jsonMatch = rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing rawText as JSON");
      }
    }
    // CASE 4: Extract from nested rawText field
    else if (rawResponse.rawResponse && 
        rawResponse.rawResponse.rawText && 
        typeof rawResponse.rawResponse.rawText === 'string') {
      try {
        const jsonMatch = rawResponse.rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing nested rawText as JSON");
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
    console.error("Error extracting parsedJson");
    return result;
  }
}

/**
 * Process a batch of records
 */
async function processBatch() {
  try {
    console.log(`Processing batch of up to ${BATCH_SIZE} records`);
    
    // Get records that need processing
    const results = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          isNotNull(analysisResults.rawResponse),
          isNull(analysisResults.parsedJson)
        )
      )
      .limit(BATCH_SIZE);
    
    if (results.length === 0) {
      console.log("No records found that need processing");
      return { processed: 0, skipped: 0, total: 0, complete: true };
    }
    
    console.log(`Found ${results.length} records to process`);
    
    let processed = 0;
    let skipped = 0;
    
    // Process each record
    for (const result of results) {
      try {
        console.log(`Processing record ${result.id}`);
        
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
      } catch (error) {
        console.error(`Error processing record ${result.id}`);
        skipped++;
      }
    }
    
    console.log(`
Batch processing complete:
- Records processed: ${processed}
- Records skipped: ${skipped}
- Total in batch: ${results.length}
    `);
    
    return { 
      processed, 
      skipped, 
      total: results.length,
      complete: false // There might be more records to process
    };
  } catch (error) {
    console.error("Error processing batch:", error);
    return { processed: 0, skipped: 0, total: 0, complete: true };
  }
}

// Run the batch processor
processBatch()
  .then(result => {
    console.log("Batch processing completed:", result);
    process.exit(0);
  })
  .catch(error => {
    console.error("Batch processing failed:", error);
    process.exit(1);
  });