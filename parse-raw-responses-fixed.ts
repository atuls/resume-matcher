// Use relative paths to fix module import issues
import { db } from "./server/db";
import { analysisResults } from "./shared/schema";
import { eq, and, isNotNull, isNull, sql } from "drizzle-orm";

/**
 * Script to process raw_response data and populate the parsed fields in the database
 * This will extract skills, work history, red flags, and summary information from
 * the raw JSON responses stored in the analysis_results table.
 */

// Define helper functions for extracting data from a variety of response formats
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

// Main function to process raw responses
async function processRawResponses(options: {
  jobDescriptionId?: string;
  forceReprocess?: boolean;
  limit?: number;
} = {}) {
  const { jobDescriptionId, forceReprocess = false, limit } = options;
  const startTime = Date.now();
  
  if (jobDescriptionId) {
    console.log(`Starting to process raw responses for job ID: ${jobDescriptionId}`);
  } else {
    console.log(`Starting to process raw responses for all jobs`);
  }
  
  if (forceReprocess) {
    console.log("Force reprocessing: Will update all records regardless of current parsing status");
  }
  
  try {
    // Build the where conditions for our query
    let conditions = [];
    
    // Always require raw_response to not be null
    conditions.push(isNotNull(analysisResults.rawResponse));
    
    // Add job ID filter if provided
    if (jobDescriptionId) {
      conditions.push(eq(analysisResults.jobDescriptionId, jobDescriptionId));
    }
    
    // Add parsing status filter if not forcing reprocess
    if (!forceReprocess) {
      conditions.push(eq(analysisResults.parsingStatus, "pending"));
    }
    
    // Combine conditions with AND
    const whereCondition = conditions.length === 1 
      ? conditions[0] 
      : and(...conditions);
    
    // Get all analysis results that match our conditions
    let query = db
      .select()
      .from(analysisResults)
      .where(whereCondition);
    
    // Apply limit if provided
    const results = limit 
      ? await query.limit(limit) 
      : await query;
    
    console.log(`Found ${results.length} raw responses to process`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each result
    for (const result of results) {
      try {
        let rawResponseData: any;
        
        // Handle different formats of raw_response
        if (typeof result.rawResponse === "string") {
          try {
            rawResponseData = JSON.parse(result.rawResponse);
          } catch (e) {
            console.error(`Failed to parse raw_response as JSON for analysis ID ${result.id}:`, e);
            // Skip this record
            errorCount++;
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
        
        // Update the record with parsed data
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
          .where(eq(analysisResults.id, result.id));
        
        successCount++;
        
        // Log progress every 50 records
        if (successCount % 50 === 0) {
          console.log(`Processed ${successCount} records successfully so far`);
        }
      } catch (error) {
        console.error(`Error processing analysis ID ${result.id}:`, error);
        errorCount++;
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`
Processing complete:
- Total records: ${results.length}
- Successfully processed: ${successCount}
- Errors: ${errorCount}
- Duration: ${duration.toFixed(2)} seconds
    `);
    
  } catch (error) {
    console.error("Error running processRawResponses:", error);
  }
}

// Main execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: {
    jobDescriptionId?: string;
    forceReprocess?: boolean;
    limit?: number;
  } = {};
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--job-id':
      case '-j':
        options.jobDescriptionId = args[++i];
        break;
      case '--force':
      case '-f':
        options.forceReprocess = true;
        break;
      case '--limit':
      case '-l':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npx tsx parse-raw-responses-fixed.ts [options]

Options:
  --job-id, -j ID     Process only records for a specific job ID
  --force, -f         Force reprocessing of all matching records
  --limit, -l N       Process only N records (useful for testing)
  --help, -h          Show this help message
        `);
        process.exit(0);
    }
  }
  
  // If no job ID is provided, use the default one
  if (!options.jobDescriptionId) {
    options.jobDescriptionId = "f17e9b1c-9e63-4ed5-9cae-a307b37c95ff";
  }
  
  await processRawResponses(options);
  console.log("Processing job complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in main execution:", error);
    process.exit(1);
  });