import { apiRequest } from "./queryClient";
import { 
  JobDescription, 
  JobRequirement, 
  Resume,
  AnalysisResult,
  CandidateJobConnection
} from "@shared/schema";
import { EnrichedAnalysisResult } from "@/types";

// Define RedFlagAnalysis type
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
  currentCompany?: string;
}

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
    throw new Error("Failed to upload job description");
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

export async function getJobDescription(id: string): Promise<JobDescription & { requirements: JobRequirement[] }> {
  const response = await fetch(`/api/job-descriptions/${id}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch job description");
  }
  
  const jobDescription = await response.json();
  
  // Fetch requirements for this job description
  const requirementsResponse = await fetch(`/api/job-descriptions/${id}/requirements`, {
    credentials: "include",
  });
  
  if (!requirementsResponse.ok) {
    throw new Error("Failed to fetch job requirements");
  }
  
  const requirements = await requirementsResponse.json();
  
  return {
    ...jobDescription,
    requirements,
  };
}

export async function getJobRequirements(jobDescriptionId: string): Promise<JobRequirement[]> {
  const response = await fetch(`/api/job-descriptions/${jobDescriptionId}/requirements`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch job requirements");
  }
  
  return response.json();
}

export async function deleteJobDescription(id: string): Promise<void> {
  const response = await apiRequest("DELETE", `/api/job-descriptions/${id}`);
  return;
}

export async function analyzeJobDescription(id: string): Promise<JobRequirement[]> {
  const response = await apiRequest("POST", `/api/job-descriptions/${id}/analyze`);
  
  if (!response.ok) {
    throw new Error("Failed to analyze job description");
  }
  
  return response.json();
}

export async function analyzeJobRequirements(
  jobDescriptionId: string,
  requirements: { requirement: string; importance: string; tags: string[] }[]
): Promise<JobRequirement[]> {
  const response = await apiRequest("POST", `/api/job-descriptions/${jobDescriptionId}/requirements`, {
    requirements,
  });
  
  if (!response.ok) {
    throw new Error("Failed to analyze job requirements");
  }
  
  return response.json();
}

export async function updateJobRequirement(id: string, data: {
  requirement: string;
  importance: string;
  tags: string[];
}): Promise<JobRequirement> {
  const response = await apiRequest("PUT", `/api/job-requirements/${id}`, data);
  
  if (!response.ok) {
    throw new Error("Failed to update job requirement");
  }
  
  return response.json();
}

export async function deleteJobRequirement(id: string): Promise<void> {
  const response = await apiRequest("DELETE", `/api/job-requirements/${id}`);
  return;
}

// Resume API
export async function uploadResume(file: File, options?: { customName?: string }): Promise<Resume> {
  const formData = new FormData();
  formData.append("file", file);
  
  if (options?.customName) {
    formData.append("customName", options.customName);
  }
  
  const response = await fetch("/api/resumes", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to upload resume");
  }
  
  return response.json();
}

export async function uploadMultipleResumes(files: File[]): Promise<Resume[]> {
  // Using Promise.all to upload files in parallel
  try {
    const uploadPromises = files.map(file => uploadResume(file));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error("Error uploading multiple resumes:", error);
    throw new Error("Failed to upload one or more resumes");
  }
}

export async function getResumes(page = 1, pageSize = 50): Promise<{
  resumes: Resume[],
  pagination: {
    page: number,
    pageSize: number,
    total: number,
    totalPages: number
  }
}> {
  const response = await fetch(`/api/resumes?page=${page}&pageSize=${pageSize}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch resumes");
  }
  
  return response.json();
}

