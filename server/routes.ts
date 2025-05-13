import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { WebSocketServer, WebSocket } from 'ws';
import {
  analyzeJobDescription,
  analyzeResume,
  generateCustomPrompt,
} from "./services/aiService";
import {
  extractTextFromFile,
  parseJobDescription,
  parseResume,
} from "./services/documentProcessor";
import {
  extractSkillsFromResume,
  extractWorkHistory,
  analyzeRedFlags,
  RedFlagAnalysis
} from "./services/skillsExtractor";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { isAnthropicApiKeyAvailable } from "./services/anthropicService";

// Define TextBlock interface for Anthropic responses
interface TextBlock {
  type: 'text';
  text: string;
}

// Type guard function to check if a block is a TextBlock
function isTextBlock(block: any): block is TextBlock {
  return block && 'type' in block && block.type === 'text' && 'text' in block;
}

import {
  analyzeRequirementsSchema,
  analyzeResumeSchema,
  insertJobDescriptionSchema,
  insertJobRequirementSchema,
  insertResumeSchema,
  updateRequirementSchema,
  insertCandidateJobConnectionSchema,
  JobDescription,
  JobRequirement,
  Resume
} from "@shared/schema";

// Configure multer for memory storage of uploaded files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Keep track of connected WebSocket clients
const clients = new Map<string, WebSocket>();

