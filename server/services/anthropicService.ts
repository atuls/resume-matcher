import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage';

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
 * @param customPrompt Optional custom prompt to override the default
 * @returns An array of extracted skills
 */
export async function extractSkillsWithClaude(text: string, customPrompt?: string): Promise<string[]> {
  try {
    // Truncate text if it's too long (Claude has context length limits)
    const truncatedText = text.length > 50000 ? text.substring(0, 50000) + '...' : text;
    
    // Default system prompt if no custom prompt is provided
    const defaultSystemPrompt = `You are a skilled HR professional with expertise in parsing resumes.
      IMPORTANT: You must output ONLY valid JSON with no other text. Do not add any explanations or notes before or after the JSON.
      
      Your task is to extract a comprehensive list of technical skills, soft skills, and qualifications from the resume.
      Return a JSON object with a single "skills" array containing string items.
      
      Example of correct output format:
      {"skills": ["JavaScript", "React", "Node.js", "Communication", "Project Management"]}
      
      REMINDER: Output only valid JSON with no additional text.`;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219', 
      max_tokens: 1000,
      system: customPrompt || defaultSystemPrompt,
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
 * @param customPrompt Optional custom prompt to override the default
 * @returns An array of work experiences
 */
export async function extractWorkHistoryWithClaude(text: string, customPrompt?: string): Promise<Array<{
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
    
    // Default system prompt if no custom prompt is provided
    const defaultSystemPrompt = `You are a skilled HR professional with expertise in parsing resumes.
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
      
      REMINDER: Output only valid JSON with no additional text.`;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 2000,
      system: customPrompt || defaultSystemPrompt,
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
    
    // Try to get custom prompt from settings for Claude
    let systemPrompt = '';
    let userPrompt = '';
    try {
      // First, try to get the Claude-specific prompt
      const claudePromptSetting = await storage.getSetting('claude_analysis_prompt');
      if (claudePromptSetting?.value) {
        systemPrompt = claudePromptSetting.value;
        console.log("Using Claude-specific prompt from settings");
        
        // Use a simplified user prompt when we have a custom system prompt
        userPrompt = `JOB DESCRIPTION:\n${truncatedJob}\n\nRESUME:\n${truncatedResume}`;
      } else {
        // Fall back to the general analysis prompt if no Claude-specific one exists
        const generalPromptSetting = await storage.getSetting('analysis_prompt');
        if (generalPromptSetting?.value) {
          // If using the general prompt, put instructions in system and content in user message
          systemPrompt = "You are Claude. Your task is to analyze a resume against a job description and provide analysis in valid JSON format only. Do not include any explanations or notes.";
          userPrompt = generalPromptSetting.value
            .replace('{JOB_DESCRIPTION}', truncatedJob)
            .replace('{RESUME}', truncatedResume);
          console.log("Using general analysis prompt from settings for Claude");
        } else {
          throw new Error('No analysis prompt found in settings');
        }
      }
    } catch (error) {
      console.error("Error loading custom Claude prompt:", error);
      throw new Error('Failed to load analysis prompt from settings');
    }
    
    // Get the model from settings if available
    let model = 'claude-3-7-sonnet-20250219'; // Default model
    try {
      const modelSetting = await storage.getSetting('claude_model');
      if (modelSetting?.value && modelSetting.value.includes('claude')) {
        model = modelSetting.value;
        console.log(`Using custom Claude model from settings: ${model}`);
      }
    } catch (error) {
      console.log("Error fetching Claude model setting, using default:", error);
    }
    
    // Make the API call with the settings-based prompts
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { 
          role: 'user', 
          content: userPrompt
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
        // Attempt to normalize any potentially problematic values before parsing
        const normalizedText = jsonText
          // Fix unquoted values like partially, fully, etc.
          .replace(/"matched"\s*:\s*partially/g, '"matched": "partial"')
          .replace(/"matched"\s*:\s*fully/g, '"matched": "full"')
          .replace(/"matched"\s*:\s*no/g, '"matched": "none"')
          // Fix capitalized boolean values
          .replace(/:\s*True/g, ': true')
          .replace(/:\s*False/g, ': false')
          // Fix missing quotes for string values between braces
          .replace(/:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*([,}])/g, ': "$1"$2');
        
        result = JSON.parse(normalizedText);
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
                let jsonCandidate = text.substring(startIdx, i + 1);
                
                // Apply the same normalization as in the first attempt
                jsonCandidate = jsonCandidate
                  .replace(/"matched"\s*:\s*partially/g, '"matched": "partial"')
                  .replace(/"matched"\s*:\s*fully/g, '"matched": "full"')
                  .replace(/"matched"\s*:\s*no/g, '"matched": "none"')
                  .replace(/:\s*True/g, ': true')
                  .replace(/:\s*False/g, ': false')
                  .replace(/:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*([,}])/g, ': "$1"$2');
                
                result = JSON.parse(jsonCandidate);
                console.log("Found valid JSON using brace balancing and normalization");
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
      
      // Store the original text and parsed JSON for debugging
      const rawResponse = {
        rawText: text,
        parsedJson: result
      };
      
      // First approach: Direct mapping if Claude returned the exact format we expect
      if (result.skills && result.experience && result.education && 
          typeof result.score === 'number' && Array.isArray(result.matchedRequirements)) {
        return {
          skills: result.skills,
          experience: result.experience,
          education: result.education,
          score: result.score,
          matchedRequirements: result.matchedRequirements,
          rawResponse
        };
      }
      
      // Second approach: Try to extract from nested "jobAnalysis" or similar structures 
      // that Claude sometimes returns
      console.log("Standard fields not found, attempting to extract from nested structure");
      
      // First, check for common nested structures Claude might return
      const nestedObj = 
        result.jobAnalysis || 
        result.resumeAnalysis || 
        result.analysis || 
        result.jobRequirements ||
        result;
        
      // Extract skills - check multiple possible locations  
      const skills = 
        nestedObj.skills || 
        nestedObj.candidateSkills || 
        (nestedObj.resumeSkills && Array.isArray(nestedObj.resumeSkills) ? nestedObj.resumeSkills : null) ||
        [];
      
      // Extract experience summary
      const experience = 
        nestedObj.experience || 
        nestedObj.workExperience ||
        nestedObj.candidateExperience ||
        "Experience extracted from resume";
      
      // Extract education info
      const education = 
        nestedObj.education || 
        nestedObj.educationBackground ||
        nestedObj.candidateEducation ||
        "Education extracted from resume";
        
      // Extract score - several possible locations
      let score = 
        typeof nestedObj.score === 'number' ? nestedObj.score : 
        typeof nestedObj.matchScore === 'number' ? nestedObj.matchScore :
        typeof nestedObj.overallScore === 'number' ? nestedObj.overallScore :
        typeof nestedObj.overallMatch === 'number' ? nestedObj.overallMatch : 
        null;
        
      // If score is still null or not a number between 0-100, assign a default
      if (score === null || typeof score !== 'number' || isNaN(score) || score < 0 || score > 100) {
        score = 50; // Default middle score
      }
      
      // Extract matched requirements - check multiple possible locations and formats
      let matchedRequirements = 
        Array.isArray(nestedObj.matchedRequirements) ? nestedObj.matchedRequirements : 
        Array.isArray(nestedObj.requirements) ? nestedObj.requirements.map((req: any) => ({
          requirement: req.requirement || req.name || req.text || "Requirement",
          matched: req.matched || req.isMatched || req.match === 'full' || req.match === true,
          confidence: typeof req.confidence === 'number' ? req.confidence : 0.5
        })) : 
        [];
      
      // If we still don't have requirements, create a default entry
      if (!matchedRequirements || matchedRequirements.length === 0) {
        matchedRequirements = [{
          requirement: "Resume evaluation requirement",
          matched: true,
          confidence: 0.5
        }];
      }
      
      console.log(`Extracted from Claude response: score=${score}, skills count=${skills.length}, requirements count=${matchedRequirements.length}`);
      
      // Return the extracted data
      return {
        skills: Array.isArray(skills) ? skills : [],
        experience: typeof experience === 'string' ? experience : "Experience extracted from resume",
        education: typeof education === 'string' ? education : "Education extracted from resume",
        score: score,
        matchedRequirements: matchedRequirements,
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