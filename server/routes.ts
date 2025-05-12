import type { Express, Request, Response } from "express";
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
} from "@shared/schema";

// Configure multer for memory storage of uploaded files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server on the same HTTP server but at /ws path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Map<string, WebSocket>();
  
  // WebSocket connection handler
  wss.on('connection', (ws) => {
    // Generate a unique ID for this connection
    const clientId = Date.now().toString();
    clients.set(clientId, ws);
    
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Send welcome message
    const welcomeMessage = { type: 'info', message: 'Connected to Resume Analyzer WebSocket' };
    ws.send(JSON.stringify(welcomeMessage));
    
    // Send a test batch event immediately to verify connectivity 
    setTimeout(() => {
      try {
        const testEvent = { 
          type: 'batchAnalysisProgress', 
          jobId: 'test-job', 
          current: 1,
          total: 10, 
          progress: 10,
          message: 'Test websocket message' 
        };
        console.log(`Sending test event to client ${clientId}:`, testEvent);
        ws.send(JSON.stringify(testEvent));
      } catch (err) {
        console.error('Error sending test event:', err);
      }
    }, 2000);
    
    // Handle message from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message from client:', data);
        
        // Handle client registration for specific events
        if (data.type === 'register') {
          console.log(`Client ${clientId} registered for event: ${data.event}`);
          ws.send(JSON.stringify({ type: 'info', message: `Registered for ${data.event}` }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
  });
  
  // Helper function to broadcast updates to all connected clients
  const broadcastUpdate = (data: any) => {
    console.log('Broadcasting update:', JSON.stringify(data).substring(0, 200));
    let activeClients = 0;
    
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
        activeClients++;
      }
    });
    
    console.log(`Broadcast sent to ${activeClients} active clients`);
  };
  
  // API routes
  const apiRouter = app.route("/api");

  // Job Description endpoints
  app.get("/api/job-descriptions", async (req: Request, res: Response) => {
    try {
      const jobDescriptions = await storage.getAllJobDescriptions();
      res.json(jobDescriptions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job descriptions" });
    }
  });

  app.get("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      res.json(jobDescription);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job description" });
    }
  });

  app.post(
    "/api/job-descriptions",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Extract text from the uploaded file
        const extractedText = await extractTextFromFile(
          req.file.buffer,
          req.file.originalname
        );

        // Parse job description to get title and other metadata
        const { title, company, description } = parseJobDescription(extractedText);

        // Prepare job description data
        const jobDescriptionData = {
          title,
          company: company || null,
          description,
          rawContent: extractedText,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
        };

        // Validate data
        const validatedData = insertJobDescriptionSchema.parse(jobDescriptionData);

        // Save job description
        const savedJobDescription = await storage.createJobDescription(validatedData);

        res.status(201).json(savedJobDescription);
      } catch (error) {
        console.error("Error uploading job description:", error);
        res.status(500).json({
          message: "Failed to process job description",
          error: error.message,
        });
      }
    }
  );

  app.delete("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteJobDescription(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Job description not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete job description" });
    }
  });

  // Job Requirements endpoints
  app.get(
    "/api/job-descriptions/:id/requirements",
    async (req: Request, res: Response) => {
      try {
        const requirements = await storage.getJobRequirements(req.params.id);
        res.json(requirements);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch job requirements" });
      }
    }
  );

  app.post(
    "/api/job-descriptions/:id/analyze-requirements",
    async (req: Request, res: Response) => {
      try {
        const { jobDescriptionId } = analyzeRequirementsSchema.parse({
          jobDescriptionId: req.params.id,
        });

        // Get job description
        const jobDescription = await storage.getJobDescription(jobDescriptionId);
        if (!jobDescription) {
          return res
            .status(404)
            .json({ message: "Job description not found" });
        }

        // Analyze job description to extract requirements
        const analysisResult = await analyzeJobDescription(
          jobDescription.rawContent
        );

        // Save requirements to storage
        const savedRequirements = [];
        for (const req of analysisResult.requirements) {
          const requirementData = {
            jobDescriptionId,
            requirement: req.requirement,
            importance: req.importance,
            tags: req.tags,
          };

          const validatedData =
            insertJobRequirementSchema.parse(requirementData);
          const savedRequirement = await storage.createJobRequirement(
            validatedData
          );
          savedRequirements.push(savedRequirement);
        }

        res.json({ requirements: savedRequirements });
      } catch (error) {
        console.error("Error analyzing job requirements:", error);
        res.status(500).json({
          message: "Failed to analyze job requirements",
          error: error.message,
        });
      }
    }
  );

  app.put(
    "/api/job-requirements/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const updateData = updateRequirementSchema.parse({
          id,
          ...req.body,
        });

        const updatedRequirement = await storage.updateJobRequirement(
          id,
          updateData
        );
        if (!updatedRequirement) {
          return res.status(404).json({ message: "Requirement not found" });
        }

        res.json(updatedRequirement);
      } catch (error) {
        res.status(500).json({
          message: "Failed to update job requirement",
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/api/job-requirements/:id",
    async (req: Request, res: Response) => {
      try {
        const success = await storage.deleteJobRequirement(req.params.id);
        if (!success) {
          return res.status(404).json({ message: "Requirement not found" });
        }
        res.status(204).send();
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to delete job requirement" });
      }
    }
  );

  // Resume endpoints
  app.get("/api/resumes", async (req: Request, res: Response) => {
    try {
      const resumes = await storage.getAllResumes();
      res.json(resumes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  app.get("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.json(resume);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });
  
  // Update resume's "Contacted in Rippling" status
  app.patch("/api/resumes/:id/contacted", async (req: Request, res: Response) => {
    try {
      const resumeId = req.params.id;
      const { contacted } = req.body as { contacted: boolean };
      
      // Validate input
      if (typeof contacted !== 'boolean') {
        return res.status(400).json({ message: "Invalid input: 'contacted' must be a boolean" });
      }
      
      // Get current resume to ensure it exists
      const resume = await storage.getResume(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Update the resume
      const updatedResume = await storage.updateResume(resumeId, {
        contactedInRippling: contacted
      });
      
      res.json(updatedResume);
    } catch (error) {
      console.error("Error updating resume contacted status:", error);
      res.status(500).json({ message: "Error updating resume" });
    }
  });
  
  // Get resume basic analysis (skills and work history)
  app.get("/api/resumes/:id/analysis", async (req: Request, res: Response) => {
    try {
      // Check if job description ID is provided and valid
      const jobDescriptionId = req.query.jobDescriptionId as string;
      const forceRerun = req.query.forceRerun === 'true';
      
      // UUID validation regex
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (jobDescriptionId && isValidUUID.test(jobDescriptionId)) {
        // If job description ID is provided, delegate to resume-job analysis
        const resumeId = req.params.id;
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
        if (requirements.length === 0) {
          return res.status(400).json({
            message: "No requirements found. Please analyze the job description first."
          });
        }
        
        // Check if we have an existing analysis result
        const existingAnalysis = await storage.getAnalysisResultForResume(resumeId, jobDescriptionId);
        
        // Use existing analysis unless force rerun is requested
        if (existingAnalysis && !forceRerun) {
          return res.json({
            analysis: {
              skills: existingAnalysis.skillMatches.map(match => match.requirement),
              experience: "Experience from previous analysis",
              education: "Education from previous analysis",
              score: existingAnalysis.overallScore,
              matchedRequirements: existingAnalysis.skillMatches.map(match => ({
                requirement: match.requirement,
                matched: match.match === 'full' || match.match === 'partial',
                confidence: match.confidence
              }))
            },
            rawResponse: existingAnalysis.rawResponse,
            aiModel: existingAnalysis.aiModel || 'unknown'
          });
        }
        
        // Analyze resume against job description
        const analysisResult = await analyzeResume(
          resume.extractedText,
          jobDescription.description,
          requirements.map(r => ({
            requirement: r.requirement,
            importance: r.importance,
            tags: r.tags || []
          }) as {
            requirement: string;
            importance: string;
            tags: string[];
          })
        );
        
        // Save or update the analysis result
        if (existingAnalysis && forceRerun) {
          // If it exists and we're force rerunning, update it with raw response for debugging
          await storage.updateAnalysisResult(existingAnalysis.id, {
            overallScore: analysisResult.overallScore,
            skillMatches: analysisResult.skillMatches,
            rawResponse: analysisResult.rawResponse || null,
            aiModel: analysisResult.aiModel || 'unknown',
            updatedAt: new Date()
          });
        } else {
          // Otherwise create a new one with raw response for debugging
          await storage.createAnalysisResult({
            resumeId,
            jobDescriptionId,
            overallScore: analysisResult.overallScore,
            skillMatches: analysisResult.skillMatches,
            rawResponse: analysisResult.rawResponse || null,
            aiModel: analysisResult.aiModel || 'unknown'
          });
        }
        
        // Format the response to match expected client format
        return res.json({
          analysis: {
            skills: analysisResult.skillMatches.map(match => match.requirement),
            experience: analysisResult.skillMatches.find(m => m.evidence)?.evidence || "Experience extracted from resume",
            education: "Education extracted from resume",
            score: analysisResult.overallScore,
            matchedRequirements: analysisResult.skillMatches.map(match => ({
              requirement: match.requirement,
              matched: match.match === 'full',
              confidence: match.confidence
            }))
          },
          rawResponse: analysisResult.rawResponse,
          aiModel: analysisResult.aiModel || 'unknown'
        });
      }
      
      // Basic resume analysis without job description
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Extract skills and work history in parallel
      const [skills, workHistory] = await Promise.all([
        extractSkillsFromResume(resume.extractedText),
        extractWorkHistory(resume.extractedText)
      ]);
      
      res.json({
        skills,
        workHistory,
        resumeId: resume.id
      });
    } catch (error) {
      console.error("Error analyzing resume:", error);
      res.status(500).json({ 
        message: "Failed to analyze resume", 
        error: error.message 
      });
    }
  });

  app.post(
    "/api/resumes",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Extract text from the uploaded file
        const extractedText = await extractTextFromFile(
          req.file.buffer,
          req.file.originalname
        );

        // Parse resume to extract candidate info
        const { candidateName, candidateTitle } = parseResume(extractedText);

        // Prepare resume data
        const resumeData = {
          candidateName: candidateName || null,
          candidateTitle: candidateTitle || null,
          rawContent: req.file.buffer.toString("base64"),
          extractedText,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
        };

        // Validate data
        const validatedData = insertResumeSchema.parse(resumeData);

        // Save resume
        const savedResume = await storage.createResume(validatedData);

        res.status(201).json(savedResume);
      } catch (error) {
        console.error("Error uploading resume:", error);
        res.status(500).json({
          message: "Failed to process resume",
          error: error.message,
        });
      }
    }
  );

  app.delete("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteResume(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });

  // Analysis endpoints
  app.post(
    "/api/analyze",
    async (req: Request, res: Response) => {
      try {
        const { jobDescriptionId, resumeIds } = analyzeResumeSchema.parse(
          req.body
        );

        // Get job description
        const jobDescription = await storage.getJobDescription(jobDescriptionId);
        if (!jobDescription) {
          return res
            .status(404)
            .json({ message: "Job description not found" });
        }

        // Get job requirements
        const requirements = await storage.getJobRequirements(jobDescriptionId);
        if (requirements.length === 0) {
          return res.status(400).json({
            message:
              "No requirements found. Please analyze the job description first.",
          });
        }

        // Process each resume
        const results = [];
        for (const resumeId of resumeIds) {
          // Get resume
          const resume = await storage.getResume(resumeId);
          if (!resume) {
            return res.status(404).json({
              message: `Resume with ID ${resumeId} not found`,
            });
          }

          // Check if analysis already exists
          const existingAnalysis = await storage.getAnalysisResultForResume(
            resumeId,
            jobDescriptionId
          );
          if (existingAnalysis) {
            results.push(existingAnalysis);
            continue;
          }

          // Analyze resume
          const analysisResult = await analyzeResume(
            resume.extractedText,
            jobDescription.description,
            requirements.map((r) => ({
              requirement: r.requirement,
              importance: r.importance,
              tags: r.tags || [],
            }) as {
              requirement: string;
              importance: string;
              tags: string[];
            })
          );

          // Save analysis result with raw response and model info for debugging
          const resultData = {
            jobDescriptionId,
            resumeId,
            overallScore: analysisResult.overallScore,
            skillMatches: analysisResult.skillMatches,
            rawResponse: analysisResult.rawResponse || null,
            aiModel: analysisResult.aiModel || 'unknown'
          };

          const savedResult = await storage.createAnalysisResult(resultData);
          
          // Also update resume with candidate name and title if available
          if (analysisResult.candidateName || analysisResult.candidateTitle) {
            await storage.updateResume(resumeId, {
              candidateName: analysisResult.candidateName || resume.candidateName,
              candidateTitle: analysisResult.candidateTitle || resume.candidateTitle,
            });
          }

          results.push(savedResult);
        }

        res.json({ results });
      } catch (error) {
        console.error("Error analyzing resumes:", error);
        res.status(500).json({
          message: "Failed to analyze resumes",
          error: error.message,
        });
      }
    }
  );

  app.get(
    "/api/job-descriptions/:id/results",
    async (req: Request, res: Response) => {
      try {
        const results = await storage.getAnalysisResultsByJob(req.params.id);
        
        // Enrich results with resume data
        const enrichedResults = [];
        for (const result of results) {
          const resume = await storage.getResume(result.resumeId);
          if (resume) {
            enrichedResults.push({
              ...result,
              resume: {
                id: resume.id,
                candidateName: resume.candidateName,
                candidateTitle: resume.candidateTitle,
                fileName: resume.fileName,
                fileType: resume.fileType,
              },
            });
          }
        }
        
        res.json(enrichedResults);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch analysis results" });
      }
    }
  );
  
  // Endpoint to get matching scores for specific resumes with a job
  // Original GET endpoint - keeping for backward compatibility
  app.get(
    "/api/job-descriptions/:id/resume-scores",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const resumeIds = Array.isArray(req.query.resumeId) 
          ? req.query.resumeId as string[] 
          : req.query.resumeId 
            ? [req.query.resumeId as string]
            : [];
        
        if (resumeIds.length === 0) {
          return res.json({});
        }
        
        // Get all analysis results for the job
        const results = await storage.getAnalysisResultsByJob(id);
        
        if (!results || results.length === 0) {
          return res.json({});
        }
        
        // Filter by requested resume IDs and format the response
        const scoreMap: { [resumeId: string]: { score: number, matchedAt: Date } } = {};
        
        results.forEach(result => {
          if (resumeIds.includes(result.resumeId)) {
            scoreMap[result.resumeId] = {
              score: result.overallScore,
              matchedAt: result.createdAt
            };
          }
        });
        
        res.json(scoreMap);
      } catch (error) {
        console.error("Error getting resume scores (GET):", error);
        res.status(500).json({ message: "Failed to get resume scores" });
      }
    }
  );
  
  // New POST endpoint for handling large batches of resume IDs
  app.post(
    "/api/job-descriptions/:id/resume-scores",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { resumeIds } = req.body;
        
        if (!Array.isArray(resumeIds) || resumeIds.length === 0) {
          return res.json({});
        }
        
        console.log(`Processing scores request for job ${id} with ${resumeIds.length} resumes`);
        
        // Get all analysis results for the job
        const results = await storage.getAnalysisResultsByJob(id);
        
        if (!results || results.length === 0) {
          return res.json({});
        }
        
        // Filter by requested resume IDs and format the response
        const scoreMap: { [resumeId: string]: { score: number, matchedAt: Date } } = {};
        
        results.forEach(result => {
          if (resumeIds.includes(result.resumeId)) {
            scoreMap[result.resumeId] = {
              score: result.overallScore,
              matchedAt: result.createdAt
            };
          }
        });
        
        res.json(scoreMap);
      } catch (error) {
        console.error("Error getting resume scores (POST):", error);
        res.status(500).json({ message: "Failed to get resume scores" });
      }
    }
  );

  // API endpoint to get candidate red flag analysis 
  app.get(
    "/api/resumes/:id/red-flag-analysis",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { jobDescriptionId } = req.query as { jobDescriptionId?: string };
        
        // Get the resume
        const resume = await storage.getResume(id);
        
        if (!resume) {
          return res.status(404).json({ message: "Resume not found" });
        }
        
        // Extract work history and skills from resume content
        const workHistory = await extractWorkHistory(resume.extractedText);
        const skills = await extractSkillsFromResume(resume.extractedText);
        
        // Get job description content if provided
        let jobDescriptionContent = undefined;
        
        if (jobDescriptionId) {
          const jobDescription = await storage.getJobDescription(jobDescriptionId as string);
          if (jobDescription) {
            jobDescriptionContent = jobDescription.description;
          }
        }
        
        // Analyze for red flags
        const analysis = analyzeRedFlags(workHistory, skills, jobDescriptionContent);
        
        res.json({
          resumeId: id,
          jobDescriptionId: jobDescriptionId || null,
          analysis
        });
      } catch (error) {
        console.error("Error getting red flag analysis:", error);
        res.status(500).json({ message: "Failed to analyze resume for red flags" });
      }
    }
  );
  
  // Custom prompts endpoint
  app.post("/api/custom-prompt", async (req: Request, res: Response) => {
    try {
      const { jobDescriptionId, customInstructions } = req.body;

      // Get job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }

      // Get job requirements
      const requirements = await storage.getJobRequirements(jobDescriptionId);
      const requirementsText = requirements
        .map((r) => `- ${r.requirement} (${r.importance})`)
        .join("\n");

      // Generate custom prompt
      const prompt = await generateCustomPrompt(
        jobDescription.description,
        requirementsText,
        customInstructions
      );

      res.json({ prompt });
    } catch (error) {
      res.status(500).json({
        message: "Failed to generate custom prompt",
        error: error.message,
      });
    }
  });
  
  // Batch analysis endpoint to run all analyses on all candidates for a job
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { jobDescriptionId, resumeIds } = req.body;
      
      if (!jobDescriptionId || !resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
        return res.status(400).json({ message: "Missing required fields or invalid format" });
      }
      
      // Get job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Get job requirements
      const requirements = await storage.getJobRequirements(jobDescriptionId);
      
      // Initialize results array for tracking
      const results = resumeIds.map(id => ({
        id,
        status: 'queued',
        message: 'Analysis queued'
      }));
      
      // Send initial response immediately
      res.json({ results });
      
      // Process in background after sending initial response
      (async () => {
        // Process a limited number of resumes at a time (to avoid rate-limiting issues)
        console.log(`Starting batch analysis for ${resumeIds.length} resumes...`);
        
        // Send a progress update via WebSocket
        broadcastUpdate({
          type: 'batchAnalysisStart',
          jobId: jobDescriptionId,
          total: resumeIds.length,
          message: `Starting analysis for ${resumeIds.length} resumes...`
        });
        
        // Track progress
        let completed = 0;
        let successful = 0;
        let failed = 0;
        
        // Process each resume sequentially
        for (let i = 0; i < resumeIds.length; i++) {
          const resumeId = resumeIds[i];
          
          // Send progress update
          broadcastUpdate({
            type: 'batchAnalysisProgress',
            jobId: jobDescriptionId,
            current: i + 1,
            total: resumeIds.length,
            resumeId,
            status: 'processing',
            progress: Math.round(((i + 1) / resumeIds.length) * 100),
            message: `Processing resume ${i+1}/${resumeIds.length}...`
          });
          
          try {
            // Get the resume
            const resume = await storage.getResume(resumeId);
            if (!resume) {
              console.error(`Resume ${resumeId} not found, skipping`);
              
              // Send resume skip update
              broadcastUpdate({
                type: 'batchAnalysisResumeStatus',
                jobId: jobDescriptionId,
                resumeId,
                status: 'skipped',
                message: 'Resume not found'
              });
              
              failed++;
              continue;
            }
            
            console.log(`Analyzing resume ${i+1}/${resumeIds.length}: ${resumeId}`);
            
            // Run job match analysis
            try {
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
              
              // Store or update the analysis result
              const existingAnalysis = await storage.getAnalysisResultForResume(resumeId, jobDescriptionId);
              
              if (existingAnalysis) {
                await storage.updateAnalysisResult(existingAnalysis.id, {
                  overallScore: analysisResult.overallScore,
                  skillMatches: JSON.stringify(analysisResult.skillMatches),
                  rawResponse: JSON.stringify(analysisResult.rawResponse),
                  aiModel: analysisResult.aiModel || 'unknown'
                });
              } else {
                await storage.createAnalysisResult({
                  resumeId,
                  jobDescriptionId,
                  overallScore: analysisResult.overallScore,
                  skillMatches: JSON.stringify(analysisResult.skillMatches),
                  rawResponse: JSON.stringify(analysisResult.rawResponse),
                  aiModel: analysisResult.aiModel || 'unknown'
                });
              }
              
              // Send successful analysis update via WebSocket
              broadcastUpdate({
                type: 'batchAnalysisResumeStatus',
                jobId: jobDescriptionId,
                resumeId,
                status: 'analyzed',
                score: analysisResult.overallScore,
                skillsMatched: analysisResult.skillMatches.length,
                message: `Analysis complete with score: ${analysisResult.overallScore}`
              });
              
              successful++;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error(`Error analyzing resume ${resumeId} (job match analysis):`, error);
              
              // Send error update via WebSocket
              broadcastUpdate({
                type: 'batchAnalysisResumeStatus',
                jobId: jobDescriptionId,
                resumeId,
                status: 'error',
                message: `Analysis error: ${errorMessage.substring(0, 100)}`
              });
              
              failed++;
            }
            
            // Run red flag analysis (which includes work history extraction)
            try {
              // Extract work history and skills for red flag analysis
              const workHistory = await extractWorkHistory(resume.extractedText);
              const skills = await extractSkillsFromResume(resume.extractedText);
              
              // Analyze for red flags
              const redFlagAnalysis = analyzeRedFlags(workHistory, skills, jobDescription.description);
              
              // Log success
              console.log(`Completed red flag analysis for resume ${resumeId}`);
            } catch (error) {
              console.error(`Error analyzing resume ${resumeId} (red flag analysis):`, error);
            }
          } catch (error) {
            console.error(`Error processing resume ${resumeId}:`, error);
          }
          
          // Update the completed count
          completed++;
          
          // Send progress update
          broadcastUpdate({
            type: 'batchAnalysisProgress',
            jobId: jobDescriptionId,
            current: completed,
            total: resumeIds.length,
            progress: Math.round((completed / resumeIds.length) * 100),
            message: `Processed ${completed}/${resumeIds.length} resumes`
          });
        }
        
        // Send completion update via WebSocket
        broadcastUpdate({
          type: 'batchAnalysisComplete',
          jobId: jobDescriptionId,
          total: resumeIds.length,
          successful,
          failed,
          message: `Batch analysis complete. Successfully analyzed: ${successful}, Failed: ${failed}`
        });
        
        console.log("Batch analysis complete");
      })();
    } catch (error) {
      console.error("Error initiating batch analysis:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to initiate batch analysis" });
      }
    }
  });

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
      res.status(500).json({ message: "Failed to create connection", error: error.message });
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
  
  // Test AI services with a simple prompt
  app.post("/api/ai-test", async (req: Request, res: Response) => {
    try {
      const { prompt, provider } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false, 
          message: "Prompt is required" 
        });
      }
      
      // Test OpenAI
      if (provider === 'openai' || !provider) {
        if (!process.env.OPENAI_API_KEY) {
          return res.status(200).json({
            success: false,
            message: "OpenAI API key is not configured"
          });
        }
        
        const openaiClient = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY 
        });
        
        const response = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 100
        });
        
        return res.json({
          success: true,
          provider: 'openai',
          response: response.choices[0].message.content
        });
      }
      
      // Test Anthropic
      if (provider === 'anthropic') {
        if (!process.env.ANTHROPIC_API_KEY) {
          return res.status(200).json({
            success: false,
            message: "Anthropic API key is not configured"
          });
        }
        
        const anthropicClient = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        const response = await anthropicClient.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 100,
          messages: [{ role: 'user', content: prompt }]
        });
        
        return res.json({
          success: true,
          provider: 'anthropic',
          response: isTextBlock(response.content[0]) ? (response.content[0] as TextBlock).text : "Response not in expected format"
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "Invalid provider specified. Use 'openai' or 'anthropic'"
      });
    } catch (error) {
      console.error("Error testing AI service:", error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to test AI service: ${(error as Error).message}` 
      });
    }
  });
  
  // Check AI service status
  app.get("/api/ai-status", async (_req: Request, res: Response) => {
    try {
      // Check if OpenAI API key is available
      const openaiApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
      
      // Check if Anthropic API key is available
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      
      // Check if Mistral API key is available (optional)
      const mistralApiKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;
      
      // Check if at least one primary AI service is available
      const isPrimaryAIAvailable = !!openaiApiKey || !!anthropicApiKey;
      
      if (!isPrimaryAIAvailable) {
        return res.status(200).json({ 
          available: false,
          message: "No AI service API keys are configured" 
        });
      }
      
      // If we have API keys, we can assume the services are available
      return res.json({ 
        available: true,
        message: "AI services are properly configured",
        providers: {
          openai: !!openaiApiKey,
          anthropic: !!anthropicApiKey,
          mistral: !!mistralApiKey
        }
      });
    } catch (error) {
      console.error("Error checking AI service status:", error);
      res.status(500).json({ 
        available: false,
        message: "Failed to check AI service status"
      });
    }
  });

  // Settings API endpoints
  app.get("/api/settings/:key", async (req: Request, res: Response) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.get("/api/settings/category/:category", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSettingsByCategory(req.params.category);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings by category:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const { key, value, category } = req.body;
      
      if (!key || !value || !category) {
        return res.status(400).json({ message: "Key, value, and category are required" });
      }
      
      const setting = await storage.upsertSetting({
        key,
        value,
        category
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Error saving setting:", error);
      res.status(500).json({ message: "Failed to save setting" });
    }
  });

  // Return the HTTP server that was created at the beginning of this function
  return httpServer;
}
