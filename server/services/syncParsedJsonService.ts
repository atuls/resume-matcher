/**
 * Service to extract and sync the parsed JSON data from raw_response
 * This utility will populate the new parsedJson field for all analysis results
 */
import { db } from "../db";
import { analysisResults } from "../../shared/schema";
import { eq, isNotNull, isNull, and } from "drizzle-orm";

/**
 * Extract the structured JSON data from the raw_response
 */
function extractParsedJson(rawResponse: any): any {
  if (!rawResponse) return null;
  
  // Initialize result object
  const result: any = {
    skills: [],
    workHistory: [],
    redFlags: [],
    summary: "",
    score: 0
  };
  
  try {
    // CASE 1: Direct parsedJson field
    if (rawResponse.parsedJson && typeof rawResponse.parsedJson === 'object') {
      // Extract from the parsedJson field
      if (rawResponse.parsedJson.Skills && Array.isArray(rawResponse.parsedJson.Skills)) {
        result.skills = rawResponse.parsedJson.Skills;
      }
      
      if (rawResponse.parsedJson.Work_History && Array.isArray(rawResponse.parsedJson.Work_History)) {
        result.workHistory = rawResponse.parsedJson.Work_History;
      }
      
      if (rawResponse.parsedJson.Red_Flags && Array.isArray(rawResponse.parsedJson.Red_Flags)) {
        result.redFlags = rawResponse.parsedJson.Red_Flags;
      }
      
      if (rawResponse.parsedJson.Summary) {
        result.summary = rawResponse.parsedJson.Summary;
      }
      
      if (rawResponse.parsedJson.matching_score) {
        result.score = rawResponse.parsedJson.matching_score;
      }
      
      return result;
    }
    
    // CASE 2: Nested rawResponse.parsedJson
    if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
      const nestedParsedJson = rawResponse.rawResponse.parsedJson;
      
      if (nestedParsedJson.Skills && Array.isArray(nestedParsedJson.Skills)) {
        result.skills = nestedParsedJson.Skills;
      }
      
      if (nestedParsedJson.Work_History && Array.isArray(nestedParsedJson.Work_History)) {
        result.workHistory = nestedParsedJson.Work_History;
      }
      
      if (nestedParsedJson.Red_Flags && Array.isArray(nestedParsedJson.Red_Flags)) {
        result.redFlags = nestedParsedJson.Red_Flags;
      }
      
      if (nestedParsedJson.Summary) {
        result.summary = nestedParsedJson.Summary;
      }
      
      if (nestedParsedJson.matching_score) {
        result.score = nestedParsedJson.matching_score;
      }
      
      return result;
    }
    
    // CASE 3: rawText to be parsed
    if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
      try {
        // Find JSON object in the rawText
        const jsonMatch = rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          if (parsed.Skills && Array.isArray(parsed.Skills)) {
            result.skills = parsed.Skills;
          }
          
          if (parsed.Work_History && Array.isArray(parsed.Work_History)) {
            result.workHistory = parsed.Work_History;
          }
          
          if (parsed.Red_Flags && Array.isArray(parsed.Red_Flags)) {
            result.redFlags = parsed.Red_Flags;
          }
          
          if (parsed.Summary) {
            result.summary = parsed.Summary;
          }
          
          if (parsed.matching_score) {
            result.score = parsed.matching_score;
          }
          
          return result;
        }
      } catch (e) {
        console.error("Error parsing rawText:", e);
      }
    }
    
    // CASE 4: Deeply nested structure
    if (rawResponse.rawResponse && 
        rawResponse.rawResponse.rawText && 
        typeof rawResponse.rawResponse.rawText === 'string') {
      try {
        // Find JSON object in the nested rawText
        const jsonMatch = rawResponse.rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          if (parsed.Skills && Array.isArray(parsed.Skills)) {
            result.skills = parsed.Skills;
          }
          
          if (parsed.Work_History && Array.isArray(parsed.Work_History)) {
            result.workHistory = parsed.Work_History;
          }
          
          if (parsed.Red_Flags && Array.isArray(parsed.Red_Flags)) {
            result.redFlags = parsed.Red_Flags;
          }
          
          if (parsed.Summary) {
            result.summary = parsed.Summary;
          }
          
          if (parsed.matching_score) {
            result.score = parsed.matching_score;
          }
          
          return result;
        }
      } catch (e) {
        console.error("Error parsing nested rawText:", e);
      }
    }
    
    // If no data found, return the empty result
    return result;
  } catch (error) {
    console.error("Error extracting parsed JSON:", error);
    return result;
  }
}

/**
 * Sync parsedJson for a specific job description
 */
