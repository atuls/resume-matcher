import { Request, Response } from "express";
import { db } from "./db";
import { analysisResults } from "../shared/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { extractParsedJson } from "./services/syncParsedJsonService";

// Helper functions for extracting data from a variety of response formats
function extractSkills(rawResponse: any): string[] {
  try {
    // Try multiple potential paths to find skills data
    if (rawResponse?.parsedJson?.Skills) {
      return rawResponse.parsedJson.Skills;
    } else if (rawResponse?.extractedSections?.skills) {
      return rawResponse.extractedSections.skills;
    } else if (rawResponse?.parsedJson?.skills) {
      return rawResponse.parsedJson.skills;
    } else if (rawResponse?.skills) {
      return rawResponse.skills;
    } else if (typeof rawResponse === "string") {
      // Try to parse the string if it's JSON
      try {
        const parsed = JSON.parse(rawResponse);
        return extractSkills(parsed);
      } catch (e) {
        console.error("Failed to parse skills from string:", e);
      }
    }
    
    // If we get here, we didn't find skills
    return [];
  } catch (error) {
    console.error("Error extracting skills:", error);
    return [];
  }
}

function extractWorkHistory(rawResponse: any): any[] {
  try {
    // Try multiple potential paths to find work history data
    if (rawResponse?.parsedJson?.["Work History"]) {
      return rawResponse.parsedJson["Work History"];
    } else if (rawResponse?.parsedJson?.workHistory) {
      return rawResponse.parsedJson.workHistory;
    } else if (rawResponse?.extractedSections?.workHistory) {
      return rawResponse.extractedSections.workHistory;
    } else if (rawResponse?.workHistory) {
      return rawResponse.workHistory;
    } else if (rawResponse?.parsedJson?.["Work_History"]) {
      return rawResponse.parsedJson["Work_History"];
    } else if (typeof rawResponse === "string") {
      // Try to parse the string if it's JSON
      try {
        const parsed = JSON.parse(rawResponse);
        return extractWorkHistory(parsed);
      } catch (e) {
        console.error("Failed to parse work history from string:", e);
      }
    }
    
    // If we get here, we didn't find work history
    return [];
  } catch (error) {
    console.error("Error extracting work history:", error);
    return [];
  }
}

function extractRedFlags(rawResponse: any): string[] {
  try {
    // Try multiple potential paths to find red flags data
    if (rawResponse?.parsedJson?.["Red Flags"]) {
      return rawResponse.parsedJson["Red Flags"];
    } else if (rawResponse?.parsedJson?.redFlags) {
      return rawResponse.parsedJson.redFlags;
    } else if (rawResponse?.extractedSections?.redFlags) {
      return rawResponse.extractedSections.redFlags;
    } else if (rawResponse?.redFlags) {
      return rawResponse.redFlags;
    } else if (rawResponse?.parsedJson?.["Red_Flags"]) {
      return rawResponse.parsedJson["Red_Flags"];
    } else if (typeof rawResponse === "string") {
      // Try to parse the string if it's JSON
      try {
        const parsed = JSON.parse(rawResponse);
        return extractRedFlags(parsed);
      } catch (e) {
        console.error("Failed to parse red flags from string:", e);
      }
    }
    
    // If we get here, we didn't find red flags
    return [];
  } catch (error) {
    console.error("Error extracting red flags:", error);
    return [];
  }
}

function extractSummary(rawResponse: any): string {
  try {
    // Try multiple potential paths to find summary data
    if (rawResponse?.parsedJson?.Summary) {
      return rawResponse.parsedJson.Summary;
    } else if (rawResponse?.parsedJson?.summary) {
      return rawResponse.parsedJson.summary;
    } else if (rawResponse?.extractedSections?.summary) {
      return rawResponse.extractedSections.summary;
    } else if (rawResponse?.summary) {
      return rawResponse.summary;
    } else if (typeof rawResponse === "string") {
      // Try to parse the string if it's JSON
      try {
        const parsed = JSON.parse(rawResponse);
        return extractSummary(parsed);
      } catch (e) {
        console.error("Failed to parse summary from string:", e);
      }
    }
    
    // If we get here, we didn't find a summary
    return "";
  } catch (error) {
    console.error("Error extracting summary:", error);
    return "";
  }
}

/**
 * Handler function for the process-raw-analysis endpoint
 * This processes raw response data and populates the parsed fields
 */
