/**
 * Script to fix records that have 'complete' status but missing work history
 * This targets specifically records where the data exists for the same resume
 * in another analysis result and can be copied over.
 */

const { Pool } = require('pg');

async function fixMissingWorkHistory() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Finding records with missing work history...');
    
    // Find records with missing work history but that have other analysis records
    // for the same resume with valid work history
    const query = `
      SELECT 
        a1.id,
        a1.resume_id,
        a1.job_description_id,
        a2.id as source_record_id
      FROM analysis_results a1
      JOIN analysis_results a2 
        ON a1.resume_id = a2.resume_id 
        AND a1.id != a2.id
        AND a2.parsed_work_history IS NOT NULL
        AND a2.parsed_work_history != '[]'
      WHERE 
        a1.parsing_status = 'complete'
        AND (a1.parsed_work_history IS NULL OR a1.parsed_work_history = '[]')
      LIMIT 200
    `;
    
    const { rows } = await pool.query(query);
    console.log(`Found ${rows.length} records with missing work history`);
    
    let successCount = 0;
    
    // Process each record
    for (const record of rows) {
      // Update the record with work history from the other analysis
      const updateQuery = `
        UPDATE analysis_results
        SET parsed_work_history = (
          SELECT parsed_work_history 
          FROM analysis_results 
          WHERE id = $1
        )
        WHERE id = $2
        RETURNING id
      `;
      
      try {
        const result = await pool.query(updateQuery, [record.source_record_id, record.id]);
        if (result.rows.length > 0) {
          console.log(`Fixed record ${record.id} using data from ${record.source_record_id}`);
          successCount++;
        }
      } catch (err) {
        console.error(`Error updating record ${record.id}:`, err.message);
      }
    }
    
    console.log(`Successfully fixed ${successCount} out of ${rows.length} records`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixMissingWorkHistory()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });