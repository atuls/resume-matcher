/**
 * Migration to add a new parsedJson field to the analysis_results table
 * This field will store the extracted JSON data from the raw_response
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addParsedJsonToAnalysisResults() {
  console.log("Running migration: addParsedJsonToAnalysisResults");
  
  // Check if the parsed_json column already exists
  try {
    // Try querying using the new column to see if it exists
    await db.execute(sql`
      SELECT parsed_json FROM analysis_results LIMIT 1;
    `);
    
    // If no error was thrown, the column exists
    console.log("parsedJson field already exists in analysis_results table");
    return;
  } catch (err) {
    // If error was thrown, the column doesn't exist - continue with migration
    console.log("parsedJson field does not exist yet, creating it now");
  }
  
  // Add the parsed_json column
  console.log("Adding parsedJson field to analysis_results table");
  await db.execute(sql`
    ALTER TABLE analysis_results
    ADD COLUMN parsed_json JSONB;
  `);
  
  console.log("parsedJson field added successfully");
}