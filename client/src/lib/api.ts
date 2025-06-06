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

export async function getResumes(page = 1, pageSize = 1000): Promise<{
  resumes: Resume[],
  pagination: {
    page: number,
    pageSize: number,
    total: number,
    totalPages: number
  }
}> {
  const response = await fetch(`/api/resumes?page=${page}&limit=${pageSize}`, {
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
  
  const responseData = await response.json();
  console.log('API response data structure:', responseData);
  
  // Check if response has a nested 'resume' property (common pattern)
  if (responseData && responseData.resume) {
    return responseData.resume;
  }
  
  return responseData;
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
  // Add timestamp to prevent browser caching
  const timestamp = Date.now();
  
  const url = jobDescriptionId 
    ? `/api/resumes/${resumeId}/red-flag-analysis?jobDescriptionId=${encodeURIComponent(jobDescriptionId)}&_t=${timestamp}`
    : `/api/resumes/${resumeId}/red-flag-analysis?_t=${timestamp}`;
    
  const response = await fetch(url, {
    credentials: "include",
    // Add cache control headers to prevent caching
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
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
  force: boolean = false,
  skipExisting: boolean = false
): Promise<{results: AnalysisResult[], skippedCount?: number, alreadyAnalyzedIds?: string[]}> {
  // If skipExisting is true, we need to filter out resumeIds that already have analysis
  let resumesToProcess = [...resumeIds];
  let analyzedResumeIds: string[] = [];
  
  if (skipExisting && !force) {
    // Get existing scores for this job
    const existingScores = await getResumeScoresForJob(jobDescriptionId);
    if (existingScores?.scores?.length > 0) {
      // Get the IDs of resumes that already have scores
      analyzedResumeIds = existingScores.scores.map(score => score.resumeId);
      // Filter out resumes that already have scores
      resumesToProcess = resumeIds.filter(id => !analyzedResumeIds.includes(id));
    }
  }
  
  // If all resumes have been analyzed, return an empty result
  if (resumesToProcess.length === 0) {
    return { 
      results: [],
      skippedCount: analyzedResumeIds.length,
      alreadyAnalyzedIds: analyzedResumeIds
    };
  }
  
  const response = await apiRequest("POST", "/api/analyze", {
    jobDescriptionId,
    resumeIds: resumesToProcess,
    force,
    startProcessing: true  // Explicitly start batch processing
  });
  
  const data = await response.json();
  return {
    ...data,
    skippedCount: resumeIds.length - resumesToProcess.length,
    alreadyAnalyzedIds: analyzedResumeIds
  };
}

// Get resume scores for a specific job (used to check which resumes already have analysis)
export async function getResumeScoresForJob(jobDescriptionId: string): Promise<{scores: Array<{resumeId: string, score: number}>}> {
  const response = await apiRequest("GET", `/api/job-descriptions/${jobDescriptionId}/resume-scores`);
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
  batchSize: number = 50,
  processAll: boolean = false
): Promise<{
  message: string;
  pendingCount: number;
  processingCount: number;
  resumeIds: string[];
  totalUnanalyzed?: number;
}> {
  try {
    const response = await apiRequest("POST", "/api/admin/batch-process-unprocessed", {
      jobDescriptionId,
      batchSize,
      processAll,
      startProcessing: true  // Explicitly start batch processing
    });
    
    if (!response.ok) {
      throw new Error(`Error finding unanalyzed resumes: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error("Error in analyzeUnanalyzedResumes:", error);
    // Return a safe fallback
    return {
      message: "Failed to find unanalyzed resumes",
      pendingCount: 0,
      processingCount: 0,
      resumeIds: []
    };
  }
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
function processScoreData(data: any): { 
  [resumeId: string]: { 
    score: number, 
    matchedAt: Date,
    skills?: string[],
    currentPosition?: { title: string, company: string } | null,
    redFlags?: string[],
    parsingStatus?: string,
    parsedJson?: any
  } 
} {
  // Check if data is valid
  if (!data || typeof data !== 'object') {
    console.error('Invalid score data received:', data);
    return {};
  }
  
  // Convert strings to Date objects
  const processed: { 
    [resumeId: string]: { 
      score: number, 
      matchedAt: Date,
      skills?: string[],
      currentPosition?: { title: string, company: string } | null,
      redFlags?: string[],
      parsingStatus?: string,
      parsedJson?: any
    } 
  } = {};
  
  console.log("Processing score data:", data);
  const sampleScore = data.scores && data.scores[0];
  if (sampleScore) {
    console.log("Sample score for debugging:", sampleScore);
  }
  
  // Handle the enhanced data format where scores is an array in the response
  if (data.scores && Array.isArray(data.scores)) {
    // Process the scores array format (new API format)
    for (const score of data.scores) {
      if (score && score.resumeId && score.score !== undefined) {
        processed[score.resumeId] = {
          score: typeof score.score === 'number' ? score.score : parseInt(score.score),
          matchedAt: score.matchedAt ? new Date(score.matchedAt) : new Date(),
          skills: Array.isArray(score.skills) ? score.skills : [],
          currentPosition: score.currentPosition || null,
          redFlags: Array.isArray(score.redFlags) ? score.redFlags : [],
          parsingStatus: score.parsingStatus || 'pending',
          parsedJson: score.parsedJson || null
        };
      }
    }
  } else {
    // Handle the old format for backward compatibility
    for (const [resumeId, scoreData] of Object.entries(data)) {
      if (scoreData && typeof scoreData === 'object' && 'score' in scoreData && 'matchedAt' in scoreData) {
        processed[resumeId] = {
          score: (scoreData as any).score,
          matchedAt: new Date((scoreData as any).matchedAt)
        };
      }
    }
  }
  
  console.log("Scores for current set of resumes:", processed);
  console.log("Loaded", Object.keys(processed).length, "scores for job", data.scores?.[0]?.jobDescriptionId);
  
  return processed;
}

export async function getResumeScores(
  resumeIds: string | string[] | null, 
  jobDescriptionId?: string, 
  onlyExistingScores: boolean = false
): Promise<{
  [resumeId: string]: { score: number, matchedAt: Date }
}> {
  try {
    // If no jobDescriptionId is provided, return empty result
    if (!jobDescriptionId) {
      console.log('No jobDescriptionId provided, skipping score fetch');
      return {};
    }
    
    const url = `/api/job-descriptions/${jobDescriptionId}/resume-scores`;
    
    // Optimization: If onlyExistingScores is true, don't send any resumeIds
    // This improves performance by only fetching scores that already exist
    if (onlyExistingScores) {
      console.log(`Getting only existing scores for job ${jobDescriptionId}`);
      console.time('getExistingScores');
      
      // Use GET for the existing scores endpoint
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });
      
      console.timeEnd('getExistingScores');
      
      if (!response.ok) {
        console.error("Resume scores API error:", response.status, response.statusText);
        throw new Error(`Failed to fetch resume scores: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return processScoreData(data);
    }
    
    // Regular flow for specific resume IDs
    const resumeIdsArray = !resumeIds ? [] : (Array.isArray(resumeIds) ? resumeIds : [resumeIds]);
    
    console.log(`Fetching scores for ${resumeIdsArray.length} resumes and job ${jobDescriptionId}`);
    
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

/**
 * Get parsed analysis data for a resume from the database
 * This uses the same data source as the candidates table view
 * 
 * @param resumeId The resume ID to get analysis data for
 * @param jobId Optional job ID to get job-specific analysis
 * @returns The parsed analysis data including skills, work history, red flags, etc.
 */
export async function getParsedAnalysisData(resumeId: string, jobId?: string): Promise<any> {
  let url = `/api/resumes/${resumeId}/parsed-analysis`;
  
  // Add job ID as a query parameter if provided
  if (jobId) {
    url += `?jobId=${jobId}`;
  }
  
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    // Add cache control headers to prevent caching
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });

  if (!response.ok) {
    throw new Error(`Error fetching parsed analysis data: ${response.status}`);
  }

  return response.json();
}

/**
 * Get raw AI response for a specific resume and job
 * 
 * @param resumeId The resume ID
 * @param jobDescriptionId The job description ID
 * @returns The raw AI response data from the analysis
 */
export async function getRawAIResponse(resumeId: string, jobDescriptionId?: string): Promise<any> {
  let url = `/api/resumes/${resumeId}/raw-response`;
  
  // Add job ID as a query parameter if provided
  if (jobDescriptionId) {
    url += `?jobDescriptionId=${jobDescriptionId}`;
  }
  
  const response = await fetch(url, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Error fetching raw AI response: ${response.status}`);
  }

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

export async function processRawAnalysisForJob(jobDescriptionId: string, force: boolean = true): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  const response = await apiRequest("POST", `/api/job-descriptions/${jobDescriptionId}/process-raw-analysis`, {
    force
  });
  return response.json();
}

/**
 * Sync individual parsed fields from parsedJson for a specific job
 * This extracts data from the parsedJson field into individual fields:
 * - parsedSkills from parsedJson.skills
 * - parsedWorkHistory from parsedJson.workHistory
 * - parsedRedFlags from parsedJson.redFlags
 * - parsedSummary from parsedJson.summary
 */
export async function syncParsedFieldsFromJson(jobDescriptionId: string): Promise<{
  updated: number;
  skipped: number;
  total: number;
  message: string;
}> {
  const response = await apiRequest("POST", `/api/sync-parsed-fields/${jobDescriptionId}`, {});
  return response.json();
}

/**
 * Use enhanced parser to handle multiple field name variations
 * This uses an improved parser that can extract data from various field names:
 * - Skills from: skills, Skills, skill_list, etc.
 * - Work History from: workHistory, work_history, Work History, employment_history, etc.
 * - Red Flags from: redFlags, red_flags, Red Flags, warnings, etc.
 * - Summary from: summary, Summary, overview, etc.
 */
export async function useEnhancedParser(jobDescriptionId: string): Promise<{
  extractedCount: number;
  syncedCount: number;
  message: string;
}> {
  try {
    // Step 1: Use the existing reprocess-job endpoint to extract data with field name variations
    console.log(`Using enhanced parser for job ${jobDescriptionId}`);
    
    const extractResponse = await fetch(`/api/reprocess-job/${jobDescriptionId}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        limit: 100,
        force: true,
        useEnhancedParser: true  // Add flag to use enhanced parser
      })
    });
    
    if (!extractResponse.ok) {
      console.error("Enhanced parser extraction failed:", await extractResponse.text());
      throw new Error(`Failed to extract structured data with enhanced parser (${extractResponse.status})`);
    }
    
    // Step 2: Sync extracted data to individual fields 
    const syncResponse = await fetch(`/api/sync-parsed-fields/${jobDescriptionId}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    
    if (!syncResponse.ok) {
      console.error("Enhanced parser sync failed:", await syncResponse.text());
      throw new Error(`Failed to sync extracted structured data to individual fields (${syncResponse.status})`);
    }
    
    const extractResult = await extractResponse.json();
    const syncResult = await syncResponse.json();
    
    return {
      extractedCount: extractResult.processed || 0,
      syncedCount: syncResult.updated || 0,
      message: `Enhanced parser processed ${extractResult.processed || 0} records and synced ${syncResult.updated || 0} records`
    };
  } catch (error) {
    console.error("Enhanced parser error:", error);
    throw error;
  }
}