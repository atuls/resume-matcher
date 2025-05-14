/**
 * Resume data extractor utility
 * Extracts structured data from various formats of resume analysis API responses
 */

type WorkHistoryItem = {
  title?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  durationMonths?: number;
  isCurrentRole?: boolean;
  // Handle alternate field naming
  Title?: string;
  Company?: string;
  Location?: string;
  StartDate?: string;
  EndDate?: string;
  Description?: string;
  DurationMonths?: number;
  IsCurrentRole?: boolean;
  current?: boolean;
};

type SkillItem = {
  name?: string;
  category?: string;
  level?: string;
  years?: number;
  relevance?: string;
  // Handle alternate field naming
  Name?: string;
  Category?: string;
  Level?: string;
  Years?: number;
  Relevance?: string;
};

type RedFlagItem = {
  description?: string;
  impact?: string;
  severity?: string;
  // Handle alternate field naming
  Description?: string;
  Impact?: string;
  Severity?: string;
};

type ExtractedResumeData = {
  workHistory: WorkHistoryItem[];
  skills: SkillItem[];
  redFlags: RedFlagItem[];
  summary: string;
  score?: number;
};

/**
 * Helper to safely access JSON data with case-insensitive fallbacks
 * @param obj The object to extract from
 * @param key The primary key to check
 * @param fallbackKeys Alternative keys to check if primary isn't found
 * @returns The value or undefined
 */
function getField(obj: any, key: string, fallbackKeys: string[] = []): any {
  if (!obj) return undefined;
  
  // Direct attempt with provided key
  if (obj[key] !== undefined) return obj[key];
  
  // Try all fallback keys
  for (const fallbackKey of fallbackKeys) {
    if (obj[fallbackKey] !== undefined) return obj[fallbackKey];
  }
  
  // Try lowercase/uppercase variants
  const lowerKey = key.toLowerCase();
  const upperKey = key.toUpperCase();
  const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
  
  if (obj[lowerKey] !== undefined) return obj[lowerKey];
  if (obj[upperKey] !== undefined) return obj[upperKey];
  if (obj[capitalizedKey] !== undefined) return obj[capitalizedKey];
  
  return undefined;
}

/**
 * Extract structured resume data from various API response formats
 * @param data The API response data to parse
 * @returns Structured resume data
 */
export function extractResumeData(data: any): ExtractedResumeData {
  // Default empty result
  const result: ExtractedResumeData = {
    workHistory: [],
    skills: [],
    redFlags: [],
    summary: "",
    score: 0
  };
  
  if (!data) return result;
  
  // Try to extract work history
  const workHistorySource = getField(data, 'work_history', [
    'workHistory', 
    'Work_History', 
    'work_experience', 
    'workExperience', 
    'employment'
  ]);
  
  if (Array.isArray(workHistorySource)) {
    result.workHistory = workHistorySource;
  } else if (typeof data.rawResponse === 'string') {
    // Try to extract from raw JSON in the response
    try {
      const parsedRaw = JSON.parse(data.rawResponse);
      const workHistory = getField(parsedRaw, 'work_history', [
        'workHistory', 
        'Work_History', 
        'work_experience', 
        'workExperience', 
        'employment'
      ]);
      
      if (Array.isArray(workHistory)) {
        result.workHistory = workHistory;
      }
    } catch (e) {
      console.error('Error parsing raw response JSON:', e);
    }
  }
  
  // Try to extract skills
  const skillsSource = getField(data, 'skills', [
    'Skills', 
    'technical_skills', 
    'technicalSkills', 
    'softSkills', 
    'competencies'
  ]);
  
  if (Array.isArray(skillsSource)) {
    result.skills = skillsSource;
  } else if (typeof data.rawResponse === 'string') {
    // Try to extract from raw JSON in the response
    try {
      const parsedRaw = JSON.parse(data.rawResponse);
      const skills = getField(parsedRaw, 'skills', [
        'Skills', 
        'technical_skills', 
        'technicalSkills', 
        'softSkills', 
        'competencies'
      ]);
      
      if (Array.isArray(skills)) {
        result.skills = skills;
      }
    } catch (e) {
      console.error('Error parsing raw response JSON for skills:', e);
    }
  }
  
  // Try to extract red flags
  const redFlagsSource = getField(data, 'red_flags', [
    'redFlags', 
    'Red_Flags', 
    'warnings', 
    'concerns'
  ]);
  
  if (Array.isArray(redFlagsSource)) {
    result.redFlags = redFlagsSource;
  } else if (typeof data.rawResponse === 'string') {
    // Try to extract from raw JSON in the response
    try {
      const parsedRaw = JSON.parse(data.rawResponse);
      const redFlags = getField(parsedRaw, 'red_flags', [
        'redFlags', 
        'Red_Flags', 
        'warnings', 
        'concerns'
      ]);
      
      if (Array.isArray(redFlags)) {
        result.redFlags = redFlags;
      }
    } catch (e) {
      console.error('Error parsing raw response JSON for red flags:', e);
    }
  }
  
  // Try to extract summary
  result.summary = getField(data, 'summary', ['Summary', 'overview', 'Overview']) || '';
  
  // Try to extract score
  const scoreValue = getField(data, 'score', ['Score', 'matching_score', 'matchingScore']);
  if (typeof scoreValue === 'number') {
    result.score = scoreValue;
  } else if (typeof scoreValue === 'string') {
    const parsedScore = parseInt(scoreValue, 10);
    if (!isNaN(parsedScore)) {
      result.score = parsedScore;
    }
  }
  
  return result;
}