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
    
    // CASE 6: From extractedSections in raw response (matches the structure seen in the screenshots)
    if (rawResponse.extractedSections) {
      console.log("Found extractedSections at top level");
      
      // Extract skills - Handle the case where skills is in the parent object
      if (rawResponse.skills && Array.isArray(rawResponse.skills)) {
        console.log("Using skills array from parent object");
        result.skills = rawResponse.skills;
      } else if (rawResponse.extractedSections.skills && typeof rawResponse.extractedSections.skills === 'string') {
        try {
          // Sometimes skills are stored as a comma-separated string
          const skillsText = rawResponse.extractedSections.skills.trim();
          if (skillsText) {
            result.skills = skillsText.split(',').map(s => s.trim()).filter(s => s);
          }
        } catch (e) {
          console.error("Error parsing skills string:", e);
        }
      } else if (rawResponse.extractedSections.skills && Array.isArray(rawResponse.extractedSections.skills)) {
        result.skills = rawResponse.extractedSections.skills;
      }
      
      // Extract work history
      if (rawResponse.extractedSections.workHistory && Array.isArray(rawResponse.extractedSections.workHistory)) {
        result.workHistory = rawResponse.extractedSections.workHistory;
        console.log(`Found ${result.workHistory.length} work history items in extractedSections.workHistory`);
      }
      
      // Extract red flags
      if (rawResponse.extractedSections.redFlags && Array.isArray(rawResponse.extractedSections.redFlags)) {
        result.redFlags = rawResponse.extractedSections.redFlags;
        console.log(`Found ${result.redFlags.length} red flags in extractedSections.redFlags`);
      }
      
      // Extract summary
      if (rawResponse.extractedSections.summary && typeof rawResponse.extractedSections.summary === 'string') {
        result.summary = rawResponse.extractedSections.summary;
        console.log("Found summary in extractedSections.summary");
      }
      
      // Extract score if available
      if (rawResponse.extractedSections.score || rawResponse.extractedSections.matching_score) {
        result.score = rawResponse.extractedSections.score || rawResponse.extractedSections.matching_score;
      } else if (rawResponse.score) {
        result.score = rawResponse.score;
      }
      
      // If we successfully extracted at least one field, return the result
      console.log("Extracted data:", {
        skillsCount: result.skills.length,
        workHistoryCount: result.workHistory.length,
        redFlagsCount: result.redFlags.length,
        hasSummary: !!result.summary,
        score: result.score
      });
      
      return result;
    }
    
    // CASE 7: From extractedSections in nested rawResponse (another possible structure)
    if (rawResponse.rawResponse && rawResponse.rawResponse.extractedSections) {
      console.log("Found extractedSections in nested rawResponse");
      
      const nestedSections = rawResponse.rawResponse.extractedSections;
      console.log("Nested extractedSections found with keys:", Object.keys(nestedSections));
      
      // CRITICAL DEBUG: Dump a bit of the data to see what we're working with
      for (const key of Object.keys(nestedSections)) {
        const value = nestedSections[key];
        console.log(`- "${key}" field is type: ${typeof value}, is array: ${Array.isArray(value)}`);
        if (Array.isArray(value) && value.length > 0) {
          console.log(`  - First item sample: ${JSON.stringify(value[0]).substring(0, 100)}...`);
        } else if (typeof value === 'string') {
          console.log(`  - String value starts with: ${value.substring(0, 100)}...`);
        }
      }
      
      // Check skills at multiple levels
      if (rawResponse.skills && Array.isArray(rawResponse.skills)) {
        console.log("Using skills array from parent object");
        result.skills = rawResponse.skills;
      } else if (rawResponse.rawResponse.skills && Array.isArray(rawResponse.rawResponse.skills)) {
        console.log("Using skills array from rawResponse.skills");
        result.skills = rawResponse.rawResponse.skills;
      } else if (nestedSections.skills && typeof nestedSections.skills === 'string') {
        try {
          // Sometimes skills are stored as a comma-separated string
          const skillsText = nestedSections.skills.trim();
          if (skillsText) {
            result.skills = skillsText.split(',').map(s => s.trim()).filter(s => s);
            console.log("Parsed skills from string:", result.skills);
          }
        } catch (e) {
          console.error("Error parsing skills string:", e);
        }
      } else if (nestedSections.skills && Array.isArray(nestedSections.skills)) {
        result.skills = nestedSections.skills;
        console.log("Using skills array from nestedSections.skills with length:", result.skills.length);
      }
      
      // Extract work history
      if (nestedSections.workHistory && Array.isArray(nestedSections.workHistory)) {
        result.workHistory = nestedSections.workHistory;
        console.log(`Found ${result.workHistory.length} work history items in nestedSections.workHistory`);
      } else if (rawResponse.rawResponse.work_history && Array.isArray(rawResponse.rawResponse.work_history)) {
        result.workHistory = rawResponse.rawResponse.work_history;
        console.log(`Found ${result.workHistory.length} work history items in rawResponse.rawResponse.work_history`);
      } else if (rawResponse.rawResponse.parsedJson && rawResponse.rawResponse.parsedJson.work_history && 
                 Array.isArray(rawResponse.rawResponse.parsedJson.work_history)) {
        result.workHistory = rawResponse.rawResponse.parsedJson.work_history;
        console.log(`Found ${result.workHistory.length} work history items in rawResponse.rawResponse.parsedJson.work_history`);
      }
      
      // Extract red flags
      if (nestedSections.redFlags && Array.isArray(nestedSections.redFlags)) {
        result.redFlags = nestedSections.redFlags;
        console.log(`Found ${result.redFlags.length} red flags in nestedSections.redFlags`);
      } else if (rawResponse.rawResponse.red_flags && Array.isArray(rawResponse.rawResponse.red_flags)) {
        result.redFlags = rawResponse.rawResponse.red_flags;
        console.log(`Found ${result.redFlags.length} red flags in rawResponse.rawResponse.red_flags`);
      } else if (rawResponse.rawResponse.parsedJson && rawResponse.rawResponse.parsedJson.red_flags && 
                 Array.isArray(rawResponse.rawResponse.parsedJson.red_flags)) {
        result.redFlags = rawResponse.rawResponse.parsedJson.red_flags;
        console.log(`Found ${result.redFlags.length} red flags in rawResponse.rawResponse.parsedJson.red_flags`);
      }
      
      // Extract summary
      if (nestedSections.summary && typeof nestedSections.summary === 'string') {
        result.summary = nestedSections.summary;
        console.log("Found summary in nestedSections.summary");
      } else if (rawResponse.rawResponse.summary && typeof rawResponse.rawResponse.summary === 'string') {
        result.summary = rawResponse.rawResponse.summary;
        console.log("Found summary in rawResponse.rawResponse.summary");
      } else if (rawResponse.rawResponse.parsedJson && rawResponse.rawResponse.parsedJson.summary && 
                 typeof rawResponse.rawResponse.parsedJson.summary === 'string') {
        result.summary = rawResponse.rawResponse.parsedJson.summary;
        console.log("Found summary in rawResponse.rawResponse.parsedJson.summary");
      }
      
      // Extract score if available
      if (nestedSections.score || nestedSections.matching_score) {
        result.score = nestedSections.score || nestedSections.matching_score;
      } else if (rawResponse.rawResponse.matching_score) {
        result.score = rawResponse.rawResponse.matching_score;
      } else if (rawResponse.rawResponse.parsedJson && rawResponse.rawResponse.parsedJson.matching_score) {
        result.score = rawResponse.rawResponse.parsedJson.matching_score;
      } else if (rawResponse.score) {
        result.score = rawResponse.score;
      }
      
      // If we successfully extracted at least one field, return the result
      console.log("Extracted data:", {
        skillsCount: result.skills.length,
        workHistoryCount: result.workHistory.length,
        redFlagsCount: result.redFlags.length,
        hasSummary: !!result.summary,
        score: result.score
      });
      
      return result;
    }
    
    // CASE 8: From field-specific parsedX columns
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
    
    // Add debugging for raw response structure
    console.log(`Processing record ${id}`);
    console.log(`Raw response type: ${typeof result.rawResponse}`);
    
    try {
      // Check for extractedSections field
      if (result.rawResponse && result.rawResponse.extractedSections) {
        console.log(`extractedSections keys: ${Object.keys(result.rawResponse.extractedSections).join(', ')}`);
        
        if (result.rawResponse.extractedSections.workHistory) {
          console.log(`workHistory found with ${Array.isArray(result.rawResponse.extractedSections.workHistory) ? 
            result.rawResponse.extractedSections.workHistory.length + ' items' : 'non-array type'}`);
        }
        
        if (result.rawResponse.extractedSections.redFlags) {
          console.log(`redFlags found with ${Array.isArray(result.rawResponse.extractedSections.redFlags) ? 
            result.rawResponse.extractedSections.redFlags.length + ' items' : 'non-array type'}`);
        }
      } else if (result.rawResponse && result.rawResponse.rawResponse && result.rawResponse.rawResponse.extractedSections) {
        console.log(`Nested extractedSections keys: ${Object.keys(result.rawResponse.rawResponse.extractedSections).join(', ')}`);
      } else {
        console.log(`No extractedSections field found in raw response or its nested structure`);
        // Debug what's actually in the raw response
        console.log("Top-level keys:", Object.keys(result.rawResponse || {}));
        if (result.rawResponse && result.rawResponse.rawResponse) {
          console.log("Nested rawResponse keys:", Object.keys(result.rawResponse.rawResponse));
        }
      }
    } catch (error) {
      console.error("Error examining raw response structure:", error);
    }
    
    // Extract structured data
    const parsedJson = extractParsedJson(result.rawResponse);
    
    // Debug extracted data
    if (parsedJson) {
      console.log(`Extracted data from raw response:
        - Skills: ${parsedJson.skills.length} items
        - Work History: ${parsedJson.workHistory.length} items
        - Red Flags: ${parsedJson.redFlags.length} items
        - Summary: ${parsedJson.summary ? 'Yes' : 'No'}
        - Score: ${parsedJson.score}`);
    } else {
      console.log(`No parsedJson data could be extracted`);
    }
    
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