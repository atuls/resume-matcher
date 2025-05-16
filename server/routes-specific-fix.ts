import express, { Express, Request, Response, NextFunction } from "express";
import http, { Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "./db";
import { 
  analysisResults, 
  candidateConnections, 
  jobDescriptions, 
  jobRequirements, 
  resumes, 
  settings 
} from "@shared/schema";

// Register API route handlers
export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = http.createServer(app);
  
  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Handle red flag analysis endpoint - without duplicate variables
  app.get("/api/resumes/:id/red-flag-analysis", async (req: Request, res: Response) => {
    // Disable caching for this endpoint
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    try {
      const resumeId = req.params.id;
      const jobDescriptionId = req.query.jobDescriptionId?.toString() || null;
      
      // Fetch the resume
      const resume = await storage.getResume(resumeId);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Default values object to avoid duplicate declarations
      const analysisData = {
        currentJobPosition: null,
        currentCompany: null,
        isCurrentlyEmployed: false,
        redFlags: [] as string[],
        highlights: [] as string[],
        recentRoles: [] as Array<{ title: string; company: string; durationMonths: number; isContract: boolean }>,
        averageTenureMonths: 0
      };
      
      // Get analysis results from database
      try {
        // Query the database for analysis results
        const analysisResults = await storage.getAnalysisResultsByResume(resumeId);
        
        if (analysisResults && analysisResults.length > 0) {
          // Find the relevant analysis (job-specific or most recent)
          const relevantAnalysis = jobDescriptionId
            ? analysisResults.find(a => a.jobDescriptionId === jobDescriptionId) || analysisResults[0]
            : analysisResults[0];
          
          // Try to parse the red flags
          if (relevantAnalysis.parsedRedFlags) {
            try {
              const parsedFlags = typeof relevantAnalysis.parsedRedFlags === 'string' 
                ? JSON.parse(relevantAnalysis.parsedRedFlags)
                : relevantAnalysis.parsedRedFlags;
                
              if (Array.isArray(parsedFlags)) {
                analysisData.redFlags = parsedFlags;
              }
            } catch (err) {
              console.error("Error parsing red flags:", err);
            }
          }
          
          // Try to parse the skills
          if (relevantAnalysis.parsedSkills) {
            try {
              const parsedSkills = typeof relevantAnalysis.parsedSkills === 'string'
                ? JSON.parse(relevantAnalysis.parsedSkills)
                : relevantAnalysis.parsedSkills;
                
              if (Array.isArray(parsedSkills)) {
                analysisData.highlights = parsedSkills;
              } else if (parsedSkills && parsedSkills.highlights) {
                analysisData.highlights = parsedSkills.highlights;
              } else if (parsedSkills && parsedSkills.keySkills) {
                analysisData.highlights = parsedSkills.keySkills;
              }
            } catch (err) {
              console.error("Error parsing skills:", err);
            }
          }
          
          // Try to parse the work history
          if (relevantAnalysis.parsedWorkHistory) {
            try {
              const parsedWorkHistory = typeof relevantAnalysis.parsedWorkHistory === 'string'
                ? JSON.parse(relevantAnalysis.parsedWorkHistory)
                : relevantAnalysis.parsedWorkHistory;
                
              if (parsedWorkHistory) {
                if (parsedWorkHistory.currentJobPosition) {
                  analysisData.currentJobPosition = parsedWorkHistory.currentJobPosition;
                }
                if (parsedWorkHistory.currentCompany) {
                  analysisData.currentCompany = parsedWorkHistory.currentCompany;
                }
                if (parsedWorkHistory.isCurrentlyEmployed !== undefined) {
                  analysisData.isCurrentlyEmployed = parsedWorkHistory.isCurrentlyEmployed;
                }
                if (Array.isArray(parsedWorkHistory.recentRoles)) {
                  analysisData.recentRoles = parsedWorkHistory.recentRoles;
                }
                if (parsedWorkHistory.averageTenureMonths) {
                  analysisData.averageTenureMonths = parsedWorkHistory.averageTenureMonths;
                }
              }
            } catch (err) {
              console.error("Error parsing work history:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error retrieving analysis results:", err);
      }
      
      // Return the analysis data
      return res.status(200).json({
        resumeId,
        jobDescriptionId,
        analysis: analysisData
      });
    } catch (error) {
      console.error("Error in red flag analysis:", error);
      return res.status(500).json({ message: "Error processing red flag analysis" });
    }
  });
  
  // Return the server for use in index.ts
  return httpServer;
}