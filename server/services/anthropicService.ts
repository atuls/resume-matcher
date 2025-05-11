import Anthropic from '@anthropic-ai/sdk';

// Define interfaces for Anthropic content types
interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

type ContentBlock = TextBlock | ToolUseBlock;

// Type guard function to check if a ContentBlock is a TextBlock
function isTextBlock(block: any): block is TextBlock {
  return block && 'type' in block && block.type === 'text' && 'text' in block;
}

// Initialize the Anthropic client
// The newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Check if Anthropic API key is available
 */
export function isAnthropicApiKeyAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Extract skills from resume text using Anthropic Claude
 * 
 * @param text The resume text to analyze
 * @returns An array of extracted skills
 */
export async function extractSkillsWithClaude(text: string): Promise<string[]> {
  try {
    if (!isAnthropicApiKeyAvailable()) {
      throw new Error('Anthropic API key not available');
    }

    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      system: `You're a resume analysis AI. Extract ALL technical and soft skills from the resume text. 
      Return ONLY a JSON object with a "skills" array, nothing else. Include programming languages, frameworks, tools, and soft skills.
      Keep each skill short (1-3 words maximum) and lowercase.`,
      messages: [
        { role: 'user', content: text.slice(0, 7000) }  // Limit to 7000 chars to avoid token limits
      ],
    });

    const contentBlock = message.content[0];
    
    if (!contentBlock || !isTextBlock(contentBlock)) {
      throw new Error('Empty response from Claude or response in unexpected format');
    }
    
    try {
      const result = JSON.parse(contentBlock.text);
      return result.skills || [];
    } catch (error) {
      console.error("Failed to parse skills JSON from Claude:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error extracting skills with Claude:", error);
    throw error;
  }
}

/**
 * Extract work history from resume text using Anthropic Claude
 * 
 * @param text The resume text to analyze
 * @returns An array of work experiences
 */
export async function extractWorkHistoryWithClaude(text: string): Promise<Array<{
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
    if (!isAnthropicApiKeyAvailable()) {
      throw new Error('Anthropic API key not available');
    }

    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1536,
      system: `You're a resume analysis AI. Extract ALL work experiences from the resume text. 
      Return a JSON object with a "workHistory" array containing objects with these properties for each position:
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
      If you can't find any work history, return an empty array.`,
      messages: [
        { role: 'user', content: text.slice(0, 7000) }  // Limit to 7000 chars to avoid token limits
      ],
    });

    const contentBlock = message.content[0];
    
    if (!contentBlock || !isTextBlock(contentBlock)) {
      throw new Error('Empty response from Claude or response in unexpected format');
    }
    
    try {
      const result = JSON.parse(contentBlock.text);
      return result.workHistory || [];
    } catch (error) {
      console.error("Failed to parse work history JSON from Claude:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error extracting work history with Claude:", error);
    throw error;
  }
}

/**
 * Analyze a resume against a job description using Anthropic Claude
 * 
 * @param resumeText The text content of the resume
 * @param jobDescription The job description to match against
 * @returns An analysis result with matching score and details
 */
export async function analyzeResumeWithClaude(
  resumeText: string, 
  jobDescription: string
): Promise<{
  skills: string[];
  experience: string;
  education: string;
  score: number;
  matchedRequirements: Array<{
    requirement: string;
    matched: boolean;
    confidence: number;
  }>;
}> {
  try {
    if (!isAnthropicApiKeyAvailable()) {
      throw new Error('Anthropic API key not available');
    }

    // Extract requirements from job description (simple approach)
    const requirements = jobDescription
      .split(/\n|\.|;/)
      .filter(line => 
        line.trim().length > 10 && 
        /required|experience|skills|qualifications|proficiency|knowledge|degree|education/i.test(line)
      )
      .map(line => line.trim())
      .slice(0, 8); // Limit to prevent token issues

    const message = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 2048,
      system: `You're an expert resume analyzer comparing resumes to job descriptions. 
      Provide a detailed analysis of how well the resume matches the job requirements.
      Return ONLY a JSON object with these properties:
      - skills: array of strings listing candidate's skills relevant to the job
      - experience: string summarizing relevant experience
      - education: string summarizing education 
      - score: number between 0-100 representing overall match percentage
      - matchedRequirements: array of objects with requirements from the job, each containing:
        - requirement: string with the requirement text
        - matched: boolean indicating if candidate meets this requirement
        - confidence: number between 0-1 indicating match confidence`,
      messages: [
        { 
          role: 'user', 
          content: `Job Description:\n${jobDescription.slice(0, 3000)}\n\nResume:\n${resumeText.slice(0, 5000)}\n\nAnalyze how well this resume matches the job description and extract key information.${
            requirements.length > 0 ? `\n\nKey requirements to analyze:\n${requirements.join('\n')}` : ''
          }`
        }
      ],
    });

    const contentBlock = message.content[0];
    
    if (!contentBlock || !isTextBlock(contentBlock)) {
      throw new Error('Empty response from Claude or response in unexpected format');
    }
    
    try {
      const result = JSON.parse(contentBlock.text);
      
      // Ensure we have all required fields
      if (!result.skills || !result.experience || !result.education || 
          typeof result.score !== 'number' || !result.matchedRequirements) {
        throw new Error('Incomplete analysis results from Claude');
      }
      
      return {
        skills: result.skills,
        experience: result.experience,
        education: result.education,
        score: result.score,
        matchedRequirements: result.matchedRequirements
      };
    } catch (error) {
      console.error("Failed to parse analysis JSON from Claude:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error analyzing resume with Claude:", error);
    throw error;
  }
}