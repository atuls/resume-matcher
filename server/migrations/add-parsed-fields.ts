import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Migration to add parsed fields to analysis_results table
 */
export async function addParsedFieldsToAnalysisResults() {
  console.log('Running migration: addParsedFieldsToAnalysisResults');
  
  try {
    // Check if columns already exist
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'analysis_results' 
      AND column_name = 'parsed_skills'
    `);
    
    if (result.rows.length > 0) {
      console.log('Parsed fields already exist in analysis_results table');
      return;
    }
    
    // Add the new columns
    await db.execute(sql`
      ALTER TABLE analysis_results
      ADD COLUMN parsed_skills JSONB,
      ADD COLUMN parsed_work_history JSONB,
      ADD COLUMN parsed_red_flags JSONB,
      ADD COLUMN parsed_summary TEXT,
      ADD COLUMN parsing_status TEXT DEFAULT 'pending'
    `);
    
    console.log('Successfully added parsed fields to analysis_results table');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}