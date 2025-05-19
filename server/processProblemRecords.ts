/**
 * Special utility to process problematic raw response records
 * that have nested JSON structure in rawText
 */
import { db } from "./db";
import { analysisResults } from "../shared/schema";
import { eq, and, isNotNull, isNull } from "drizzle-orm";

/**
 * Parse nested JSON strings in rawText fields
 * This fixes records where the extraction is failing due to nested structure
 */
function parseNestedRawText(rawResponse: any): any {
  // If rawResponse is null or not an object, return null
  if (!rawResponse || typeof rawResponse !== 'object') {
    return null;
  }
  
  console.log("Parsing nested rawText: Checking for nested structure");
  
  // Case 1: Check if data is in rawResponse.rawText
  if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
    console.log("Found rawText field, attempting to parse as JSON");
    try {
      // Find JSON object pattern in the string
      const jsonMatch = rawResponse.rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("Successfully parsed JSON from rawText");
        return parsed;
      }
    } catch (e) {
      console.error("Error parsing rawText as JSON:", e);
    }
  }
  
  // Case 2: Check if data is in rawResponse.rawResponse.rawText
  if (rawResponse.rawResponse && 
      rawResponse.rawResponse.rawText && 
      typeof rawResponse.rawResponse.rawText === 'string') {
    console.log("Found nested rawResponse.rawText, attempting to parse as JSON");
    try {
      // Find JSON object pattern in the string
      const jsonMatch = rawResponse.rawResponse.rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("Successfully parsed JSON from nested rawText");
        return parsed;
      }
    } catch (e) {
      console.error("Error parsing nested rawText as JSON:", e);
    }
  }
  
  // Case 3: If parsedJson is already available, use it
  if (rawResponse.parsedJson) {
    console.log("Found parsedJson field, using it directly");
    return rawResponse.parsedJson;
  }
  
  // Case 4: If rawResponse.rawResponse.parsedJson is available, use it
  if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
    console.log("Found nested parsedJson field, using it directly");
    return rawResponse.rawResponse.parsedJson;
  }
  
  console.log("No valid JSON structure found in nested fields");
  return null;
}

/**
 * Extract skills from the parsed data
 */
function extractSkills(parsed: any): string[] {
  if (!parsed) return [];
  
  if (Array.isArray(parsed.Skills)) {
    return parsed.Skills;
  } else if (Array.isArray(parsed.skills)) {
    return parsed.skills;
  }
  
  return [];
}

/**
 * Extract work history from the parsed data
 */
function extractWorkHistory(parsed: any): any[] {
  if (!parsed) return [];
  
  if (Array.isArray(parsed.Work_History)) {
    return parsed.Work_History;
  } else if (Array.isArray(parsed["Work History"])) {
    return parsed["Work History"];
  } else if (Array.isArray(parsed.workHistory)) {
    return parsed.workHistory;
  }
  
  return [];
}

/**
 * Extract red flags from the parsed data
 */
function extractRedFlags(parsed: any): string[] {
  if (!parsed) return [];
  
  if (Array.isArray(parsed.Red_Flags)) {
    return parsed.Red_Flags;
  } else if (Array.isArray(parsed["Red Flags"])) {
    return parsed["Red Flags"];
  } else if (Array.isArray(parsed.redFlags)) {
    return parsed.redFlags;
  }
  
  return [];
}

/**
 * Extract summary from the parsed data
 */
function extractSummary(parsed: any): string {
  if (!parsed) return "";
  
  if (typeof parsed.Summary === 'string') {
    return parsed.Summary;
  } else if (typeof parsed.summary === 'string') {
    return parsed.summary;
  }
  
  return "";
}

/**
 * Process a single analysis result
 */
