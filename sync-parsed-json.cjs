// Utility to synchronize the parsed JSON from raw_response data (CommonJS version)
const fs = require('fs');
const path = require('path');

/**
 * Extract structured data from raw response
 */
function extractParsedJson(rawResponse) {
  if (!rawResponse) return null;
  
  // Initialize result
  const result = {
    skills: [],
    workHistory: [],
    redFlags: [],
    summary: "",
    score: 0
  };
  
  try {
    // Try multiple paths to find the data
    let parsedJson = null;
    
    // CASE 1: Extract from parsedJson at root level
    if (rawResponse.parsedJson && typeof rawResponse.parsedJson === 'object') {
      parsedJson = rawResponse.parsedJson;
    }
    // CASE 2: Extract from nested rawResponse.parsedJson
    else if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
      parsedJson = rawResponse.rawResponse.parsedJson;
    }
    // CASE 3: Extract from rawText field as JSON
    else if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
      try {
        const jsonMatch = rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing rawText as JSON");
      }
    }
    // CASE 4: Extract from nested rawText field
    else if (rawResponse.rawResponse && 
        rawResponse.rawResponse.rawText && 
        typeof rawResponse.rawResponse.rawText === 'string') {
      try {
        const jsonMatch = rawResponse.rawResponse.rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing nested rawText as JSON");
      }
    }
    
    // CASE 5: Handle our specific data format from the sample
    if (rawResponse.parsedData) {
      console.log("Found parsedData at root level");
      // Extract from the parsed data structure if it exists
      if (rawResponse.parsedData.skills && Array.isArray(rawResponse.parsedData.skills)) {
        result.skills = rawResponse.parsedData.skills;
      }
      
      if (rawResponse.parsedData.workHistory && Array.isArray(rawResponse.parsedData.workHistory)) {
        result.workHistory = rawResponse.parsedData.workHistory;
      }
      
      if (rawResponse.parsedData.redFlags && Array.isArray(rawResponse.parsedData.redFlags)) {
        result.redFlags = rawResponse.parsedData.redFlags;
      }
      
      if (rawResponse.parsedData.summary) {
        result.summary = rawResponse.parsedData.summary;
      }
      
      if (rawResponse.scoreData && rawResponse.scoreData.score) {
        result.score = rawResponse.scoreData.score;
      }
      
      return result;
    }
    
    // Extract data from parsedJson if we found it
    if (parsedJson) {
      if (parsedJson.Skills && Array.isArray(parsedJson.Skills)) {
        result.skills = parsedJson.Skills;
      }
      
      if (parsedJson.Work_History && Array.isArray(parsedJson.Work_History)) {
        result.workHistory = parsedJson.Work_History;
      }
      
      if (parsedJson.Red_Flags && Array.isArray(parsedJson.Red_Flags)) {
        result.redFlags = parsedJson.Red_Flags;
      }
      
      if (parsedJson.Summary) {
        result.summary = parsedJson.Summary;
      }
      
      if (parsedJson.matching_score) {
        result.score = parsedJson.matching_score;
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error extracting parsedJson", error);
    return result;
  }
}

/**
 * Process a single record from the input JSON file
 */
function processRecord(record) {
  try {
    // Extract structured data
    const parsedJson = extractParsedJson(record);
    
    // Skip if no meaningful data was extracted
    if (!parsedJson || 
        (parsedJson.skills.length === 0 && 
         parsedJson.workHistory.length === 0 && 
         parsedJson.redFlags.length === 0 && 
         !parsedJson.summary)) {
      console.log(`No meaningful data extracted for record`);
      return null;
    }
    
    // Return the parsed JSON data
    return {
      id: record.id || "sample-id",
      resumeId: record.resumeId || "sample-resume-id",
      jobDescriptionId: record.jobDescriptionId || "sample-job-id",
      parsedJson,
      skills: parsedJson.skills.length > 0 ? parsedJson.skills : null,
      workHistory: parsedJson.workHistory.length > 0 ? parsedJson.workHistory : null,
      redFlags: parsedJson.redFlags.length > 0 ? parsedJson.redFlags : null,
      summary: parsedJson.summary || null,
      score: parsedJson.score || 0
    };
  } catch (error) {
    console.error(`Error processing record:`, error);
    return null;
  }
}

/**
 * Main function to run the sync process
 */
async function main() {
  try {
    // Check if input file exists
    const inputFile = process.argv[2] || 'api_response.json';
    
    if (!fs.existsSync(inputFile)) {
      console.error(`Input file ${inputFile} does not exist`);
      return;
    }
    
    // Read input file
    console.log(`Reading data from ${inputFile}`);
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    // Handle single object vs array
    const recordsToProcess = Array.isArray(data) ? data : [data];
    
    console.log(`Found ${recordsToProcess.length} records to process`);
    
    // Process each record
    const results = [];
    let processed = 0;
    let skipped = 0;
    
    for (const record of recordsToProcess) {
      const processedRecord = processRecord(record);
      
      if (processedRecord) {
        results.push(processedRecord);
        processed++;
      } else {
        skipped++;
      }
      
      // Log progress for larger datasets
      if ((processed + skipped) % 10 === 0 && processed + skipped > 0) {
        console.log(`Progress: ${processed} processed, ${skipped} skipped, ${processed + skipped}/${recordsToProcess.length} total`);
      }
    }
    
    // Write output file
    const outputFile = 'parsed_analysis_response.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    
    console.log(`
Processing complete:
- Total records: ${recordsToProcess.length}
- Successfully processed: ${processed}
- Skipped: ${skipped}
- Output saved to: ${outputFile}
    `);
  } catch (error) {
    console.error("Error processing data:", error);
  }
}

// Run the script
main();