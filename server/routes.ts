import express, { Express, Request, Response, NextFunction } from "express";
import http, { Server } from "http";
import { storage } from "./storage";
import { WebSocketServer } from "ws";
import { db } from "./db";
import { 
  analysisResults, 
  candidateConnections, 
  jobDescriptions, 
  jobRequirements, 
  resumes, 
  settings 
} from "@shared/schema";
import { 
  and, 
  eq, 
  inArray, 
  desc, 
  asc,
  or,
  sql,
  count,
  isNull,
  not
} from "drizzle-orm";
import {
  analyzeRequirements,
  analyzeSkillMatch,
  analyzeRedFlags,
  batchAnalyzeResumes,
  getCurrentAIModel,
  extractSkillsFromResume,
  extractRequirementsFromJobDescription
} from "./services/skillsExtractor";
import {
  extractTextFromPDFs,
  extractTextFromDOCX
} from "./services/textExtractor";
import { v4 as uuidv4 } from "uuid";
import {
  parseClaudeAnalysisResponse,
  processParsedAnalysis
} from "./services/responseParserService";
import multer from "multer";
import { makeBackup } from "./services/migrationService";
import util from "util";

// Define types
type RedFlagAnalysis = {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
};

// Set up file upload handling
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

interface TextBlock {
  type: 'text';
  text: string;
}

function isTextBlock(block: any): block is TextBlock {
  return block && block.type === 'text' && typeof block.text === 'string';
}

// Periodically check if Claude API is available
async function checkAIServicesAvailability() {
  try {
    const aiStatus = {
      claude: { available: false, message: "Checking..." },
      openai: { available: false, message: "Checking..." },
      mistral: { available: false, message: "Checking..." }
    };
    
    // Save to database
    await db.insert(settings).values({
      key: 'ai_status',
      value: JSON.stringify(aiStatus),
      category: 'system'
    }).onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(aiStatus) }
    });
    
    return aiStatus;
  } catch (error) {
    console.error("Error checking AI availability:", error);
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = http.createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients
  const clients = new Set();
  
  wss.on('connection', (ws) => {
    // Add new client to the set
    clients.add(ws);
    console.log('WebSocket client connected');
    
    // Remove client from the set when they disconnect
    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });
  });
  
  // Function to broadcast updates to all connected clients
  function broadcastUpdate(type: string, data: any) {
    const message = JSON.stringify({ type, data });
    
    clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Check AI service availability
  checkAIServicesAvailability();
  
  // Register API routes
  app.get("/api", (_req: Request, res: Response) => {
    res.json({ message: "API is running" });
  });
  
  // Get job descriptions
  app.get("/api/job-descriptions", async (req: Request, res: Response) => {
    try {
      let allJobs;
      
      // Get all job descriptions
      if (req.query.archived === 'true') {
        // Get archived jobs
        allJobs = await storage.getArchivedJobDescriptions();
      } else if (req.query.archived === 'false') {
        // Get active jobs
        allJobs = await storage.getActiveJobDescriptions();
      } else {
        // Get all jobs
        allJobs = await storage.getAllJobDescriptions();
      }
      
      // Return the results
      res.json(allJobs);
    } catch (error) {
      console.error("Error fetching job descriptions:", error);
      res.status(500).json({ message: "Failed to fetch job descriptions" });
    }
  });
  
  // Get job description by ID
  app.get("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const jobDescription = await storage.getJobDescription(jobId);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      res.json(jobDescription);
    } catch (error) {
      console.error("Error fetching job description:", error);
      res.status(500).json({ message: "Failed to fetch job description" });
    }
  });
  
  // Create job description - multipart form data with file upload
  app.post(
    "/api/job-descriptions",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        // Check if we have form data
        if (!req.body) {
          return res.status(400).json({ message: "No data provided" });
        }
        
        const { title, description, company } = req.body;
        
        // Check if we have required fields
        if (!title || !description) {
          return res.status(400).json({ message: "Title and description are required" });
        }
        
        // File data if uploaded
        let fileName = null;
        let fileSize = null;
        let fileType = null;
        let rawContent = description;
        
        // Handle file upload if present
        if (req.file) {
          fileName = req.file.originalname;
          fileSize = req.file.size;
          fileType = req.file.mimetype;
          
          // Extract text from file based on type
          if (fileType === 'application/pdf') {
            try {
              const extractedText = await extractTextFromPDFs(req.file.buffer);
              if (extractedText) {
                rawContent = extractedText;
              }
            } catch (e) {
              console.error("Error extracting text from PDF:", e);
            }
          } else if (fileType.includes('word') || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            try {
              const extractedText = await extractTextFromDOCX(req.file.buffer);
              if (extractedText) {
                rawContent = extractedText;
              }
            } catch (e) {
              console.error("Error extracting text from DOCX:", e);
            }
          }
        }
        
        // Create the job description
        const jobDescription = await storage.createJobDescription({
          title,
          description,
          rawContent,
          company,
          fileName,
          fileSize,
          fileType,
        });
        
        // Return the created job description
        res.status(201).json(jobDescription);
      } catch (error) {
        console.error("Error creating job description:", error);
        res.status(500).json({ message: "Failed to create job description" });
      }
    }
  );
  
  // Update job description
  app.patch("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const jobDescription = await storage.getJobDescription(jobId);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Update the job description
      const updatedJob = await storage.updateJobDescription(jobId, req.body);
      
      // Return the updated job description
      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job description:", error);
      res.status(500).json({ message: "Failed to update job description" });
    }
  });
  
  // Archive a job description
  app.patch("/api/job-descriptions/:id/archive", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const jobDescription = await storage.getJobDescription(jobId);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Archive the job description
      const archivedJob = await storage.updateJobDescription(jobId, { archived: true });
      
      // Broadcast the update
      broadcastUpdate('job_archived', { id: jobId });
      
      // Return the archived job description
      res.json(archivedJob);
    } catch (error) {
      console.error("Error archiving job description:", error);
      res.status(500).json({ message: "Failed to archive job description" });
    }
  });
  
  // Restore an archived job description
  app.patch("/api/job-descriptions/:id/restore", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const jobDescription = await storage.getJobDescription(jobId);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Restore the job description
      const restoredJob = await storage.updateJobDescription(jobId, { archived: false });
      
      // Broadcast the update
      broadcastUpdate('job_restored', { id: jobId });
      
      // Return the restored job description
      res.json(restoredJob);
    } catch (error) {
      console.error("Error restoring job description:", error);
      res.status(500).json({ message: "Failed to restore job description" });
    }
  });
  
  // Delete job description
  app.delete("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const jobDescription = await storage.getJobDescription(jobId);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Delete the job description
      await storage.deleteJobDescription(jobId);
      
      // Broadcast the update
      broadcastUpdate('job_deleted', { id: jobId });
      
      // Return success
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting job description:", error);
      res.status(500).json({ message: "Failed to delete job description" });
    }
  });
  
  // Get job requirements
  app.get("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const jobDescription = await storage.getJobDescription(jobId);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Get requirements for this job
      const requirements = await storage.getJobRequirementsByJobId(jobId);
      
      // Return the requirements
      res.json({ requirements });
    } catch (error) {
      console.error("Error fetching job requirements:", error);
      res.status(500).json({ message: "Failed to fetch job requirements" });
    }
  });
  
  // Create job requirement
  app.post("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const jobDescription = await storage.getJobDescription(jobId);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Create the requirement
      const requirement = await storage.createJobRequirement({
        jobDescriptionId: jobId,
        requirement: req.body.requirement,
        importance: req.body.importance,
        tags: req.body.tags || [],
      });
      
      // Return the created requirement
      res.status(201).json(requirement);
    } catch (error) {
      console.error("Error creating job requirement:", error);
      res.status(500).json({ message: "Failed to create job requirement" });
    }
  });
  
  // Update job requirement
  app.patch("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      const requirementId = req.params.id;
      const requirement = await storage.getJobRequirement(requirementId);
      
      if (!requirement) {
        return res.status(404).json({ message: "Job requirement not found" });
      }
      
      // Update the requirement
      const updatedRequirement = await storage.updateJobRequirement(requirementId, req.body);
      
      // Return the updated requirement
      res.json(updatedRequirement);
    } catch (error) {
      console.error("Error updating job requirement:", error);
      res.status(500).json({ message: "Failed to update job requirement" });
    }
  });
  
  // Delete job requirement
  app.delete("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      const requirementId = req.params.id;
      const requirement = await storage.getJobRequirement(requirementId);
      
      if (!requirement) {
        return res.status(404).json({ message: "Job requirement not found" });
      }
      
      // Delete the requirement
      await storage.deleteJobRequirement(requirementId);
      
      // Return success
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting job requirement:", error);
      res.status(500).json({ message: "Failed to delete job requirement" });
    }
  });
  
  // Analyze job description to extract requirements
  app.post("/api/analyze-requirements", async (req: Request, res: Response) => {
    try {
      const { jobDescriptionId, text } = req.body;
      
      if (!jobDescriptionId) {
        return res.status(400).json({ message: "Job description ID is required" });
      }
      
      // Get the job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      // Use the provided text or the job description's content
      const descriptionText = text || jobDescription.description;
      
      // Analyze the job description to extract requirements
      const requirements = await extractRequirementsFromJobDescription(descriptionText);
      
      // Return the extracted requirements
      res.json({ requirements });
    } catch (error) {
      console.error("Error analyzing job description:", error);
      res.status(500).json({ message: "Failed to analyze job description" });
    }
  });
  
  // Get all resumes with pagination and sorting
  app.get("/api/resumes", async (req: Request, res: Response) => {
    try {
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';
      const search = req.query.search as string || '';
      
      // Get resumes with pagination
      const results = await storage.getResumesWithPagination(page, limit, sortBy, sortOrder, search);
      
      // Return the results
      res.json(results);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });
  
  // Get resume by ID
  app.get("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const resumeId = req.params.id;
      const resume = await storage.getResume(resumeId);
      
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
      // Disable caching for this endpoint
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const resumeId = req.params.id;
      const jobDescriptionId = req.query.jobDescriptionId?.toString() || null;
      
      // Fetch the resume 
      const resume = await storage.getResume(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Default values
      const redFlagData = {
        currentJobPosition: null,
        currentCompany: null,
        isCurrentlyEmployed: false,
        redFlags: [] as string[],
        highlights: [] as string[],
        recentRoles: [] as Array<{ title: string; company: string; durationMonths: number; isContract: boolean }>,
        averageTenureMonths: 0
      };
      
      // Try to get analysis from the database
      try {
        // Get all analysis results for this resume
        const analysisResults = await storage.getAnalysisResultsByResume(resumeId);
        
        if (analysisResults && analysisResults.length > 0) {
          // Find analysis for this job description if specified
          const relevantAnalysis = jobDescriptionId
            ? analysisResults.find(a => a.jobDescriptionId === jobDescriptionId) || analysisResults[0]
            : analysisResults[0];
          
          // Extract data from analysis
          if (relevantAnalysis.parsedRedFlags) {
            try {
              const parsedFlags = typeof relevantAnalysis.parsedRedFlags === 'string'
                ? JSON.parse(relevantAnalysis.parsedRedFlags)
                : relevantAnalysis.parsedRedFlags;
                
              if (Array.isArray(parsedFlags)) {
                redFlagData.redFlags = parsedFlags;
              }
            } catch (err) {
              console.error("Error parsing red flags:", err);
            }
          }
          
          if (relevantAnalysis.parsedSkills) {
            try {
              const parsedSkills = typeof relevantAnalysis.parsedSkills === 'string'
                ? JSON.parse(relevantAnalysis.parsedSkills)
                : relevantAnalysis.parsedSkills;
                
              if (Array.isArray(parsedSkills)) {
                redFlagData.highlights = parsedSkills;
              } else if (parsedSkills && parsedSkills.highlights) {
                redFlagData.highlights = parsedSkills.highlights;
              } else if (parsedSkills && parsedSkills.keySkills) {
                redFlagData.highlights = parsedSkills.keySkills;
              }
            } catch (err) {
              console.error("Error parsing skills:", err);
            }
          }
          
          if (relevantAnalysis.parsedWorkHistory) {
            try {
              const parsedWorkHistory = typeof relevantAnalysis.parsedWorkHistory === 'string'
                ? JSON.parse(relevantAnalysis.parsedWorkHistory)
                : relevantAnalysis.parsedWorkHistory;
                
              if (parsedWorkHistory) {
                if (parsedWorkHistory.currentJobPosition) {
                  redFlagData.currentJobPosition = parsedWorkHistory.currentJobPosition;
                }
                if (parsedWorkHistory.currentCompany) {
                  redFlagData.currentCompany = parsedWorkHistory.currentCompany;
                }
                if (parsedWorkHistory.isCurrentlyEmployed !== undefined) {
                  redFlagData.isCurrentlyEmployed = parsedWorkHistory.isCurrentlyEmployed;
                }
                if (Array.isArray(parsedWorkHistory.recentRoles)) {
                  redFlagData.recentRoles = parsedWorkHistory.recentRoles;
                }
                if (parsedWorkHistory.averageTenureMonths) {
                  redFlagData.averageTenureMonths = parsedWorkHistory.averageTenureMonths;
                }
              }
            } catch (err) {
              console.error("Error parsing work history:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error retrieving analysis:", err);
      }
      
      return res.status(200).json({
        resumeId: resumeId,
        jobDescriptionId: jobDescriptionId,
        analysis: redFlagData
      });
    } catch (error) {
      console.error("Error in red flag analysis:", error);
      return res.status(500).json({ message: "Error processing red flag analysis" });
    }
  });

  // Return the HTTP server for use in server/index.ts
  return httpServer;
}