export async function processAnalysisResult(analysisResultId: string): Promise<boolean> {
  try {
    // Fetch the result from the database
    const [result] = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.id, analysisResultId));
    
    if (!result) {
      console.error(`Analysis result not found: ${analysisResultId}`);
      return false;
    }
    
    // Skip if rawResponse is null
    if (!result.rawResponse) {
      console.log(`Analysis result has no rawResponse: ${analysisResultId}`);
      await db
        .update(analysisResults)
        .set({ 
          parsingStatus: 'no_data'
        })
        .where(eq(analysisResults.id, analysisResultId));
      return false;
    }
    
    // Extract and parse the nested data
    const rawResponseData = typeof result.rawResponse === 'string' 
      ? JSON.parse(result.rawResponse) 
      : result.rawResponse;
    
    // Try to get the nested data structure
    const parsedData = parseNestedRawText(rawResponseData);
    
    if (!parsedData) {
      console.error(`Failed to extract data from raw response: ${analysisResultId}`);
      return false;
    }
    
    // Extract structured data
    const skills = extractSkills(parsedData);
    const workHistory = extractWorkHistory(parsedData);
    const redFlags = extractRedFlags(parsedData);
    const summary = extractSummary(parsedData);
    
    // Update the database with extracted data
    await db
      .update(analysisResults)
      .set({
        parsedSkills: skills.length > 0 ? skills : null,
        parsedWorkHistory: workHistory.length > 0 ? workHistory : null,
        parsedRedFlags: redFlags.length > 0 ? redFlags : null,
        parsedSummary: summary || null,
        parsingStatus: "complete",
        updatedAt: new Date()
      })
      .where(eq(analysisResults.id, analysisResultId));
    
    console.log(`Successfully processed analysis result: ${analysisResultId}`);
    console.log(`- Skills: ${skills.length} items`);
    console.log(`- Work History: ${workHistory.length} items`);
    console.log(`- Red Flags: ${redFlags.length} items`);
    console.log(`- Summary: ${summary ? 'Found' : 'Not found'}`);
    
    return true;
  } catch (error) {
    console.error(`Error processing analysis result ${analysisResultId}:`, error);
    return false;
  }
}

/**
 * Process multiple analysis results by job ID
 */
export async function processAnalysisResultsByJob(
  jobDescriptionId: string,
  limit: number = 10,
  resetStatus: boolean = false
): Promise<{ success: number, failed: number, total: number }> {
  try {
    console.log(`Processing analysis results for job: ${jobDescriptionId}`);
    
    // Build query conditions
    const conditions = [
      eq(analysisResults.jobDescriptionId, jobDescriptionId),
      isNotNull(analysisResults.rawResponse)
    ];
    
    // If we're not resetting, only process records that are 'complete' but have null parsed fields
    if (!resetStatus) {
      conditions.push(eq(analysisResults.parsingStatus, 'complete'));
      // Records that have parsing_status='complete' but NULL parsed fields
      conditions.push(isNull(analysisResults.parsedSkills));
    } else {
      // If resetting, only target records with 'complete' status
      conditions.push(eq(analysisResults.parsingStatus, 'complete'));
    }
    
    // Get analysis results that match our criteria
    const results = await db
      .select()
      .from(analysisResults)
      .where(and(...conditions))
      .limit(limit);
    
    console.log(`Found ${results.length} analysis results to process`);
    
    // If resetting status, update to 'pending' first
    if (resetStatus && results.length > 0) {
      console.log(`Resetting parsing status for ${results.length} records...`);
      
      for (const result of results) {
        await db
          .update(analysisResults)
          .set({ parsingStatus: 'pending' })
          .where(eq(analysisResults.id, result.id));
      }
      
      console.log(`Reset complete. Records are now marked as 'pending'`);
    }
    
    // Process each result
    let successCount = 0;
    let failedCount = 0;
    
    for (const result of results) {
      const success = await processAnalysisResult(result.id);
      
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    }
    
    console.log(`
Processing complete:
- Total records: ${results.length}
- Successfully processed: ${successCount}
- Failed: ${failedCount}
    `);
    
    return {
      success: successCount,
      failed: failedCount,
      total: results.length
    };
  } catch (error) {
    console.error(`Error processing analysis results for job ${jobDescriptionId}:`, error);
    return { success: 0, failed: 0, total: 0 };
  }
}

/**
 * Helper function to reset and reprocess a specific analysis result
 */
export async function resetAndReprocessAnalysisResult(analysisResultId: string): Promise<boolean> {
  try {
    // First, reset the status to pending
    await db
      .update(analysisResults)
      .set({ parsingStatus: 'pending' })
      .where(eq(analysisResults.id, analysisResultId));
    
    console.log(`Reset parsing status for analysis result: ${analysisResultId}`);
    
    // Then process it
    return await processAnalysisResult(analysisResultId);
  } catch (error) {
    console.error(`Error resetting and reprocessing analysis result ${analysisResultId}:`, error);
    return false;
  }
}