export async function getResume(id: string): Promise<Resume & { extractedText: string }> {
  const response = await fetch(`/api/resumes/${id}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch resume");
  }
  
  return response.json();
}

export async function updateResumeContactedStatus(id: string, contacted: boolean): Promise<Resume> {
  const response = await fetch(`/api/resumes/${id}/contacted`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ contacted }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update resume contacted status");
  }
  
  return response.json();
}

export async function getResumeAnalysis(
  id: string, 
  jobDescriptionId?: string,
  forceRerun: boolean = false
): Promise<{
  analysis: {
    skills: string[];
    experience: string;
    education: string;
    score: number;
    matchedRequirements: Array<{
      requirement: string;
      matched: boolean;
      confidence: number;
    }>;
  };
  rawResponse?: any;
  aiModel?: string;
  analysis_warning?: string;
}> {
  // Build URL based on whether jobDescriptionId is provided
  const baseUrl = `/api/resumes/${id}/analysis`;
  const url = jobDescriptionId 
    ? `${baseUrl}?jobDescriptionId=${jobDescriptionId}${forceRerun ? '&forceRerun=true' : ''}` 
    : `${baseUrl}${forceRerun ? '?forceRerun=true' : ''}`;
  const response = await fetch(url, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch resume analysis");
  }
  
  return response.json();
}

export async function getResumeRedFlagAnalysis(resumeId: string, jobDescriptionId?: string): Promise<{
  resumeId: string;
  jobDescriptionId: string | null;
  analysis: RedFlagAnalysis;
}> {
  const url = jobDescriptionId 
    ? `/api/resumes/${resumeId}/red-flag-analysis?jobDescriptionId=${encodeURIComponent(jobDescriptionId)}`
    : `/api/resumes/${resumeId}/red-flag-analysis`;
    
  const response = await fetch(url, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get resume red flag analysis");
  }
  
  return response.json();
}

export async function deleteResume(id: string): Promise<void> {
  const response = await apiRequest("DELETE", `/api/resumes/${id}`);
  return;
}

// Function to download resume file
export async function downloadResume(id: string): Promise<Blob> {
  const response = await fetch(`/api/resumes/${id}/download`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to download resume file");
  }
  
  return response.blob();
}

// Analysis API
export async function analyzeResumes(
  jobDescriptionId: string, 
  resumeIds: string[],
  force: boolean = false
): Promise<{results: AnalysisResult[]}> {
  const response = await apiRequest("POST", "/api/analyze", {
    jobDescriptionId,
    resumeIds,
    force,
    startProcessing: true  // Explicitly start batch processing
  });
  
  return response.json();
}

/**
 * Analyze a batch of unanalyzed resumes for a job
 * This will process up to the specified batch size (default 50) of resumes that
 * don't have existing analysis results for the specified job
 * 
 * @param jobDescriptionId The job description ID to analyze against
 * @param batchSize The maximum number of unanalyzed resumes to process (default: 50)
 * @returns The API response with batch processing details
 */
export async function analyzeUnanalyzedResumes(
  jobDescriptionId: string, 
  batchSize: number = 50
): Promise<{
  message: string;
  pendingCount: number;
  processingCount: number;
  resumeIds: string[];
}> {
  const response = await apiRequest("POST", "/api/admin/batch-process-unprocessed", {
    jobDescriptionId,
    batchSize,
    startProcessing: true  // Explicitly start batch processing
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

// Helper function to process score data with date conversion
function processScoreData(data: any): { [resumeId: string]: { score: number, matchedAt: Date } } {
  // Check if data is valid
  if (!data || typeof data !== 'object') {
    console.error('Invalid score data received:', data);
    return {};
  }
  
  // Convert strings to Date objects
  const processed: { [resumeId: string]: { score: number, matchedAt: Date } } = {};
  
  console.log("Processing score data:", data);
  
  for (const [resumeId, scoreData] of Object.entries(data)) {
    if (scoreData && typeof scoreData === 'object' && 'score' in scoreData && 'matchedAt' in scoreData) {
      processed[resumeId] = {
        score: (scoreData as any).score,
        matchedAt: new Date((scoreData as any).matchedAt)
      };
    }
  }
  
  return processed;
}

export async function getResumeScores(resumeIds: string | string[], jobDescriptionId?: string): Promise<{
  [resumeId: string]: { score: number, matchedAt: Date }
}> {
  try {
    // Ensure resumeIds is always an array
    const resumeIdsArray = Array.isArray(resumeIds) ? resumeIds : [resumeIds];
    
    console.log(`Fetching scores for ${resumeIdsArray.length} resumes and job ${jobDescriptionId}`);
    
    // If no jobDescriptionId is provided, return empty result
    if (!jobDescriptionId) {
      console.log('No jobDescriptionId provided, skipping score fetch');
      return {};
    }
    
    // Using POST endpoint to handle large numbers of resumeIds
    const url = `/api/job-descriptions/${jobDescriptionId}/resume-scores`;
    
    // For small batches (under 20 resumes), use GET for simplicity
    if (resumeIdsArray.length <= 20) {
      const queryString = resumeIdsArray.map((id: string) => `resumeId=${encodeURIComponent(id)}`).join('&');
      const getUrl = `${url}?${queryString}`;
      
      console.log("Using GET for small batch, URL:", getUrl);
      
      const response = await fetch(getUrl, {
        credentials: "include",
      });
      
      if (!response.ok) {
        console.error("Resume scores API error (GET):", response.status, response.statusText);
        throw new Error(`Failed to fetch resume scores: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return processScoreData(data);
    }
    
    // For larger batches, use POST to avoid URL length limitations
    console.log("Using POST for large batch of resumeIds (data loading only, not starting batch analysis)");
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ 
        resumeIds: resumeIdsArray,
        startProcessing: false // Explicitly prevent batch processing when just loading data
      }),
    });
    
    if (!response.ok) {
      console.error("Resume scores API error (POST):", response.status, response.statusText);
      throw new Error(`Failed to fetch resume scores: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processScoreData(data);
  } catch (error) {
    console.error("Error fetching scores:", error);
    return {};
  }
}

// Custom prompt API
export async function submitCustomPrompt(
  resumeId: string, 
  jobDescriptionId: string, 
  prompt: string
): Promise<{
  result: string;
}> {
  const response = await apiRequest("POST", "/api/custom-prompt", {
    resumeId,
    jobDescriptionId,
    prompt,
  });
  
  return response.json();
}

// AI Status API
export async function checkAIStatus(): Promise<{ available: boolean, message: string }> {
  try {
    const response = await fetch("/api/ai-status", {
      credentials: "include",
    });
    
    if (!response.ok) {
      return { available: false, message: "AI service is not available" };
    }
    
    return response.json();
  } catch (error) {
    console.error("Error checking AI status:", error);
    return { available: false, message: "Could not connect to AI service" };
  }
}

// Settings API
export interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSetting(key: string): Promise<Setting | null> {
  try {
    const response = await fetch(`/api/settings/${key}`, {
      credentials: "include",
    });
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error("Failed to fetch setting");
    }
    
    return response.json();
  } catch (error) {
    console.error("Error fetching setting:", error);
    return null;
  }
}

export async function getSettingsByCategory(category: string): Promise<Setting[]> {
  try {
    const response = await fetch(`/api/settings/category/${category}`, {
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch settings");
    }
    
    return response.json();
  } catch (error) {
    console.error("Error fetching settings:", error);
    return [];
  }
}

export async function saveSetting(key: string, value: string, category: string): Promise<Setting | null> {
  try {
    const response = await apiRequest("POST", "/api/settings", {
      key,
      value,
      category
    });
    
    if (!response.ok) {
      throw new Error("Failed to save setting");
    }
    
    return response.json();
  } catch (error) {
    console.error("Error saving setting:", error);
    return null;
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

export async function processRawAnalysisForJob(jobDescriptionId: string): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  const response = await apiRequest("POST", `/api/job-descriptions/${jobDescriptionId}/process-raw-analysis`);
  return response.json();
}