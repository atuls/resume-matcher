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
import { ResponseParserService } from "./services/responseParserService";
import { addParsedFieldsToAnalysisResults } from "./migrations/add-parsed-fields";
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
  Resume,
  analysisResults
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
  // Check if OpenAI API key is available and valid
  const isOpenAIAvailable = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20;
  
  // Check if Mistral API key is available and valid
  const isMistralAvailable = process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.length > 20;
  
  // Check if Anthropic API key is available
  const isAnthropicAvailable = await isAnthropicApiKeyAvailable();
  
  return {
    openai: isOpenAIAvailable,
    anthropic: isAnthropicAvailable,
    mistral: isMistralAvailable,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    clients.set(clientId, ws);
    console.log(`WebSocket client connected: ${clientId}`);
    
    // Send a test event to the client
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

    // Handle client disconnection
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });
  });
  
  // Root endpoint
  app.get("/api", (_req: Request, res: Response) => {
    res.status(200).json({ message: "API is running" });
  });

  // Get all job descriptions
  app.get("/api/job-descriptions", async (req: Request, res: Response) => {
    try {
      const jobDescriptions = await storage.getAllJobDescriptions();
      res.status(200).json(jobDescriptions);
    } catch (error) {
      console.error("Error getting job descriptions:", error);
      res.status(500).json({ message: "Failed to get job descriptions" });
    }
  });

  // Get a specific job description
  app.get("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      res.status(200).json(jobDescription);
    } catch (error) {
      console.error("Error getting job description:", error);
      res.status(500).json({ message: "Failed to get job description" });
    }
  });

  // Create a new job description
  app.post(
    "/api/job-descriptions",
    async (req: Request, res: Response) => {
      try {
        const jobData = insertJobDescriptionSchema.parse(req.body);
        
        const jobDescription = await storage.createJobDescription({
          title: jobData.title,
          company: jobData.company,
          location: jobData.location,
          description: jobData.description,
          jobType: jobData.jobType,
          roleType: jobData.roleType,
          seniority: jobData.seniority,
          experienceYears: jobData.experienceYears,
          keySkills: jobData.keySkills
        });
        
        // Extract requirements if not provided
        if (!jobData.requirements || jobData.requirements.length === 0) {
          // If the analyzedRequirements array is not empty, store them
          if (jobData.analyzedRequirements && jobData.analyzedRequirements.length > 0) {
            for (const req of jobData.analyzedRequirements) {
              await storage.createJobRequirement({
                jobDescriptionId: jobDescription.id,
                requirement: req.requirement,
                importance: req.importance,
                tags: req.tags,
                category: req.category,
              });
            }
          } else {
            // Analyze the job description to extract requirements
            const requirements = await analyzeJobDescription(jobDescription.description);
            
            if (requirements && requirements.length > 0) {
              // Store requirements in the database
              for (const req of requirements) {
                await storage.createJobRequirement({
                  jobDescriptionId: jobDescription.id,
                  requirement: req.requirement,
                  importance: req.importance,
                  tags: req.tags || [],
                });
              }
            }
          }
        } else {
          // Store the provided requirements
          for (const req of jobData.requirements) {
            await storage.createJobRequirement({
              jobDescriptionId: jobDescription.id,
              requirement: req.requirement,
              importance: req.importance,
              tags: req.tags || [],
            });
          }
        }
        
        res.status(201).json(jobDescription);
      } catch (error) {
        console.error("Error creating job description:", error);
        res.status(400).json({ 
          message: "Failed to create job description", 
          error: error.message 
        });
      }
    }
  );

  // Delete a job description
  app.delete("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteJobDescription(req.params.id);
      res.status(200).json({ message: "Job description deleted" });
    } catch (error) {
      console.error("Error deleting job description:", error);
      res.status(500).json({ message: "Failed to delete job description" });
    }
  });

  // Get all requirements for a job description
  app.get("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const requirements = await storage.getJobRequirementsByJobId(req.params.id);
      res.status(200).json(requirements);
    } catch (error) {
      console.error("Error getting job requirements:", error);
      res.status(500).json({ message: "Failed to get job requirements" });
    }
  });

  // Create a new job requirement
  app.post("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      const requirementData = insertJobRequirementSchema.parse({
        ...req.body,
        jobDescriptionId: req.params.id
      });
      
      const requirement = await storage.createJobRequirement(requirementData);
      
      res.status(201).json(requirement);
    } catch (error) {
      console.error("Error creating job requirement:", error);
      res.status(400).json({ 
        message: "Failed to create job requirement", 
        error: error.message 
      });
    }
  });

  // Update a job requirement
  app.patch("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      const requirementData = updateRequirementSchema.parse({
        ...req.body,
        id: req.params.id
      });
      
      const requirement = await storage.updateJobRequirement(requirementData);
      
      if (!requirement) {
        return res.status(404).json({ message: "Job requirement not found" });
      }
      
      res.status(200).json(requirement);
    } catch (error) {
      console.error("Error updating job requirement:", error);
      res.status(400).json({ 
        message: "Failed to update job requirement", 
        error: error.message 
      });
    }
  });

  // Delete a job requirement
  app.delete("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteJobRequirement(req.params.id);
      res.status(200).json({ message: "Job requirement deleted" });
    } catch (error) {
      console.error("Error deleting job requirement:", error);
      res.status(500).json({ message: "Failed to delete job requirement" });
    }
  });

  // Analyze job requirements
  app.post("/api/analyze-requirements", async (req: Request, res: Response) => {
    try {
      const { description } = analyzeRequirementsSchema.parse(req.body);
      
      const requirements = await analyzeJobDescription(description);
      
      res.status(200).json(requirements);
    } catch (error) {
      console.error("Error analyzing job requirements:", error);
      res.status(400).json({ 
        message: "Failed to analyze job requirements", 
        error: error.message 
      });
    }
  });

  // Get resumes with pagination
  app.get("/api/resumes", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await storage.getResumesWithPagination(page, limit);
      
      console.log(`getAllResumes: ${Date.now() - performance.now()}ms`);
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error getting resumes:", error);
      return res.status(500).json({ message: "Failed to get resumes", error: error.message });
    }
  });

  // Get a specific resume
  app.get("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.status(200).json(resume);
    } catch (error) {
      console.error("Error getting resume:", error);
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });

  // Get red flag analysis for a resume from the database
  app.get("/api/resumes/:id/red-flag-analysis", async (req: Request, res: Response) => {
    // Disable caching for this endpoint to ensure we always get fresh data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    try {
      const resumeId = req.params.id;
      const jobId = req.query.jobDescriptionId?.toString() || null;
      
      console.log(`Getting red flag analysis for resume ${resumeId} with job ${jobId || 'none'}`);
      
      // Fetch the resume to verify it exists
      const resume = await storage.getResume(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Default values for when no analysis is found
      let currentJobPosition = null;
      let currentCompany = null;
      let isCurrentlyEmployed = false;
      let redFlags: string[] = [];
      let highlights: string[] = [];
      let recentRoles: Array<{ title: string; company: string; durationMonths: number; isContract: boolean }> = [];
      let averageTenureMonths = 0;
      
      // Query the database directly for analysis results based on the resume ID and job ID
      const query = jobId 
        ? await db
            .select()
            .from(analysisResults)
            .where(and(
              eq(analysisResults.resumeId, resumeId),
              eq(analysisResults.jobDescriptionId, jobId)
            ))
            .orderBy(desc(analysisResults.createdAt))
            .limit(1)
        : await db
            .select()
            .from(analysisResults)
            .where(eq(analysisResults.resumeId, resumeId))
            .orderBy(desc(analysisResults.createdAt))
            .limit(1);
      
      console.log(`Found ${query.length} analysis result(s) in database for resume ${resumeId}`);
      
      // If we found analysis results, extract the data
      if (query.length > 0) {
        const analysis = query[0];
        console.log(`Analysis ID: ${analysis.id}, created at ${analysis.createdAt}`);
        
        // Try to get data from parsed fields
        if (analysis.parsedRedFlags || analysis.parsedWorkHistory || analysis.parsedSkills) {
          console.log("Using parsed fields from database");
          
          // Extract red flags
          if (analysis.parsedRedFlags) {
            try {
              const parsedRedFlags = typeof analysis.parsedRedFlags === 'string'
                ? JSON.parse(analysis.parsedRedFlags)
                : analysis.parsedRedFlags;
              
              if (Array.isArray(parsedRedFlags)) {
                redFlags = parsedRedFlags;
              } else if (typeof parsedRedFlags === 'object' && parsedRedFlags !== null) {
                redFlags = Object.values(parsedRedFlags).filter(item => typeof item === 'string');
              }
              console.log(`Extracted ${redFlags.length} red flags from parsed fields`);
            } catch (e) {
              console.error("Error parsing red flags:", e);
            }
          }
          
          // Extract work history
          if (analysis.parsedWorkHistory) {
            try {
              const parsedWorkHistory = typeof analysis.parsedWorkHistory === 'string'
                ? JSON.parse(analysis.parsedWorkHistory)
                : analysis.parsedWorkHistory;
              
              if (typeof parsedWorkHistory === 'object' && parsedWorkHistory !== null) {
                // Extract recent roles
                if (Array.isArray(parsedWorkHistory.recentRoles)) {
                  recentRoles = parsedWorkHistory.recentRoles;
                }
                
                // Extract current position
                if (parsedWorkHistory.currentJobPosition) {
                  currentJobPosition = parsedWorkHistory.currentJobPosition;
                } else if (parsedWorkHistory.currentPosition) {
                  currentJobPosition = parsedWorkHistory.currentPosition;
                }
                
                // Extract current company
                if (parsedWorkHistory.currentCompany) {
                  currentCompany = parsedWorkHistory.currentCompany;
                }
                
                // Extract employment status
                if (typeof parsedWorkHistory.isCurrentlyEmployed === 'boolean') {
                  isCurrentlyEmployed = parsedWorkHistory.isCurrentlyEmployed;
                }
                
                // Extract average tenure
                if (typeof parsedWorkHistory.averageTenureMonths === 'number') {
                  averageTenureMonths = parsedWorkHistory.averageTenureMonths;
                }
              }
            } catch (e) {
              console.error("Error parsing work history:", e);
            }
          }
          
          // Extract highlights/skills
          if (analysis.parsedSkills) {
            try {
              const parsedSkills = typeof analysis.parsedSkills === 'string'
                ? JSON.parse(analysis.parsedSkills)
                : analysis.parsedSkills;
              
              if (typeof parsedSkills === 'object' && parsedSkills !== null) {
                if (Array.isArray(parsedSkills.highlights)) {
                  highlights = parsedSkills.highlights;
                } else if (Array.isArray(parsedSkills.keySkills)) {
                  highlights = parsedSkills.keySkills;
                } else if (Array.isArray(parsedSkills.skills)) {
                  highlights = parsedSkills.skills;
                } else if (Array.isArray(parsedSkills)) {
                  highlights = parsedSkills;
                }
              }
              console.log(`Extracted ${highlights.length} highlights from parsed fields`);
            } catch (e) {
              console.error("Error parsing skills:", e);
            }
          }
        }
        
        // If we're missing data, try the raw response as backup
        if ((!redFlags.length || !highlights.length || !currentJobPosition) && analysis.rawResponse) {
          console.log("Using raw response as backup");
          try {
            const parsedResponse = typeof analysis.rawResponse === 'string'
              ? JSON.parse(analysis.rawResponse)
              : analysis.rawResponse;
            
            if (typeof parsedResponse === 'object' && parsedResponse !== null) {
              // Extract missing redFlags
              if (!redFlags.length) {
                if (Array.isArray(parsedResponse.redFlags)) {
                  redFlags = parsedResponse.redFlags;
                } else if (parsedResponse.analysis && Array.isArray(parsedResponse.analysis.redFlags)) {
                  redFlags = parsedResponse.analysis.redFlags;
                }
              }
              
              // Extract missing highlights
              if (!highlights.length) {
                if (Array.isArray(parsedResponse.highlights)) {
                  highlights = parsedResponse.highlights;
                } else if (parsedResponse.analysis && Array.isArray(parsedResponse.analysis.highlights)) {
                  highlights = parsedResponse.analysis.highlights;
                } else if (parsedResponse.keySkills && Array.isArray(parsedResponse.keySkills)) {
                  highlights = parsedResponse.keySkills;
                }
              }
              
              // Extract missing current job
              if (!currentJobPosition) {
                if (parsedResponse.currentJobPosition) {
                  currentJobPosition = parsedResponse.currentJobPosition;
                } else if (parsedResponse.currentPosition) {
                  currentJobPosition = parsedResponse.currentPosition;
                }
              }
              
              // Extract missing company
              if (!currentCompany && parsedResponse.currentCompany) {
                currentCompany = parsedResponse.currentCompany;
              }
            }
          } catch (e) {
            console.error("Error extracting from raw response:", e);
          }
        }
      } else {
        console.log("No existing analysis found for this resume/job combination");
      }
      
      // Return the analysis data we found, or default empty values
      return res.status(200).json({
        resumeId: resumeId,
        jobDescriptionId: jobId,
        analysis: {
          currentJobPosition,
          currentCompany,
          isCurrentlyEmployed,
          redFlags,
          highlights,
          recentRoles,
          averageTenureMonths
        }
      });
    } catch (error) {
      console.error("Error getting red flag analysis:", error);
      return res.status(500).json({ message: "Failed to get red flag analysis", error: error.message });
    }
  });

  // (Rest of the file remains the same)
  
  // Start the HTTP server
  httpServer.listen(0);
  return httpServer;
}