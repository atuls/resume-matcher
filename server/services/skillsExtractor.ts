import OpenAI from "openai";
import { 
  isAnthropicApiKeyAvailable,
  extractSkillsWithClaude,
  extractWorkHistoryWithClaude
} from "./anthropicService";

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types for the red flag analysis
export interface RedFlagAnalysis {
  hasJobHoppingHistory: boolean;
  hasContractRoles: boolean;
  isCurrentlyEmployed: boolean;
  averageTenureMonths: number;
  recentRoles: Array<{
    title: string;
    company: string;
    durationMonths: number;
    isContract: boolean;
  }>;
  redFlags: string[];
  highlights: string[];
  currentJobPosition?: string;
}

/**
 * Extract skills from resume text using AI (OpenAI or Claude)
 * 
 * @param text The resume text to analyze
 * @returns An array of extracted skills
 */
export async function extractSkillsFromResume(text: string): Promise<string[]> {
  try {
    // Try Claude first if available
    if (isAnthropicApiKeyAvailable()) {
      try {
        return await extractSkillsWithClaude(text);
      } catch (error) {
        console.error("Claude skills extraction failed, falling back to OpenAI:", error);
        // Continue to OpenAI if Claude fails
      }
    }
    
    // If OpenAI API key is not available, use fallback extraction
    if (!process.env.OPENAI_API_KEY) {
      return fallbackSkillsExtraction(text);
    }
    
    const prompt = `
      Extract ALL technical and soft skills from the following resume. 
      Return ONLY a JSON array of strings with the skills, nothing else.
      Include programming languages, frameworks, tools, and soft skills.
      Keep each skill short (1-3 words maximum) and lowercase.
      
      Resume text:
      ${text.slice(0, 7000)} // Limit to 7000 chars to avoid token limits
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use the cost-effective model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      return fallbackSkillsExtraction(text);
    }
    
    try {
      const result = JSON.parse(content);
      return result.skills || [];
    } catch (error) {
      console.error("Failed to parse skills JSON:", error);
      return fallbackSkillsExtraction(text);
    }
  } catch (error) {
    console.error("Error extracting skills with AI:", error);
    return fallbackSkillsExtraction(text);
  }
}

/**
 * Extract work history from resume text using AI (OpenAI or Claude)
 * 
 * @param text The resume text to analyze
 * @returns An array of work experiences
 */
export async function extractWorkHistory(text: string): Promise<Array<{
  title: string;
  company: string;
  period: string;
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  isCurrentJob?: boolean;
  isContractRole?: boolean;
  description: string;
}>> {
  try {
    // Try Claude first if available
    if (isAnthropicApiKeyAvailable()) {
      try {
        return await extractWorkHistoryWithClaude(text);
      } catch (error) {
        console.error("Claude work history extraction failed, falling back to OpenAI:", error);
        // Continue to OpenAI if Claude fails
      }
    }
    
    // If OpenAI API key is not available, use fallback extraction
    if (!process.env.OPENAI_API_KEY) {
      return fallbackWorkExtraction(text);
    }
    
    const prompt = `
      Extract ALL work experiences from the following resume.
      Return a JSON object with an array of "workHistory" items with the following properties for each:
      - title: the job title
      - company: the company name
      - period: the time period (e.g., "2020 - 2023")
      - startDate: formatted as YYYY-MM if available
      - endDate: formatted as YYYY-MM if available, or "Present" if it's a current job
      - durationMonths: calculated duration in months (integer)
      - isCurrentJob: boolean, true if this is their current job
      - isContractRole: boolean, true if the role appears to be a contract, temporary, or freelance position
      - description: a brief description of the role and responsibilities
      
      For startDate and endDate, make your best estimate based on the text if exact dates aren't provided.
      For durationMonths, calculate the approximate duration in months based on the dates.
      If you cannot determine if it's a contract role, default to false for isContractRole.
      If any information is truly missing, use null as the value.
      If you can't find any work history, return an empty array.
      
      Resume text:
      ${text.slice(0, 7000)}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use the cost-effective model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      return fallbackWorkExtraction(text);
    }
    
    try {
      const result = JSON.parse(content);
      return result.workHistory || [];
    } catch (error) {
      console.error("Failed to parse work history JSON:", error);
      return fallbackWorkExtraction(text);
    }
  } catch (error) {
    console.error("Error extracting work history with AI:", error);
    return fallbackWorkExtraction(text);
  }
}

/**
 * Basic skills extraction fallback when OpenAI is not available
 */
function fallbackSkillsExtraction(text: string): string[] {
  const commonSkills = [
    "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "php", "swift",
    "react", "angular", "vue", "node.js", "express", "django", "rails", "flutter",
    "sql", "mongodb", "postgresql", "mysql", "firebase", "aws", "azure", "gcp",
    "docker", "kubernetes", "git", "ci/cd", "agile", "scrum", "jira",
    "leadership", "communication", "teamwork", "problem solving", "time management",
    "critical thinking", "adaptability", "project management", "attention to detail"
  ];
  
  const foundSkills = commonSkills.filter(skill => 
    text.toLowerCase().includes(skill.toLowerCase())
  );
  
  return foundSkills.length > 0 ? foundSkills : ["javascript", "html", "css", "communication", "teamwork"];
}

/**
 * Basic work history extraction fallback when OpenAI is not available
 */
