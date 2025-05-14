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
  
  // Debug - log what we received
  console.log("PARSER RECEIVED:", 
    typeof rawResponse === 'string' 
      ? (rawResponse.length > 100 ? rawResponse.substring(0, 100) + "..." : rawResponse)
      : typeof rawResponse
  );
  
  try {
    // Parse string to JSON if needed
    let parsedData: any;
    
    if (typeof rawResponse === 'string') {
      try {
        // If it starts with a double quote, it might be a JSON string that needs unescaping
        if (rawResponse.startsWith('"') && rawResponse.endsWith('"')) {
          console.log("RAW RESPONSE APPEARS TO BE A JSON STRING THAT NEEDS UNESCAPING");
          // Try to unescape it (in case we have an escaped JSON string)
          try {
            const unescaped = JSON.parse(rawResponse);
            if (typeof unescaped === 'string' && unescaped.startsWith('{')) {
              console.log("SUCCESSFULLY UNESCAPED JSON STRING");
              try {
                const doubleParseResult = JSON.parse(unescaped);
                console.log("DOUBLE PARSE SUCCESSFUL");
                parsedData = doubleParseResult;
              } catch(e) {
                console.error("Failed to parse unescaped string as JSON");
                parsedData = { text: unescaped };
              }
            } else {
              console.log("UNESCAPED STRING IS NOT JSON");
              parsedData = { text: unescaped };
            }
          } catch(e) {
            console.error("Failed to unescape JSON string:", e);
            parsedData = { text: rawResponse };
          }
        }
        // Only try to parse if it looks like JSON
        else if (rawResponse.trim().startsWith('{') && rawResponse.trim().endsWith('}')) {
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
    
    // Log all keys to debug format issues
    console.log("AVAILABLE KEYS IN RESPONSE:", Object.keys(parsedData));
    
    // Extract matching score if available
    if (typeof parsedData.matching_score === 'number' || typeof parsedData.matching_score === 'string') {
      result.score = Number(parsedData.matching_score);
      console.log("Found matching_score field:", result.score);
    } else if (typeof parsedData.score === 'number' || typeof parsedData.score === 'string') {
      result.score = Number(parsedData.score);
      console.log("Found score field:", result.score);
    } else if (typeof parsedData.matchScore === 'number' || typeof parsedData.matchScore === 'string') {
      result.score = Number(parsedData.matchScore);
      console.log("Found matchScore field:", result.score);
    }
    
    // Extract Work_History field (with exact capitalization and underscore)
    if (Array.isArray(parsedData.Work_History)) {
      console.log("Found Work_History field in raw response with", parsedData.Work_History.length, "entries");
      result.workHistory = parsedData.Work_History;
    } else if (Array.isArray(parsedData.work_history)) {
      console.log("Found work_history field in raw response with", parsedData.work_history.length, "entries");
      result.workHistory = parsedData.work_history;
    } else if (Array.isArray(parsedData.workHistory)) {
      console.log("Found workHistory field in raw response with", parsedData.workHistory.length, "entries");
      result.workHistory = parsedData.workHistory;
    }
    
    // Extract Skills field (with exact capitalization)
    if (Array.isArray(parsedData.Skills)) {
      console.log("Found Skills field in raw response with", parsedData.Skills.length, "entries");
      result.skills = parsedData.Skills;
    } else if (Array.isArray(parsedData.skills)) {
      console.log("Found skills field in raw response with", parsedData.skills.length, "entries");
      result.skills = parsedData.skills;
    }
    
    // Extract Red_Flags field (with exact capitalization and underscore)
    if (Array.isArray(parsedData.Red_Flags)) {
      console.log("Found Red_Flags field in raw response with", parsedData.Red_Flags.length, "entries");
      result.redFlags = parsedData.Red_Flags;
    } else if (Array.isArray(parsedData.red_flags)) {
      console.log("Found red_flags field in raw response with", parsedData.red_flags.length, "entries");
      result.redFlags = parsedData.red_flags;
    } else if (Array.isArray(parsedData.redFlags)) {
      console.log("Found redFlags field in raw response with", parsedData.redFlags.length, "entries");
      result.redFlags = parsedData.redFlags;
    }
    
    // Extract Summary field (with exact capitalization)
    if (typeof parsedData.Summary === 'string') {
      result.summary = parsedData.Summary;
      console.log("Found Summary field");
    } else if (typeof parsedData.summary === 'string') {
      result.summary = parsedData.summary;
      console.log("Found summary field");
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