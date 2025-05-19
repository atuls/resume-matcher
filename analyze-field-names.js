/**
 * This script analyzes the field names in the parsed_json objects
 * to identify which field name variations are most common.
 * 
 * It helps us understand how different AI models structure their output
 * and which field names we should look for when extracting data.
 */

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function analyzeFieldNames() {
  console.log("Analyzing field names in parsed_json objects...");
  
  try {
    // Connect to the database
    console.log("Connected to database");
    
    // Get all analysis results with parsed_json using Drizzle ORM 
    const { analysisResults } = await import('./shared/schema.js');
    const results = await db.select()
      .from(analysisResults)
      .where(sql`parsed_json IS NOT NULL`)
      .limit(1000);
    
    console.log(`Found ${results.length} records with parsed_json`);
    
    if (results.length === 0) {
      console.log("No records found with parsed_json");
      return;
    }
    
    // Track field names and their frequencies
    const fieldCounts = {};
    const topLevelCounts = {};
    
    // Specific categories of interest
    const skillsFieldVariations = {};
    const workHistoryFieldVariations = {};
    const redFlagsFieldVariations = {};
    const summaryFieldVariations = {};
    
    // Process each record
    for (const row of results) {
      try {
        const parsedJson = row.parsedJson;
        
        if (!parsedJson || typeof parsedJson !== 'object') {
          continue;
        }
        
        // Count top-level field names
        for (const key of Object.keys(parsedJson)) {
          topLevelCounts[key] = (topLevelCounts[key] || 0) + 1;
          
          // Categorize fields of interest
          const lowerKey = key.toLowerCase();
          
          // Skills variations
          if (lowerKey.includes('skill') || lowerKey === 'abilities' || lowerKey === 'competencies') {
            skillsFieldVariations[key] = (skillsFieldVariations[key] || 0) + 1;
          }
          
          // Work history variations
          if (lowerKey.includes('history') || lowerKey.includes('experience') || 
              lowerKey.includes('employment') || lowerKey.includes('work') || 
              lowerKey === 'jobs' || lowerKey === 'positions' || lowerKey === 'roles') {
            workHistoryFieldVariations[key] = (workHistoryFieldVariations[key] || 0) + 1;
          }
          
          // Red flags variations
          if (lowerKey.includes('flag') || lowerKey.includes('warning') || 
              lowerKey.includes('concern') || lowerKey.includes('issue') || 
              lowerKey.includes('gap')) {
            redFlagsFieldVariations[key] = (redFlagsFieldVariations[key] || 0) + 1;
          }
          
          // Summary variations
          if (lowerKey.includes('summary') || lowerKey.includes('overview') || 
              lowerKey === 'profile' || lowerKey === 'abstract' || 
              lowerKey === 'description') {
            summaryFieldVariations[key] = (summaryFieldVariations[key] || 0) + 1;
          }
          
          // For deeply nested objects, recursively count field names
          if (parsedJson[key] && typeof parsedJson[key] === 'object') {
            countNestedFields(parsedJson[key], key, fieldCounts);
          }
        }
      } catch (error) {
        console.error(`Error processing record ${row.id}:`, error);
      }
    }
    
    // Sort and display results
    console.log("\n=== TOP-LEVEL FIELD NAMES ===");
    displaySortedCounts(topLevelCounts);
    
    console.log("\n=== SKILLS FIELD VARIATIONS ===");
    displaySortedCounts(skillsFieldVariations);
    
    console.log("\n=== WORK HISTORY FIELD VARIATIONS ===");
    displaySortedCounts(workHistoryFieldVariations);
    
    console.log("\n=== RED FLAGS FIELD VARIATIONS ===");
    displaySortedCounts(redFlagsFieldVariations);
    
    console.log("\n=== SUMMARY FIELD VARIATIONS ===");
    displaySortedCounts(summaryFieldVariations);
    
    console.log("\n=== ALL NESTED FIELD NAMES ===");
    displaySortedCounts(fieldCounts);
    
  } catch (error) {
    console.error("Error analyzing field names:", error);
  }
}

// Helper function to count nested fields
function countNestedFields(obj, parentKey, counts) {
  if (!obj || typeof obj !== 'object') return;
  
  if (Array.isArray(obj)) {
    // If it's an array, check the first element's structure
    if (obj.length > 0 && typeof obj[0] === 'object') {
      countNestedFields(obj[0], parentKey, counts);
    }
  } else {
    // Process object keys
    for (const key of Object.keys(obj)) {
      const fullKey = `${parentKey}.${key}`;
      counts[fullKey] = (counts[fullKey] || 0) + 1;
      
      // Recursively process nested objects
      if (obj[key] && typeof obj[key] === 'object') {
        countNestedFields(obj[key], fullKey, counts);
      }
    }
  }
}

// Helper function to display sorted counts
function displaySortedCounts(counts) {
  const sortedEntries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]); // Sort by count in descending order
  
  for (const [key, count] of sortedEntries) {
    console.log(`${key}: ${count}`);
  }
}

// Run the analysis
analyzeFieldNames();