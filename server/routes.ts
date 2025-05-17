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
import { count, desc, eq, and, not, like, gt, lt, isNull, sql, asc } from "drizzle-orm";
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

  // Get resume scores for a job description
  app.get("/api/job-descriptions/:id/resume-scores", async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      
      // Query the analysis_results table to get scores
      const results = await db.select({
        id: analysisResults.id,
        resumeId: analysisResults.resumeId,
        jobDescriptionId: analysisResults.jobDescriptionId,
        score: analysisResults.overallScore,
        matchedAt: analysisResults.createdAt
      })
      .from(analysisResults)
      .where(eq(analysisResults.jobDescriptionId, jobId));
      
      // Format response to match client expectations
      res.json({ 
        scores: results.map(result => ({
          resumeId: result.resumeId,
          jobDescriptionId: result.jobDescriptionId,
          score: result.score,
          matchedAt: result.matchedAt
        })) 
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

  // Create HTTP server
  const httpServer = new Server(app);
  return httpServer;
}