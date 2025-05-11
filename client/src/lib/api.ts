import { apiRequest } from "./queryClient";
import { 
  JobDescription, 
  JobRequirement, 
  Resume,
  AnalysisResult,
  CandidateJobConnection
} from "@shared/schema";
import { EnrichedAnalysisResult } from "@/types";

// Job Description API
export async function uploadJobDescription(file: File): Promise<JobDescription> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch("/api/job-descriptions", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload job description: ${error}`);
  }
  
  return response.json();
}

export async function getJobDescriptions(): Promise<JobDescription[]> {
  const response = await fetch("/api/job-descriptions", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch job descriptions");
  }
  
  return response.json();
}

export async function getJobDescription(id: string): Promise<JobDescription> {
  const response = await fetch(`/api/job-descriptions/${id}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch job description");
  }
  
  return response.json();
}

export async function deleteJobDescription(id: string): Promise<void> {
  const response = await apiRequest("DELETE", `/api/job-descriptions/${id}`);
  return;
}

// Job Requirements API
export async function getJobRequirements(jobDescriptionId: string): Promise<JobRequirement[]> {
  const response = await fetch(`/api/job-descriptions/${jobDescriptionId}/requirements`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch job requirements");
  }
  
  return response.json();
}

export async function analyzeJobRequirements(jobDescriptionId: string): Promise<{requirements: JobRequirement[]}> {
  const response = await apiRequest("POST", `/api/job-descriptions/${jobDescriptionId}/analyze-requirements`);
  return response.json();
}

export async function updateJobRequirement(
  id: string, 
  data: {
    requirement?: string;
    importance?: string;
    tags?: string[];
  }
): Promise<JobRequirement> {
  const response = await apiRequest("PUT", `/api/job-requirements/${id}`, data);
  return response.json();
}

export async function deleteJobRequirement(id: string): Promise<void> {
  const response = await apiRequest("DELETE", `/api/job-requirements/${id}`);
  return;
}

// Resume API
export async function uploadResume(file: File): Promise<Resume> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch("/api/resumes", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload resume: ${error}`);
  }
  
  return response.json();
}

// Multi-file resume upload API
export async function uploadMultipleResumes(files: File[]): Promise<Resume[]> {
  // We'll make sequential calls to keep the backend simple
  const results: Resume[] = [];
  
  for (const file of files) {
    try {
      const resume = await uploadResume(file);
      results.push(resume);
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  if (results.length === 0 && files.length > 0) {
    throw new Error("Failed to upload any resumes");
  }
  
  return results;
}

export async function getResumes(): Promise<Resume[]> {
  const response = await fetch("/api/resumes", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch resumes");
  }
  
  return response.json();
}

export async function getResume(id: string): Promise<Resume> {
  const response = await fetch(`/api/resumes/${id}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch resume");
  }
  
  return response.json();
}

export async function getResumeAnalysis(id: string): Promise<{
  skills: string[];
  workHistory: Array<{
    title: string;
    company: string;
    period: string;
    description: string;
  }>;
  resumeId: string;
}> {
  const response = await fetch(`/api/resumes/${id}/analysis`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to analyze resume");
  }
  
  return response.json();
}

export async function deleteResume(id: string): Promise<void> {
  const response = await apiRequest("DELETE", `/api/resumes/${id}`);
  return;
}

// Analysis API
export async function analyzeResumes(
  jobDescriptionId: string, 
  resumeIds: string[]
): Promise<{results: AnalysisResult[]}> {
  const response = await apiRequest("POST", "/api/analyze", {
    jobDescriptionId,
    resumeIds,
  });
  
  return response.json();
}

export async function getAnalysisResults(jobDescriptionId: string): Promise<EnrichedAnalysisResult[]> {
  const response = await fetch(`/api/job-descriptions/${jobDescriptionId}/results`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch analysis results");
  }
  
  return response.json();
}

export async function getResumeScores(resumeIds: string[], jobDescriptionId: string): Promise<{
  [resumeId: string]: { score: number, matchedAt: Date }
}> {
  const response = await fetch(`/api/job-descriptions/${jobDescriptionId}/resume-scores?${
    resumeIds.map(id => `resumeId=${encodeURIComponent(id)}`).join('&')
  }`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch resume scores");
  }
  
  return response.json();
}

// Custom Prompt API
export async function generateCustomPrompt(
  jobDescriptionId: string, 
  customInstructions: string
): Promise<{prompt: string}> {
  const response = await apiRequest("POST", "/api/custom-prompt", {
    jobDescriptionId,
    customInstructions,
  });
  
  return response.json();
}

// Check if OpenAI API key is properly configured
export async function checkAIServiceStatus(): Promise<{available: boolean, message: string}> {
  try {
    const response = await fetch("/api/ai-status", {
      credentials: "include",
    });
    
    if (!response.ok) {
      return { available: false, message: "AI service is not properly configured" };
    }
    
    return response.json();
  } catch (error) {
    return { available: false, message: "Could not connect to AI service" };
  }
}

// Candidate-Job Connection APIs
export async function getCandidateJobConnections(resumeId: string): Promise<CandidateJobConnection[]> {
  const response = await fetch(`/api/resumes/${resumeId}/job-connections`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch job connections");
  }
  
  return response.json();
}

export async function getJobCandidates(jobDescriptionId: string): Promise<{
  connection: CandidateJobConnection;
  resume: Resume;
}[]> {
  const response = await fetch(`/api/job-descriptions/${jobDescriptionId}/candidates`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch candidates for job");
  }
  
  return response.json();
}

export async function createCandidateJobConnection(data: {
  resumeId: string;
  jobDescriptionId: string;
  status?: string;
  notes?: string;
}): Promise<CandidateJobConnection> {
  const response = await apiRequest("POST", "/api/candidate-connections", data);
  return response.json();
}

export async function updateCandidateJobConnection(
  id: string,
  data: {
    status?: string;
    notes?: string;
  }
): Promise<CandidateJobConnection> {
  const response = await apiRequest("PUT", `/api/candidate-connections/${id}`, data);
  return response.json();
}

export async function deleteCandidateJobConnection(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/candidate-connections/${id}`);
  return;
}
