import OpenAI from "openai";
import { isAnthropicApiKeyAvailable, analyzeResumeWithClaude } from "./anthropicService";

// Create OpenAI client with API key from environment variables
// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

// Analyze job description to extract requirements
export async function analyzeJobDescription(jobDescription: string): Promise<{
  requirements: Array<{
    requirement: string;
    importance: 'Required' | 'Preferred' | 'Nice to have';
    tags: string[];
  }>;
}> {
  try {
    // Using gpt-4o-mini as requested by the user - more cost-effective while still providing good analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert recruiter AI that analyzes job descriptions to extract key requirements. " +
            "Extract skills, experience levels, education requirements, and other important qualifications."
        },
        {
          role: "user",
          content: 
            `Please analyze this job description and identify the key requirements. For each requirement, determine if it's "Required", "Preferred", or "Nice to have" and add relevant tags.\n\n` +
            `Return results in the following JSON format:\n{"requirements": [{"requirement": "string", "importance": "Required|Preferred|Nice to have", "tags": ["tag1", "tag2"]}]}\n\n` +
            `Here's the job description:\n${jobDescription}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"requirements": []}');
    return result;
  } catch (error) {
    console.error('Error analyzing job description:', error);
    throw new Error('Failed to analyze job description with AI');
  }
}

// Compare resume against job requirements
export async function analyzeResume(
  resumeText: string, 
  jobDescription: string, 
  requirements: Array<{
    requirement: string;
    importance: string;
    tags: string[];
  }>
): Promise<{
  overallScore: number;
  skillMatches: Array<{
    requirement: string;
    match: 'full' | 'partial' | 'none';
    confidence: number;
    evidence?: string;
  }>;
  candidateName?: string;
  candidateTitle?: string;
}> {
  try {
    // First try to use Claude if available
    if (isAnthropicApiKeyAvailable()) {
      try {
        console.log("Using Claude for resume analysis");
        const claudeResult = await analyzeResumeWithClaude(resumeText, jobDescription);
        
        // Convert Claude's output format to our expected output format
        const skillMatches = claudeResult.matchedRequirements.map(item => ({
          requirement: item.requirement,
          match: item.matched ? 'full' : 'partial',
          confidence: item.confidence,
          evidence: claudeResult.experience // Use experience as evidence
        }));
        
        // Extract candidate name (basic approach)
        const possibleName = resumeText.split('\n')[0].trim();
        const candidateName = possibleName.length < 30 ? possibleName : undefined;
        
        return {
          overallScore: claudeResult.score,
          skillMatches,
          candidateName,
          candidateTitle: claudeResult.skills.join(', ') // Use skills as a fallback for title
        };
      } catch (error) {
        console.error("Error using Claude for resume analysis, falling back to OpenAI:", error);
        // Continue to OpenAI fallback
      }
    }
    
    // Fallback to OpenAI
    const requirementsText = requirements
      .map(r => `- ${r.requirement} (${r.importance})`)
      .join('\n');

    // Using gpt-4o-mini as requested by the user - more cost-effective while still providing good analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert recruiter AI that analyzes resumes against job requirements. " +
            "Provide an objective assessment of how well a candidate's resume matches specific job requirements."
        },
        {
          role: "user",
          content:
            `Please analyze this resume against the following job requirements:\n\n` +
            `JOB DESCRIPTION:\n${jobDescription}\n\n` +
            `SPECIFIC REQUIREMENTS:\n${requirementsText}\n\n` +
            `RESUME:\n${resumeText}\n\n` +
            `Provide the candidate's name and job title if you can identify them. Then evaluate each requirement with a match level (full, partial, none), confidence score (0-1), and evidence from the resume.\n\n` +
            `Calculate an overall match score (0-100) based on requirements importance and match level.\n\n` +
            `Return in the following JSON format:\n` +
            `{"candidateName": "string", "candidateTitle": "string", "overallScore": number, "skillMatches": [{"requirement": "string", "match": "full|partial|none", "confidence": number, "evidence": "string"}]}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"overallScore": 0, "skillMatches": []}');
    return result;
  } catch (error) {
    console.error('Error analyzing resume:', error);
    throw new Error('Failed to analyze resume with AI');
  }
}

// Generate prompts for custom analysis
export async function generateCustomPrompt(
  jobDescription: string,
  requirements: string,
  customInstructions: string
): Promise<string> {
  try {
    // Using gpt-4o-mini as requested by the user - more cost-effective while still providing good analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating effective prompts for AI-based resume analysis."
        },
        {
          role: "user",
          content:
            `Based on this job description and requirements, create a customized analysis prompt that incorporates these special instructions.\n\n` +
            `JOB DESCRIPTION:\n${jobDescription}\n\n` +
            `REQUIREMENTS:\n${requirements}\n\n` +
            `CUSTOM INSTRUCTIONS:\n${customInstructions}\n\n` +
            `Generate a prompt that would be effective for an AI to use when analyzing resumes against this job.`
        }
      ]
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating custom prompt:', error);
    throw new Error('Failed to generate custom analysis prompt');
  }
}