// Simplified function to check AI services availability
async function checkAIServicesAvailability() {
  const openaiAvailable = process.env.OPENAI_API_KEY?.length > 20;
  const anthropicAvailable = isAnthropicApiKeyAvailable();
  const mistralAvailable = process.env.MISTRAL_API_KEY?.length > 20;

  return {
    openai: openaiAvailable,
    anthropic: anthropicAvailable,
    mistral: mistralAvailable,
    anyServiceAvailable: openaiAvailable || anthropicAvailable || mistralAvailable
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server on the same server but different path from Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Function to broadcast WebSocket updates with timestamps and enhanced logging
  const broadcastUpdate = (data: any) => {
    // Add a timestamp to all events for debugging
    const dataWithTimestamp = {
      ...data,
      serverTimestamp: Date.now()
    };
    
    // Add more detailed logging for all batch analysis events
    if (['batchAnalysisStart', 'batchAnalysisProgress', 'batchAnalysisResumeStatus', 'batchAnalysisComplete'].includes(data.type)) {
      console.log(`\n📢 WEBSOCKET BROADCAST [${data.type}]:`, JSON.stringify(dataWithTimestamp));
    } else {
      console.log('Broadcasting update:', JSON.stringify(dataWithTimestamp).substring(0, 200));
    }
    
    let activeClients = 0;
    let failedClients = 0;
    
    // More detailed logging for progress updates
    if (data.type === 'batchAnalysisProgress') {
      console.log(`\n📊 Progress WebSocket: Processing ${data.current}/${data.total} (${data.progress}%) - ${data.candidateName}`);
    }
    
    // Convert Map to array to iterate over values
    Array.from(clients.values()).forEach((client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(dataWithTimestamp));
          activeClients++;
        } else {
          failedClients++;
        }
      } catch (err) {
        console.error('Error sending to client:', err);
        failedClients++;
      }
    });
    
    console.log(`Broadcast sent to ${activeClients} active clients (${failedClients} failed)`);
    
    // If this is a progress event, log additional details
    if (data.type === 'batchAnalysisProgress') {
      console.log(`Progress update: ${data.current}/${data.total} (${data.progress}%)`);
    }
  };
  
  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    const clientId = Date.now().toString();
    clients.set(clientId, ws);
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Send a test event immediately to validate connection
    try {
      // Send a dummy progress event for testing
      console.log(`Sending test event to client ${clientId}: {
  type: 'batchAnalysisProgress',
  jobId: 'test-job',
  current: 1,
  total: 10,
  progress: 10,
  resumeId: 'test-resume-id',
  candidateName: 'John Test Candidate',
  status: 'processing',
  message: 'Processing candidate: John Test Candidate (1 of 10)'
}`);
      
      ws.send(JSON.stringify({
        type: 'batchAnalysisProgress',
        jobId: 'test-job',
        current: 1,
        total: 10,
        progress: 10,
        resumeId: 'test-resume-id',
        candidateName: 'John Test Candidate',
        status: 'processing',
        message: 'Processing candidate: John Test Candidate (1 of 10)'
      }));
    } catch (e) {
      console.error('Error sending initial test message', e);
    }
    
    // Handle client disconnection
    ws.on('close', () => {
      console.log(`WebSocket client disconnected: ${clientId}`);
      clients.delete(clientId);
    });
    
    // Basic ping/pong for keeping connection alive
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        }
      } catch (e) {
        console.log('Non-JSON message received:', message.toString());
      }
    });
  });
  
  // Root endpoint to verify the API is running
  app.get("/api", (_req: Request, res: Response) => {
    res.json({ message: "Resume Analysis API v1.0" });
  });
  
  // Job Description CRUD endpoints
  
  // Get all job descriptions
  app.get("/api/job-descriptions", async (req: Request, res: Response) => {
    try {
      const jobDescriptions = await storage.getAllJobDescriptions();
      res.json(jobDescriptions);
    } catch (error) {
      console.error("Error fetching job descriptions:", error);
      res.status(500).json({ message: "Failed to fetch job descriptions" });
    }
  });
  
  // Get a specific job description by ID
  app.get("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      res.json(jobDescription);
    } catch (error) {
      console.error("Error fetching job description:", error);
      res.status(500).json({ message: "Failed to fetch job description" });
    }
  });
  
  // Create a new job description
  app.post(
    "/api/job-descriptions",
    upload.single("file"), // Handle uploaded file if provided
    async (req: Request, res: Response) => {
      try {
        // Get file content if provided
        let fileContent: string | undefined;
        let extractedText: string | undefined;
        
        if (req.file) {
          fileContent = req.file.buffer.toString("base64");
          
          // Extract text from the file
          try {
            extractedText = await extractTextFromFile(req.file.buffer);
            console.log("Extracted text from file, length:", extractedText.length);
          } catch (error) {
            console.error("Error extracting text from file:", error);
            return res.status(400).json({ message: "Failed to extract text from file" });
          }
        }
        
        // Use parsed text from file or text from request body
        const descriptionText = extractedText || req.body.description;
        
        // Require either file or description text
        if (!descriptionText) {
          return res.status(400).json({ message: "Description is required" });
        }
        
        // Use provided title or try to parse from text
        let title = req.body.title;
        let parsedData: { title?: string; company?: string; description?: string } = {};
        
        if (!title && descriptionText) {
          try {
            parsedData = await parseJobDescription(descriptionText);
            title = parsedData.title;
          } catch (error) {
            console.error("Error parsing job description:", error);
            // Continue with basic information
          }
        }
        
        // Validate the data
        const insertData = insertJobDescriptionSchema.parse({
          title: title || "Untitled Position",
          company: req.body.company || parsedData.company || null,
          description: descriptionText,
          fileContent: fileContent || null,
          fileName: req.file?.originalname || null,
          fileType: req.file?.mimetype || null,
        });
        
        const jobDescription = await storage.createJobDescription(insertData);
        
        // If we have a description, try to extract requirements
        if (jobDescription && jobDescription.description) {
          try {
            // Try to automatically extract requirements using AI
            const requirements = await analyzeJobDescription(jobDescription.description);
            
            // Save each requirement to the database
            for (const requirement of requirements.requirements) {
              try {
                await storage.createJobRequirement({
                  jobDescriptionId: jobDescription.id,
                  requirement: requirement.requirement,
                  importance: requirement.importance || "medium",
                  tags: requirement.tags || [],
                  category: requirement.category || null,
                });
              } catch (err) {
                console.error(`Error saving requirement: ${requirement.requirement}`, err);
              }
            }
          } catch (error) {
            console.error("Error extracting job requirements:", error);
            // Continue without requirements - user can add them manually
          }
        }
        
        res.status(201).json(jobDescription);
      } catch (error) {
        console.error("Error creating job description:", error);
        res.status(500).json({ message: "Failed to create job description" });
      }
    }
  );
  
  // Delete a job description
  app.delete("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteJobDescription(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Job description not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting job description:", error);
      res.status(500).json({ message: "Failed to delete job description" });
    }
  });
  
  // Job Requirements endpoints
  
  // Get requirements for a job description
  app.get("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const requirements = await storage.getJobRequirements(req.params.id);
      res.json(requirements);
    } catch (error) {
      console.error("Error fetching job requirements:", error);
      res.status(500).json({ message: "Failed to fetch job requirements" });
    }
  });
  
  // Add a requirement to a job description
  app.post("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const jobDescriptionId = req.params.id;
      
      // Make sure job description exists
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Validate the data
      const requirementData = insertJobRequirementSchema.parse({
        jobDescriptionId,
        requirement: req.body.requirement,
        importance: req.body.importance || "medium",
        tags: req.body.tags || [],
        category: req.body.category || null,
      });
      
      const requirement = await storage.createJobRequirement(requirementData);
      res.status(201).json(requirement);
    } catch (error) {
      console.error("Error creating requirement:", error);
      res.status(500).json({ message: "Failed to create requirement" });
    }
  });
  
  // Update a requirement
  app.patch("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      const requirementId = req.params.id;
      
      // Validate the data
      const updateData = updateRequirementSchema.parse(req.body);
      
      const requirement = await storage.updateJobRequirement(requirementId, updateData);
      if (!requirement) {
        return res.status(404).json({ message: "Requirement not found" });
      }
      
      res.json(requirement);
    } catch (error) {
      console.error("Error updating requirement:", error);
      res.status(500).json({ message: "Failed to update requirement" });
    }
  });
  
  // Delete a requirement
  app.delete("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteJobRequirement(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Requirement not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting requirement:", error);
      res.status(500).json({ message: "Failed to delete requirement" });
    }
  });
  
  // Analyze requirements from a job description
  app.post("/api/analyze-requirements", async (req: Request, res: Response) => {
    try {
      const { description } = analyzeRequirementsSchema.parse(req.body);
      
      // Extract requirements using AI
      const requirements = await analyzeJobDescription(description);
      
      res.json(requirements);
    } catch (error) {
      console.error("Error analyzing requirements:", error);
      res.status(500).json({ message: "Failed to analyze requirements" });
    }
  });
  
  // Resume CRUD endpoints
  
  // Get all resumes
  app.get("/api/resumes", async (req: Request, res: Response) => {
    try {
      const resumes = await storage.getAllResumes();
      res.json(resumes);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });
  
  // Get a specific resume by ID
  app.get("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.json(resume);
    } catch (error) {
      console.error("Error fetching resume:", error);
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });
  
  // Get red flag analysis for a resume
  app.get("/api/resumes/:id/red-flag-analysis", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Check if we already have an analysis result that we can extract data from
      let hasRelevantAnalysis = false;
      let allRequirements: string[] = [];
      let majorRedFlags: RedFlagAnalysis[] = [];
      
      // Try to get any analysis results for this resume
      const allAnalysisResults = await storage.getAnalysisResultsByResume(resume.id);
      
      if (allAnalysisResults && allAnalysisResults.length > 0) {
        // Use the most recent analysis result
        const latestAnalysis = allAnalysisResults[0];
        
        let rawData = null;
        try {
          if (latestAnalysis.rawResponse) {
            rawData = JSON.parse(latestAnalysis.rawResponse);
          }
        } catch (e) {
          console.error("Error parsing raw response:", e);
        }
        
        // Extract requirements if available
        if (latestAnalysis.skillMatches) {
          try {
            const skillMatches = JSON.parse(latestAnalysis.skillMatches);
            if (Array.isArray(skillMatches)) {
              allRequirements = skillMatches.map(match => match.requirement);
              hasRelevantAnalysis = true;
            }
          } catch (e) {
            console.error("Error parsing skill matches:", e);
          }
        }
      }
      
      // If we don't have existing analysis, analyze the resume text
      if (!hasRelevantAnalysis) {
        // Extract skills and work history
        allRequirements = await extractSkillsFromResume(resume.extractedText);
      }
      
      // Get red flags based on resume text
      majorRedFlags = await analyzeRedFlags(resume.extractedText);
      
      res.json({
        requirements: allRequirements,
        redFlags: majorRedFlags
      });
    } catch (error) {
      console.error("Error analyzing red flags:", error);
      res.status(500).json({ message: "Failed to analyze red flags" });
    }
  });
  
  // Mark a resume as contacted
  app.patch("/api/resumes/:id/contacted", async (req: Request, res: Response) => {
    try {
      const resumeId = req.params.id;
      const { contacted } = req.body;
      
      if (typeof contacted !== 'boolean') {
        return res.status(400).json({ message: "Contacted field must be a boolean" });
      }
      
      const resume = await storage.updateResume(resumeId, { 
        contacted, 
        contactedAt: contacted ? new Date() : null 
      });
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      res.json(resume);
    } catch (error) {
      console.error("Error updating resume contacted status:", error);
      res.status(500).json({ message: "Failed to update resume" });
    }
  });
  
  // Get analysis results for a specific resume
  app.get("/api/resumes/:id/analysis", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Get all analysis results for this resume
      const analysisResults = await storage.getAnalysisResultsByResume(resume.id);
      res.json(analysisResults);
    } catch (error) {
      console.error("Error fetching analysis results:", error);
      res.status(500).json({ message: "Failed to fetch analysis results" });
    }
  });
  
  // Create a new resume
  app.post(
    "/api/resumes",
    upload.single("file"), // Handle uploaded file if provided
    async (req: Request, res: Response) => {
      try {
        // Get file content if provided
        let fileContent: string | undefined;
        let extractedText: string | undefined;
        
        if (req.file) {
          fileContent = req.file.buffer.toString("base64");
          
          // Extract text from the file
          try {
            extractedText = await extractTextFromFile(req.file.buffer);
            console.log("Extracted text from file, length:", extractedText.length);
          } catch (error) {
            console.error("Error extracting text from file:", error);
            return res.status(400).json({ message: "Failed to extract text from file" });
          }
        }
        
        // Use parsed text from file or text from request body
        const resumeText = extractedText || req.body.text;
        
        // Require either file or resume text
        if (!resumeText) {
          return res.status(400).json({ message: "Resume text is required" });
        }
        
        // Use provided name or try to parse from text
        let candidateName = req.body.candidateName;
        let currentTitle = req.body.currentTitle;
        let currentCompany = req.body.currentCompany;
        
        if (!candidateName || !currentTitle) {
          try {
            const parsedData = await parseResume(resumeText);
            candidateName = candidateName || parsedData.name;
            currentTitle = currentTitle || parsedData.title;
            currentCompany = currentCompany || parsedData.company;
          } catch (error) {
            console.error("Error parsing resume:", error);
            // Continue with basic information
          }
        }
        
        // Validate the data
        const insertData = insertResumeSchema.parse({
          candidateName: candidateName || "Unknown Candidate",
          extractedText: resumeText,
          fileContent: fileContent || null,
          fileName: req.file?.originalname || null,
          fileType: req.file?.mimetype || null,
          currentTitle: currentTitle || null,
          currentCompany: currentCompany || null,
          contacted: false,
          contactedAt: null,
        });
        
        const resume = await storage.createResume(insertData);
        res.status(201).json(resume);
      } catch (error) {
        console.error("Error creating resume:", error);
        res.status(500).json({ message: "Failed to create resume" });
      }
    }
  );
  
  // Delete a resume
  app.delete("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteResume(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting resume:", error);
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });
  
  // Analyze a resume against a job description
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      // Validate request data
      const { resumeId, jobDescriptionId } = analyzeResumeSchema.parse(req.body);
      
      // Get resume
      const resume = await storage.getResume(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Get job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Get job requirements
      const requirements = await storage.getJobRequirements(jobDescriptionId);
      
      // Check for existing analysis
      const existingAnalysis = await storage.getAnalysisResultForResume(resumeId, jobDescriptionId);
      if (existingAnalysis) {
        // Return existing analysis instead of generating a new one
        return res.json({ 
          results: [existingAnalysis], 
          message: "Using existing analysis" 
        });
      }
      
      // Run job match analysis
      // Ensure that tags is never null before passing to analyzeResume
      const requirementsWithTags = requirements.map(req => ({
        requirement: req.requirement,
        importance: req.importance,
        tags: req.tags || [] // Convert null to empty array
      }));
      
      const analysisResult = await analyzeResume(
        resume.extractedText,
        jobDescription.description,
        requirementsWithTags
      );
      
      // Store analysis result
      const overallScore = 
        analysisResult.overallScore !== undefined && 
        analysisResult.overallScore !== null && 
        !isNaN(analysisResult.overallScore) 
          ? analysisResult.overallScore 
          : 50; // Default to middle score if missing
      
      const skillMatches = 
        Array.isArray(analysisResult.skillMatches) 
          ? JSON.stringify(analysisResult.skillMatches) 
          : JSON.stringify([]);
      
      const result = await storage.createAnalysisResult({
        resumeId,
        jobDescriptionId,
        overallScore,
        skillMatches,
        rawResponse: JSON.stringify(analysisResult.rawResponse || {}),
        aiModel: analysisResult.aiModel || 'unknown'
      });
      
      // Extract additional fields if not already present
      if (!resume.currentTitle && analysisResult.candidateTitle) {
        await storage.updateResume(resumeId, {
          currentTitle: analysisResult.candidateTitle
        });
      }
      
      res.json({ results: [result], message: "Analysis complete" });
    } catch (error) {
      console.error("Error analyzing resume:", error);
      res.status(500).json({ message: "Failed to analyze resume" });
    }
  });
  
  // Get resume scores for a job description (GET version for smaller batches)
  app.get("/api/job-descriptions/:id/resume-scores", async (req: Request, res: Response) => {
    try {
      const jobDescriptionId = req.params.id;
      const resumeIds = Array.isArray(req.query.resumeId) 
        ? req.query.resumeId as string[]
        : req.query.resumeId 
        ? [req.query.resumeId as string] 
        : [];
      
      // Validate input
      if (resumeIds.length === 0) {
        return res.status(400).json({ message: "No resume IDs provided in query parameters" });
      }
      
      console.log(`GET scores request for job ${jobDescriptionId} with ${resumeIds.length} resumes`);
      
      // Get job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Get analysis results for these resumes and this job
      const analysisResults = await storage.getAnalysisResultsByJob(jobDescriptionId);
      
      // Filter only for the requested resumes
      const filteredResults = analysisResults.filter(result => 
        resumeIds.includes(result.resumeId)
      );
      
      // Format the response to match the expected structure in the frontend
      const scoreMap: Record<string, { score: number, matchedAt: Date }> = {};
      
      filteredResults.forEach(result => {
        scoreMap[result.resumeId] = {
          score: result.overallScore,
          matchedAt: result.createdAt
        };
      });
      
      res.json(scoreMap);
    } catch (error) {
      console.error("Error processing resume scores GET request:", error);
      res.status(500).json({ message: "Internal server error processing resume scores" });
    }
  });

  // Get resume scores for a job description or analyze in bulk
  app.post("/api/job-descriptions/:id/resume-scores", async (req: Request, res: Response) => {
    try {
      const jobDescriptionId = req.params.id;
      const { resumeIds, limit } = req.body;
      
      // Validate input
      if (!Array.isArray(resumeIds) || resumeIds.length === 0) {
        return res.status(400).json({ message: "No resume IDs provided" });
      }
      
      // Apply limit if specified
      const actualLimit = limit ? parseInt(limit.toString()) : resumeIds.length;
      const limitedResumeIds = resumeIds.slice(0, actualLimit);
      
      console.log(`Processing scores request for job ${jobDescriptionId} with ${limitedResumeIds.length} resumes${limit ? ` (limited to ${actualLimit})` : ''}`);
      
      // Get job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Get job requirements
      const requirements = await storage.getJobRequirements(jobDescriptionId);
      
      // Filter out resumes that already have analysis results to avoid reprocessing
      const existingAnalysisMap = new Map();
      const existingAnalyses = await storage.getAnalysisResultsByJob(jobDescriptionId);
      
      // Create a map for faster lookups
      existingAnalyses.forEach(analysis => {
        existingAnalysisMap.set(analysis.resumeId, analysis);
      });
      
      // Filter to only include resumes without existing analysis
      const resumesToProcess = limitedResumeIds.filter(id => !existingAnalysisMap.has(id));
      
      console.log(`Found ${existingAnalyses.length} existing analyses; will process ${resumesToProcess.length} new resumes`);
      
      // Initialize results array for tracking
      const results = limitedResumeIds.map(id => ({
        id,
        status: existingAnalysisMap.has(id) ? 'complete' : 'queued',
        message: existingAnalysisMap.has(id) ? 'Analysis already exists' : 'Analysis queued'
      }));
      
      // Send initial response immediately
      res.json({ results });
      
      // Only process if there are new resumes to analyze
      if (resumesToProcess.length > 0) {
        // Process in background after sending initial response
        processBatchAnalysis(resumesToProcess, jobDescriptionId, jobDescription, requirements)
          .catch(error => {
            console.error("Fatal error in batch analysis:", error);
          });
      } else {
        console.log("No new resumes to process, skipping batch analysis");
      }
    } catch (error) {
      console.error("Error initiating batch analysis:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to initiate batch analysis" });
      }
    }
  });
  
  // Separate function to process batch analysis for better readability
  async function processBatchAnalysis(
    resumeIds: string[],
    jobDescriptionId: string,
    jobDescription: JobDescription,
    requirements: JobRequirement[]
  ): Promise<void> {
    // Track process timing for debugging
    const batchStartTime = Date.now();
    console.log(`🔍 [BATCH-DEBUG] Starting batch analysis at ${new Date().toISOString()}`);
    console.log(`🔍 [BATCH-DEBUG] Processing ${resumeIds.length} resumes...`);
    
    try {
      // Get all resumes first to have access to their names
      console.log(`🔍 [BATCH-DEBUG] Fetching resume data...`);
      const allResumes = await Promise.all(resumeIds.map(id => storage.getResume(id)));
      const validResumes = allResumes.filter(Boolean) as Resume[];
      console.log(`🔍 [BATCH-DEBUG] Found ${validResumes.length} valid resumes out of ${resumeIds.length} requested`);
      
      // Create list of candidate names for debugging
      const candidateNames = validResumes.map(resume => 
        resume?.candidateName || `Resume ${(resume?.id || '').substring(0, 8)}`
      );
      
      console.log(`🔍 [BATCH-DEBUG] Candidates to process: ${candidateNames.join(', ').substring(0, 200)}...`);
      
      // Create resume ID -> resume map for faster lookups
      const resumeMap = validResumes.reduce((map, resume) => {
        map.set(resume.id, resume);
        return map;
      }, new Map<string, Resume>());
      
      // Make a definitive list of resumes that will be processed (valid resumes only)
      const finalResumeIds = validResumes.map(resume => resume.id);
      const totalToProcess = finalResumeIds.length;
      
      // Send a progress update via WebSocket with detailed information
      console.log(`🔍 [BATCH-DEBUG] Broadcasting batch start event via WebSocket...`);
      broadcastUpdate({
        type: 'batchAnalysisStart',
        jobId: jobDescriptionId,
        total: totalToProcess,
        message: `Starting analysis for ${totalToProcess} resumes...`,
        resumeNames: candidateNames.slice(0, 5), // Only include first 5 names to avoid huge payloads
        debugInfo: {
          startTime: batchStartTime,
          serverTime: new Date().toISOString()
        }
      });
      
      // Track progress
      let completed = 0;
      let successful = 0;
      let failed = 0;
    
      // Process each resume sequentially (only valid ones)
      for (let i = 0; i < finalResumeIds.length; i++) {
        const resumeId = finalResumeIds[i];
        const resumeStartTime = Date.now();
        
        console.log(`\n🔍 [BATCH-DEBUG] === Processing resume ${i+1}/${totalToProcess} (${resumeId}) ===`);
        
        try {
          // Get the resume (using our map for efficiency)
          const resume = resumeMap.get(resumeId);
          
          if (!resume) {
            console.error(`🔍 [BATCH-DEBUG] Resume ${resumeId} not found in map, skipping`);
            
            // Send resume skip update
            broadcastUpdate({
              type: 'batchAnalysisResumeStatus',
              jobId: jobDescriptionId,
              resumeId,
              status: 'skipped',
              message: 'Resume not found',
              debugInfo: { 
                error: 'Resume not found or invalid',
                timeStamp: new Date().toISOString()
              }
            });
            
            failed++;
            continue;
          }
          
          const candidateName = resume.candidateName || 'Unknown candidate';
          console.log(`🔍 [BATCH-DEBUG] Processing candidate: ${candidateName}`);
          console.log(`🔍 [BATCH-DEBUG] Resume text length: ${resume.extractedText?.length || 0} characters`);
          
          // Create detailed progress event with candidate name and proper counts
          const progressEvent = {
            type: 'batchAnalysisProgress',
            jobId: jobDescriptionId,
            current: i + 1,
            total: totalToProcess,
            resumeId,
            candidateName: candidateName,
            status: 'processing',
            progress: Math.round(((i + 1) / totalToProcess) * 100),
            message: `Processing resume ${i+1}/${totalToProcess} - ${candidateName}...`,
            debugInfo: {
              startTime: resumeStartTime,
              serverTime: new Date().toISOString()
            }
          };
          
          console.log(`🔍 [BATCH-DEBUG] Broadcasting progress event for ${candidateName}`);
          
          // Send the progress update immediately
          broadcastUpdate(progressEvent);
          
          // Send a second update immediately after to ensure clients get the message
          console.log(`🔍 [BATCH-DEBUG] Broadcasting second progress event to ensure delivery`);
          broadcastUpdate({
            ...progressEvent,
            message: `Analyzing resume for ${candidateName} (${i+1}/${totalToProcess})...`
          });
          
          // Add another broadcast for analysis in progress
          setTimeout(() => {
            console.log(`🔍 [BATCH-DEBUG] Broadcasting AI analysis in progress event (from timeout)`);
            broadcastUpdate({
              ...progressEvent,
              message: `AI analyzing resume for ${candidateName}...`,
              status: 'analyzing'
            });
          }, 1000);
          
          console.log(`🔍 [BATCH-DEBUG] Starting AI analysis for ${candidateName}`);
          
          // Run job match analysis
          try {
            // Ensure that tags is never null before passing to analyzeResume
            const requirementsWithTags = requirements.map(req => ({
              requirement: req.requirement,
              importance: req.importance,
              tags: req.tags || [] // Convert null to empty array
            }));
            
            console.log(`🔍 [BATCH-DEBUG] Calling analyzeResume for ${candidateName} with ${requirementsWithTags.length} requirements`);
            console.time(`resume-analysis-${resumeId}`);
              
            const analysisResult = await analyzeResume(
              resume.extractedText,
              jobDescription.description,
              requirementsWithTags
            );
            
            console.timeEnd(`resume-analysis-${resumeId}`);
          
            // Store or update the analysis result
            const existingAnalysis = await storage.getAnalysisResultForResume(resumeId, jobDescriptionId);
            
            if (existingAnalysis) {
              // Ensure valid values when updating
              const overallScore = 
                analysisResult.overallScore !== undefined && 
                analysisResult.overallScore !== null && 
                !isNaN(analysisResult.overallScore) 
                  ? analysisResult.overallScore 
                  : 50; // Default to middle score if missing
              
              const skillMatches = 
                Array.isArray(analysisResult.skillMatches) 
                  ? JSON.stringify(analysisResult.skillMatches) 
                  : JSON.stringify([]);
              
              await storage.updateAnalysisResult(existingAnalysis.id, {
                overallScore: overallScore,
                skillMatches: skillMatches,
                rawResponse: JSON.stringify(analysisResult.rawResponse || {}),
                aiModel: analysisResult.aiModel || 'unknown'
              });
            } else {
              // Ensure we have valid values for database fields
              const overallScore = 
                analysisResult.overallScore !== undefined && 
                analysisResult.overallScore !== null && 
                !isNaN(analysisResult.overallScore) 
                  ? analysisResult.overallScore 
                  : 50; // Default to middle score if missing
              
              const skillMatches = 
                Array.isArray(analysisResult.skillMatches) 
                  ? JSON.stringify(analysisResult.skillMatches) 
                  : JSON.stringify([]);
                  
              await storage.createAnalysisResult({
                resumeId,
                jobDescriptionId,
                overallScore: overallScore,
                skillMatches: skillMatches,
                rawResponse: JSON.stringify(analysisResult.rawResponse || {}),
                aiModel: analysisResult.aiModel || 'unknown'
              });
            }
            
            // Extract additional fields if not already present
            if (!resume.currentTitle && analysisResult.candidateTitle) {
              await storage.updateResume(resumeId, {
                currentTitle: analysisResult.candidateTitle
              });
            }
            
            // Add a score entry to the mapping for the client to display
            console.log(`Successfully analyzed resume ${resumeId} with score ${analysisResult.overallScore}`);
            
            // Update batch stats
            successful++;
            
            // Send success status update
            broadcastUpdate({
              type: 'batchAnalysisResumeStatus',
              jobId: jobDescriptionId,
              resumeId,
              status: 'success',
              score: analysisResult.overallScore,
              candidateName,
              message: `Analysis complete - Score: ${analysisResult.overallScore}`,
              timestamp: new Date().toISOString()
            });
            
          } catch (analysisError) {
            // Handle errors in the inner analysis process
            console.error(`Error analyzing resume ${resumeId}:`, analysisError);
            
            // Send failure status
            broadcastUpdate({
              type: 'batchAnalysisResumeStatus',
              jobId: jobDescriptionId,
              resumeId,
              status: 'failed',
              message: `Analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`,
              timestamp: new Date().toISOString()
            });
          }
        } catch (resumeError) {
          // Handle errors in the resume processing (outer loop)
          console.error(`Error processing resume ${resumeId}:`, resumeError);
          failed++;
          
          broadcastUpdate({
            type: 'batchAnalysisResumeStatus',
            jobId: jobDescriptionId,
            resumeId,
            status: 'error',
            message: `Processing error: ${resumeError instanceof Error ? resumeError.message : 'Unknown error'}`,
            timestamp: new Date().toISOString()
          });
        }
        
        // Update completed count
        completed++;
        
        // Add 500ms delay between resumes to avoid rate limits and give UI time to update
        if (i < finalResumeIds.length - 1) {
          console.log(`🔍 [BATCH-DEBUG] Adding a small delay between resumes...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Update progress after each resume with the candidate name
        const completedCandidateName = candidateNames[i] || 'Unknown';
        
        // Send a progress update for overall batch
        const completionEvent = {
          type: 'batchAnalysisProgress',
          jobId: jobDescriptionId,
          current: completed,
          total: totalToProcess,
          resumeId,
          candidateName: completedCandidateName,
          status: 'completed',
          progress: Math.round((completed / totalToProcess) * 100),
          message: `Processed ${completed}/${totalToProcess} resumes (latest: ${completedCandidateName})`
        };
        
        // Send the update
        broadcastUpdate(completionEvent);
        
        // Send again after a small delay to ensure UI receives it
        setTimeout(() => {
          broadcastUpdate(completionEvent);
        }, 300);
      }
      
      // Create and send completion event via WebSocket
      const completeEvent = {
        type: 'batchAnalysisComplete',
        jobId: jobDescriptionId,
        total: totalToProcess,
        successful,
        failed,
        message: `Batch analysis complete. Successfully analyzed: ${successful}, Failed: ${failed}`
      };
      
      console.log("Sending batch completion event:", completeEvent);
      broadcastUpdate(completeEvent);
      
      // Send a final progress update to ensure UI shows 100%
      const finalProgressEvent = {
        type: 'batchAnalysisProgress',
        jobId: jobDescriptionId,
        current: totalToProcess,
        total: totalToProcess,
        progress: 100,
        message: `Completed analysis for all ${totalToProcess} resumes`,
        debugInfo: {
          totalTimeMs: Date.now() - batchStartTime,
          endTime: new Date().toISOString()
        }
      };
      
      // Delay the final progress update slightly to ensure proper sequencing
      setTimeout(() => {
        console.log(`🔍 [BATCH-DEBUG] Sending final progress update: ${totalToProcess}/${totalToProcess} complete`);
        broadcastUpdate(finalProgressEvent);
      }, 500);
      
      console.log(`🔍 [BATCH-DEBUG] Batch analysis complete in ${(Date.now() - batchStartTime) / 1000} seconds`);
      console.log(`🔍 [BATCH-DEBUG] Results: ${successful} successful, ${failed} failed`);
      
    } catch (mainBatchError) {
      // Handle any errors in the main batch processing
      console.error(`🔍 [BATCH-DEBUG] CRITICAL ERROR in batch processing:`, mainBatchError);
      
      // Notify clients of the batch failure
      broadcastUpdate({
        type: 'batchAnalysisError',
        jobId: jobDescriptionId, 
        error: mainBatchError instanceof Error ? mainBatchError.message : 'Unknown error in batch processing',
        message: 'Batch analysis failed due to a server error',
        timeStamp: Date.now()
      });
    }
  }

  // Candidate-Job Connection endpoints
  
  // Get all connections for a resume
  app.get("/api/resumes/:id/job-connections", async (req: Request, res: Response) => {
    try {
      const connections = await storage.getCandidateJobConnections({ resumeId: req.params.id });
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job connections" });
    }
  });

  // Get all candidates connected to a job
  app.get("/api/job-descriptions/:id/candidates", async (req: Request, res: Response) => {
    try {
      const connections = await storage.getCandidateJobConnections({ jobDescriptionId: req.params.id });
      
      // Fetch the full resume data for each connection
      const candidates = await Promise.all(
        connections.map(async (conn) => {
          const resume = await storage.getResume(conn.resumeId);
          return {
            connection: conn,
            resume
          };
        })
      );
      
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch candidates for job" });
    }
  });

  // Create a connection between resume and job
  app.post("/api/candidate-connections", async (req: Request, res: Response) => {
    try {
      const { resumeId, jobDescriptionId, status, notes } = req.body;
      
      // Validate the data
      const connectionData = insertCandidateJobConnectionSchema.parse({
        resumeId,
        jobDescriptionId,
        status: status || "pending",
        notes: notes || null
      });
      
      const connection = await storage.createCandidateJobConnection(connectionData);
      res.status(201).json(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      res.status(500).json({ message: "Failed to create connection", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update a connection
  app.put("/api/candidate-connections/:id", async (req: Request, res: Response) => {
    try {
      const { status, notes } = req.body;
      const connection = await storage.updateCandidateJobConnection(req.params.id, { status, notes });
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: "Failed to update connection" });
    }
  });

  // Delete a connection
  app.delete("/api/candidate-connections/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteCandidateJobConnection(req.params.id);
      
      if (!success) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // Test AI service
  app.post("/api/ai-test", async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }
      
      // First try Anthropic if available
      if (isAnthropicApiKeyAvailable()) {
        try {
          const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || "",
          });
          
          const response = await anthropic.messages.create({
            max_tokens: 300,
            model: "claude-3-haiku-20240307",
            messages: [{ role: "user", content: prompt }],
          });
          
          let responseText = "";
          
          if (response.content && Array.isArray(response.content)) {
            for (const block of response.content) {
              if (isTextBlock(block)) {
                responseText += block.text;
              }
            }
          }
          
          return res.json({ 
            message: "AI test successful",
            service: "Anthropic Claude",
            response: responseText || "No text response",
            model: response.model,
            usage: response.usage
          });
        } catch (error) {
          console.error("Error using Anthropic:", error);
          // Fall through to OpenAI
        }
      }
      
      // Fall back to OpenAI
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });
          
          const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
          });
          
          return res.json({
            message: "AI test successful",
            service: "OpenAI",
            response: response.choices[0]?.message?.content || "No response",
            model: response.model,
            usage: response.usage
          });
        } catch (error) {
          console.error("Error using OpenAI:", error);
          return res.status(500).json({ message: "Failed to test AI services", error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      // If no API keys are available
      return res.status(500).json({ message: "No AI services configured" });
    } catch (error) {
      console.error("Error testing AI service:", error);
      res.status(500).json({ message: "Failed to test AI service" });
    }
  });

  // Check AI service status
  app.get("/api/ai-status", async (_req: Request, res: Response) => {
    try {
      const status = await checkAIServicesAvailability();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to check AI status" });
    }
  });

  // Custom prompt endpoint
  app.post("/api/custom-prompt", async (req: Request, res: Response) => {
    try {
      const { prompt, extractedText, jobDescription, requirements } = req.body;
      
      if (!prompt || !extractedText || !jobDescription) {
        return res.status(400).json({ message: "Prompt, resume text, and job description are required" });
      }
      
      const result = await generateCustomPrompt(prompt, extractedText, jobDescription, requirements);
      res.json(result);
    } catch (error) {
      console.error("Error generating custom prompt:", error);
      res.status(500).json({ message: "Failed to generate custom prompt" });
    }
  });
  
  // Settings endpoints
  
  // Get a specific setting
  app.get("/api/settings/:key", async (req: Request, res: Response) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });
  
  // Get settings by category
  app.get("/api/settings/category/:category", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettingsByCategory(req.params.category);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  
  // Create or update a setting
  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const { key, value, category, description } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Key and value are required" });
      }
      
      const setting = await storage.upsertSetting({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        category: category || 'general',
        description: description || null
      });
      
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to save setting" });
    }
  });

  return httpServer;
}