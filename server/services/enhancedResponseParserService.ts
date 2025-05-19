/**
 * Enhanced Response Parser Service - Improved version to handle multiple field name variations
 * Extracts structured data from raw AI responses, with consistent field names
 */
import { db } from '../db';
import { analysisResults } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Define all possible variations of field names for better extraction
const FIELD_VARIATIONS = {
  skills: ['skills', 'Skills', 'skill_list', 'skillList', 'key_skills', 'candidate_skills', 
           'technical_skills', 'soft_skills', 'hardSkills', 'softSkills'],
  
  workHistory: [
    'workHistory', 'work_history', 'work-history', 'Work History', 'employment_history',
    'work experience', 'workExperience', 'experience', 'Experience',
    'jobs', 'positions', 'career_history', 'professional_experience', 'employment'
  ],
  
  redFlags: [
    'redFlags', 'red_flags', 'red-flags', 'Red Flags', 'flags', 'concerns',
    'warnings', 'issues', 'potential_issues', 'potential_concerns', 'cautions',
    'warning_signs', 'resume_issues'
  ],
  
  summary: ['summary', 'Summary', 'overview', 'Overview', 'profile', 'Profile', 
            'candidate_summary', 'executive_summary', 'resume_summary']
};

/**
 * Extract a specific field from an object using multiple possible key names
 */
function extractField(obj: any, fieldVariations: string[], defaultValue: any = null): any {
  if (!obj || typeof obj !== 'object') return defaultValue;
  
  // Try each possible field name
  for (const fieldName of fieldVariations) {
    if (obj[fieldName] !== undefined) {
      return obj[fieldName];
    }
  }
  
  return defaultValue;
}

/**
 * Extract raw response content by checking multiple possible locations and field name variations
 */
export function extractRawResponseContent(rawResponse: any): any {
  if (!rawResponse) {
    console.log("extractRawResponseContent: rawResponse is null or undefined");
    return null;
  }
  
  console.log("extractRawResponseContent: Raw response type:", typeof rawResponse);
  if (typeof rawResponse === 'object') {
    console.log("extractRawResponseContent: Raw response keys:", Object.keys(rawResponse));
  }
  
  // Strategy 1: Look for parsedJson field at different nesting levels
  // Direct access to parsedJson if available
  if (rawResponse.parsedJson) {
    console.log("extractRawResponseContent: Found parsedJson at top level");
    return rawResponse.parsedJson;
  }
  
  // Check for nested rawResponse.parsedJson
  if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
    console.log("extractRawResponseContent: Found parsedJson in nested rawResponse");
    return rawResponse.rawResponse.parsedJson;
  }
  
  // Check for deeply nested parsedJson
  if (rawResponse.rawResponse && 
      rawResponse.rawResponse.rawResponse && 
      rawResponse.rawResponse.rawResponse.parsedJson) {
    console.log("extractRawResponseContent: Found parsedJson in deeply nested rawResponse");
    return rawResponse.rawResponse.rawResponse.parsedJson;
  }
  
  // Check for parsedJson in extractedSections
  if (rawResponse.extractedSections && rawResponse.extractedSections.parsedJson) {
    console.log("extractRawResponseContent: Found parsedJson in extractedSections");
    return rawResponse.extractedSections.parsedJson;
  }
  
  if (rawResponse.rawResponse && 
      rawResponse.rawResponse.extractedSections && 
      rawResponse.rawResponse.extractedSections.parsedJson) {
    console.log("extractRawResponseContent: Found parsedJson in nested extractedSections");
    return rawResponse.rawResponse.extractedSections.parsedJson;
  }
  
  // Strategy 2: Check for fields with known variations at different nesting levels
  // Check if current object has any of our expected fields with various naming conventions
  const hasExpectedFields = Object.values(FIELD_VARIATIONS).some(variations => 
    variations.some(fieldName => rawResponse[fieldName] !== undefined)
  );
  
  if (hasExpectedFields) {
    console.log("extractRawResponseContent: Found expected fields at top level");
    return extractFieldsWithVariations(rawResponse);
  }
  
  // Check if there's a nested rawResponse object with expected fields
  if (rawResponse.rawResponse) {
    const nestedHasExpectedFields = Object.values(FIELD_VARIATIONS).some(variations => 
      variations.some(fieldName => rawResponse.rawResponse[fieldName] !== undefined)
    );
    
    if (nestedHasExpectedFields) {
      console.log("extractRawResponseContent: Found expected fields in nested rawResponse");
      return extractFieldsWithVariations(rawResponse.rawResponse);
    }
  }
  
  // Strategy 3: Try parsing rawText as JSON if available
  if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
    console.log("extractRawResponseContent: Attempting to parse rawText");
    try {
      // Find JSON object pattern in the string
      const jsonMatch = rawResponse.rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("extractRawResponseContent: Successfully parsed JSON from rawText");
        return extractFieldsWithVariations(parsed);
      }
    } catch (e) {
      console.error("extractRawResponseContent: Error parsing rawText as JSON:", e);
    }
  }
  
  // Check for nested rawText
  if (rawResponse.rawResponse && 
      rawResponse.rawResponse.rawText && 
      typeof rawResponse.rawResponse.rawText === 'string') {
    console.log("extractRawResponseContent: Attempting to parse nested rawText");
    try {
      const jsonMatch = rawResponse.rawResponse.rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("extractRawResponseContent: Successfully parsed JSON from nested rawText");
        return extractFieldsWithVariations(parsed);
      }
    } catch (e) {
      console.error("extractRawResponseContent: Error parsing nested rawText as JSON:", e);
    }
  }
  
  console.log("extractRawResponseContent: No valid structure found for extraction");
  return null;
}

/**
 * Extract fields with multiple naming variations and normalize to standard names
 */
function extractFieldsWithVariations(data: any): any {
  if (!data || typeof data !== 'object') return null;
  
  // Create a normalized result object
  const result: any = {};
  
  // Extract skills with various naming conventions
  const skills = extractField(data, FIELD_VARIATIONS.skills, []);
  result.skills = Array.isArray(skills) ? skills : [];
  
  // Extract work history with various naming conventions
  const workHistory = extractField(data, FIELD_VARIATIONS.workHistory, []);
  result.workHistory = Array.isArray(workHistory) ? workHistory : [];
  
  // Extract red flags with various naming conventions
  const redFlags = extractField(data, FIELD_VARIATIONS.redFlags, []);
  result.redFlags = Array.isArray(redFlags) ? redFlags : [];
  
  // Extract summary with various naming conventions
  const summary = extractField(data, FIELD_VARIATIONS.summary, '');
  result.summary = typeof summary === 'string' ? summary : '';
  
  // Add score if available
  if (data.matching_score !== undefined) {
    result.matching_score = data.matching_score;
  } else if (data.score !== undefined) {
    result.matching_score = data.score;
  } else if (data.match_score !== undefined) {
    result.matching_score = data.match_score;
  }
  
  return result;
}

/**
 * Update the parsedJson field for a specific record
 */
export async function updateParsedJson(recordId: string, rawResponse: any): Promise<boolean> {
  try {
    console.log(`Processing record ${recordId}`);
    
    // Extract parsedJson from rawResponse
    const parsedJson = extractRawResponseContent(rawResponse);
    
    if (!parsedJson) {
      console.log(`No parsedJson could be extracted for record ${recordId}`);
      return false;
    }
    
    console.log(`Extracted parsedJson for record ${recordId}`, 
                Object.keys(parsedJson).length > 0 ? Object.keys(parsedJson) : 'empty object');
    
    // Update the record with the extracted parsedJson
    await db
      .update(analysisResults)
      .set({
        parsedJson: parsedJson,
        updatedAt: new Date()
      })
      .where(eq(analysisResults.id, recordId));
    
    return true;
  } catch (error) {
    console.error(`Error updating parsedJson for record ${recordId}:`, error);
    return false;
  }
}

/**
 * Process a batch of records to update their parsedJson field
 */
export async function processRawResponseBatch(limit: number = 50): Promise<{
  processed: number;
  successful: number;
}> {
  try {
    // Get records with rawResponse but no parsedJson
    const results = await db
      .select({
        id: analysisResults.id,
        rawResponse: analysisResults.rawResponse
      })
      .from(analysisResults)
      .where(eq(analysisResults.parsedJson, null))
      .limit(limit);
    
    console.log(`Found ${results.length} records to process`);
    
    let successful = 0;
    
    // Process each record
    for (const result of results) {
      const success = await updateParsedJson(result.id, result.rawResponse);
      if (success) {
        successful++;
      }
    }
    
    return {
      processed: results.length,
      successful
    };
  } catch (error) {
    console.error("Error processing raw response batch:", error);
    return {
      processed: 0,
      successful: 0
    };
  }
}