function fallbackWorkExtraction(text: string): Array<{
  title: string;
  company: string;
  period: string;
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  isCurrentJob?: boolean;
  isContractRole?: boolean;
  description: string;
}> {
  // This is very basic and will be improved in the future
  const lines = text.split('\n');
  let foundCompanies = [];
  
  for (const line of lines) {
    // Look for lines that might contain job titles and company names
    if (/software|developer|engineer|manager|consultant|analyst|designer/i.test(line) && 
        /inc\.?|llc|corp|ltd|company|technologies|systems|solutions/i.test(line)) {
      
      const words = line.split(/\s+/);
      if (words.length >= 4) {
        // Very crude heuristic to guess a company name
        const possibleCompany = words.slice(Math.max(0, words.length - 3)).join(' ');
        
        // Check if likely a contract role
        const isContractRole = /contract|temp|temporary|freelance|consultant/i.test(line);
        
        foundCompanies.push({
          title: "Software Developer", // Default title
          company: possibleCompany,
          period: "Not specified",
          isCurrentJob: false,
          isContractRole: isContractRole,
          description: "Role details not available without AI processing"
        });
      }
    }
  }
  
  return foundCompanies.length > 0 ? foundCompanies.slice(0, 3) : [{
    title: "Work Experience",
    company: "Details not available",
    period: "Not specified",
    isCurrentJob: false,
    isContractRole: false,
    description: "Resume work history requires AI processing for accurate extraction"
  }];
}

/**
 * Analyze a resume for red flags based on work history
 * 
 * @param workHistory The work history extracted from the resume
 * @param skills The skills extracted from the resume
 * @param jobDescription Optional job description for analyzing match highlights
 * @returns Red flag analysis results
 */
export function analyzeRedFlags(
  workHistory: Array<{
    title: string;
    company: string;
    period: string;
    startDate?: string;
    endDate?: string;
    durationMonths?: number;
    isCurrentJob?: boolean;
    isContractRole?: boolean;
    description: string;
  }>,
  skills: string[],
  jobDescription?: string
): RedFlagAnalysis {
  // Default analysis result with no red flags
  const defaultAnalysis: RedFlagAnalysis = {
    hasJobHoppingHistory: false,
    hasContractRoles: false,
    isCurrentlyEmployed: false,
    averageTenureMonths: 0,
    recentRoles: [],
    redFlags: [],
    highlights: []
  };
  
  // If no work history, return default with red flag for no experience
  if (!workHistory || workHistory.length === 0) {
    return {
      ...defaultAnalysis,
      redFlags: ["No work history found in resume"]
    };
  }
  
  // Sort work history by start date (descending) to get most recent roles first
  // For simplicity, we'll just use the most recent 3 jobs for analysis
  const sortedHistory = [...workHistory].sort((a, b) => {
    // If we have durationMonths, use that for sorting
    if (a.isCurrentJob && !b.isCurrentJob) return -1;
    if (!a.isCurrentJob && b.isCurrentJob) return 1;
    
    // Sort by startDate if available
    if (a.startDate && b.startDate) {
      return b.startDate.localeCompare(a.startDate);
    }
    
    return 0;
  });
  
  // Get recent roles (last 3 jobs)
  const recentJobs = sortedHistory.slice(0, 3);
  
  // Detect if currently employed
  const isCurrentlyEmployed = recentJobs.some(job => job.isCurrentJob === true);
  
  // Current job position
  const currentJobPosition = isCurrentlyEmployed ? 
    recentJobs.find(job => job.isCurrentJob)?.title : undefined;
  
  // Check for contract roles
  const hasContractRoles = recentJobs.some(job => job.isContractRole === true);
  
  // Calculate average tenure
  let totalMonths = 0;
  let countableJobs = 0;
  
  recentJobs.forEach(job => {
    if (job.durationMonths) {
      totalMonths += job.durationMonths;
      countableJobs++;
    }
  });
  
  const averageTenureMonths = countableJobs > 0 ? Math.round(totalMonths / countableJobs) : 0;
  
  // Determine if job hopping (less than 12 months average in recent roles)
  const hasJobHoppingHistory = averageTenureMonths > 0 && averageTenureMonths < 12;
  
  // Build recent roles list
  const recentRoles = recentJobs.map(job => ({
    title: job.title,
    company: job.company,
    durationMonths: job.durationMonths || 0,
    isContract: job.isContractRole || false
  }));
  
  // Compile red flags
  const redFlags: string[] = [];
  
  if (hasJobHoppingHistory) {
    redFlags.push(`Short average tenure (${averageTenureMonths} months) in recent positions`);
  }
  
  if (hasContractRoles) {
    redFlags.push("Recent contract/temporary roles in work history");
  }
  
  if (!isCurrentlyEmployed) {
    redFlags.push("Currently unemployed");
  }
  
  // Identify highlights
  const highlights: string[] = [];
  
  // If job description provided, identify matching skills
  if (jobDescription && skills.length > 0) {
    const jobDescLower = jobDescription.toLowerCase();
    const matchingSkills = skills.filter(skill => 
      jobDescLower.includes(skill.toLowerCase())
    );
    
    if (matchingSkills.length > 0) {
      highlights.push(`Matches ${matchingSkills.length} key skills required for the role`);
      
      // Add top 3 matching skills
      const topSkills = matchingSkills.slice(0, 3).join(", ");
      if (topSkills) {
        highlights.push(`Key matching skills: ${topSkills}`);
      }
    }
  }
  
  // Add experience level highlight
  if (averageTenureMonths >= 24) {
    highlights.push(`Strong job stability with ${Math.round(averageTenureMonths/12)} year average tenure`);
  }
  
  return {
    hasJobHoppingHistory,
    hasContractRoles,
    isCurrentlyEmployed,
    averageTenureMonths,
    recentRoles,
    redFlags,
    highlights,
    currentJobPosition
  };
}