export async function handleProcessRawAnalysis(req: Request, res: Response) {
  const { id: jobDescriptionId } = req.params;
  const { force = false } = req.body;
  console.log(`Processing raw analysis for job ID: ${jobDescriptionId}, force=${force}`);
  
  try {
    // Count the total number of raw responses for this job
    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(analysisResults)
      .where(
        and(
          eq(analysisResults.jobDescriptionId, jobDescriptionId),
          isNotNull(analysisResults.rawResponse)
        )
      );
    
    const totalCount = Number(countResult.count);
    
    // Get all analysis results for this job that have raw_response
    const results = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          eq(analysisResults.jobDescriptionId, jobDescriptionId),
          isNotNull(analysisResults.rawResponse)
        )
      );
    
    console.log(`Found ${results.length} raw responses to process for job ${jobDescriptionId}`);
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each result
    for (const result of results) {
      try {
        // If not forcing reprocessing, skip records that are already processed and have parsedJson
        if (!force && result.parsingStatus === "complete" && result.parsedJson) {
          skipped++;
          continue;
        }
        
        // Process records based on force parameter
        
        let rawResponseData: any;
        
        // Handle different formats of raw_response
        if (typeof result.rawResponse === "string") {
          try {
            rawResponseData = JSON.parse(result.rawResponse);
          } catch (e) {
            console.error(`Failed to parse raw_response as JSON for analysis ID ${result.id}:`, e);
            errors++;
            continue;
          }
        } else {
          rawResponseData = result.rawResponse;
        }
        
        // Extract data from raw response
        const skills = extractSkills(rawResponseData);
        const workHistory = extractWorkHistory(rawResponseData);
        const redFlags = extractRedFlags(rawResponseData);
        const summary = extractSummary(rawResponseData);
        
        // Extract structured JSON data using the dedicated service
        const parsedJson = extractParsedJson(rawResponseData);
        
        // Variables for the individual parsed fields
        let extractedSkills = skills.length > 0 ? skills : null;
        let extractedWorkHistory = workHistory.length > 0 ? workHistory : null;
        let extractedRedFlags = redFlags.length > 0 ? redFlags : null;
        let extractedSummary = summary || null;
        
        // If we have parsedJson, extract data from it to fill individual fields if they're empty
        if (parsedJson) {
          console.log(`Extracted parsedJson for record ${result.id}, extracting individual fields`);
          
          // Extract skills from parsedJson if we didn't get any from the regular extraction
          if (!extractedSkills && Array.isArray(parsedJson.skills) && parsedJson.skills.length > 0) {
            console.log(`Using ${parsedJson.skills.length} skills from parsedJson`);
            extractedSkills = parsedJson.skills;
          }
          
          // Extract work history from parsedJson if we didn't get any from the regular extraction
          if (!extractedWorkHistory && Array.isArray(parsedJson.workHistory) && parsedJson.workHistory.length > 0) {
            console.log(`Using ${parsedJson.workHistory.length} work history items from parsedJson`);
            extractedWorkHistory = parsedJson.workHistory;
          }
          
          // Extract red flags from parsedJson if we didn't get any from the regular extraction
          if (!extractedRedFlags && Array.isArray(parsedJson.redFlags) && parsedJson.redFlags.length > 0) {
            console.log(`Using ${parsedJson.redFlags.length} red flags from parsedJson`);
            extractedRedFlags = parsedJson.redFlags;
          }
          
          // Extract summary from parsedJson if we didn't get any from the regular extraction
          if (!extractedSummary && parsedJson.summary) {
            console.log(`Using summary from parsedJson`);
            extractedSummary = parsedJson.summary;
          }
        }
        
        // Update the record with parsed data
        await db
          .update(analysisResults)
          .set({
            parsedSkills: extractedSkills,
            parsedWorkHistory: extractedWorkHistory,
            parsedRedFlags: extractedRedFlags,
            parsedSummary: extractedSummary,
            // Include the structured JSON data
            parsedJson: parsedJson || null,
            parsingStatus: "complete",
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, result.id));
        
        processed++;
      } catch (error) {
        console.error(`Error processing analysis ID ${result.id}:`, error);
        errors++;
      }
    }
    
    // Return the processing statistics
    return res.status(200).json({
      success: true,
      processed,
      skipped,
      errors,
      total: results.length,
      totalCount,
      message: `Processed ${processed} out of ${results.length} records`
    });
  } catch (error) {
    console.error("Error processing raw analysis:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error processing raw analysis", 
      error: String(error) 
    });
  }
}