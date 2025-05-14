import OpenAI from "openai";
import { isAnthropicApiKeyAvailable, analyzeResumeWithClaude } from "./anthropicService";
import { storage } from "../storage";

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
    // Try to get model from settings
    let model = "gpt-4o-mini";  // Default model
    try {
      const modelSetting = await storage.getSetting('analysis_default_model');
      if (modelSetting?.value) {
        model = modelSetting.value;
        console.log(`Using custom model from settings for job description analysis: ${model}`);
      }
    } catch (error) {
      console.log("Error fetching model setting:", error);
      // Continue with default model if there's an error
    }
    
    // Using gpt-4o-mini as requested by the user - more cost-effective while still providing good analysis
    const response = await openai.chat.completions.create({
      model: model,
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
  rawResponse?: any;
  aiModel?: string;
}> {
  try {
    // First try to use Claude if available
    if (isAnthropicApiKeyAvailable()) {
      try {
        // We don't have access to candidate name here, so just log basic info
        console.log("Using Claude for resume analysis");
        console.log("Resume text length:", resumeText.length);
        console.log("Job description text length:", jobDescription.length);
        console.log("Requirements count:", requirements.length);
        
        const startTime = Date.now();
        const claudeResult = await analyzeResumeWithClaude(resumeText, jobDescription);
        const endTime = Date.now();
        
        console.log(`Claude analysis completed in ${(endTime - startTime) / 1000} seconds`);
        console.log("Claude score:", claudeResult.score);
        console.log("Matched requirements:", claudeResult.matchedRequirements.length);
        
        // Convert Claude's output format to our expected output format
        const skillMatches = claudeResult.matchedRequirements.map(item => ({
          requirement: item.requirement,
          match: item.matched ? ('full' as const) : ('partial' as const),
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
          candidateTitle: claudeResult.skills.join(', '), // Use skills as a fallback for title
          rawResponse: claudeResult,
          aiModel: "claude-3-7-sonnet-20250219"
        };
      } catch (error) {
        console.error("Error using Claude for resume analysis, falling back to OpenAI:", error);
        // Continue to OpenAI fallback
      }
    }
    
    // Fallback to OpenAI
    console.log("Falling back to OpenAI for resume analysis");
    const requirementsText = requirements
      .map(r => `- ${r.requirement} (${r.importance})`)
      .join('\n');

    console.log("Resume text length:", resumeText.length);
    console.log("Job description text length:", jobDescription.length);
    console.log("Requirements count:", requirements.length);
    
    // Try to get custom prompt from settings
    let customPrompt = null;
    try {
      const promptSetting = await storage.getSetting('analysis_prompt');
      if (promptSetting?.value) {
        customPrompt = promptSetting.value
          .replace('{JOB_DESCRIPTION}', jobDescription)
          .replace('{REQUIREMENTS}', requirementsText)
          .replace('{RESUME}', resumeText);
        console.log("Using custom analysis prompt from settings");
        
        // Add more detailed logging for debugging
        console.log("======= RESUME ANALYSIS DEBUG =======");
        console.log("Resume text snippet (first 150 chars):", resumeText.substring(0, 150));
        console.log("Resume text length:", resumeText.length);
        console.log("Job description snippet (first 150 chars):", jobDescription.substring(0, 150));
        console.log("Requirements count:", requirements.length);
        console.log("Custom prompt snippet (first 200 chars):", 
          customPrompt.substring(0, 200) + "...");
        console.log("====================================");
      }
    } catch (error) {
      console.log("Error fetching custom prompt:", error);
      // Continue with default prompt if there's an error
    }
    
    // Try to get model from settings
    let model = "gpt-4o-mini";  // Default model
    try {
      const modelSetting = await storage.getSetting('analysis_default_model');
      if (modelSetting?.value) {
        // Only use the model from settings if it's a valid OpenAI model
        // Avoid using Claude models with OpenAI
        if (!modelSetting.value.includes('claude')) {
          model = modelSetting.value;
          console.log(`Using custom model from settings: ${model}`);
        } else {
          console.log(`Ignoring Claude model for OpenAI: ${modelSetting.value}, using default ${model}`);
        }
      }
    } catch (error) {
      console.log("Error fetching model setting:", error);
      // Continue with default model if there's an error
    }
    
    console.log(`Using OpenAI ${model} for analysis`);
    const startTime = Date.now();
    
    // Using prompt either from settings or default
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: 
            "You are an expert recruiter AI that analyzes resumes against job requirements. " +
            "Provide an objective assessment of how well a candidate's resume matches specific job requirements."
        },
        {
          role: "user",
          content: customPrompt || 
            `Please analyze this resume against the following job requirements and return your analysis in JSON format:\n\n` +
            `JOB DESCRIPTION:\n${jobDescription}\n\n` +
            `SPECIFIC REQUIREMENTS:\n${requirementsText}\n\n` +
            `RESUME:\n${resumeText}\n\n` +
            `Provide the candidate's name and job title if you can identify them. Then evaluate each requirement with a match level (full, partial, none), confidence score (0-1), and evidence from the resume.\n\n` +
            `Calculate an overall match score (0-100) based on requirements importance and match level.\n\n` +
            `Return your analysis as JSON in the following format:\n` +
            `{"candidateName": "string", "candidateTitle": "string", "overallScore": number, "skillMatches": [{"requirement": "string", "match": "full|partial|none", "confidence": number, "evidence": "string"}]}`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const endTime = Date.now();
    console.log(`OpenAI analysis completed in ${(endTime - startTime) / 1000} seconds`);

    // Parse JSON response with robust error handling and default values
    let result;
    try {
      result = JSON.parse(response.choices[0].message.content || '{"overallScore": 0, "skillMatches": []}');
      
      // Ensure there's always a valid overallScore (this is a required field in the database)
      if (result.overallScore === undefined || result.overallScore === null || isNaN(result.overallScore)) {
        console.warn("OpenAI returned no score or invalid score, defaulting to 50");
        result.overallScore = 50; // Default to middle score if missing
      }
      
      // Ensure skillMatches is an array
      if (!Array.isArray(result.skillMatches)) {
        result.skillMatches = [];
      }
      
      console.log("OpenAI score:", result.overallScore);
      console.log("OpenAI skill matches:", result.skillMatches.length);
    } catch (error) {
      console.error("Failed to parse OpenAI response:", error);
      // Provide a valid fallback with required fields
      result = {
        overallScore: 50,
        skillMatches: [],
        candidateName: "Unknown",
        candidateTitle: "Unknown"
      };
    }
    
    // Store the raw response with more details for debugging
    const rawResponse = {
      model: model,
      rawText: response.choices[0].message.content,
      parsedJson: result,
      promptUsed: customPrompt || 'default prompt',
      responseMetadata: {
        finishReason: response.choices[0].finish_reason,
        completionTokens: response.usage?.completion_tokens,
        promptTokens: response.usage?.prompt_tokens
      }
    };
    
    // Return result with enhanced raw response and model info
    return {
      ...result,
      rawResponse: rawResponse,
      aiModel: model,
      // Pass through any analysis warning that might have been added during verification
      analysis_warning: result.analysis_warning
    };
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
