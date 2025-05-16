import { Request, Response } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { analysisResults } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Handles the red flag analysis endpoint
 * This avoids the duplicate variable declaration issues in the main routes.ts file
 */
export async function handleRedFlagAnalysis(req: Request, res: Response) {
  // Add cache control headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  try {
    const resumeId = req.params.id;
    const jobId = req.query.jobDescriptionId?.toString() || null;
    
    console.log(`Getting red flag analysis for resume ${resumeId} with job ${jobId || 'none'}`);
    
    // Fetch the resume
    const resume = await storage.getResume(resumeId);
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }
    
    // Create an object to hold analysis data
    const analysisData = {
      currentJobPosition: null as string | null,
      currentCompany: null as string | null,
      isCurrentlyEmployed: false,
      redFlags: [] as string[],
      highlights: [] as string[],
      recentRoles: [] as Array<{ title: string; company: string; durationMonths: number; isContract: boolean }>,
      averageTenureMonths: 0
    };
    
    // Query the database for analysis results
    const analysisQuery = jobId 
      ? await db.select()
          .from(analysisResults)
          .where(and(
            eq(analysisResults.resumeId, resumeId),
            eq(analysisResults.jobDescriptionId, jobId)
          ))
          .orderBy(desc(analysisResults.createdAt))
          .limit(1)
      : await db.select()
          .from(analysisResults)
          .where(eq(analysisResults.resumeId, resumeId))
          .orderBy(desc(analysisResults.createdAt))
          .limit(1);
    
    console.log(`Found ${analysisQuery.length} analysis results for resume ${resumeId}`);
    
    if (analysisQuery.length > 0) {
      // Process the latest analysis
      const latestAnalysis = analysisQuery[0];
      
      // Extract red flags
      if (latestAnalysis.parsedRedFlags) {
        try {
          const parsedRedFlags = typeof latestAnalysis.parsedRedFlags === 'string'
            ? JSON.parse(latestAnalysis.parsedRedFlags)
            : latestAnalysis.parsedRedFlags;
          
          if (Array.isArray(parsedRedFlags)) {
            analysisData.redFlags = parsedRedFlags;
          }
        } catch (e) {
          console.error("Error parsing red flags:", e);
        }
      }
      
      // Extract work history
      if (latestAnalysis.parsedWorkHistory) {
        try {
          const parsedWorkHistory = typeof latestAnalysis.parsedWorkHistory === 'string'
            ? JSON.parse(latestAnalysis.parsedWorkHistory)
            : latestAnalysis.parsedWorkHistory;
          
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
        } catch (e) {
          console.error("Error parsing work history:", e);
        }
      }
      
      // Extract skills
      if (latestAnalysis.parsedSkills) {
        try {
          const parsedSkills = typeof latestAnalysis.parsedSkills === 'string'
            ? JSON.parse(latestAnalysis.parsedSkills)
            : latestAnalysis.parsedSkills;
          
          if (Array.isArray(parsedSkills)) {
            analysisData.highlights = parsedSkills;
          } else if (parsedSkills && parsedSkills.highlights) {
            analysisData.highlights = parsedSkills.highlights;
          } else if (parsedSkills && parsedSkills.keySkills) {
            analysisData.highlights = parsedSkills.keySkills;
          }
        } catch (e) {
          console.error("Error parsing skills:", e);
        }
      }
      
      // Try to extract from raw response if no data from parsed fields
      if (latestAnalysis.rawResponse) {
        try {
          let rawData = typeof latestAnalysis.rawResponse === 'string'
            ? JSON.parse(latestAnalysis.rawResponse)
            : latestAnalysis.rawResponse;
          
          // Extract red flags if missing
          if (analysisData.redFlags.length === 0 && Array.isArray(rawData.redFlags)) {
            analysisData.redFlags = rawData.redFlags;
          }
          
          // Extract highlights if missing
          if (analysisData.highlights.length === 0) {
            if (Array.isArray(rawData.highlights)) {
              analysisData.highlights = rawData.highlights;
            } else if (rawData.keySkills && Array.isArray(rawData.keySkills)) {
              analysisData.highlights = rawData.keySkills;
            }
          }
          
          // Extract current job position if missing
          if (!analysisData.currentJobPosition) {
            if (rawData.currentJobPosition) {
              analysisData.currentJobPosition = rawData.currentJobPosition;
            } else if (rawData.currentPosition) {
              analysisData.currentJobPosition = rawData.currentPosition;
            }
          }
          
          // Extract current company if missing
          if (!analysisData.currentCompany && rawData.currentCompany) {
            analysisData.currentCompany = rawData.currentCompany;
          }
        } catch (e) {
          console.error("Error processing raw response:", e);
        }
      }
    }
    
    // Return the analysis data
    return res.status(200).json({
      resumeId,
      jobDescriptionId: jobId,
      analysis: analysisData
    });
  } catch (error) {
    console.error("Error in red flag analysis:", error);
    return res.status(500).json({ message: "Error processing red flag analysis", error: String(error) });
  }
}