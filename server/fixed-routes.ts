import { Express, Request, Response, NextFunction } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  analysisResults,
  jobDescriptions,
  jobRequirements,
  resumes,
  candidateJobConnections,
  rawAnalysisResults
} from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
import { count, desc, eq, and, not, like, gt, lt, isNull, sql, asc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import axios from "axios";
import { Claude } from "@anthropic-ai/sdk";
import { MistralClient } from "@mistralai/mistralai";
import OpenAI from "openai";

// Import handlers for specific endpoints
import { handleRedFlagAnalysis } from "./redFlagAnalyzer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all the routes for your application here
  app.get("/api", (_req: Request, res: Response) => {
    res.json({ message: "API is running" });
  });

  // Return a list of job descriptions
  app.get("/api/job-descriptions", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string || "active";
      let jobDescriptionsList;

      // Based on status parameter, return different job descriptions
      if (status === "archived") {
        jobDescriptionsList = await storage.getArchivedJobDescriptions();
      } else if (status === "active") {
        jobDescriptionsList = await storage.getActiveJobDescriptions();
      } else {
        jobDescriptionsList = await storage.getAllJobDescriptions();
      }

      res.json({ jobDescriptions: jobDescriptionsList });
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

  // Create a new job description
  app.post(
    "/api/job-descriptions",
    async (req: Request, res: Response) => {
      try {
        const insertJobDescriptionSchema = createInsertSchema(jobDescriptions, {
          title: (schema) => schema.title.min(1, "Title is required"),
          description: (schema) => schema.description.min(1, "Description is required"),
        }).omit({ id: true, createdAt: true, updatedAt: true });

        const validatedData = insertJobDescriptionSchema.parse(req.body);
        const newJobDescription = await storage.createJobDescription(validatedData);
        
        res.status(201).json({ jobDescription: newJobDescription });
      } catch (error) {
        console.error("Error creating job description:", error);
        res.status(400).json({ message: "Error creating job description", error: String(error) });
      }
    }
  );

  // Update a job description's basic info (title, company, etc.)
  app.patch("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      const updatedJobDescription = await storage.updateJobDescription(req.params.id, req.body);
      res.json({ jobDescription: updatedJobDescription });
    } catch (error) {
      console.error("Error updating job description:", error);
      res.status(400).json({ message: "Error updating job description", error: String(error) });
    }
  });

  // Update a job description's status (active/archived)
  app.patch("/api/job-descriptions/:id/status", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      const updatedJobDescription = await storage.updateJobDescription(req.params.id, {
        isArchived: req.body.isArchived
      });
      
      res.json({ jobDescription: updatedJobDescription });
    } catch (error) {
      console.error("Error updating job description status:", error);
      res.status(400).json({ message: "Error updating job description status", error: String(error) });
    }
  });

  // Delete a job description
  app.delete("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      await storage.deleteJobDescription(req.params.id);
      res.json({ message: "Job description deleted successfully" });
    } catch (error) {
      console.error("Error deleting job description:", error);
      res.status(500).json({ message: "Error deleting job description", error: String(error) });
    }
  });

  // Get all requirements for a job
  app.get("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      const requirements = await storage.getJobRequirementsByJobId(req.params.id);
      res.json({ requirements });
    } catch (error) {
      console.error("Error fetching job requirements:", error);
      res.status(500).json({ message: "Error fetching job requirements", error: String(error) });
    }
  });

  // Add a new requirement to a job
  app.post("/api/job-descriptions/:id/requirements", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      
      const insertRequirementSchema = createInsertSchema(jobRequirements, {
        requirement: (schema) => schema.requirement.min(1, "Requirement is required"),
      }).omit({ id: true });

      const validatedData = insertRequirementSchema.parse({
        ...req.body,
        jobDescriptionId: req.params.id
      });
      
      const newRequirement = await storage.createJobRequirement(validatedData);
      res.status(201).json({ requirement: newRequirement });
    } catch (error) {
      console.error("Error creating job requirement:", error);
      res.status(400).json({ message: "Error creating job requirement", error: String(error) });
    }
  });

  // Update a job requirement
  app.patch("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      const requirement = await storage.getJobRequirement(req.params.id);
      
      if (!requirement) {
        return res.status(404).json({ message: "Requirement not found" });
      }
      
      const updatedRequirement = await storage.updateJobRequirement(req.params.id, req.body);
      res.json({ requirement: updatedRequirement });
    } catch (error) {
      console.error("Error updating job requirement:", error);
      res.status(400).json({ message: "Error updating job requirement", error: String(error) });
    }
  });

  // Delete a job requirement
  app.delete("/api/job-requirements/:id", async (req: Request, res: Response) => {
    try {
      const requirement = await storage.getJobRequirement(req.params.id);
      
      if (!requirement) {
        return res.status(404).json({ message: "Requirement not found" });
      }
      
      await storage.deleteJobRequirement(req.params.id);
      res.json({ message: "Requirement deleted successfully" });
    } catch (error) {
      console.error("Error deleting job requirement:", error);
      res.status(500).json({ message: "Error deleting job requirement", error: String(error) });
    }
  });

  // Get a list of resumes
  app.get("/api/resumes", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';
      const jobDescriptionId = req.query.jobDescriptionId as string || null;
      
      // Only get resumes that match this job above a certain threshold
      const scoreThreshold = parseInt(req.query.scoreThreshold as string) || 0;
      
      const result = await storage.getResumesWithPagination({ 
        page, 
        limit, 
        search,
        jobDescriptionId,
        scoreThreshold
      });
      
      res.json(result);
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

  // Get red flag analysis for a resume from the database
  app.get("/api/resumes/:id/red-flag-analysis", handleRedFlagAnalysis);

  // The rest of the routes would go here...

  // Create HTTP server
  const httpServer = app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });

  return httpServer;
}