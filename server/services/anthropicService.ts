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

// Define the interface for our resume analysis result
interface ResumeAnalysisResult {
  skills: string[];
  experience: string;
  education: string;
  score: number;
  matchedRequirements: Array<{
    requirement: string;
    matched: boolean;
    confidence: number;
  }>;
  rawResponse?: any; // Add this to allow the rawResponse property
}

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
    // Truncate text if it's too long (Claude has context length limits)
    const truncatedText = text.length > 50000 ? text.substring(0, 50000) + '...' : text;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219', 
      max_tokens: 1000,
      system: `You are a skilled HR professional with expertise in parsing resumes.
      IMPORTANT: You must output ONLY valid JSON with no other text. Do not add any explanations or notes before or after the JSON.
      
      Your task is to extract a comprehensive list of technical skills, soft skills, and qualifications from the resume.
      Return a JSON object with a single "skills" array containing string items.
      
      Example of correct output format:
      {"skills": ["JavaScript", "React", "Node.js", "Communication", "Project Management"]}
      
      REMINDER: Output only valid JSON with no additional text.`,
      messages: [
        { role: 'user', content: `Extract the skills from the following resume in JSON format only:\n\n${truncatedText}` }
      ]
    });

    const contentBlock = response.content[0];
    
    if (!contentBlock || !isTextBlock(contentBlock)) {
      throw new Error('Empty response from Claude or response in unexpected format');
    }
    
    try {
      // We've already verified this is a TextBlock in the guard above
      let text = (contentBlock as TextBlock).text;
      
      // Claude sometimes wraps JSON in code blocks with ```json or ``` tags
      // Remove these if present to extract the raw JSON
      if (text.includes('```')) {
        text = text.replace(/```json\s*|\s*```/g, '');
      }
      
      const result = JSON.parse(text);
      return result.skills || [];
    } catch (error) {
      console.error("Failed to parse skills JSON from Claude:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error extracting skills with Claude:", error);
    throw new Error(`Failed to extract skills with Claude: ${(error as Error).message}`);
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
  location?: string;
  startDate?: string;
  endDate?: string;
  description: string;
  durationMonths?: number;
  isCurrentRole?: boolean;
}>> {
  try {
    // Truncate text if it's too long (Claude has context length limits)
    const truncatedText = text.length > 50000 ? text.substring(0, 50000) + '...' : text;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 2000,
      system: `You are a skilled HR professional with expertise in parsing resumes.
      IMPORTANT: You must output ONLY valid JSON with no other text. Do not add any explanations or notes before or after the JSON.
      
      Your task is to extract the work history from this resume.
      Return a JSON object with a single "workHistory" array containing objects with these properties:
      - title: Job title (string)
      - company: Company name (string)
      - location: Location (string, optional)
      - startDate: Start date (string, optional)
      - endDate: End date (string, optional, use "Present" for current roles)
      - description: Summary of responsibilities and achievements (string)
      - durationMonths: Estimated duration in months (number, optional) 
      - isCurrentRole: Boolean indicating if this is their current role (boolean, optional)
      
      Example of correct output format:
      {"workHistory": [
        {
          "title": "Software Engineer",
          "company": "Tech Company",
          "location": "San Francisco, CA",
          "startDate": "2020-01",
          "endDate": "Present",
          "description": "Developed applications using React and Node.js",
          "durationMonths": 24,
          "isCurrentRole": true
        }
      ]}
      
      REMINDER: Output only valid JSON with no additional text.`,
      messages: [
        { role: 'user', content: `Extract the work history from the following resume in JSON format only:\n\n${truncatedText}` }
      ]
    });

    const contentBlock = response.content[0];
    
    if (!contentBlock || !isTextBlock(contentBlock)) {
      throw new Error('Empty response from Claude or response in unexpected format');
    }
    
    try {
      // We've already verified this is a TextBlock in the guard above
      let text = (contentBlock as TextBlock).text;
      
      // Claude sometimes wraps JSON in code blocks with ```json or ``` tags
      // Remove these if present to extract the raw JSON
      if (text.includes('```')) {
        text = text.replace(/```json\s*|\s*```/g, '');
      }
      
      // Sometimes Claude starts with explanatory text like "I'll extract..." - let's clean that up
      // Find the first { character to identify the start of JSON
      const jsonStartIndex = text.indexOf('{');
      if (jsonStartIndex > 0) {
        text = text.substring(jsonStartIndex);
      }
      
      const result = JSON.parse(text);
      return result.workHistory || [];
    } catch (error) {
      console.error("Failed to parse work history JSON from Claude:", error);
      // Instead of throwing error, return empty array as fallback
      console.warn("Returning empty work history array due to JSON parsing error");
      return [];
    }
  } catch (error) {
    console.error("Error extracting work history with Claude:", error);
    throw new Error(`Failed to extract work history with Claude: ${(error as Error).message}`);
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
): Promise<ResumeAnalysisResult> {
  try {
    // Truncate texts if they're too long (Claude has context length limits)
    const truncatedResume = resumeText.length > 30000 ? resumeText.substring(0, 30000) + '...' : resumeText;
    const truncatedJob = jobDescription.length > 20000 ? jobDescription.substring(0, 20000) + '...' : jobDescription;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 2000,
      system: `You are an expert resume analyst. 
      IMPORTANT: You must output ONLY valid JSON with no other text. Do not add any explanations or notes before or after the JSON.
      
      Your task is to analyze a resume against a job description and determine how well the candidate matches the role.
      Extract key requirements from the job description and check if the resume demonstrates those skills or experiences.
      
      Return a JSON object with these properties:
      - skills: Array of strings listing relevant skills found in the resume
      - experience: String summarizing relevant experience
      - education: String summarizing education background
      - score: Number from 0-100 indicating overall match percentage
      - matchedRequirements: Array of objects with:
        - requirement: String describing the job requirement
        - matched: Boolean indicating if the resume matches this requirement
        - confidence: Number from 0-1 indicating confidence in the match
      
      Example of correct output format:
      {
        "skills": ["JavaScript", "React", "Node.js"],
        "experience": "5 years of frontend development experience",
        "education": "Bachelor's in Computer Science",
        "score": 85,
        "matchedRequirements": [
          {
            "requirement": "JavaScript proficiency",
            "matched": true,
            "confidence": 0.95
          },
          {
            "requirement": "5+ years experience",
            "matched": true,
            "confidence": 0.9
          }
        ]
      }
      
      REMINDER: Output only valid JSON with no additional text.`,
      messages: [
        { 
          role: 'user', 
          content: `Analyze this resume against the job description in JSON format only:\n\nJOB DESCRIPTION:\n${truncatedJob}\n\nRESUME:\n${truncatedResume}` 
        }
      ]
    });

    const contentBlock = response.content[0];
    
    if (!contentBlock || !isTextBlock(contentBlock)) {
      throw new Error('Empty response from Claude or response in unexpected format');
    }
    
    try {
      // We've already verified this is a TextBlock in the guard above
      let text = (contentBlock as TextBlock).text;
      console.log("Raw Claude response (first 100 chars):", text.substring(0, 100).replace(/\n/g, ' '));
      
      // Claude sometimes wraps JSON in code blocks with ```json or ``` tags
      // Remove these if present to extract the raw JSON
      if (text.includes('```')) {
        text = text.replace(/```json\s*|\s*```/g, '');
      }
      
      // Try to locate and extract JSON if Claude added explanatory text
      let jsonText = text;
      const jsonMatch = text.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log("JSON extracted using regex");
      }
      
      // Try to parse the JSON
      let result;
      try {
        result = JSON.parse(jsonText);
      } catch (error) {
        const jsonError = error as Error;
        console.error("Initial JSON parsing failed:", jsonError.message);
        
        // Try a more thorough approach to find valid JSON with balanced braces
        let braceCount = 0;
        let startIdx = -1;
        
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '{') {
            if (braceCount === 0) startIdx = i;
            braceCount++;
          } else if (text[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIdx !== -1) {
              // Found a potential JSON object
              try {
                const jsonCandidate = text.substring(startIdx, i + 1);
                result = JSON.parse(jsonCandidate);
                console.log("Found valid JSON using brace balancing");
                break;
              } catch (e) {
                // Continue searching
                console.log("Found balanced braces but invalid JSON, continuing search");
              }
            }
          }
        }
        
        if (!result) {
          throw new Error("Could not extract valid JSON from Claude response: " + jsonError.message);
        }
      }
      
      // Ensure we have all required fields
      if (!result.skills || !result.experience || !result.education || 
          typeof result.score !== 'number' || !result.matchedRequirements) {
        throw new Error('Incomplete data in Claude response');
      }
      
      // Store the original text response for debugging purposes
      const rawResponse = {
        rawText: text,
        parsedJson: result
      };
      
      return {
        skills: result.skills,
        experience: result.experience,
        education: result.education,
        score: result.score,
        matchedRequirements: result.matchedRequirements,
        rawResponse
      };
    } catch (error) {
      console.error("Failed to parse resume analysis JSON from Claude:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error analyzing resume with Claude:", error);
    throw new Error(`Failed to analyze resume with Claude: ${(error as Error).message}`);
  }
}