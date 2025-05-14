/**
 * Utility for extracting structured data from resume analysis results
 */

// Types for extracted data
export interface ExtractedResumeData {
  skills: string[];
  workHistory: any[];
  education: string;
  summary: string;
  redFlags: string[];
  score: number;
}

/**
 * Extract structured data from a resume analysis result
 * This handles the complex nested structure and different response formats
 * 
 * @param analysisResult The raw analysis result from the API
 * @returns Structured data with normalized fields
 */
export function extractResumeData(analysisResult: any): ExtractedResumeData {
  // Initialize with default empty values
  const result: ExtractedResumeData = {
    skills: [],
    workHistory: [],
    education: '',
    summary: '',
    redFlags: [],
    score: 0
  };

  try {
    // Normalize - unwrap array if needed
    const data = Array.isArray(analysisResult) ? analysisResult[0] : analysisResult;
    
    // Extract score from various possible formats
    if (data.matching_score) {
      result.score = data.matching_score;
    } else if (data.overallScore) {
      result.score = data.overallScore;
    } else if (data.score) {
      result.score = data.score;
    } else {
      result.score = 0;
    }
    
    // Try to extract work history from red flag analysis (which has different structure)
    if (data.analysis && data.analysis.recentRoles && Array.isArray(data.analysis.recentRoles)) {
      console.log("Found work history in data.analysis.recentRoles");
      result.workHistory = data.analysis.recentRoles;
    }
    
    // Try to extract work history directly from the response (Claude's new format with Work_History field)
    if (data.rawResponse && typeof data.rawResponse === 'string') {
      try {
        const parsedResponse = JSON.parse(data.rawResponse);
        if (Array.isArray(parsedResponse.Work_History)) {
          console.log("Found work history directly in response.Work_History");
          result.workHistory = parsedResponse.Work_History;
        }
        if (Array.isArray(parsedResponse.Skills)) {
          console.log("Found skills directly in response.Skills");
          result.skills = parsedResponse.Skills;
        }
        if (Array.isArray(parsedResponse.Red_Flags)) {
          console.log("Found red flags directly in response.Red_Flags");
          result.redFlags = parsedResponse.Red_Flags;
        }
      } catch (err) {
        // Ignore JSON parsing errors - this is just an attempt at direct extraction
      }
    }
    
    // Check for direct array fields at top level of data or rawResponse
    if (Array.isArray(data.Work_History)) {
      console.log("Found work history at data.Work_History");
      result.workHistory = data.Work_History;
    }
    if (Array.isArray(data.Skills)) {
      console.log("Found skills at data.Skills");
      result.skills = data.Skills;
    }
    if (Array.isArray(data.Red_Flags)) {
      console.log("Found red flags at data.Red_Flags");
      result.redFlags = data.Red_Flags;
    }
    
    // Extract from rawResponse
    if (data.rawResponse) {
      // Try to get skills
      if (Array.isArray(data.rawResponse.skills)) {
        result.skills = data.rawResponse.skills;
      }
      
      // Get experience/work history
      if (typeof data.rawResponse.experience === 'string') {
        result.summary = data.rawResponse.experience;
      }
      
      // Try to get work history from parsedJson
      if (data.rawResponse.parsedJson) {
        if (Array.isArray(data.rawResponse.parsedJson['Work History'])) {
          console.log("Found work history in data.rawResponse.parsedJson['Work History']");
          result.workHistory = data.rawResponse.parsedJson['Work History'];
        } else if (Array.isArray(data.rawResponse.parsedJson.WorkHistory)) {
          console.log("Found work history in data.rawResponse.parsedJson.WorkHistory");
          result.workHistory = data.rawResponse.parsedJson.WorkHistory;
        }
      }
      
      // Get education
      if (typeof data.rawResponse.education === 'string') {
        result.education = data.rawResponse.education;
      }
      
      // Try to get nested data from rawResponse.rawResponse
      if (data.rawResponse.rawResponse) {
        // Try to extract JSON from rawText field if available
        if (typeof data.rawResponse.rawResponse.rawText === 'string') {
          try {
            // Extract JSON parts from the rawText using regex
            const jsonMatch = data.rawResponse.rawResponse.rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsedJson = JSON.parse(jsonMatch[0]);
              
              // Extract skills if available
              if (Array.isArray(parsedJson.Skills)) {
                result.skills = parsedJson.Skills;
              } else if (Array.isArray(parsedJson.skills)) {
                result.skills = parsedJson.skills;
              } else if (Array.isArray(parsedJson['skills'])) {
                result.skills = parsedJson['skills']; 
              }
              
              // Extract work history if available
              if (Array.isArray(parsedJson['Work History'])) {
                result.workHistory = parsedJson['Work History'];
              } else if (Array.isArray(parsedJson.WorkHistory)) {
                result.workHistory = parsedJson.WorkHistory;
              } else if (Array.isArray(parsedJson.work_history)) {
                result.workHistory = parsedJson.work_history;
              } else if (Array.isArray(parsedJson.Work_History)) {
                result.workHistory = parsedJson.Work_History;
              }
              
              // Extract red flags if available
              if (Array.isArray(parsedJson['Red Flags'])) {
                result.redFlags = parsedJson['Red Flags'];
              } else if (Array.isArray(parsedJson.RedFlags)) {
                result.redFlags = parsedJson.RedFlags;
              } else if (Array.isArray(parsedJson.red_flags)) {
                result.redFlags = parsedJson.red_flags;
              } else if (Array.isArray(parsedJson.Red_Flags)) {
                result.redFlags = parsedJson.Red_Flags;
              }
              
              // Extract summary if available
              if (typeof parsedJson.Summary === 'string') {
                result.summary = parsedJson.Summary;
              } else if (typeof parsedJson.summary === 'string') {
                result.summary = parsedJson.summary;
              } else if (parsedJson.Summary && typeof parsedJson.Summary === 'object' && parsedJson.Summary.text) {
                // Handle nested summary object
                result.summary = parsedJson.Summary.text;
              }
            }
          } catch (e) {
            console.error("Error parsing JSON from rawText:", e);
          }
        }
      }
    }
    
    // Get skills from skillMatches if available
    if (data.skillMatches && Array.isArray(data.skillMatches)) {
      // Extract unique skill names from the matches
      const skillsFromMatches = data.skillMatches.map((match: any) => {
        return match.requirement || '';
      }).filter(Boolean);
      
      if (skillsFromMatches.length > 0) {
        // Create a unique array of skills by using an object as a map
        const uniqueSkills: {[key: string]: boolean} = {};
        
        // Add existing skills
        result.skills.forEach((skill: string) => {
          uniqueSkills[skill] = true;
        });
        
        // Add new skills
        skillsFromMatches.forEach((skill: string) => {
          uniqueSkills[skill] = true;
        });
        
        // Convert back to array
        result.skills = Object.keys(uniqueSkills);
      }
    }
    
  } catch (error) {
    console.error("Error extracting resume data:", error);
  }
  
  return result;
}

/**
 * Extract red flags data from the dedicated red flags API response
 * 
 * @param redFlagResult The red flag analysis result
 * @returns Array of red flag strings
 */
export function extractRedFlagData(redFlagResult: any): string[] {
  try {
    // Check if the redFlags field exists and contains a redFlags array
    if (redFlagResult.redFlags && Array.isArray(redFlagResult.redFlags.redFlags)) {
      return redFlagResult.redFlags.redFlags;
    }
    
    // Try alternative paths
    if (Array.isArray(redFlagResult.redFlags)) {
      return redFlagResult.redFlags;
    }
    
    // Return an empty array if no red flags found
    return [];
  } catch (error) {
    console.error("Error extracting red flag data:", error);
    return [];
  }
}