/**
 * Utility functions for debugging data structures in the resume analysis application
 */

/**
 * Examines common access paths for skills data in an analysis object
 * @param analysis The analysis object to examine
 * @returns Object containing all possible paths and their values/existence
 */
export function examineSkillsAccessPaths(analysis: any) {
  if (!analysis) return { error: 'No analysis object provided' };
  
  return {
    'analysis?.analysis?.skills': analysis?.analysis?.skills || undefined,
    'analysis?.rawResponse?.parsedJson?.Skills': analysis?.rawResponse?.parsedJson?.Skills || undefined,
    'analysis?.rawResponse?.parsedJson?.skills': analysis?.rawResponse?.parsedJson?.skills || undefined,
    'analysis?.rawResponse?.extractedSections?.skills': analysis?.rawResponse?.extractedSections?.skills || undefined,
    'analysis?.rawResponse?.skills': analysis?.rawResponse?.skills || undefined,
  };
}

/**
 * Examines common access paths for work history data in a red flag analysis object
 * @param redFlagData The red flag analysis object to examine
 * @returns Object containing all possible paths and their values/existence
 */
export function examineWorkHistoryAccessPaths(redFlagData: any) {
  if (!redFlagData) return { error: 'No red flag data object provided' };
  
  return {
    'redFlagData?.analysis?.recentRoles': redFlagData?.analysis?.recentRoles || undefined,
    'redFlagData?.rawResponse?.parsedJson?.WorkHistory': redFlagData?.rawResponse?.parsedJson?.WorkHistory || undefined,
    'redFlagData?.rawResponse?.parsedJson?.workHistory': redFlagData?.rawResponse?.parsedJson?.workHistory || undefined,
    'redFlagData?.rawResponse?.extractedSections?.workHistory': redFlagData?.rawResponse?.extractedSections?.workHistory || undefined,
    'redFlagData?.workHistory': redFlagData?.workHistory || undefined,
  };
}

/**
 * Gets skills from an analysis object by trying multiple potential access paths
 * @param analysis The analysis object to extract skills from
 * @returns Array of skills or empty array if none found
 */
export function extractSkillsFromAnalysis(analysis: any): string[] {
  if (!analysis) return [];
  
  // Try different potential paths in order of likelihood
  if (analysis?.analysis?.skills && Array.isArray(analysis.analysis.skills)) {
    console.log("Found skills in analysis.analysis.skills");
    return analysis.analysis.skills;
  } 
  
  if (analysis?.rawResponse?.parsedJson?.Skills && Array.isArray(analysis.rawResponse.parsedJson.Skills)) {
    console.log("Found skills in analysis.rawResponse.parsedJson.Skills");
    return analysis.rawResponse.parsedJson.Skills;
  }
  
  if (analysis?.rawResponse?.parsedJson?.skills && Array.isArray(analysis.rawResponse.parsedJson.skills)) {
    console.log("Found skills in analysis.rawResponse.parsedJson.skills");
    return analysis.rawResponse.parsedJson.skills;
  }
  
  if (analysis?.rawResponse?.extractedSections?.skills && Array.isArray(analysis.rawResponse.extractedSections.skills)) {
    console.log("Found skills in analysis.rawResponse.extractedSections.skills");
    return analysis.rawResponse.extractedSections.skills;
  }
  
  if (analysis?.rawResponse?.skills && Array.isArray(analysis.rawResponse.skills)) {
    console.log("Found skills in analysis.rawResponse.skills");
    return analysis.rawResponse.skills;
  }
  
  return [];
}

/**
 * Separates technical skills from soft skills based on keywords
 * @param skillsList Array of skills to categorize
 * @returns Object containing arrays of technical and soft skills
 */
export function categorizeSkills(skillsList: string[]) {
  if (!skillsList || !Array.isArray(skillsList)) return { technicalSkills: [], softSkills: [] };
  
  // Define soft skills for filtering
  const softSkillKeywords = [
    'communication', 'teamwork', 'leadership', 'problem solving', 
    'adaptability', 'time management', 'creativity', 'critical thinking',
    'collaboration', 'presentation', 'interpersonal', 'organization', 
    'flexibility', 'negotiation', 'conflict resolution'
  ];
  
  // Filter for technical vs soft skills
  const technicalSkills = skillsList.filter(skill => 
    !softSkillKeywords.some(softSkill => 
      skill.toLowerCase().includes(softSkill.toLowerCase())
    )
  );
  
  const softSkills = skillsList.filter(skill => 
    softSkillKeywords.some(softSkill => 
      skill.toLowerCase().includes(softSkill.toLowerCase())
    )
  );
  
  return { technicalSkills, softSkills };
}

/**
 * Safely extracts formatted work history from analysis data
 * @param redFlagData Analysis data that might contain work history
 * @returns Formatted work history array or empty array
 */
export function extractWorkHistory(redFlagData: any): any[] {
  if (!redFlagData) return [];
  
  // Try different potential paths in order of likelihood
  if (redFlagData?.analysis?.recentRoles && Array.isArray(redFlagData.analysis.recentRoles)) {
    console.log("Found work history in redFlagData.analysis.recentRoles");
    return redFlagData.analysis.recentRoles;
  }
  
  if (redFlagData?.rawResponse?.parsedJson?.WorkHistory && Array.isArray(redFlagData.rawResponse.parsedJson.WorkHistory)) {
    console.log("Found work history in redFlagData.rawResponse.parsedJson.WorkHistory");
    return redFlagData.rawResponse.parsedJson.WorkHistory;
  }
  
  if (redFlagData?.rawResponse?.parsedJson?.workHistory && Array.isArray(redFlagData.rawResponse.parsedJson.workHistory)) {
    console.log("Found work history in redFlagData.rawResponse.parsedJson.workHistory");
    return redFlagData.rawResponse.parsedJson.workHistory;
  }
  
  if (redFlagData?.workHistory && Array.isArray(redFlagData.workHistory)) {
    console.log("Found work history in redFlagData.workHistory");
    return redFlagData.workHistory;
  }
  
  return [];
}

/**
 * Check if a field exists at any level in a nested object
 * @param obj The object to search
 * @param field The field name to look for
 * @returns The path to the field if found, null otherwise
 */
export function findFieldPath(obj: any, field: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  
  // Check if the field exists directly on this object
  if (field in obj) return field;
  
  // Recursively check all nested objects
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const path = findFieldPath(obj[key], field);
      if (path) return `${key}.${path}`;
    }
  }
  
  return null;
}