export async function syncParsedJsonForJob(jobDescriptionId: string): Promise<{ 
  processed: number; 
  skipped: number; 
  total: number;
}> {
  try {
    // Only process records with raw_response
    const results = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          eq(analysisResults.jobDescriptionId, jobDescriptionId),
          isNotNull(analysisResults.rawResponse)
        )
      );
    
    console.log(`Found ${results.length} analysis results with raw_response for job ${jobDescriptionId}`);
    
    let processed = 0;
    let skipped = 0;
    
    // Process each result
    for (const result of results) {
      try {
        const rawResponse = result.rawResponse;
        
        // Extract the parsed JSON data
        const parsedJson = extractParsedJson(rawResponse);
        
        // Skip if no meaningful data was extracted
        if (!parsedJson || 
            (parsedJson.skills.length === 0 && 
             parsedJson.workHistory.length === 0 && 
             parsedJson.redFlags.length === 0 && 
             !parsedJson.summary)) {
          skipped++;
          continue;
        }
        
        // Update the database record with parsed data
        await db
          .update(analysisResults)
          .set({
            parsedJson,
            // Also update the individual parsed fields for backward compatibility
            parsedSkills: parsedJson.skills.length > 0 ? parsedJson.skills : null,
            parsedWorkHistory: parsedJson.workHistory.length > 0 ? parsedJson.workHistory : null,
            parsedRedFlags: parsedJson.redFlags.length > 0 ? parsedJson.redFlags : null,
            parsedSummary: parsedJson.summary || null,
            parsingStatus: "complete",
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, result.id));
        
        processed++;
        
        // Log progress every 50 records
        if (processed % 50 === 0) {
          console.log(`Processed ${processed} records so far`);
        }
      } catch (error) {
        console.error(`Error processing record ${result.id}:`, error);
        skipped++;
      }
    }
    
    console.log(`
Processing complete for job ${jobDescriptionId}:
- Total: ${results.length}
- Processed: ${processed}
- Skipped: ${skipped}
    `);
    
    return {
      processed,
      skipped,
      total: results.length
    };
  } catch (error) {
    console.error("Error syncing parsed JSON for job:", error);
    return {
      processed: 0,
      skipped: 0,
      total: 0
    };
  }
}

/**
 * Sync parsedJson for all analysis results
 */
export async function syncAllParsedJson(batchLimit?: number): Promise<{
  processed: number;
  skipped: number;
  total: number;
}> {
  try {
    // Build the WHERE condition
    const whereCondition = and(
      isNotNull(analysisResults.rawResponse),
      isNull(analysisResults.parsedJson)
    );
    
    // Get results based on whether a limit is provided
    const results = batchLimit
      ? await db
          .select()
          .from(analysisResults)
          .where(whereCondition)
          .limit(batchLimit)
      : await db
          .select()
          .from(analysisResults)
          .where(whereCondition);
    
    console.log(`Found ${results.length} analysis results that need parsedJson sync`);
    
    let processed = 0;
    let skipped = 0;
    
    // Process each result
    for (const result of results) {
      try {
        const rawResponse = result.rawResponse;
        
        // Extract the parsed JSON data
        const parsedJson = extractParsedJson(rawResponse);
        
        // Skip if no meaningful data was extracted
        if (!parsedJson || 
            (parsedJson.skills.length === 0 && 
             parsedJson.workHistory.length === 0 && 
             parsedJson.redFlags.length === 0 && 
             !parsedJson.summary)) {
          skipped++;
          continue;
        }
        
        // Update the database record with parsed data
        await db
          .update(analysisResults)
          .set({
            parsedJson,
            // Also update the individual parsed fields for backward compatibility
            parsedSkills: parsedJson.skills.length > 0 ? parsedJson.skills : null,
            parsedWorkHistory: parsedJson.workHistory.length > 0 ? parsedJson.workHistory : null,
            parsedRedFlags: parsedJson.redFlags.length > 0 ? parsedJson.redFlags : null,
            parsedSummary: parsedJson.summary || null,
            parsingStatus: "complete",
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, result.id));
        
        processed++;
        
        // Log progress every 50 records
        if (processed % 50 === 0) {
          console.log(`Processed ${processed} records so far`);
        }
      } catch (error) {
        console.error(`Error processing record ${result.id}:`, error);
        skipped++;
      }
    }
    
    console.log(`
Processing complete for all records:
- Total: ${results.length}
- Processed: ${processed}
- Skipped: ${skipped}
    `);
    
    return {
      processed,
      skipped,
      total: results.length
    };
  } catch (error) {
    console.error("Error syncing all parsed JSON:", error);
    return {
      processed: 0,
      skipped: 0,
      total: 0
    };
  }
}