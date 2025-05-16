const { storage } = require("./storage");
const { db } = require("./db");
const { analysisResults } = require("@shared/schema");
const { eq, and, desc } = require("drizzle-orm");

/**
 * Handler function for the red flag analysis endpoint
 */
async function handleRedFlagAnalysis(req, res) {
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
      currentJobPosition: null,
      currentCompany: null,
      isCurrentlyEmployed: false,
      redFlags: [],
      highlights: [],
      recentRoles: [],
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

module.exports = { handleRedFlagAnalysis };