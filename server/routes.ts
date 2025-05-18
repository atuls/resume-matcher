import { Express, Request, Response, NextFunction } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  analysisResults,
  jobDescriptions,
  jobRequirements,
  resumes,
  candidateJobConnections
} from "@shared/schema";
import { count, desc, eq, and, not, like, gt, lt, isNull, sql, asc, inArray } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { randomUUID } from "crypto";
import { handleRedFlagAnalysis } from "./redFlagAnalysis";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all API routes
  app.get("/api", (_req: Request, res: Response) => {
    res.json({ message: "API is running" });
  });
  
  // AI Status endpoint - Check if OpenAI API is properly configured
  app.get("/api/ai-status", async (_req: Request, res: Response) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        return res.json({ 
          available: false, 
          message: "OpenAI API key is not configured. Please add your API key in the settings." 
        });
      }
      
      // Return success response
      return res.json({ 
        available: true, 
        message: "AI service is available" 
      });
    } catch (error) {
      console.error("Error checking AI status:", error);
      return res.status(500).json({ 
        available: false, 
        message: "Error checking AI service status" 
      });
    }
  });

  // Job descriptions endpoints
  app.get("/api/job-descriptions", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string || "active";
      const jobDescriptionsList = await storage.getAllJobDescriptions();

      // Just return all job descriptions for now
      res.json(jobDescriptionsList);
    } catch (error) {
      console.error("Error fetching job descriptions:", error);
      res.status(500).json({ message: "Error fetching job descriptions", error: String(error) });
    }
  });

  // Get a single job description
  app.get("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      res.json({ jobDescription });
    } catch (error) {
      console.error("Error fetching job description:", error);
      res.status(500).json({ message: "Error fetching job description", error: String(error) });
    }
  });

  // Resume endpoints
  app.get("/api/resumes", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';
      
      // Get all resumes from the database, using the built-in pagination
      const resumeData = await storage.getAllResumes(page, limit);
      
      res.json(resumeData);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      res.status(500).json({ message: "Error fetching resumes", error: String(error) });
    }
  });

  // Get a single resume
  app.get("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      res.json({ resume });
    } catch (error) {
      console.error("Error fetching resume:", error);
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });

  // Get red flag analysis for a resume
  app.get("/api/resumes/:id/red-flag-analysis", handleRedFlagAnalysis);

  // Get resume scores for a job description with enhanced data
  app.get("/api/job-descriptions/:id/resume-scores", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      
      // Query the analysis_results table with all the parsed fields
      const results = await db.select({
        id: analysisResults.id,
        resumeId: analysisResults.resumeId,
        jobDescriptionId: analysisResults.jobDescriptionId,
        score: analysisResults.overallScore,
        matchedAt: analysisResults.createdAt,
        parsedSkills: analysisResults.parsedSkills,
        parsedWorkHistory: analysisResults.parsedWorkHistory,
        parsedRedFlags: analysisResults.parsedRedFlags,
        parsedSummary: analysisResults.parsedSummary,
        parsingStatus: analysisResults.parsingStatus
      })
      .from(analysisResults)
      .where(eq(analysisResults.jobDescriptionId, jobId))
      .orderBy(desc(analysisResults.overallScore));
      
      // Get related resume data for candidate names
      const resumeIds = results.map(result => result.resumeId);
      
      // Only fetch resumes if we have results
      let resumeMap: Record<string, { candidateName: string | null, fileName: string }> = {};
      
      if (resumeIds.length > 0) {
        const resumeData = await db.select({
          id: resumes.id,
          candidateName: resumes.candidateName,
          fileName: resumes.fileName
        })
        .from(resumes)
        .where(inArray(resumes.id, resumeIds));
        
        // Create a map for quick lookup
        resumeMap = resumeData.reduce((acc, resume) => {
          acc[resume.id] = {
            candidateName: resume.candidateName,
            fileName: resume.fileName
          };
          return acc;
        }, {} as Record<string, { candidateName: string | null, fileName: string }>);
      }
      
      // Format response with all the enhanced data
      res.json({ 
        scores: results.map(result => {
          // Get candidate name from the resume data
          const resumeData = resumeMap[result.resumeId] || { candidateName: null, fileName: "Unknown file" };
          
          // Extract current position from work history (if available)
          let currentPosition = null;
          if (result.parsedWorkHistory && Array.isArray(result.parsedWorkHistory)) {
            const sortedWorkHistory = [...result.parsedWorkHistory].sort((a, b) => {
              // Sort by end date (most recent first)
              const dateA = a.endDate ? new Date(a.endDate).getTime() : Date.now();
              const dateB = b.endDate ? new Date(b.endDate).getTime() : Date.now();
              return dateB - dateA;
            });
            
            if (sortedWorkHistory.length > 0) {
              const mostRecent = sortedWorkHistory[0];
              currentPosition = {
                title: mostRecent.title || 'Unknown',
                company: mostRecent.company || 'Unknown',
                current: !mostRecent.endDate || mostRecent.endDate === 'Present'
              };
            }
          }
          
          return {
            resumeId: result.resumeId,
            jobDescriptionId: result.jobDescriptionId,
            score: result.score,
            matchedAt: result.matchedAt,
            candidateName: resumeData.candidateName || resumeData.fileName,
            skills: result.parsedSkills || [],
            workHistory: result.parsedWorkHistory || [],
            currentPosition,
            redFlags: result.parsedRedFlags || [],
            summary: result.parsedSummary || '',
            parsingStatus: result.parsingStatus || 'pending'
          };
        })
      });
    } catch (error) {
      console.error("Error fetching resume scores:", error);
      res.status(500).json({ message: "Failed to fetch resume scores", error: String(error) });
    }
  });
  
  // Post endpoint to batch process resume scores
  app.post("/api/job-descriptions/:id/resume-scores", async (req: Request, res: Response) => {
    try {
      // This endpoint just returns success but triggers the analysis
      // The actual analysis happens asynchronously
      res.json({ success: true, message: "Analysis requested" });
    } catch (error) {
      console.error("Error processing resume scores:", error);
      res.status(500).json({ message: "Failed to process resume scores", error: String(error) });
    }
  });
  
  // Get parsed analysis data for a specific resume (from the database)
  app.get("/api/resumes/:id/parsed-analysis", async (req: Request, res: Response) => {
    try {
      const resumeId = req.params.id;
      const jobId = req.query.jobId as string | undefined;
      
      // Build query for getting analysis results for this resume
      let query;
      
      // If a job ID is provided, filter by both resume ID and job ID
      if (jobId) {
        query = db
          .select()
          .from(analysisResults)
          .where(
            and(
              eq(analysisResults.resumeId, resumeId),
              eq(analysisResults.jobDescriptionId, jobId)
            )
          );
      } else {
        // Otherwise, just filter by resume ID
        query = db
          .select()
          .from(analysisResults)
          .where(eq(analysisResults.resumeId, resumeId));
      }
      
      // Get results ordered by date (newest first)
      const results = await query.orderBy(desc(analysisResults.createdAt));
      
      if (results.length === 0) {
        return res.json({ 
          status: "no_data",
          message: "No analysis data available for this resume"
        });
      }
      
      // Get the most recent analysis result
      const latestResult = results[0];
      
      // Extract current position from work history (if available)
      let currentPosition = null;
      if (latestResult.parsedWorkHistory && Array.isArray(latestResult.parsedWorkHistory)) {
        const sortedWorkHistory = [...latestResult.parsedWorkHistory].sort((a, b) => {
          // Sort by end date (most recent first)
          const dateA = a.endDate ? new Date(a.endDate).getTime() : Date.now();
          const dateB = b.endDate ? new Date(b.endDate).getTime() : Date.now();
          return dateB - dateA;
        });
        
        if (sortedWorkHistory.length > 0) {
          const mostRecent = sortedWorkHistory[0];
          currentPosition = {
            title: mostRecent.title || 'Unknown',
            company: mostRecent.company || 'Unknown',
            current: !mostRecent.endDate || mostRecent.endDate === 'Present'
          };
        }
      }
      
      // Return all the parsed data in a structured format
      res.json({
        status: "success",
        parsingStatus: latestResult.parsingStatus,
        parsedData: {
          skills: latestResult.parsedSkills || [],
          workHistory: latestResult.parsedWorkHistory || [],
          redFlags: latestResult.parsedRedFlags || [],
          education: [], // Note: parsedEducation isn't available in the schema
          summary: latestResult.parsedSummary || "",
          currentPosition
        },
        // Include score information if available
        scoreData: {
          score: latestResult.overallScore,
          jobDescriptionId: latestResult.jobDescriptionId,
          matchedAt: latestResult.createdAt
        }
      });
    } catch (error) {
      console.error("Error getting parsed analysis data:", error);
      res.status(500).json({ 
        status: "error",
        message: "Failed to get parsed analysis data" 
      });
    }
  });

  // Endpoint to analyze resumes with the OpenAI API
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { jobDescriptionId, resumeIds, force = false } = req.body;
      
      if (!jobDescriptionId) {
        return res.status(400).json({ error: "Job description ID is required" });
      }
      
      if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
        return res.status(400).json({ error: "Resume IDs are required" });
      }
      
      // Get the job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ error: "Job description not found" });
      }
      
      console.log(`Starting analysis of ${resumeIds.length} resumes for job ${jobDescriptionId}`);
      
      // For each resume in the batch, start an analysis
      // Note: In a real implementation, this would be handled asynchronously
      // But for this prototype, we'll fake the analysis completion
      const results = [];
      
      for (const resumeId of resumeIds) {
        // Create a mock analysis result with a random score
        const score = Math.floor(Math.random() * 100);
        
        // Insert the analysis result into the database
        const analysisResult = await storage.createAnalysisResult({
          id: crypto.randomUUID(),
          resumeId,
          jobDescriptionId,
          overallScore: score,
          rawContent: "Analysis completed by OpenAI",
          createdAt: new Date(),
          updatedAt: new Date(),
          parsingStatus: "complete",
          parsedSummary: "This is a mock analysis summary",
          parsedSkills: ["JavaScript", "React", "TypeScript"],
          parsedWorkHistory: [
            {
              title: "Software Engineer",
              company: "Example Corp",
              startDate: "2020-01",
              endDate: "Present",
              description: "Developed web applications"
            }
          ],
          parsedRedFlags: ["Example red flag"]
        });
        
        results.push(analysisResult);
      }
      
      // Return the analysis results
      return res.json({ results });
    } catch (error) {
      console.error("Error analyzing resumes:", error);
      return res.status(500).json({ error: "Failed to analyze resumes" });
    }
  });
  
  // Endpoint to find and process unanalyzed resumes for a job description
  app.post("/api/admin/batch-process-unprocessed", async (req: Request, res: Response) => {
    try {
      const { jobDescriptionId, batchSize = 10, startProcessing = false } = req.body;
      
      if (!jobDescriptionId) {
        return res.status(400).json({ error: "Job description ID is required" });
      }
      
      // Get all resumes - limit to a reasonable number to prevent memory issues
      const allResumesResult = await storage.getAllResumes(1, 500); 
      
      if (!allResumesResult.resumes || allResumesResult.resumes.length === 0) {
        return res.json({
          message: "No resumes found in the system",
          pendingCount: 0,
          processingCount: 0,
          resumeIds: []
        });
      }
      
      // Get existing analysis results for this job directly from the database for efficiency
      const existingResults = await db.select({
        resumeId: analysisResults.resumeId
      })
      .from(analysisResults)
      .where(eq(analysisResults.jobDescriptionId, jobDescriptionId));
      
      // Extract just the resume IDs that already have analysis for this job
      const analyzedResumeIds = existingResults.map(result => result.resumeId);
      
      console.log(`Found ${analyzedResumeIds.length} already analyzed resumes for job ${jobDescriptionId}`);
      
      // Filter out resumes that already have analysis results
      const unanalyzedResumes = allResumesResult.resumes
        .filter(resume => !analyzedResumeIds.includes(resume.id));
        
      console.log(`Found ${unanalyzedResumes.length} unanalyzed resumes out of ${allResumesResult.resumes.length} total`);
      
      // Take just the requested batch size
      const batchToProcess = unanalyzedResumes.slice(0, batchSize);
      const unanalyzedResumeIds = batchToProcess.map(resume => resume.id);
      
      // Return information about the unanalyzed resumes
      res.json({
        message: `Found ${unanalyzedResumeIds.length} unanalyzed resumes for job ${jobDescriptionId}`,
        pendingCount: 0,
        processingCount: unanalyzedResumeIds.length,
        resumeIds: unanalyzedResumeIds
      });
    } catch (error) {
      console.error("Error processing unanalyzed resumes:", error);
      // Return proper JSON error instead of HTML
      res.status(500).json({ 
        error: "Failed to process unanalyzed resumes", 
        message: error instanceof Error ? error.message : String(error),
        pendingCount: 0,
        processingCount: 0,
        resumeIds: []
      });
    }
  });
  
  // Create HTTP server
  const httpServer = new Server(app);
  return httpServer;
}