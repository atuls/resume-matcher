import { Request, Response } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { analysisResults } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Handler function for processing resume red flag analysis
 */
export async function handleRedFlagAnalysis(req: Request, res: Response) {
  // Disable caching for this endpoint
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  try {
    const resumeId = req.params.id;
    const jobDescriptionId = req.query.jobDescriptionId?.toString() || null;
    
    console.log(`Getting red flag analysis for resume ${resumeId} with job ${jobDescriptionId || 'none'}`);
    
    // Fetch the resume
    const resume = await storage.getResume(resumeId);
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }
    
    // Create data container for analysis results
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
    const analysisQuery = jobDescriptionId 
      ? await db.select()
          .from(analysisResults)
          .where(and(
            eq(analysisResults.resumeId, resumeId),
            eq(analysisResults.jobDescriptionId, jobDescriptionId)
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
      // Use the most recent analysis result
      const analysis = analysisQuery[0];
      
      // Try to parse red flags from the analysis
      if (analysis.parsedRedFlags) {
        try {
          const parsedFlags = typeof analysis.parsedRedFlags === 'string'
            ? JSON.parse(analysis.parsedRedFlags)
            : analysis.parsedRedFlags;
            
          if (Array.isArray(parsedFlags)) {
            analysisData.redFlags = parsedFlags;
          }
        } catch (error) {
          console.error("Error parsing red flags:", error);
        }
      }
      
      // Try to parse skills from the analysis
      if (analysis.parsedSkills) {
        try {
          const parsedSkills = typeof analysis.parsedSkills === 'string'
            ? JSON.parse(analysis.parsedSkills)
            : analysis.parsedSkills;
            
          if (Array.isArray(parsedSkills)) {
            analysisData.highlights = parsedSkills;
          } else if (parsedSkills && parsedSkills.highlights) {
            analysisData.highlights = parsedSkills.highlights;
          } else if (parsedSkills && parsedSkills.keySkills) {
            analysisData.highlights = parsedSkills.keySkills;
          }
        } catch (error) {
          console.error("Error parsing skills:", error);
        }
      }
      
      // Try to parse work history from the analysis
      if (analysis.parsedWorkHistory) {
        try {
          const parsedWorkHistory = typeof analysis.parsedWorkHistory === 'string'
            ? JSON.parse(analysis.parsedWorkHistory)
            : analysis.parsedWorkHistory;
            
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
        } catch (error) {
          console.error("Error parsing work history:", error);
        }
      }
      
      // If we don't have data from parsed fields, try to extract from raw response
      if ((!analysisData.redFlags.length || !analysisData.highlights.length) && analysis.rawResponse) {
        try {
          const rawData = typeof analysis.rawResponse === 'string'
            ? JSON.parse(analysis.rawResponse)
            : analysis.rawResponse;
            
          if (rawData) {
            // Extract red flags if missing
            if (!analysisData.redFlags.length) {
              if (Array.isArray(rawData.redFlags)) {
                analysisData.redFlags = rawData.redFlags;
              } else if (rawData.analysis && Array.isArray(rawData.analysis.redFlags)) {
                analysisData.redFlags = rawData.analysis.redFlags;
              }
            }
            
            // Extract highlights if missing
            if (!analysisData.highlights.length) {
              if (Array.isArray(rawData.highlights)) {
                analysisData.highlights = rawData.highlights;
              } else if (rawData.analysis && Array.isArray(rawData.analysis.highlights)) {
                analysisData.highlights = rawData.analysis.highlights;
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
          }
        } catch (error) {
          console.error("Error extracting data from raw response:", error);
        }
      }
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
}