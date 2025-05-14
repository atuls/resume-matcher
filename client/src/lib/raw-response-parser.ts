/**
 * Direct parser for raw LLM responses, optimized for extracting data from Claude responses
 * This provides more direct access to the standardized fields that Claude returns
 */

export interface ParsedRawResponse {
  workHistory: any[];
  skills: string[];
  redFlags: string[];
  summary: string;
  score: number;
  rawData: any; // The full parsed JSON object
}

/**
 * Parses the raw LLM response string to extract structured data
 * Focuses on the exact format seen in screenshots: Work_History, Skills, Red_Flags
 */
export function parseRawResponse(rawResponse: string | any): ParsedRawResponse {
  // Default empty result
  const result: ParsedRawResponse = {
    workHistory: [],
    skills: [],
    redFlags: [],
    summary: "",
    score: 0,
    rawData: null
  };
  
  // Handle null/undefined case
  if (!rawResponse) {
    console.warn("Empty rawResponse provided to parser");
    return result;
  }
  
  try {
    // Parse string to JSON if needed
    let parsedData: any;
    
    if (typeof rawResponse === 'string') {
      try {
        // Only try to parse if it looks like JSON
        if (rawResponse.trim().startsWith('{') && rawResponse.trim().endsWith('}')) {
          parsedData = JSON.parse(rawResponse);
          console.log("Successfully parsed raw response string to JSON object");
        } else {
          console.warn("Raw response doesn't appear to be JSON, using as-is");
          parsedData = { text: rawResponse };
        }
      } catch (e) {
        console.error("Failed to parse raw response as JSON:", e);
        parsedData = { text: rawResponse }; 
      }
    } else if (typeof rawResponse === 'object') {
      // Already an object
      parsedData = rawResponse;
    } else {
      console.warn(`Unexpected rawResponse type: ${typeof rawResponse}`);
      return result;
    }
    
    // Store the full raw data
    result.rawData = parsedData;
    
    // Extract matching score if available
    if (typeof parsedData.matching_score === 'number') {
      result.score = parsedData.matching_score;
    }
    
    // Extract Work_History field (with exact capitalization and underscore)
    if (Array.isArray(parsedData.Work_History)) {
      console.log("Found Work_History field in raw response with", parsedData.Work_History.length, "entries");
      result.workHistory = parsedData.Work_History;
    } 
    
    // Extract Skills field (with exact capitalization)
    if (Array.isArray(parsedData.Skills)) {
      console.log("Found Skills field in raw response with", parsedData.Skills.length, "entries");
      result.skills = parsedData.Skills;
    }
    
    // Extract Red_Flags field (with exact capitalization and underscore)
    if (Array.isArray(parsedData.Red_Flags)) {
      console.log("Found Red_Flags field in raw response with", parsedData.Red_Flags.length, "entries");
      result.redFlags = parsedData.Red_Flags;
    }
    
    // Extract Summary field (with exact capitalization)
    if (typeof parsedData.Summary === 'string') {
      result.summary = parsedData.Summary;
    }
    
    // Log what we found
    console.log("Raw response parser results:");
    console.log("- Work History:", result.workHistory.length > 0 ? "Found" : "Not found");
    console.log("- Skills:", result.skills.length > 0 ? "Found" : "Not found");
    console.log("- Red Flags:", result.redFlags.length > 0 ? "Found" : "Not found");
    console.log("- Summary:", result.summary ? "Found" : "Not found");
    console.log("- Score:", result.score);
    
    return result;
  } catch (e) {
    console.error("Error in raw response parser:", e);
    return result;
  }
}