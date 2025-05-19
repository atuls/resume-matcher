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
export function extractParsedJson(rawResponse: any): { 
  skills: string[]; 
  workHistory: any[]; 
  redFlags: string[]; 
  summary: string;
  score: number;
} | null {
  if (!rawResponse) return null;
  
  // Initialize the result object with default values
  const result = {
    skills: [],
    workHistory: [],
    redFlags: [],
    summary: "",
    score: 0
  };
  
  try {
    console.log("Processing raw response structure");
    
    // CASE 1: Extract from parsedJson at root level
    if (rawResponse.parsedJson && typeof rawResponse.parsedJson === 'object') {
      console.log("Found parsedJson at root level");
      
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
    
    // CASE 2: Extract from nested rawResponse.parsedJson
    if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
      console.log("Found parsedJson in nested rawResponse");
      
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
    
    // CASE 3: Extract from parsedData structure
    if (rawResponse.parsedData) {
      console.log("Found parsedData structure");
      
      if (rawResponse.parsedData.skills && Array.isArray(rawResponse.parsedData.skills)) {
        result.skills = rawResponse.parsedData.skills;
      }
      
      if (rawResponse.parsedData.workHistory && Array.isArray(rawResponse.parsedData.workHistory)) {
        result.workHistory = rawResponse.parsedData.workHistory;
      }
      
      if (rawResponse.parsedData.redFlags && Array.isArray(rawResponse.parsedData.redFlags)) {
        result.redFlags = rawResponse.parsedData.redFlags;
      }
      
      if (rawResponse.parsedData.summary) {
        result.summary = rawResponse.parsedData.summary;
      }
      
      if (rawResponse.scoreData && rawResponse.scoreData.score) {
        result.score = rawResponse.scoreData.score;
      }
      
      return result;
    }
    
    // CASE 4: Extract from rawText field as JSON
    if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
      console.log("Found rawText field, attempting to parse as JSON");
      
      try {
        // Find JSON object pattern in string
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
        console.error("Error parsing rawText as JSON:", e);
      }
    }
    
    // CASE 5: Extract from nested rawText field
    if (rawResponse.rawResponse && 
        rawResponse.rawResponse.rawText && 
        typeof rawResponse.rawResponse.rawText === 'string') {
      console.log("Found nested rawText field, attempting to parse as JSON");
      
      try {
        // Find JSON object pattern in string
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
        console.error("Error parsing nested rawText as JSON:", e);
      }
    }
    
    // CASE 6: From field-specific parsedX columns
    if (rawResponse.parsedSkills || rawResponse.parsedWorkHistory || rawResponse.parsedRedFlags || rawResponse.parsedSummary) {
      console.log("Using existing parsed fields");
      
      if (rawResponse.parsedSkills && Array.isArray(rawResponse.parsedSkills)) {
        result.skills = rawResponse.parsedSkills;
      }
      
      if (rawResponse.parsedWorkHistory && Array.isArray(rawResponse.parsedWorkHistory)) {
        result.workHistory = rawResponse.parsedWorkHistory;
      }
      
      if (rawResponse.parsedRedFlags && Array.isArray(rawResponse.parsedRedFlags)) {
        result.redFlags = rawResponse.parsedRedFlags;
      }
      
      if (rawResponse.parsedSummary) {
        result.summary = rawResponse.parsedSummary;
      }
      
      // Score might be in a separate field or not present
      if (rawResponse.score) {
        result.score = rawResponse.score;
      }
      
      // Return the result if we found at least one meaningful field
      if (result.skills.length > 0 || result.workHistory.length > 0 || 
          result.redFlags.length > 0 || result.summary) {
        return result;
      }
    }
    
    // No valid data found
    console.log("No valid data structure found in raw response");
    return null;
  } catch (error) {
    console.error("Error extracting parsedJson:", error);
    return null;
  }
}

/**
 * Sync parsedJson for a single analysis result
 */
export async function syncSingleParsedJson(id: string): Promise<boolean> {
  try {
    // Get the record
    const [result] = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.id, id));
    
    if (!result) {
      console.error(`Record ${id} not found`);
      return false;
    }
    
    if (!result.rawResponse) {
      console.log(`Record ${id} has no rawResponse`);
      return false;
    }
    
    // Extract structured data
    const parsedJson = extractParsedJson(result.rawResponse);
    
    // Skip if no meaningful data was extracted
    if (!parsedJson || 
        (parsedJson.skills.length === 0 && 
         parsedJson.workHistory.length === 0 && 
         parsedJson.redFlags.length === 0 && 
         !parsedJson.summary)) {
      console.log(`No meaningful data extracted for record ${id}`);
      return false;
    }
    
    // Update the record
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
      .where(eq(analysisResults.id, id));
    
    console.log(`Successfully processed record ${id}`);
    console.log(`- Skills: ${parsedJson.skills.length}`);
    console.log(`- Work History: ${parsedJson.workHistory.length}`);
    console.log(`- Red Flags: ${parsedJson.redFlags.length}`);
    console.log(`- Summary: ${parsedJson.summary ? 'Found' : 'Not found'}`);
    
    return true;
  } catch (error) {
    console.error(`Error processing record ${id}:`, error);
    return false;
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
      } catch (error) {
        console.error(`Error processing record ${result.id}:`, error);
        skipped++;
      }
    }
    
    return { processed, skipped, total: results.length };
  } catch (error) {
    console.error(`Error syncing parsed JSON for job ${jobDescriptionId}:`, error);
    return { processed: 0, skipped: 0, total: 0 };
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
            parsedSkills: parsedJson.skills.length > 0 ? parsedJson.skills : null,
            parsedWorkHistory: parsedJson.workHistory.length > 0 ? parsedJson.workHistory : null,
            parsedRedFlags: parsedJson.redFlags.length > 0 ? parsedJson.redFlags : null,
            parsedSummary: parsedJson.summary || null,
            parsingStatus: "complete",
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, result.id));
        
        processed++;
      } catch (error) {
        console.error(`Error processing record ${result.id}:`, error);
        skipped++;
      }
    }
    
    return { processed, skipped, total: results.length };
  } catch (error) {
    console.error("Error syncing all parsed JSON:", error);
    return { processed: 0, skipped: 0, total: 0 };
  }
}