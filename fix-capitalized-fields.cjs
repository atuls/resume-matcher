/**
 * Fix Empty Parsed Fields - Capitalized Fields Version
 * 
 * This script specifically fixes analysis results that have capitalized field names
 * in the raw_response (such as "Work History" instead of "work_history").
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// The specific job ID we're focusing on
const JOB_ID = 'f17e9b1c-9e63-4ed5-9cae-a307b37c95ff';

/**
 * Extract the work history, red flags, summary, and skills from a raw response object
 * with special handling for capitalized field names
 */
function extractDataFromRawResponse(rawResponse) {
  if (!rawResponse) return null;
  
  console.log(`Processing raw response of type: ${typeof rawResponse}`);
  
  // Ensure rawResponse is an object
  if (typeof rawResponse === 'string') {
    try {
      rawResponse = JSON.parse(rawResponse);
    } catch (e) {
      console.error('Failed to parse rawResponse as JSON', e);
      return null;
    }
  }
  
  const result = {
    workHistory: [],
    redFlags: [],
    summary: '',
    skills: [],
    score: null
  };
  
  // Try to get score with various field names
  if (rawResponse.matching_score) {
    result.score = rawResponse.matching_score;
  } else if (rawResponse.score) {
    result.score = rawResponse.score;
  } else if (rawResponse.matchingScore) {
    result.score = rawResponse.matchingScore;
  }
  
  // Check for capitalized field names at the top level
  if (rawResponse["Work History"] && Array.isArray(rawResponse["Work History"])) {
    result.workHistory = rawResponse["Work History"];
  }
  
  if (rawResponse["Red Flags"] && Array.isArray(rawResponse["Red Flags"])) {
    result.redFlags = rawResponse["Red Flags"];
  }
  
  if (rawResponse["Summary"] && typeof rawResponse["Summary"] === 'string') {
    result.summary = rawResponse["Summary"];
  }
  
  if (rawResponse["Skills"] && Array.isArray(rawResponse["Skills"])) {
    result.skills = rawResponse["Skills"];
  }
  
  // CASE: From rawResponse.rawResponse (nested structure)
  if (rawResponse.rawResponse) {
    // Try to parse if it's a string
    let nestedRawResponse = rawResponse.rawResponse;
    if (typeof nestedRawResponse === 'string') {
      try {
        nestedRawResponse = JSON.parse(nestedRawResponse);
      } catch (e) {
        // Failed to parse as JSON, continue with other checks
      }
    }
    
    // If we have a valid object
    if (typeof nestedRawResponse === 'object' && nestedRawResponse !== null) {
      // Check for rawText containing JSON
      if (nestedRawResponse.rawText && typeof nestedRawResponse.rawText === 'string') {
        try {
          const rawTextJson = JSON.parse(nestedRawResponse.rawText);
          
          // Check for capitalized field names in rawText
          if (rawTextJson["Work History"] && Array.isArray(rawTextJson["Work History"])) {
            result.workHistory = rawTextJson["Work History"];
          }
          
          if (rawTextJson["Red Flags"] && Array.isArray(rawTextJson["Red Flags"])) {
            result.redFlags = rawTextJson["Red Flags"];
          }
          
          if (rawTextJson["Summary"] && typeof rawTextJson["Summary"] === 'string') {
            result.summary = rawTextJson["Summary"];
          }
          
          if (rawTextJson["Skills"] && Array.isArray(rawTextJson["Skills"])) {
            result.skills = rawTextJson["Skills"];
          }
          
          // Check for score
          if (rawTextJson.matching_score) {
            result.score = rawTextJson.matching_score;
          }
        } catch (e) {
          console.error('Failed to parse rawText as JSON', e);
        }
      }
    }
  }
  
  // Ensure that fields are the expected types
  if (!Array.isArray(result.workHistory)) result.workHistory = [];
  if (!Array.isArray(result.redFlags)) result.redFlags = [];
  if (!Array.isArray(result.skills)) result.skills = [];
  if (typeof result.summary !== 'string') result.summary = '';
  
  return result;
}

/**
 * Main function to fix empty parsed fields with capitalized field names
 */
async function fixCapitalizedFields() {
  const client = await pool.connect();
  
  try {
    console.log(`Starting to fix empty parsed fields with capitalized field names for job ID: ${JOB_ID}...`);
    
    // Find records for the specific job that have raw_response but empty parsed_work_history
    const incompleteRecordsQuery = `
      SELECT id, raw_response, overall_score 
      FROM analysis_results 
      WHERE job_description_id = $1
      AND raw_response IS NOT NULL
      AND (
        parsed_work_history IS NULL OR 
        parsed_work_history = '[]'
      )
      AND raw_response::text LIKE '%Work History%'
      LIMIT 100
    `;
    
    const incompleteRecordsResult = await client.query(incompleteRecordsQuery, [JOB_ID]);
    const incompleteRecords = incompleteRecordsResult.rows;
    
    console.log(`Found ${incompleteRecords.length} records with capitalized field names to fix for job ID: ${JOB_ID}`);
    
    let successCount = 0;
    let errorCount = 0;
    let noDataCount = 0;
    
    // Process each record
    for (const record of incompleteRecords) {
      try {
        console.log(`Processing record ${record.id}...`);
        
        // Extract data from raw_response with special handling for capitalized fields
        const extractedData = extractDataFromRawResponse(record.raw_response);
        
        if (!extractedData) {
          console.log(`No data could be extracted from record ${record.id}`);
          noDataCount++;
          continue;
        }
        
        const { workHistory, redFlags, summary, skills, score } = extractedData;
        
        console.log(`Extracted data from record ${record.id}:`);
        console.log(`- Work History: ${workHistory.length} entries`);
        console.log(`- Red Flags: ${redFlags.length} entries`);
        console.log(`- Summary: ${summary ? 'Yes' : 'No'}`);
        console.log(`- Skills: ${skills.length} entries`);
        console.log(`- Score: ${score}`);
        
        // Skip if we couldn't extract work history (our main focus)
        if (workHistory.length === 0) {
          console.log(`No work history extracted for record ${record.id}`);
          noDataCount++;
          continue;
        }
        
        // Create parsedJson field with the extracted data
        const parsedJson = {
          score: score || record.overall_score,
          workHistory,
          redFlags,
          summary,
          skills
        };
        
        // Update the record with SQL
        const updateQuery = `
          UPDATE analysis_results
          SET 
            parsed_work_history = $1,
            parsed_red_flags = $2,
            parsed_summary = $3,
            parsed_skills = $4,
            parsed_json = $5,
            parsing_status = 'complete'
          WHERE id = $6
        `;
        
        const updateValues = [
          workHistory.length > 0 ? JSON.stringify(workHistory) : null,
          redFlags.length > 0 ? JSON.stringify(redFlags) : null,
          summary || null,
          skills.length > 0 ? JSON.stringify(skills) : null,
          JSON.stringify(parsedJson),
          record.id
        ];
        
        await client.query(updateQuery, updateValues);
        
        console.log(`Successfully updated record ${record.id}`);
        successCount++;
      } catch (e) {
        console.error(`Error processing record ${record.id}:`, e);
        errorCount++;
      }
    }
    
    console.log(`Fix capitalized fields completed for job ID: ${JOB_ID}:`);
    console.log(`- Successfully processed ${successCount} records`);
    console.log(`- No meaningful data found in ${noDataCount} records`);
    console.log(`- Errors processing ${errorCount} records`);
    
  } catch (e) {
    console.error('Error fixing capitalized fields:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
fixCapitalizedFields()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });