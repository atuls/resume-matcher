/**
 * Utility functions for parsing raw AI responses into structured data
 */

export interface WorkHistoryItem {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
  isCurrentRole?: string | boolean;
  durationMonths?: number;
  location?: string;
}

export interface ParsedJsonData {
  skills: string[];
  workHistory: WorkHistoryItem[];
  redFlags: string[];
  summary: string;
  score: number;
}

/**
 * Extract structured data from a raw AI response
 */
export function extractParsedJson(rawResponse: any): ParsedJsonData {
  // Initialize result with empty arrays and default values
  const result: ParsedJsonData = {
    skills: [],
    workHistory: [],
    redFlags: [],
    summary: "",
    score: 0
  };
  
  if (!rawResponse) return result;
  
  try {
    // Try multiple paths to find the data
    let parsedJson = null;
    
    // CASE 1: For analysis results that already have a parsedJson field
    if (rawResponse.parsedJson && typeof rawResponse.parsedJson === 'object') {
      console.log("Found parsedJson at root level");
      parsedJson = rawResponse.parsedJson;
    } 
    // CASE 2: For analysis results with a nested rawResponse.parsedJson
    else if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
      console.log("Found parsedJson in nested rawResponse");
      parsedJson = rawResponse.rawResponse.parsedJson;
    }
    // CASE 3: For analysis results with parsedData structure
    else if (rawResponse.parsedData) {
      console.log("Found parsedData structure");
      
      // Extract from the parsed data structure if it exists
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
    // CASE 4: For structured fields at the root level
    else if (rawResponse.skills || rawResponse.workHistory || rawResponse.redFlags) {
      console.log("Found structured fields at root level");
      
      if (rawResponse.skills && Array.isArray(rawResponse.skills)) {
        result.skills = rawResponse.skills;
      }
      
      if (rawResponse.workHistory && Array.isArray(rawResponse.workHistory)) {
        result.workHistory = rawResponse.workHistory;
      }
      
      if (rawResponse.redFlags && Array.isArray(rawResponse.redFlags)) {
        result.redFlags = rawResponse.redFlags;
      }
      
      if (rawResponse.summary) {
        result.summary = rawResponse.summary;
      }
      
      if (rawResponse.score) {
        result.score = rawResponse.score;
      }
      
      return result;
    }
    
    // Extract data from parsedJson if we found it
    if (parsedJson) {
      // Handle different field naming conventions
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
    console.error("Error extracting parsed JSON:", error);
    return result;
  }
}

/**
 * Extract skills from a raw response
 */
export function extractSkills(rawResponse: any): string[] {
  const parsed = extractParsedJson(rawResponse);
  return parsed.skills;
}

/**
 * Extract work history from a raw response
 */
export function extractWorkHistory(rawResponse: any): WorkHistoryItem[] {
  const parsed = extractParsedJson(rawResponse);
  return parsed.workHistory;
}

/**
 * Extract red flags from a raw response
 */
export function extractRedFlags(rawResponse: any): string[] {
  const parsed = extractParsedJson(rawResponse);
  return parsed.redFlags;
}

/**
 * Extract summary from a raw response
 */
export function extractSummary(rawResponse: any): string {
  const parsed = extractParsedJson(rawResponse);
  return parsed.summary;
}

/**
 * Extract score from a raw response
 */
export function extractScore(rawResponse: any): number {
  const parsed = extractParsedJson(rawResponse);
  return parsed.score;
}