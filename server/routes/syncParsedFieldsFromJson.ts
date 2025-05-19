/**
 * Endpoint to sync individual parsed fields from parsedJson data
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { analysisResults } from '../../shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const router = Router();

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
    
    // Process each result
    for (const result of results) {
      try {
        const parsedJson = result.parsedJson;
        if (!parsedJson) {
          skipped++;
          continue;
        }
        
        // Fields to update
        const updates: any = {};
        
        // Extract skills from parsedJson if they exist
        if (Array.isArray(parsedJson.skills) && parsedJson.skills.length > 0) {
          updates.parsedSkills = parsedJson.skills;
        }
        
        // Extract work history from parsedJson if it exists
        if (Array.isArray(parsedJson.workHistory) && parsedJson.workHistory.length > 0) {
          updates.parsedWorkHistory = parsedJson.workHistory;
        }
        
        // Extract red flags from parsedJson if they exist
        if (Array.isArray(parsedJson.redFlags) && parsedJson.redFlags.length > 0) {
          updates.parsedRedFlags = parsedJson.redFlags;
        }
        
        // Extract summary from parsedJson if it exists
        if (parsedJson.summary) {
          updates.parsedSummary = parsedJson.summary;
        }
        
        // If we have updates to make, update the record
        if (Object.keys(updates).length > 0) {
          await db
            .update(analysisResults)
            .set(updates)
            .where(eq(analysisResults.id, result.id));
          
          updated++;
        } else {
          skipped++;
        }
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
    
    // Process each result
    for (const result of results) {
      try {
        const parsedJson = result.parsedJson;
        if (!parsedJson) {
          skipped++;
          continue;
        }
        
        // Fields to update
        const updates: any = {};
        
        // Extract skills from parsedJson if they exist
        if (Array.isArray(parsedJson.skills) && parsedJson.skills.length > 0) {
          updates.parsedSkills = parsedJson.skills;
        }
        
        // Extract work history from parsedJson if it exists
        if (Array.isArray(parsedJson.workHistory) && parsedJson.workHistory.length > 0) {
          updates.parsedWorkHistory = parsedJson.workHistory;
        }
        
        // Extract red flags from parsedJson if they exist
        if (Array.isArray(parsedJson.redFlags) && parsedJson.redFlags.length > 0) {
          updates.parsedRedFlags = parsedJson.redFlags;
        }
        
        // Extract summary from parsedJson if it exists
        if (parsedJson.summary) {
          updates.parsedSummary = parsedJson.summary;
        }
        
        // If we have updates to make, update the record
        if (Object.keys(updates).length > 0) {
          await db
            .update(analysisResults)
            .set(updates)
            .where(eq(analysisResults.id, result.id));
          
          updated++;
        } else {
          skipped++;
        }
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