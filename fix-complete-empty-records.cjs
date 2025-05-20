/**
 * Fix Complete But Empty Records Script
 * 
 * This script specifically targets records that have a 'complete' parsing status
 * but still have empty parsed fields.
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Main function to fix complete but empty records
 */
async function fixCompleteEmptyRecords() {
  const client = await pool.connect();
  
  try {
    console.log('Starting to fix records with "complete" status but empty parsed fields...');
    
    // Find records that have 'complete' status but empty parsed_work_history
    const incompleteRecordsQuery = `
      SELECT 
        a1.id,
        a1.resume_id,
        a1.job_description_id,
        a1.overall_score,
        a2.id as source_record_id,
        a2.parsed_work_history IS NOT NULL 
          AND a2.parsed_work_history != '[]' as has_work_history,
        a2.parsed_red_flags IS NOT NULL 
          AND a2.parsed_red_flags != '[]' as has_red_flags,
        a2.parsed_summary IS NOT NULL 
          AND a2.parsed_summary != '' as has_summary
      FROM analysis_results a1
      -- Join with other analysis_results for the same resume that have valid data
      JOIN analysis_results a2 ON a1.resume_id = a2.resume_id AND a1.id != a2.id
      WHERE a1.parsing_status = 'complete'
      AND (
        a1.parsed_work_history IS NULL OR 
        a1.parsed_work_history = '[]' OR
        a1.parsed_red_flags IS NULL OR
        a1.parsed_red_flags = '[]' OR
        a1.parsed_summary IS NULL OR
        a1.parsed_summary = ''
      )
      AND a2.parsed_work_history IS NOT NULL 
      AND a2.parsed_work_history != '[]'
      LIMIT 100
    `;
    
    const incompleteRecordsResult = await client.query(incompleteRecordsQuery);
    const incompleteRecords = incompleteRecordsResult.rows;
    
    console.log(`Found ${incompleteRecords.length} records with 'complete' status but empty parsed fields`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each record
    for (const record of incompleteRecords) {
      try {
        console.log(`Processing record ${record.id} for resume ${record.resume_id}...`);
        console.log(`- Using source record ${record.source_record_id} for data`);
        
        // Build the update query based on what's available in the source record
        let updateFields = [];
        let updateValues = [record.id]; // First parameter is always the record ID
        let paramIndex = 2; // Starting with parameter index 2
        
        if (record.has_work_history) {
          updateFields.push(`parsed_work_history = (
            SELECT parsed_work_history 
            FROM analysis_results 
            WHERE id = $${paramIndex++}
          )`);
          updateValues.push(record.source_record_id);
        }
        
        if (record.has_red_flags) {
          updateFields.push(`parsed_red_flags = (
            SELECT parsed_red_flags 
            FROM analysis_results 
            WHERE id = $${paramIndex++}
          )`);
          updateValues.push(record.source_record_id);
        }
        
        if (record.has_summary) {
          updateFields.push(`parsed_summary = (
            SELECT parsed_summary 
            FROM analysis_results 
            WHERE id = $${paramIndex++}
          )`);
          updateValues.push(record.source_record_id);
        }
        
        // Only proceed if there are fields to update
        if (updateFields.length > 0) {
          const updateQuery = `
            UPDATE analysis_results
            SET ${updateFields.join(', ')}
            WHERE id = $1
          `;
          
          await client.query(updateQuery, updateValues);
          
          console.log(`Successfully updated record ${record.id}`);
          successCount++;
        } else {
          console.log(`No fields to update for record ${record.id}`);
        }
      } catch (e) {
        console.error(`Error processing record ${record.id}:`, e);
        errorCount++;
      }
    }
    
    console.log('Fix complete but empty records completed:');
    console.log(`- Successfully processed ${successCount} records`);
    console.log(`- Errors processing ${errorCount} records`);
    
  } catch (e) {
    console.error('Error fixing complete but empty records:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

// Also check for parsed_json consistency - some records may have data in parsed fields but not in parsed_json
async function fixParsedJsonInconsistencies() {
  // Create a new pool for this function
  const newPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const client = await newPool.connect();
  
  try {
    console.log('Starting to fix parsed_json inconsistencies...');
    
    // Find records that have data in parsed fields but empty or inconsistent parsed_json
    const inconsistentRecordsQuery = `
      SELECT 
        id,
        resume_id,
        job_description_id,
        overall_score,
        parsed_work_history,
        parsed_red_flags,
        parsed_summary,
        parsed_json
      FROM analysis_results
      WHERE parsing_status = 'complete'
      AND (
        parsed_json IS NULL OR
        parsed_json = '{}' OR
        parsed_json = '[]' OR
        (
          parsed_work_history IS NOT NULL AND
          parsed_work_history != '[]' AND
          (
            parsed_json IS NULL OR
            parsed_json->>'workHistory' IS NULL OR
            parsed_json->>'workHistory' = '[]'
          )
        ) OR
        (
          parsed_red_flags IS NOT NULL AND
          parsed_red_flags != '[]' AND
          (
            parsed_json IS NULL OR
            parsed_json->>'redFlags' IS NULL OR
            parsed_json->>'redFlags' = '[]'
          )
        ) OR
        (
          parsed_summary IS NOT NULL AND
          parsed_summary != '' AND
          (
            parsed_json IS NULL OR
            parsed_json->>'summary' IS NULL OR
            parsed_json->>'summary' = ''
          )
        )
      )
      LIMIT 100
    `;
    
    const inconsistentRecordsResult = await client.query(inconsistentRecordsQuery);
    const inconsistentRecords = inconsistentRecordsResult.rows;
    
    console.log(`Found ${inconsistentRecords.length} records with inconsistent parsed_json`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each record
    for (const record of inconsistentRecords) {
      try {
        console.log(`Processing record ${record.id} for resume ${record.resume_id}...`);
        
        // Create a consolidated parsedJson object from the individual parsed fields
        const parsedJson = {
          score: record.overall_score || 0,
          workHistory: record.parsed_work_history ? JSON.parse(record.parsed_work_history) : [],
          redFlags: record.parsed_red_flags ? JSON.parse(record.parsed_red_flags) : [],
          summary: record.parsed_summary || "",
          skills: [] // We don't have this information, so use an empty array
        };
        
        // Update the record with the consolidated parsedJson
        const updateQuery = `
          UPDATE analysis_results
          SET parsed_json = $1
          WHERE id = $2
        `;
        
        await client.query(updateQuery, [JSON.stringify(parsedJson), record.id]);
        
        console.log(`Successfully updated parsed_json for record ${record.id}`);
        successCount++;
      } catch (e) {
        console.error(`Error processing record ${record.id}:`, e);
        errorCount++;
      }
    }
    
    console.log('Fix parsed_json inconsistencies completed:');
    console.log(`- Successfully processed ${successCount} records`);
    console.log(`- Errors processing ${errorCount} records`);
    
  } catch (e) {
    console.error('Error fixing parsed_json inconsistencies:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run both functions in sequence
async function main() {
  await fixCompleteEmptyRecords();
  console.log('First part completed - now fixing parsed_json inconsistencies');
  // Create new connection pool for the second function
  await fixParsedJsonInconsistencies();
  console.log('Script completed - all fixes applied');
}

// Run the main function
main()
  .then(() => {
    console.log('All database repairs completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });