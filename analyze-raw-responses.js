/**
 * Script to analyze the variations of keys in raw_response and parsedJson
 * This helps identify all the different field names used for work history and red flags
 */
import pg from 'pg';
const { Pool } = pg;

async function analyzeRawResponses() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Analyzing raw responses to find field variations...');
    
    // Get a sample of analysis results with raw_response
    const query = `
      SELECT id, raw_response, parsed_json, parsed_work_history, parsed_skills
      FROM analysis_results 
      WHERE raw_response IS NOT NULL
      LIMIT 100
    `;
    
    const result = await pool.query(query);
    console.log(`Analyzing ${result.rows.length} records...`);
    
    // Track all variations of work history and red flags fields
    const workHistoryFields = new Set();
    const redFlagFields = new Set();
    const parsedJsonKeys = new Set();
    
    // Keep track of specific examples to understand structure
    let workHistorySamples = {};
    let redFlagSamples = {};
    
    // Counters for statistics
    let rawResponsesWithWorkHistory = 0;
    let parsedJsonWithWorkHistory = 0;
    let recordsWithData = 0;
    
    // Analyze each record
    for (const row of result.rows) {
      recordsWithData++;
      
      try {
        // Parse the raw_response if it's a string
        const rawResponse = typeof row.raw_response === 'string' 
          ? JSON.parse(row.raw_response) 
          : row.raw_response;
        
        // Check for all keys in the raw response
        if (rawResponse && typeof rawResponse === 'object') {
          // Level 1: Direct keys in rawResponse
          for (const key of Object.keys(rawResponse)) {
            const lowerKey = key.toLowerCase();
            
            // Check for work history variations
            if (lowerKey.includes('work') && lowerKey.includes('history')) {
              workHistoryFields.add(key);
              
              // Save a sample of this structure
              if (rawResponse[key] && Array.isArray(rawResponse[key]) && rawResponse[key].length > 0) {
                workHistorySamples[key] = rawResponse[key][0];
                rawResponsesWithWorkHistory++;
              }
            }
            
            // Check for red flag variations
            if ((lowerKey.includes('red') && lowerKey.includes('flag')) || 
                (lowerKey.includes('warning'))) {
              redFlagFields.add(key);
              
              // Save a sample of this structure
              if (rawResponse[key] && 
                  (Array.isArray(rawResponse[key]) || typeof rawResponse[key] === 'string')) {
                redFlagSamples[key] = rawResponse[key];
              }
            }
          }
          
          // Level 2: Check inside parsedJson if it exists
          if (rawResponse.parsedJson) {
            const parsedJson = typeof rawResponse.parsedJson === 'string'
              ? JSON.parse(rawResponse.parsedJson)
              : rawResponse.parsedJson;
              
            if (parsedJson && typeof parsedJson === 'object') {
              // Add all keys from parsedJson for reference
              Object.keys(parsedJson).forEach(key => {
                parsedJsonKeys.add(key);
                
                const lowerKey = key.toLowerCase();
                
                // Check for work history variations
                if (lowerKey.includes('work') && lowerKey.includes('history')) {
                  workHistoryFields.add('parsedJson.' + key);
                  
                  // Save a sample of this structure
                  if (parsedJson[key] && Array.isArray(parsedJson[key]) && parsedJson[key].length > 0) {
                    workHistorySamples['parsedJson.' + key] = parsedJson[key][0];
                    parsedJsonWithWorkHistory++;
                  }
                }
                
                // Check for red flag variations
                if ((lowerKey.includes('red') && lowerKey.includes('flag')) || 
                    (lowerKey.includes('warning'))) {
                  redFlagFields.add('parsedJson.' + key);
                  
                  // Save a sample of this structure
                  if (parsedJson[key] && 
                      (Array.isArray(parsedJson[key]) || typeof parsedJson[key] === 'string')) {
                    redFlagSamples['parsedJson.' + key] = parsedJson[key];
                  }
                }
              });
            }
          }
        }
        
        // Check in parsed_json column if it exists
        if (row.parsed_json) {
          const parsedJson = typeof row.parsed_json === 'string'
            ? JSON.parse(row.parsed_json)
            : row.parsed_json;
            
          if (parsedJson && typeof parsedJson === 'object') {
            // Add all keys from parsed_json for reference
            Object.keys(parsedJson).forEach(key => {
              parsedJsonKeys.add(key);
            });
          }
        }
        
      } catch (e) {
        console.error(`Error processing row ${row.id}:`, e.message);
      }
    }
    
    // Print analysis results
    console.log('\n=== WORK HISTORY FIELD VARIATIONS ===');
    console.log(Array.from(workHistoryFields).join('\n'));
    
    console.log('\n=== RED FLAG FIELD VARIATIONS ===');
    console.log(Array.from(redFlagFields).join('\n'));
    
    console.log('\n=== KEYS IN PARSED JSON ===');
    console.log(Array.from(parsedJsonKeys).join('\n'));
    
    console.log('\n=== WORK HISTORY FIELD SAMPLES ===');
    console.log(JSON.stringify(workHistorySamples, null, 2));
    
    console.log('\n=== RED FLAG FIELD SAMPLES ===');
    console.log(JSON.stringify(redFlagSamples, null, 2));
    
    console.log('\n=== STATISTICS ===');
    console.log(`Total records analyzed: ${recordsWithData}`);
    console.log(`Records with work history in raw_response: ${rawResponsesWithWorkHistory}`);
    console.log(`Records with work history in parsedJson: ${parsedJsonWithWorkHistory}`);
    
  } catch (error) {
    console.error('Error executing analysis:', error);
  } finally {
    await pool.end();
    console.log('Analysis complete');
  }
}

analyzeRawResponses();