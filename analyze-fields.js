/**
 * Field name analysis script (ESM version)
 */
import pkg from 'pg';
const { Pool } = pkg;

// Get the database URL from environment variables
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

// Create a database connection
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Field name variation analysis query
const fieldNameQuery = `
WITH sample AS (
  SELECT id, parsed_json, job_description_id
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

// Specific job field analysis query
const jobFieldsQuery = `
SELECT 
  COUNT(*) as total_records,
  SUM(CASE WHEN parsed_skills IS NOT NULL AND jsonb_array_length(parsed_skills) > 0 THEN 1 ELSE 0 END) as with_parsed_skills,
  SUM(CASE WHEN parsed_work_history IS NOT NULL AND jsonb_array_length(parsed_work_history) > 0 THEN 1 ELSE 0 END) as with_parsed_work_history,
  SUM(CASE WHEN parsed_red_flags IS NOT NULL AND jsonb_array_length(parsed_red_flags) > 0 THEN 1 ELSE 0 END) as with_parsed_red_flags
FROM analysis_results 
WHERE job_description_id = $1;
`;

// Compare before and after using enhanced parser
const compareSyncedRecordsQuery = `
SELECT 
  COUNT(*) as total_records,
  SUM(CASE WHEN parsed_json IS NOT NULL THEN 1 ELSE 0 END) as with_parsed_json,
  SUM(CASE WHEN parsed_skills IS NOT NULL AND jsonb_array_length(parsed_skills) > 0 THEN 1 ELSE 0 END) as with_parsed_skills,
  SUM(CASE WHEN parsed_work_history IS NOT NULL AND jsonb_array_length(parsed_work_history) > 0 THEN 1 ELSE 0 END) as with_parsed_work_history,
  SUM(CASE WHEN parsed_red_flags IS NOT NULL AND jsonb_array_length(parsed_red_flags) > 0 THEN 1 ELSE 0 END) as with_parsed_red_flags
FROM analysis_results
ORDER BY id DESC
LIMIT 200;
`;

async function analyzeFieldNames() {
  try {
    console.log("Analyzing field name variations in the database...");
    
    // Get field name variations
    const { rows: fieldVariations } = await pool.query(fieldNameQuery);
    console.log("\n=== FIELD NAME VARIATIONS ===");
    console.log(fieldVariations[0]);
    
    // Get job-specific stats for the job ID shown in the screenshot
    const jobId = "f17e9b1c-9e63-4ed5-9cae-a307b37c95ff";
    const { rows: jobStats } = await pool.query(jobFieldsQuery, [jobId]);
    console.log("\n=== JOB-SPECIFIC ANALYSIS ===");
    console.log(`Job ID: ${jobId}`);
    console.log(jobStats[0]);
    
    // Get stats for the most recently analyzed records
    const { rows: recentStats } = await pool.query(compareSyncedRecordsQuery);
    console.log("\n=== RECENTLY ANALYZED RECORDS ===");
    console.log(recentStats[0]);
    
    // Analyze the raw_response content
    const rawResponseSample = await pool.query(`
      SELECT raw_response
      FROM analysis_results
      WHERE raw_response IS NOT NULL
      LIMIT 1
    `);
    
    if (rawResponseSample.rows.length > 0) {
      console.log("\n=== RAW RESPONSE SAMPLE ===");
      const sampleRawResponse = rawResponseSample.rows[0].raw_response;
      console.log(sampleRawResponse.substring(0, 200) + "...");
      
      // Check if raw_response contains JSON
      if (sampleRawResponse.includes('{') && sampleRawResponse.includes('}')) {
        console.log("Raw response appears to contain JSON data");
      } else {
        console.log("Raw response does not appear to contain JSON data");
      }
    }
    
    console.log("\nAnalysis complete!");
  } catch (error) {
    console.error("Error analyzing field names:", error);
  } finally {
    await pool.end();
  }
}

analyzeFieldNames();