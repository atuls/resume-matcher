// Script to analyze raw_response structures for a specific job
import { db } from "./server/db";
import { analysisResults } from "./shared/schema";
import { eq } from "drizzle-orm";

// Target job ID
const JOB_ID = 'f17e9b1c-9e63-4ed5-9cae-a307b37c95ff';

// Function to check if rawText has a valid JSON structure
function hasValidJsonInRawText(rawResponse) {
  try {
    if (!rawResponse) return false;
    
    // Check if rawText exists and is a string
    if (!rawResponse.rawText || typeof rawResponse.rawText !== 'string') {
      return false;
    }
    
    // Try to extract JSON from rawText
    const jsonMatch = rawResponse.rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return false;
    
    // Try to parse the extracted JSON
    JSON.parse(jsonMatch[0]);
    return true;
  } catch (error) {
    return false;
  }
}

// Function to check if parsedJson field is present and valid
function hasValidParsedJson(rawResponse) {
  try {
    if (!rawResponse) return false;
    
    // Check if parsedJson exists and is an object
    if (!rawResponse.parsedJson || typeof rawResponse.parsedJson !== 'object') {
      return false;
    }
    
    // Check if parsedJson has expected fields
    const hasExpectedFields = 
      (rawResponse.parsedJson.Skills && Array.isArray(rawResponse.parsedJson.Skills)) ||
      (rawResponse.parsedJson.Work_History && Array.isArray(rawResponse.parsedJson.Work_History)) ||
      (rawResponse.parsedJson.Summary && typeof rawResponse.parsedJson.Summary === 'string');
    
    return hasExpectedFields;
  } catch (error) {
    return false;
  }
}

// Function to check for nested rawResponse structures
function checkNestedStructure(rawResponse) {
  try {
    if (!rawResponse) return false;
    
    // Check if there's a nested rawResponse object with parsedJson
    if (rawResponse.rawResponse && 
        rawResponse.rawResponse.parsedJson && 
        typeof rawResponse.rawResponse.parsedJson === 'object') {
      return true;
    }
    
    // Check for deeply nested structure
    if (rawResponse.rawResponse && 
        rawResponse.rawResponse.rawResponse && 
        rawResponse.rawResponse.rawResponse.parsedJson && 
        typeof rawResponse.rawResponse.rawResponse.parsedJson === 'object') {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// Main function
async function analyzeRawResponses() {
  console.log(`Analyzing raw responses for job ID: ${JOB_ID}`);
  
  try {
    // Get all analysis results for the job
    const results = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.jobDescriptionId, JOB_ID));
    
    console.log(`Found ${results.length} total analysis results`);
    
    // Initialize counters
    const stats = {
      totalRecords: results.length,
      hasRawResponse: 0,
      hasRawText: 0,
      hasValidJsonInRawText: 0,
      hasParsedJson: 0,
      hasValidParsedJson: 0,
      hasNestedStructure: 0,
      completelyValid: 0,
      problematic: 0
    };
    
    // Track problematic record IDs
    const problematicRecords = [];
    
    // Analyze each result
    for (const result of results) {
      let rawResponse = result.rawResponse;
      let isProblematic = false;
      
      // Skip null raw responses
      if (!rawResponse) {
        isProblematic = true;
        problematicRecords.push({
          id: result.id,
          resumeId: result.resumeId,
          reason: "No raw_response data"
        });
        continue;
      }
      
      stats.hasRawResponse++;
      
      // Check for rawText
      if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
        stats.hasRawText++;
        
        // Check if rawText has valid JSON
        if (hasValidJsonInRawText(rawResponse)) {
          stats.hasValidJsonInRawText++;
        } else {
          isProblematic = true;
          problematicRecords.push({
            id: result.id,
            resumeId: result.resumeId,
            reason: "rawText doesn't contain valid JSON"
          });
        }
      }
      
      // Check for parsedJson
      if (rawResponse.parsedJson) {
        stats.hasParsedJson++;
        
        // Check if parsedJson is valid
        if (hasValidParsedJson(rawResponse)) {
          stats.hasValidParsedJson++;
        } else {
          isProblematic = true;
          problematicRecords.push({
            id: result.id,
            resumeId: result.resumeId,
            reason: "parsedJson exists but is missing expected fields"
          });
        }
      }
      
      // Check for nested structure
      if (checkNestedStructure(rawResponse)) {
        stats.hasNestedStructure++;
      }
      
      // Check if record is completely valid
      if (
        (hasValidJsonInRawText(rawResponse) || hasValidParsedJson(rawResponse) || checkNestedStructure(rawResponse)) &&
        !isProblematic
      ) {
        stats.completelyValid++;
      } else {
        stats.problematic++;
      }
    }
    
    // Print stats
    console.log("\nRAW RESPONSE STRUCTURE ANALYSIS");
    console.log("===============================");
    console.log(`Total records: ${stats.totalRecords}`);
    console.log(`Records with raw_response: ${stats.hasRawResponse} (${(stats.hasRawResponse / stats.totalRecords * 100).toFixed(2)}%)`);
    console.log(`Records with rawText: ${stats.hasRawText} (${(stats.hasRawText / stats.totalRecords * 100).toFixed(2)}%)`);
    console.log(`Records with valid JSON in rawText: ${stats.hasValidJsonInRawText} (${(stats.hasValidJsonInRawText / stats.totalRecords * 100).toFixed(2)}%)`);
    console.log(`Records with parsedJson: ${stats.hasParsedJson} (${(stats.hasParsedJson / stats.totalRecords * 100).toFixed(2)}%)`);
    console.log(`Records with valid parsedJson: ${stats.hasValidParsedJson} (${(stats.hasValidParsedJson / stats.totalRecords * 100).toFixed(2)}%)`);
    console.log(`Records with nested structure: ${stats.hasNestedStructure} (${(stats.hasNestedStructure / stats.totalRecords * 100).toFixed(2)}%)`);
    console.log(`\nCOMPLETELY VALID RECORDS: ${stats.completelyValid} (${(stats.completelyValid / stats.totalRecords * 100).toFixed(2)}%)`);
    console.log(`PROBLEMATIC RECORDS: ${stats.problematic} (${(stats.problematic / stats.totalRecords * 100).toFixed(2)}%)`);
    
    // Print first 10 problematic records
    if (problematicRecords.length > 0) {
      console.log("\nSample of problematic records:");
      problematicRecords.slice(0, 10).forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}, Resume: ${record.resumeId}, Issue: ${record.reason}`);
      });
    }
    
    return stats;
  } catch (error) {
    console.error("Error analyzing raw responses:", error);
  }
}

// Run the analysis
analyzeRawResponses()
  .then(() => {
    console.log("Analysis complete");
    process.exit(0);
  })
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });