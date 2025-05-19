/**
 * Enhanced endpoint to sync individual parsed fields from parsedJson data
 * Handles multiple variations of field names (workHistory, work_history, etc.)
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { analysisResults } from '../../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const router = Router();

/**
 * Helper function to extract a field from parsedJson with multiple possible key names
 */
function extractFromJson(json: any, possibleKeys: string[], defaultValue: any = null) {
  if (!json || typeof json !== 'object') return defaultValue;
  
  for (const key of possibleKeys) {
    if (json[key] !== undefined) {
      return json[key];
    }
  }
  
  return defaultValue;
}

/**
 * POST /api/sync-parsed-fields
 * Syncs individual parsed fields (parsedSkills, parsedWorkHistory, etc.) from parsedJson for all records
 */
router.post('/sync-parsed-fields', async (req: Request, res: Response) => {
  try {
    const { batchSize = 100 } = req.body;
    
    // Get records that have parsedJson but may have empty individual fields
    const results = await db
      .select()
      .from(analysisResults)
      .where(and(
        isNotNull(analysisResults.parsedJson)
      ))
      .limit(Number(batchSize));
    
    console.log(`Found ${results.length} records with parsedJson to sync individual fields`);
    
    let updated = 0;
    let skipped = 0;
    
    // Define possible key names for each field
    const skillsKeys = ['skills', 'Skills', 'skill_list', 'skillList', 'key_skills'];
    const workHistoryKeys = [
      'workHistory', 'work_history', 'work-history', 'Work History', 
      'work experience', 'workExperience', 'employment_history', 'employmentHistory',
      'jobs', 'positions', 'career_history'
    ];
    const redFlagsKeys = [
      'redFlags', 'red_flags', 'red-flags', 'Red Flags', 
      'warnings', 'concerns', 'issues', 'potential_issues'
    ];
    const summaryKeys = ['summary', 'Summary', 'overview', 'Overview', 'profile', 'Profile'];
    
    // Process each result
    for (const result of results) {
      try {
        const parsedJson = result.parsedJson;
        if (!parsedJson) {
          skipped++;
          continue;
        }
        
        // Extract skills with multiple possible key names
        const skills = extractFromJson(parsedJson, skillsKeys, []);
        const parsedSkills = Array.isArray(skills) ? skills : [];
        
        // Extract work history with multiple possible key names
        const workHistory = extractFromJson(parsedJson, workHistoryKeys, []);
        const parsedWorkHistory = Array.isArray(workHistory) ? workHistory : [];
        
        // Extract red flags with multiple possible key names
        const redFlags = extractFromJson(parsedJson, redFlagsKeys, []);
        const parsedRedFlags = Array.isArray(redFlags) ? redFlags : [];
        
        // Extract summary with multiple possible key names
        const summary = extractFromJson(parsedJson, summaryKeys, '');
        const parsedSummary = typeof summary === 'string' ? summary : '';
        
        // Always update all fields, even if empty - ensures consistent state
        const updates: Record<string, any> = {
          parsedSkills,
          parsedWorkHistory,
          parsedRedFlags,
          parsedSummary,
          
          // Mark record as complete
          parsingStatus: "complete",
          updatedAt: new Date()
        };
        
        // Log if we found work history to help debug
        if (parsedWorkHistory.length > 0) {
          console.log(`Found work history with ${parsedWorkHistory.length} entries for record ${result.id}`);
        }
        
        // Update the record with consistent data
        await db
          .update(analysisResults)
          .set(updates)
          .where(eq(analysisResults.id, result.id));
        
        updated++;
      } catch (error) {
        console.error(`Error syncing fields for record ${result.id}:`, error);
        skipped++;
      }
    }
    
    res.json({
      success: true,
      message: `Updated ${updated} records, skipped ${skipped}`,
      updated,
      skipped,
      total: results.length
    });
  } catch (error) {
    console.error('Error syncing parsed fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing parsed fields',
      error: (error as Error).message
    });
  }
});

/**
 * POST /api/sync-parsed-fields/:jobId
 * Syncs individual parsed fields from parsedJson for a specific job description
 */
router.post('/sync-parsed-fields/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    // Get records that have parsedJson for this job
    const results = await db
      .select()
      .from(analysisResults)
      .where(and(
        eq(analysisResults.jobDescriptionId, jobId),
        isNotNull(analysisResults.parsedJson)
      ));
    
    console.log(`Found ${results.length} records with parsedJson for job ${jobId}`);
    
    let updated = 0;
    let skipped = 0;
    
    // Define possible key names for each field
    const skillsKeys = ['skills', 'Skills', 'skill_list', 'skillList', 'key_skills'];
    const workHistoryKeys = [
      'workHistory', 'work_history', 'work-history', 'Work History', 
      'work experience', 'workExperience', 'employment_history', 'employmentHistory',
      'jobs', 'positions', 'career_history'
    ];
    const redFlagsKeys = [
      'redFlags', 'red_flags', 'red-flags', 'Red Flags', 
      'warnings', 'concerns', 'issues', 'potential_issues'
    ];
    const summaryKeys = ['summary', 'Summary', 'overview', 'Overview', 'profile', 'Profile'];
    
    // Process each result
    for (const result of results) {
      try {
        const parsedJson = result.parsedJson;
        if (!parsedJson) {
          skipped++;
          continue;
        }
        
        // Extract skills with multiple possible key names
        const skills = extractFromJson(parsedJson, skillsKeys, []);
        const parsedSkills = Array.isArray(skills) ? skills : [];
        
        // Extract work history with multiple possible key names
        const workHistory = extractFromJson(parsedJson, workHistoryKeys, []);
        const parsedWorkHistory = Array.isArray(workHistory) ? workHistory : [];
        
        // Extract red flags with multiple possible key names
        const redFlags = extractFromJson(parsedJson, redFlagsKeys, []);
        const parsedRedFlags = Array.isArray(redFlags) ? redFlags : [];
        
        // Extract summary with multiple possible key names
        const summary = extractFromJson(parsedJson, summaryKeys, '');
        const parsedSummary = typeof summary === 'string' ? summary : '';
        
        // Always update all fields, even if empty - ensures consistent state
        const updates: Record<string, any> = {
          parsedSkills,
          parsedWorkHistory,
          parsedRedFlags,
          parsedSummary,
          
          // Mark record as complete
          parsingStatus: "complete",
          updatedAt: new Date()
        };
        
        // Log if we found work history to help debug
        if (parsedWorkHistory.length > 0) {
          console.log(`Found work history with ${parsedWorkHistory.length} entries for record ${result.id}`);
        }
        
        // Update the record with consistent data
        await db
          .update(analysisResults)
          .set(updates)
          .where(eq(analysisResults.id, result.id));
        
        updated++;
      } catch (error) {
        console.error(`Error syncing fields for record ${result.id}:`, error);
        skipped++;
      }
    }
    
    res.json({
      success: true,
      message: `Updated ${updated} records, skipped ${skipped}`,
      updated,
      skipped,
      total: results.length
    });
  } catch (error) {
    console.error(`Error syncing parsed fields for job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error syncing parsed fields',
      error: (error as Error).message
    });
  }
});

export default router;