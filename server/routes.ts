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
import { handleRedFlagAnalysis } from "./redFlagAnalysis";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all API routes
  app.get("/api", (_req: Request, res: Response) => {
    res.json({ message: "API is running" });
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
      
      // Query for getting all analysis results for this resume
      const query = db
        .select()
        .from(analysisResults)
        .where(eq(analysisResults.resumeId, resumeId));
      
      // If a job ID is provided, filter by that job
      if (jobId) {
        query.where(eq(analysisResults.jobDescriptionId, jobId));
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
          education: latestResult.parsedEducation || [],
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

  // Create HTTP server
  const httpServer = new Server(app);
  return httpServer;
}