/**
 * Fix Empty Parsed Fields for Specific Job ID
 * 
 * This script specifically fixes analysis results for job ID f17e9b1c-9e63-4ed5-9cae-a307b37c95ff
 * that have empty parsed work history but data in the raw_response.
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
  
  // Try to get score
  if (rawResponse.matching_score) {
    result.score = rawResponse.matching_score;
  } else if (rawResponse.score) {
    result.score = rawResponse.score;
  }
  
  // CASE 1: Direct fields at the top level
  if (rawResponse.work_history && Array.isArray(rawResponse.work_history)) {
    result.workHistory = rawResponse.work_history;
  }
  
  if (rawResponse.workHistory && Array.isArray(rawResponse.workHistory)) {
    result.workHistory = rawResponse.workHistory;
  }
  
  if (rawResponse.red_flags && Array.isArray(rawResponse.red_flags)) {
    result.redFlags = rawResponse.red_flags;
  }
  
  if (rawResponse.redFlags && Array.isArray(rawResponse.redFlags)) {
    result.redFlags = rawResponse.redFlags;
  }
  
  if (rawResponse.summary && typeof rawResponse.summary === 'string') {
    result.summary = rawResponse.summary;
  }
  
  if (rawResponse.skills && Array.isArray(rawResponse.skills)) {
    result.skills = rawResponse.skills;
  }
  
  // CASE 2: From parsedJson field
  if (rawResponse.parsedJson) {
    const parsedJson = rawResponse.parsedJson;
    
    if (parsedJson.work_history && Array.isArray(parsedJson.work_history)) {
      result.workHistory = parsedJson.work_history;
    }
    
    if (parsedJson.workHistory && Array.isArray(parsedJson.workHistory)) {
      result.workHistory = parsedJson.workHistory;
    }
    
    if (parsedJson.red_flags && Array.isArray(parsedJson.red_flags)) {
      result.redFlags = parsedJson.red_flags;
    }
    
    if (parsedJson.redFlags && Array.isArray(parsedJson.redFlags)) {
      result.redFlags = parsedJson.redFlags;
    }
    
    if (parsedJson.summary && typeof parsedJson.summary === 'string') {
      result.summary = parsedJson.summary;
    }
    
    if (parsedJson.skills && Array.isArray(parsedJson.skills)) {
      result.skills = parsedJson.skills;
    }
  }
  
  // CASE 3: From rawResponse.rawResponse (nested structure)
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
      // Check for parsedJson in nested structure
      if (nestedRawResponse.parsedJson) {
        const parsedJson = nestedRawResponse.parsedJson;
        
        if (parsedJson.work_history && Array.isArray(parsedJson.work_history)) {
          result.workHistory = parsedJson.work_history;
        }
        
        if (parsedJson.workHistory && Array.isArray(parsedJson.workHistory)) {
          result.workHistory = parsedJson.workHistory;
        }
        
        if (parsedJson.red_flags && Array.isArray(parsedJson.red_flags)) {
          result.redFlags = parsedJson.red_flags;
        }
        
        if (parsedJson.redFlags && Array.isArray(parsedJson.redFlags)) {
          result.redFlags = parsedJson.redFlags;
        }
        
        if (parsedJson.summary && typeof parsedJson.summary === 'string') {
          result.summary = parsedJson.summary;
        }
        
        if (parsedJson.skills && Array.isArray(parsedJson.skills)) {
          result.skills = parsedJson.skills;
        }
      }
      
      // Check top level nested fields
      if (nestedRawResponse.work_history && Array.isArray(nestedRawResponse.work_history)) {
        result.workHistory = nestedRawResponse.work_history;
      }
      
      if (nestedRawResponse.workHistory && Array.isArray(nestedRawResponse.workHistory)) {
        result.workHistory = nestedRawResponse.workHistory;
      }
      
      if (nestedRawResponse.red_flags && Array.isArray(nestedRawResponse.red_flags)) {
        result.redFlags = nestedRawResponse.red_flags;
      }
      
      if (nestedRawResponse.redFlags && Array.isArray(nestedRawResponse.redFlags)) {
        result.redFlags = nestedRawResponse.redFlags;
      }
      
      // CRITICAL: Check for extractedSections in nested structure
      if (nestedRawResponse.extractedSections) {
        const sections = nestedRawResponse.extractedSections;
        
        // Work History
        if (sections.workHistory) {
          if (Array.isArray(sections.workHistory)) {
            result.workHistory = sections.workHistory;
          } else if (typeof sections.workHistory === 'string') {
            try {
              const parsed = JSON.parse(sections.workHistory);
              if (Array.isArray(parsed)) {
                result.workHistory = parsed;
              }
            } catch (e) {
              // String couldn't be parsed as JSON
            }
          }
        }
        
        // Red Flags
        if (sections.redFlags) {
          if (Array.isArray(sections.redFlags)) {
            result.redFlags = sections.redFlags;
          } else if (typeof sections.redFlags === 'string') {
            try {
              const parsed = JSON.parse(sections.redFlags);
              if (Array.isArray(parsed)) {
                result.redFlags = parsed;
              }
            } catch (e) {
              // If not parseable, try comma-separated
              result.redFlags = sections.redFlags.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
        }
        
        // Summary
        if (sections.summary && typeof sections.summary === 'string') {
          result.summary = sections.summary;
        }
        
        // Skills
        if (sections.skills) {
          if (Array.isArray(sections.skills)) {
            result.skills = sections.skills;
          } else if (typeof sections.skills === 'string') {
            try {
              const parsed = JSON.parse(sections.skills);
              if (Array.isArray(parsed)) {
                result.skills = parsed;
              } else {
                // Try comma-separated
                result.skills = sections.skills.split(',').map(s => s.trim()).filter(Boolean);
              }
            } catch (e) {
              // If not parseable, try comma-separated
              result.skills = sections.skills.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
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
 * Main function to fix empty parsed fields for specific job ID
 */
async function fixEmptyParsedFieldsForJob() {
  const client = await pool.connect();
  
  try {
    console.log(`Starting to fix empty parsed fields for job ID: ${JOB_ID}...`);
    
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
      LIMIT 100
    `;
    
    const incompleteRecordsResult = await client.query(incompleteRecordsQuery, [JOB_ID]);
    const incompleteRecords = incompleteRecordsResult.rows;
    
    console.log(`Found ${incompleteRecords.length} records to fix for job ID: ${JOB_ID}`);
    
    let successCount = 0;
    let errorCount = 0;
    let noDataCount = 0;
    
    // Process each record
    for (const record of incompleteRecords) {
      try {
        console.log(`Processing record ${record.id}...`);
        
        // Extract data from raw_response
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
    
    console.log(`Fix empty parsed fields completed for job ID: ${JOB_ID}:`);
    console.log(`- Successfully processed ${successCount} records`);
    console.log(`- No meaningful data found in ${noDataCount} records`);
    console.log(`- Errors processing ${errorCount} records`);
    
  } catch (e) {
    console.error('Error fixing empty parsed fields:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
fixEmptyParsedFieldsForJob()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });