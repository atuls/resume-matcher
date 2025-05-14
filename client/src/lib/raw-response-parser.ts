/**
 * Raw LLM response parser
 * Handles direct extraction from raw LLM responses in various formats
 */

export interface ParsedRawResponse {
  workHistory: any[];
  skills: any[];
  redFlags: any[];
  summary: string;
  score: number;
  rawData: any;
}

/**
 * Helper to normalize JSON strings that might have Python-style single quotes or other issues
 * @param input The JSON string to normalize
 * @returns Normalized JSON string that can be parsed by JSON.parse
 */
function normalizeJsonString(input: string): string {
  if (!input) return "{}";
  
  // Replace Python-style single quotes with double quotes
  let normalized = input.replace(/'/g, '"');
  
  // Replace Python True/False with JSON true/false
  normalized = normalized.replace(/\bTrue\b/g, 'true');
  normalized = normalized.replace(/\bFalse\b/g, 'false');
  
  // Replace Python None with JSON null
  normalized = normalized.replace(/\bNone\b/g, 'null');
  
  // Fix common trailing comma issues
  normalized = normalized.replace(/,\s*}/g, '}');
  normalized = normalized.replace(/,\s*]/g, ']');
  
  return normalized;
}

/**
 * Attempt to extract a JSON object from a text string that might contain
 * non-JSON content before or after the JSON.
 * @param text Text that might contain JSON
 * @returns The extracted JSON object or null if extraction failed
 */
function extractJsonFromText(text: string): any {
  if (!text) return null;
  
  try {
    // First, try direct parse - maybe it's already valid JSON
    return JSON.parse(text);
  } catch (e) {
    // If direct parse fails, try to find JSON in the text
    console.log("Direct JSON parse failed, trying to extract JSON from text");
  }
  
  try {
    // Look for patterns that might indicate the start of JSON
    const jsonStart = text.indexOf('{');
    const jsonArrayStart = text.indexOf('[');
    
    // If no JSON-like structures found, return null
    if (jsonStart === -1 && jsonArrayStart === -1) {
      return null;
    }
    
    // Choose the first occurring pattern
    const startIndex = 
      (jsonStart !== -1 && jsonArrayStart !== -1) 
        ? Math.min(jsonStart, jsonArrayStart) 
        : (jsonStart !== -1 ? jsonStart : jsonArrayStart);
    
    // Once we have the start, find the matching end
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      
      // Handle string content
      if (char === '"' && !escaped) {
        inString = !inString;
      }
      
      // Only count braces/brackets when not in a string
      if (!inString) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
        
        // If we've closed all our structures, we found the end
        if (startIndex === jsonStart && openBraces === 0 && i > startIndex) {
          const json = text.substring(startIndex, i + 1);
          const normalized = normalizeJsonString(json);
          return JSON.parse(normalized);
        } else if (startIndex === jsonArrayStart && openBrackets === 0 && i > startIndex) {
          const json = text.substring(startIndex, i + 1);
          const normalized = normalizeJsonString(json);
          return JSON.parse(normalized);
        }
      }
      
      // Track escape character state
      if (char === '\\' && !escaped) {
        escaped = true;
      } else {
        escaped = false;
      }
    }
    
    // If we got here, we didn't find valid JSON
    return null;
  } catch (e) {
    console.error("Error extracting JSON from text:", e);
    return null;
  }
}

/**
 * Flattens a nested object for easier extraction of fields regardless of nesting
 * @param obj The object to flatten
 * @param prefix A prefix for flattened keys
 * @returns A flattened representation with dot notation keys
 */
function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
  const result: Record<string, any> = {};
  
  // If obj is null or not an object, return empty result
  if (!obj || typeof obj !== 'object') return result;
  
  // Recursively flatten the object
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, flattenObject(value, newKey));
      } else {
        // Add leaf values or arrays directly
        result[newKey] = value;
      }
    }
  }
  
  return result;
}

/**
 * Extract work history items from a variety of possible locations in the data
 * @param data The parsed data object
 * @returns Array of work history items
 */
function extractWorkHistory(data: any): any[] {
  if (!data) return [];
  
  // Common keys to check for work history data
  const workHistoryKeys = [
    'work_history',
    'workHistory',
    'Work_History',
    'work_experience',
    'Work_Experience',
    'employment',
    'Employment',
    'jobs',
    'Jobs'
  ];
  
  // Check direct fields first
  for (const key of workHistoryKeys) {
    if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
      return data[key];
    }
  }
  
  // Check in flattened object
  const flat = flattenObject(data);
  for (const key in flat) {
    if (workHistoryKeys.some(wk => key.toLowerCase().includes(wk.toLowerCase()))) {
      const value = flat[key];
      if (Array.isArray(value) && value.length > 0) {
        return value;
      }
    }
  }
  
  return [];
}

/**
 * Extract skills from a variety of possible locations in the data
 * @param data The parsed data object
 * @returns Array of skill items
 */
function extractSkills(data: any): any[] {
  if (!data) return [];
  
  // Common keys to check for skills data
  const skillsKeys = [
    'skills',
    'Skills',
    'technical_skills',
    'Technical_Skills',
    'soft_skills',
    'Soft_Skills',
    'competencies',
    'Competencies'
  ];
  
  // Check direct fields first
  for (const key of skillsKeys) {
    if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
      return data[key].map((skill: any) => {
        // Normalize skill objects to have both lowercase and capitalized versions of fields
        if (typeof skill === 'object') {
          return {
            name: skill.name || skill.Name || '',
            category: skill.category || skill.Category || '',
            level: skill.level || skill.Level || '',
            years: skill.years || skill.Years || 0,
            relevance: skill.relevance || skill.Relevance || '',
            // Keep original fields too
            Name: skill.name || skill.Name || '',
            Category: skill.category || skill.Category || '',
            Level: skill.level || skill.Level || '',
            Years: skill.years || skill.Years || 0,
            Relevance: skill.relevance || skill.Relevance || ''
          };
        }
        return skill;
      });
    }
  }
  
  // Check in flattened object
  const flat = flattenObject(data);
  for (const key in flat) {
    if (skillsKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      const value = flat[key];
      if (Array.isArray(value) && value.length > 0) {
        return value.map((skill: any) => {
          if (typeof skill === 'object') {
            return {
              name: skill.name || skill.Name || '',
              category: skill.category || skill.Category || '',
              level: skill.level || skill.Level || '',
              years: skill.years || skill.Years || 0,
              relevance: skill.relevance || skill.Relevance || '',
              // Keep original fields too
              Name: skill.name || skill.Name || '',
              Category: skill.category || skill.Category || '',
              Level: skill.level || skill.Level || '',
              Years: skill.years || skill.Years || 0,
              Relevance: skill.relevance || skill.Relevance || ''
            };
          }
          return skill;
        });
      }
    }
  }
  
  return [];
}

/**
 * Extract red flags from a variety of possible locations in the data
 * @param data The parsed data object
 * @returns Array of red flag items
 */
function extractRedFlags(data: any): any[] {
  if (!data) return [];
  
  // Common keys to check for red flags data
  const redFlagKeys = [
    'red_flags',
    'redFlags',
    'Red_Flags',
    'warnings',
    'Warnings',
    'concerns',
    'Concerns'
  ];
  
  // Check direct fields first
  for (const key of redFlagKeys) {
    if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
      return data[key].map((flag: any) => {
        if (typeof flag === 'object') {
          return {
            description: flag.description || flag.Description || '',
            impact: flag.impact || flag.Impact || '',
            severity: flag.severity || flag.Severity || '',
            // Keep original fields too
            Description: flag.description || flag.Description || '',
            Impact: flag.impact || flag.Impact || '',
            Severity: flag.severity || flag.Severity || ''
          };
        } else if (typeof flag === 'string') {
          return {
            description: flag,
            Description: flag
          };
        }
        return flag;
      });
    }
  }
  
  // Check in flattened object
  const flat = flattenObject(data);
  for (const key in flat) {
    if (redFlagKeys.some(rf => key.toLowerCase().includes(rf.toLowerCase()))) {
      const value = flat[key];
      if (Array.isArray(value) && value.length > 0) {
        return value.map((flag: any) => {
          if (typeof flag === 'object') {
            return {
              description: flag.description || flag.Description || '',
              impact: flag.impact || flag.Impact || '',
              severity: flag.severity || flag.Severity || '',
              // Keep original fields too
              Description: flag.description || flag.Description || '',
              Impact: flag.impact || flag.Impact || '',
              Severity: flag.severity || flag.Severity || ''
            };
          } else if (typeof flag === 'string') {
            return {
              description: flag,
              Description: flag
            };
          }
          return flag;
        });
      }
    }
  }
  
  return [];
}

/**
 * Extract summary from a variety of possible locations in the data
 * @param data The parsed data object
 * @returns Summary text
 */
function extractSummary(data: any): string {
  if (!data) return '';
  
  // Common keys to check for summary data
  const summaryKeys = [
    'summary',
    'Summary',
    'overview',
    'Overview',
    'profile',
    'Profile',
    'executive_summary',
    'Executive_Summary'
  ];
  
  // Check direct fields first
  for (const key of summaryKeys) {
    if (data[key] && typeof data[key] === 'string' && data[key].trim() !== '') {
      return data[key];
    }
  }
  
  // Check in flattened object
  const flat = flattenObject(data);
  for (const key in flat) {
    if (summaryKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      const value = flat[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
  }
  
  return '';
}

/**
 * Extract score from a variety of possible locations in the data
 * @param data The parsed data object
 * @returns Numeric score (0-100) or 0 if not found
 */
function extractScore(data: any): number {
  if (!data) return 0;
  
  // Common keys to check for score data
  const scoreKeys = [
    'score',
    'Score',
    'matching_score',
    'matchingScore',
    'MatchingScore',
    'match',
    'Match',
    'matching',
    'Matching'
  ];
  
  // Check direct fields first
  for (const key of scoreKeys) {
    if (data[key] !== undefined) {
      const score = Number(data[key]);
      if (!isNaN(score)) {
        return score;
      }
    }
  }
  
  // Check in flattened object
  const flat = flattenObject(data);
  for (const key in flat) {
    if (scoreKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      const value = flat[key];
      const score = Number(value);
      if (!isNaN(score)) {
        return score;
      }
    }
  }
  
  return 0;
}

/**
 * Parses raw LLM response text into structured data
 * This is the main entry point for the parser
 * @param rawResponse The raw text response from the LLM
 * @returns Structured data extracted from the response
 */
export function parseRawResponse(rawResponse: string): ParsedRawResponse {
  try {
    if (!rawResponse) {
      console.error("Raw response is empty");
      throw new Error("Raw response is empty");
    }
    
    // First try to extract JSON from the raw response
    const extractedJson = extractJsonFromText(rawResponse);
    if (!extractedJson) {
      console.error("Failed to extract JSON from raw response");
      
      // If JSON extraction failed but we have text, create a minimal structure
      // with the raw text as the summary
      if (rawResponse.trim()) {
        return {
          workHistory: [],
          skills: [],
          redFlags: [],
          summary: rawResponse.trim(),
          score: 0,
          rawData: null
        };
      }
      
      throw new Error("Failed to extract JSON from raw response");
    }
    
    // Extract the various components
    const workHistory = extractWorkHistory(extractedJson);
    const skills = extractSkills(extractedJson);
    const redFlags = extractRedFlags(extractedJson);
    const summary = extractSummary(extractedJson);
    const score = extractScore(extractedJson);
    
    console.log("Raw response parsed successfully", {
      workHistoryCount: workHistory.length,
      skillsCount: skills.length,
      redFlagsCount: redFlags.length,
      hasSummary: !!summary,
      score: score
    });
    
    return {
      workHistory,
      skills,
      redFlags,
      summary,
      score,
      rawData: extractedJson
    };
  } catch (error) {
    console.error("Error parsing raw response:", error);
    
    // Return a valid but empty result on error
    return {
      workHistory: [],
      skills: [],
      redFlags: [],
      summary: "",
      score: 0,
      rawData: null
    };
  }
}