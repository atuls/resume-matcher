/**
 * Field Name Analysis Script
 * This script analyzes the field names in the raw_response and parsedJson objects
 * to help identify common field name variations.
 */

import { db } from './server/db.js';
import { analysisResults } from './shared/schema.js';
import { eq, isNotNull, sql } from 'drizzle-orm';

async function analyzeFieldNames() {
  console.log("Analyzing field names in database records...");
  
  try {
    // Get all records with parsedJson
    console.log("Fetching records with parsedJson...");
    const records = await db
      .select()
      .from(analysisResults)
      .where(isNotNull(analysisResults.parsedJson))
      .limit(500);
    
    console.log(`Found ${records.length} records with parsedJson`);
    
    // Track field names and frequencies
    const fieldCounts = {};
    const skillsVariations = {};
    const workHistoryVariations = {};
    const redFlagsVariations = {};
    const summaryVariations = {};
    const educationVariations = {};
    
    // Process each record
    records.forEach(record => {
      try {
        // Skip if no parsedJson or it's not an object
        if (!record.parsedJson || typeof record.parsedJson !== 'object') {
          return;
        }
        
        // Process top-level field names
        Object.keys(record.parsedJson).forEach(field => {
          // Count each field
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
          
          // Check for each category of interest
          const lowerField = field.toLowerCase();
          
          // Skills variations
          if (lowerField.includes('skill') || lowerField === 'abilities' || lowerField === 'competencies') {
            skillsVariations[field] = (skillsVariations[field] || 0) + 1;
          }
          
          // Work history variations
          if (lowerField.includes('work') || lowerField.includes('history') || 
              lowerField.includes('experience') || lowerField.includes('employment') || 
              lowerField === 'jobs' || lowerField === 'career') {
            workHistoryVariations[field] = (workHistoryVariations[field] || 0) + 1;
          }
          
          // Red flags variations
          if (lowerField.includes('flag') || lowerField.includes('warning') || 
              lowerField.includes('concern') || lowerField.includes('issue')) {
            redFlagsVariations[field] = (redFlagsVariations[field] || 0) + 1;
          }
          
          // Summary variations
          if (lowerField.includes('summary') || lowerField.includes('overview') || 
              lowerField === 'profile' || lowerField === 'brief') {
            summaryVariations[field] = (summaryVariations[field] || 0) + 1;
          }
          
          // Education variations
          if (lowerField.includes('education') || lowerField.includes('degree') || 
              lowerField.includes('academic') || lowerField.includes('qualification')) {
            educationVariations[field] = (educationVariations[field] || 0) + 1;
          }
        });
      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error.message);
      }
    });
    
    // Print results
    console.log("\n=== ALL FIELD NAMES ===");
    printSortedCounts(fieldCounts);
    
    console.log("\n=== SKILLS FIELD VARIATIONS ===");
    printSortedCounts(skillsVariations);
    
    console.log("\n=== WORK HISTORY FIELD VARIATIONS ===");
    printSortedCounts(workHistoryVariations);
    
    console.log("\n=== RED FLAGS FIELD VARIATIONS ===");
    printSortedCounts(redFlagsVariations);
    
    console.log("\n=== SUMMARY FIELD VARIATIONS ===");
    printSortedCounts(summaryVariations);
    
    console.log("\n=== EDUCATION FIELD VARIATIONS ===");
    printSortedCounts(educationVariations);
    
    // Also check raw_response for field name variations
    console.log("\n\nAnalyzing raw_response JSON structure...");
    await analyzeRawResponses();
    
  } catch (error) {
    console.error("Error analyzing field names:", error);
  }
}

// Helper function to check raw_response fields
async function analyzeRawResponses() {
  try {
    // Get records with raw_response
    const records = await db
      .select()
      .from(analysisResults)
      .where(isNotNull(analysisResults.rawResponse))
      .limit(100);
    
    console.log(`Found ${records.length} records with raw_response`);
    
    // Track field variations in the raw response JSON
    const rawFieldVariations = {};
    let successfulParsedCount = 0;
    
    records.forEach(record => {
      try {
        // Skip if no raw_response
        if (!record.rawResponse) return;
        
        // Attempt to extract JSON from the raw response
        let jsonContent = null;
        
        // Try to find JSON content within the text
        try {
          // Look for the first { character and assume it starts a JSON object
          const possibleJsonStart = record.rawResponse.indexOf('{');
          const possibleJsonEnd = record.rawResponse.lastIndexOf('}');
          
          if (possibleJsonStart !== -1 && possibleJsonEnd !== -1 && possibleJsonEnd > possibleJsonStart) {
            const jsonString = record.rawResponse.substring(possibleJsonStart, possibleJsonEnd + 1);
            jsonContent = JSON.parse(jsonString);
            successfulParsedCount++;
          }
        } catch (e) {
          // If that fails, try to find JSON by looking for common patterns
          try {
            // Look for "here's the JSON:" or similar patterns
            const jsonMarkers = [
              "```json",
              "```\n{",
              "Here's the JSON:",
              "here's the JSON:",
              "JSON response:",
              "structured data:"
            ];
            
            for (const marker of jsonMarkers) {
              const markerIndex = record.rawResponse.indexOf(marker);
              if (markerIndex !== -1) {
                const startIndex = record.rawResponse.indexOf('{', markerIndex);
                const endIndex = record.rawResponse.lastIndexOf('}');
                
                if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                  const jsonString = record.rawResponse.substring(startIndex, endIndex + 1);
                  jsonContent = JSON.parse(jsonString);
                  successfulParsedCount++;
                  break;
                }
              }
            }
          } catch (e2) {
            // Ignore parsing errors
          }
        }
        
        // If we found JSON content, analyze its structure
        if (jsonContent && typeof jsonContent === 'object') {
          Object.keys(jsonContent).forEach(field => {
            rawFieldVariations[field] = (rawFieldVariations[field] || 0) + 1;
          });
        }
      } catch (error) {
        // Ignore errors for individual records
      }
    });
    
    console.log(`Successfully parsed JSON from ${successfulParsedCount} out of ${records.length} raw responses`);
    console.log("\n=== RAW RESPONSE FIELD VARIATIONS ===");
    printSortedCounts(rawFieldVariations);
    
  } catch (error) {
    console.error("Error analyzing raw responses:", error);
  }
}

// Helper function to print sorted counts
function printSortedCounts(countObj) {
  const sorted = Object.entries(countObj)
    .sort((a, b) => b[1] - a[1]); // Sort by count descending
    
  sorted.forEach(([field, count]) => {
    console.log(`${field}: ${count}`);
  });
  
  console.log(`Total unique fields: ${sorted.length}`);
}

// Run the analysis
analyzeFieldNames()
  .then(() => console.log("Analysis complete!"))
  .catch(err => console.error("Analysis failed:", err))
  .finally(() => process.exit(0));