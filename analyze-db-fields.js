/**
 * Simple analysis script that inspects field name variations in the database
 */

// Look at both raw_response and parsedJson fields to see
// what field name variations the AI models are using
const query = `
WITH sample AS (
  SELECT id, raw_response, parsed_json, job_description_id
  FROM analysis_results 
  WHERE parsed_json IS NOT NULL
  LIMIT 500
)
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT job_description_id) as unique_jobs,
  SUM(CASE WHEN parsed_json ? 'skills' THEN 1 ELSE 0 END) as has_skills,
  SUM(CASE WHEN parsed_json ? 'Skills' THEN 1 ELSE 0 END) as has_Skills_capitalized,
  SUM(CASE WHEN parsed_json ? 'skill_list' THEN 1 ELSE 0 END) as has_skill_list,
  
  SUM(CASE WHEN parsed_json ? 'workHistory' THEN 1 ELSE 0 END) as has_workHistory,
  SUM(CASE WHEN parsed_json ? 'work_history' THEN 1 ELSE 0 END) as has_work_history,
  SUM(CASE WHEN parsed_json ? 'Work History' THEN 1 ELSE 0 END) as has_Work_History,
  SUM(CASE WHEN parsed_json ? 'work_experience' THEN 1 ELSE 0 END) as has_work_experience,
  SUM(CASE WHEN parsed_json ? 'employment_history' THEN 1 ELSE 0 END) as has_employment_history,
  
  SUM(CASE WHEN parsed_json ? 'redFlags' THEN 1 ELSE 0 END) as has_redFlags,
  SUM(CASE WHEN parsed_json ? 'red_flags' THEN 1 ELSE 0 END) as has_red_flags,
  SUM(CASE WHEN parsed_json ? 'warnings' THEN 1 ELSE 0 END) as has_warnings,
  SUM(CASE WHEN parsed_json ? 'concerns' THEN 1 ELSE 0 END) as has_concerns
FROM sample;
`;

// Analysis of work_history field array sizes to check for empty arrays
const workHistoryAnalysisQuery = `
WITH sample AS (
  SELECT id, parsed_json
  FROM analysis_results 
  WHERE parsed_json IS NOT NULL 
    AND (parsed_json ? 'workHistory' 
      OR parsed_json ? 'work_history'
      OR parsed_json ? 'employment_history'
      OR parsed_json ? 'work_experience')
  LIMIT 500
)
SELECT 
  COUNT(*) as total_with_work_history,
  SUM(CASE WHEN jsonb_array_length(COALESCE(
    parsed_json->'workHistory', 
    parsed_json->'work_history',
    parsed_json->'employment_history',
    parsed_json->'work_experience',
    '[]'::jsonb
  )) = 0 THEN 1 ELSE 0 END) as empty_work_history_arrays,
  ROUND(AVG(jsonb_array_length(COALESCE(
    parsed_json->'workHistory', 
    parsed_json->'work_history',
    parsed_json->'employment_history',
    parsed_json->'work_experience',
    '[]'::jsonb
  ))), 1) as avg_work_history_items
FROM sample;
`;

// Comparison of parsed fields before and after using enhanced parser
const parsedFieldsQuery = `
SELECT
  COUNT(*) as total_records,
  SUM(CASE WHEN parsed_skills IS NOT NULL AND jsonb_array_length(parsed_skills) > 0 THEN 1 ELSE 0 END) as with_parsed_skills,
  SUM(CASE WHEN parsed_work_history IS NOT NULL AND jsonb_array_length(parsed_work_history) > 0 THEN 1 ELSE 0 END) as with_parsed_work_history,
  SUM(CASE WHEN parsed_red_flags IS NOT NULL AND jsonb_array_length(parsed_red_flags) > 0 THEN 1 ELSE 0 END) as with_parsed_red_flags,
  SUM(CASE WHEN parsed_summary IS NOT NULL AND parsed_summary != '' THEN 1 ELSE 0 END) as with_parsed_summary
FROM analysis_results 
WHERE job_description_id = $1;
`;

// Get the database URL from environment variables
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

// Use native Postgres client
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function analyzeFieldNames() {
  try {
    console.log("Analyzing field name variations in database...");
    
    // Run field name variation analysis
    const { rows } = await pool.query(query);
    console.log("\n=== FIELD NAME VARIATIONS ANALYSIS ===");
    console.table(rows[0]);
    
    // Run work history field analysis
    const workHistoryResult = await pool.query(workHistoryAnalysisQuery);
    console.log("\n=== WORK HISTORY FIELD ANALYSIS ===");
    console.table(workHistoryResult.rows[0]);
    
    // Analyze parsed fields for specific jobs
    const jobIds = [
      "f17e9b1c-9e63-4ed5-9cae-a307b37c95ff",  // The job shown in screenshot
      "c52c548e-6c74-4f58-944e-6730e8bfc2ad"   // Another job (if exists)
    ];
    
    for (const jobId of jobIds) {
      console.log(`\n=== PARSED FIELDS ANALYSIS FOR JOB ${jobId} ===`);
      const jobResult = await pool.query(parsedFieldsQuery, [jobId]);
      console.table(jobResult.rows[0]);
    }
    
    console.log("\nAnalysis complete!");
  } catch (error) {
    console.error("Error analyzing fields:", error);
  } finally {
    await pool.end();
  }
}

analyzeFieldNames();