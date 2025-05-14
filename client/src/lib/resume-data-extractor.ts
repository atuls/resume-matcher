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

  // If nothing provided, return empty result
  if (!analysisResult) {
    return result;
  }

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
    // Work History - try multiple field names to handle inconsistency
    if (Array.isArray(data.Work_History)) {
      console.log("Found work history at data.Work_History");
      result.workHistory = data.Work_History;
    } else if (Array.isArray(data.work_history)) {
      console.log("Found work history at data.work_history");
      result.workHistory = data.work_history;
    } else if (Array.isArray(data.workHistory)) {
      console.log("Found work history at data.workHistory");
      result.workHistory = data.workHistory;
    } else if (Array.isArray(data['Work History'])) {
      console.log("Found work history at data['Work History']");
      result.workHistory = data['Work History'];
    } else if (data.analysis && Array.isArray(data.analysis.workHistory)) {
      console.log("Found work history at data.analysis.workHistory");
      result.workHistory = data.analysis.workHistory;
    }
    
    // Skills - try multiple field names
    if (Array.isArray(data.Skills)) {
      console.log("Found skills at data.Skills");
      result.skills = data.Skills;
    } else if (Array.isArray(data.skills)) {
      console.log("Found skills at data.skills");
      result.skills = data.skills;
    } else if (Array.isArray(data['Skills'])) {
      console.log("Found skills at data['Skills']");
      result.skills = data['Skills'];
    } else if (data.analysis && Array.isArray(data.analysis.skills)) {
      console.log("Found skills at data.analysis.skills");
      result.skills = data.analysis.skills;
    }
    
    // Red Flags - try multiple field names
    if (Array.isArray(data.Red_Flags)) {
      console.log("Found red flags at data.Red_Flags");
      result.redFlags = data.Red_Flags;
    } else if (Array.isArray(data.redFlags)) {
      console.log("Found red flags at data.redFlags");
      result.redFlags = data.redFlags;
    } else if (Array.isArray(data['Red Flags'])) {
      console.log("Found red flags at data['Red Flags']");
      result.redFlags = data['Red Flags'];
    } else if (data.analysis && Array.isArray(data.analysis.redFlags)) {
      console.log("Found red flags at data.analysis.redFlags");
      result.redFlags = data.analysis.redFlags;
    } else if (data.analysis && Array.isArray(data.analysis.potentialRedFlags)) {
      console.log("Found red flags at data.analysis.potentialRedFlags");
      result.redFlags = data.analysis.potentialRedFlags.map((flag: any) => {
        if (typeof flag === 'string') return flag;
        return flag.description || flag.issue || flag.text || JSON.stringify(flag);
      });
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
    
    // Extract summary from various fields
    if (typeof data.summary === 'string' && data.summary.trim()) {
      result.summary = data.summary;
    } else if (typeof data.Summary === 'string' && data.Summary.trim()) {
      result.summary = data.Summary;
    } else if (data.analysis && typeof data.analysis.summary === 'string' && data.analysis.summary.trim()) {
      result.summary = data.analysis.summary;
    }
    
    // Combine skills, work history and red flags from all sources if currently empty
    // This ensures we have the most comprehensive data available
    
    // Log the extraction results for debugging
    console.log("Final extraction results:");
    console.log("- Skills:", result.skills.length > 0 ? "Found" : "Not found");
    console.log("- Work History:", result.workHistory.length > 0 ? "Found" : "Not found");
    console.log("- Red Flags:", result.redFlags.length > 0 ? "Found" : "Not found");
    console.log("- Summary:", result.summary ? "Found" : "Not found");
    console.log("- Score:", result.score);
    
  } catch (error) {
    console.error("Error extracting resume data:", error);
    // Don't swallow errors completely - at least log what data caused the problem
    console.error("Source data:", analysisResult ? 
      (typeof analysisResult === 'object' ? Object.keys(analysisResult).join(', ') : typeof analysisResult) 
      : "null or undefined");
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