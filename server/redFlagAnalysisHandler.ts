// Import required modules
import { Request, Response } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { analysisResults } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { analyzeRedFlags } from "./services/skillsExtractor";

/**
 * Handler function for the resume red flag analysis endpoint
 */
export async function handleRedFlagAnalysis(req: Request, res: Response) {
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
      
      // If we have a job ID but no analysis, try to perform a quick analysis
      if (jobId) {
        try {
          // Get the job description
          const jobDescription = await storage.getJobDescription(jobId);
          if (jobDescription) {
            // Analyze resume for red flags
            const analysis = await analyzeRedFlags(resume.extractedText, jobDescription.description);
            redFlags = analysis.redFlags;
            highlights = analysis.highlights || [];
          }
        } catch (e) {
          console.error("Error analyzing resume for red flags:", e);
        }
      }
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
}