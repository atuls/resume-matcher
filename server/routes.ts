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
import { handleProcessRawAnalysis } from "./processRawAnalysisEndpoint";
import syncParsedJsonRouter from "./routes/syncParsedJson";
import syncParsedFieldsRouter from "./routes/syncParsedFieldsFromJson";
import enhancedSyncParsedJsonRouter from "./routes/enhancedSyncParsedJson";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all API routes
  app.get("/api", (_req: Request, res: Response) => {
    res.json({ message: "API is running" });
  });
  
  // Register the sync parsed JSON routes
  app.use("/api", syncParsedJsonRouter);
  app.use("/api", syncParsedFieldsRouter);
  app.use("/api", enhancedSyncParsedJsonRouter); // Enhanced version with better field name support
  
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
  
  // Get raw AI response for a resume
  app.get("/api/resumes/:id/raw-response", async (req: Request, res: Response) => {
    try {
      const resumeId = req.params.id;
      const jobDescriptionId = req.query.jobDescriptionId as string;
      
      if (!resumeId) {
        return res.status(400).json({ message: "Resume ID is required" });
      }
      
      // Get the analysis result with the raw response for this resume and job
      let query = { resumeId };
      
      // If job ID is provided, add it to the query
      if (jobDescriptionId) {
        query = { ...query, jobDescriptionId };
      }
      
      // Get the result ordered by creation date (newest first)
      const results = await storage.getAnalysisResultsByFilter(query, { orderBy: 'createdAt', limit: 1 });
      
      if (!results || results.length === 0) {
        return res.status(404).json({ 
          message: "No analysis results found",
          resumeId,
          jobDescriptionId
        });
      }
      
      // Return the raw response from the latest analysis result
      res.json({
        status: "success",
        rawResponse: results[0].rawResponse,
        analysisId: results[0].id,
        createdAt: results[0].createdAt,
        aiModel: results[0].aiModel
      });
    } catch (error) {
      console.error("Error fetching raw AI response:", error);
      res.status(500).json({ 
        message: "Failed to fetch raw AI response",
        error: String(error)
      });
    }
  });

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
        parsingStatus: analysisResults.parsingStatus,
        parsedJson: analysisResults.parsedJson
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
          if (result.parsedWorkHistory) {
            // Ensure we're working with an array
            const workHistory = Array.isArray(result.parsedWorkHistory) 
              ? result.parsedWorkHistory 
              : typeof result.parsedWorkHistory === 'string'
                ? JSON.parse(result.parsedWorkHistory)
                : (result.parsedWorkHistory || []);
            
            if (Array.isArray(workHistory) && workHistory.length > 0) {
              // First look for a position marked as current
              const current = workHistory.find(job => 
                job.isCurrentRole === true || 
                job.isCurrentRole === "true" || 
                job.endDate === "Present" || 
                job.endDate === "Current" ||
                job.current === true ||
                !job.endDate
              );
              
              if (current) {
                // Get title from various possible field names
                const title = current.title || current.Title || current.position || current.Position || current.jobTitle || current.JobTitle || 'Unknown Position';
                
                // Get company from various possible field names
                const company = current.company || current.Company || current.employer || current.Employer || current.organization || current.Organization || 'Unknown Company';
                
                currentPosition = {
                  title,
                  company,
                  current: true
                };
              } else {
                // If no current position, use the most recent by end date or just take the first entry
                try {
                  const sortedWorkHistory = [...workHistory].sort((a, b) => {
                    // Try to sort by end date (most recent first)
                    const dateA = a.endDate ? new Date(a.endDate).getTime() : Date.now();
                    const dateB = b.endDate ? new Date(b.endDate).getTime() : Date.now();
                    return dateB - dateA;
                  });
                  
                  const mostRecent = sortedWorkHistory[0] || workHistory[0];
                  
                  // Get title from various possible field names
                  const title = mostRecent.title || mostRecent.Title || mostRecent.position || mostRecent.Position || mostRecent.jobTitle || mostRecent.JobTitle || 'Unknown Position';
                  
                  // Get company from various possible field names
                  const company = mostRecent.company || mostRecent.Company || mostRecent.employer || mostRecent.Employer || mostRecent.organization || mostRecent.Organization || 'Unknown Company';
                  
                  currentPosition = {
                    title,
                    company,
                    current: !mostRecent.endDate || mostRecent.endDate === 'Present' || mostRecent.endDate === 'Current'
                  };
                } catch (err) {
                  // If sorting fails, just use the first entry
                  const firstEntry = workHistory[0];
                  
                  // Get title from various possible field names
                  const title = firstEntry.title || firstEntry.Title || firstEntry.position || firstEntry.Position || firstEntry.jobTitle || firstEntry.JobTitle || 'Unknown Position';
                  
                  // Get company from various possible field names
                  const company = firstEntry.company || firstEntry.Company || firstEntry.employer || firstEntry.Employer || firstEntry.organization || firstEntry.Organization || 'Unknown Company';
                  
                  currentPosition = {
                    title,
                    company,
                    current: false
                  };
                }
              }
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
  
  // Process raw analysis for a specific job description
  app.post("/api/job-descriptions/:id/process-raw-analysis", handleProcessRawAnalysis);
  
  // Reprocess specific analysis results with nested data structures
  app.post("/api/reprocess/:analysisId", async (req: Request, res: Response) => {
    try {
      const { analysisId } = req.params;
      const { reset = true } = req.body;
      
      console.log(`Reprocessing analysis ID: ${analysisId} (reset=${reset})`);
      
      // Import the parser functions
      const { resetAndReprocessAnalysisResult, processAnalysisResult } = await import("./processProblemRecords");
      
      // Use the reset function if requested, otherwise just process
      const success = reset
        ? await resetAndReprocessAnalysisResult(analysisId)
        : await processAnalysisResult(analysisId);
      
      if (success) {
        res.json({ success: true, message: 'Analysis result processed successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Failed to process analysis result' });
      }
    } catch (error) {
      console.error('Error in reprocess endpoint:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  // Reprocess multiple analysis results by job ID
  app.post("/api/reprocess-job/:jobId", async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { limit = 10, reset = true, useEnhancedParser = false, force = false } = req.body;
      
      console.log(`Reprocessing analysis results for job ID: ${jobId} (limit=${limit}, reset=${reset}, useEnhancedParser=${useEnhancedParser})`);
      
      if (useEnhancedParser) {
        // Use our enhanced parser with field name variation handling
        console.log(`Using enhanced parser for job ${jobId}`);
        
        // First, get records for this job
        const records = await db
          .select({
            id: analysisResults.id,
            rawResponse: analysisResults.rawResponse
          })
          .from(analysisResults)
          .where(eq(analysisResults.jobDescriptionId, jobId))
          .limit(Number(limit));

        console.log(`Found ${records.length} records with rawResponse for job ${jobId}`);
        
        // Process each record with enhanced parser
        let processed = 0;
        let successful = 0;
        
        // Import enhanced parser service
        const { extractRawResponseContent, updateParsedJson } = await import("./services/enhancedResponseParserService");
        
        for (const record of records) {
          processed++;
          if (record.rawResponse) {
            try {
              const success = await updateParsedJson(record.id, record.rawResponse);
              if (success) successful++;
            } catch (err) {
              console.error(`Error processing record ${record.id}:`, err);
            }
          }
        }
        
        res.json({
          success: true,
          message: `Enhanced parsing complete. ${successful} successfully processed out of ${processed} total.`,
          processed,
          successful
        });
      } else {
        // Use standard processing
        // Import function on demand
        const { processAnalysisResultsByJob } = await import("./processProblemRecords");
        
        const result = await processAnalysisResultsByJob(jobId, limit, reset);
        
        res.json({
          success: true,
          message: `Processing complete. ${result.success} successful, ${result.failed} failed out of ${result.total} total.`,
          result
        });
      }
    } catch (error) {
      console.error('Error in reprocess-job endpoint:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
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

  // Endpoint to analyze resumes with the AI services
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
      
      // Get job requirements for this job
      const requirements = await db
        .select()
        .from(jobRequirements)
        .where(eq(jobRequirements.jobDescriptionId, jobDescriptionId))
        .orderBy(desc(jobRequirements.createdAt));
      
      console.log(`Starting analysis of ${resumeIds.length} resumes for job ${jobDescriptionId}`);
      
      // Import the AI service functions
      const { analyzeResume } = await import("./services/aiService");
      
      // For each resume in the batch, start an analysis
      const results = [];
      
      for (const resumeId of resumeIds) {
        try {
          // Get the resume content
          const resume = await storage.getResume(resumeId);
          if (!resume) {
            console.error(`Resume with ID ${resumeId} not found, skipping`);
            continue;
          }
          
          // Use the AI service to analyze this resume
          const analysisResult = await analyzeResume(
            resume.extractedText, 
            jobDescription.description,
            requirements.map(req => ({
              requirement: req.requirement,
              importance: req.importance,
              tags: req.tags || []
            }))
          );
          
          // Extract skills from the analysis result
          let parsedSkills = [];
          try {
            if (analysisResult.skillMatches && Array.isArray(analysisResult.skillMatches)) {
              // Extract skills that had a full or partial match
              parsedSkills = analysisResult.skillMatches
                .filter(match => match.match === 'full' || match.match === 'partial')
                .map(match => match.requirement);
            }
          } catch (e) {
            console.error("Error extracting skills from analysis:", e);
          }
          
          // Create mock work history if not available
          const workHistory = [
            {
              title: analysisResult.candidateTitle || "Unknown Position",
              company: "Current Company",
              startDate: "Unknown",
              endDate: "Present",
              description: "Current position"
            }
          ];
          
          // Create a record of this analysis
          const createdAnalysis = await storage.createAnalysisResult({
            resumeId,
            jobDescriptionId,
            overallScore: analysisResult.overallScore,
            skillMatches: analysisResult.skillMatches || {},
            parsedSkills,
            parsedWorkHistory: workHistory,
            parsedSummary: `Match score: ${analysisResult.overallScore}`,
            parsedRedFlags: [],
            rawResponse: analysisResult.rawResponse,
            aiModel: analysisResult.aiModel,
            parsingStatus: "complete"
          });
          
          results.push({
            resumeId,
            jobDescriptionId,
            score: analysisResult.overallScore,
            skills: parsedSkills,
            candidateName: resume.candidateName || analysisResult.candidateName || "Unknown",
            matchedAt: createdAnalysis.createdAt,
            analysis: createdAnalysis
          });
          
          // Update the resume record with the candidate name if it's blank and we found one
          if (!resume.candidateName && analysisResult.candidateName) {
            await storage.updateResume(resumeId, {
              candidateName: analysisResult.candidateName
            });
          }
          
          // Update the resume record with the candidate title if it's blank and we found one
          if (!resume.candidateTitle && analysisResult.candidateTitle) {
            await storage.updateResume(resumeId, {
              candidateTitle: analysisResult.candidateTitle
            });
          }
        } catch (error) {
          console.error(`Error analyzing resume ${resumeId}:`, error);
          // Continue with the next resume instead of failing the entire batch
        }
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
      const { jobDescriptionId, batchSize = 10, startProcessing = false, processAll = false } = req.body;
      
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
      
      // If processAll is true, return all unanalyzed resumes
      // Otherwise, take just the requested batch size
      let resumesToProcess;
      if (processAll) {
        // When processing all, return all unanalyzed resumes
        resumesToProcess = unanalyzedResumes;
      } else {
        // Otherwise limit to batch size
        resumesToProcess = unanalyzedResumes.slice(0, batchSize);
      }
      const unanalyzedResumeIds = resumesToProcess.map(resume => resume.id);
      
      const totalUnanalyzed = unanalyzedResumes.length;
      const processingCount = unanalyzedResumeIds.length;
      
      // Return information about the unanalyzed resumes
      res.json({
        message: processAll 
          ? `Processing all ${processingCount} unanalyzed resumes for job ${jobDescriptionId}` 
          : `Found ${processingCount} unanalyzed resumes for job ${jobDescriptionId} (${totalUnanalyzed} total)`,
        pendingCount: totalUnanalyzed - processingCount,
        processingCount: processingCount,
        resumeIds: unanalyzedResumeIds,
        totalUnanalyzed: totalUnanalyzed
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
  
  // Endpoint to reprocess and fix structured data for a specific analysis result
  app.post('/api/analysis-results/:id/reprocess', async (req, res) => {
    const { id } = req.params;
    
    try {
      console.log(`Reprocessing analysis result: ${id}`);
      const { syncSingleParsedJson } = await import('./services/syncParsedJsonService');
      
      const success = await syncSingleParsedJson(id);
      
      if (success) {
        return res.json({ 
          status: "success", 
          message: "Analysis result successfully reprocessed"
        });
      } else {
        return res.status(404).json({ 
          status: "error", 
          message: "Failed to reprocess analysis result - record not found or no meaningful data extracted" 
        });
      }
    } catch (error) {
      console.error(`Error reprocessing analysis result ${id}:`, error);
      res.status(500).json({ 
        status: "error", 
        message: "Error during reprocessing"
      });
    }
  });
  
  // Create HTTP server
  const httpServer = new Server(app);
  return httpServer;
}