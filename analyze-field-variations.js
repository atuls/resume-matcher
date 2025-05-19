/**
 * Field Name Variations Analysis
 * 
 * This script analyzes your database to find all the different field name variations
 * used in parsedJson objects. This helps identify which field names to look for when
 * extracting structured data from AI responses.
 */

import { db } from './server/db.js';
import { analysisResults } from './shared/schema.js';
import { isNotNull } from 'drizzle-orm';

async function analyzeFieldVariations() {
  console.log("Analyzing field name variations in parsedJson...");
  
  // Collect different field names and their frequencies
  const fieldCounts = {};
  const skillsFields = {};
  const workHistoryFields = {};
  const redFlagFields = {};
  const summaryFields = {};
  const educationFields = {};
  
  try {
    // Get records with parsedJson
    const records = await db.select({
      id: analysisResults.id,
      jobDescriptionId: analysisResults.jobDescriptionId,
      parsedJson: analysisResults.parsedJson
    })
    .from(analysisResults)
    .where(isNotNull(analysisResults.parsedJson))
    .limit(500);
    
    console.log(`Found ${records.length} records with parsedJson`);
    
    if (records.length === 0) {
      console.log("No records found with parsedJson. Cannot analyze field variations.");
      return;
    }
    
    // Process each record
    let emptySummaryCount = 0;
    let emptyWorkHistoryCount = 0;
    let emptyRedFlagCount = 0;
    
    for (const record of records) {
      if (!record.parsedJson || typeof record.parsedJson !== 'object') continue;
      
      // Analyze top-level fields in parsedJson
      for (const field of Object.keys(record.parsedJson)) {
        // Count each field name
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        
        // Check for empty arrays or null values
        const value = record.parsedJson[field];
        const isEmpty = !value || (Array.isArray(value) && value.length === 0);
        
        // Check known categories
        const lowerField = field.toLowerCase();
        
        // Skills fields
        if (lowerField.includes('skill') || lowerField === 'abilities' || lowerField === 'competencies') {
          skillsFields[field] = (skillsFields[field] || 0) + 1;
        }
        
        // Work history fields
        if (lowerField.includes('work') || lowerField.includes('history') || 
            lowerField.includes('experience') || lowerField.includes('employment') || 
            lowerField === 'jobs' || lowerField === 'positions') {
          workHistoryFields[field] = (workHistoryFields[field] || 0) + 1;
          
          if (isEmpty) emptyWorkHistoryCount++;
        }
        
        // Red flags
        if (lowerField.includes('flag') || lowerField.includes('warning') || 
            lowerField.includes('concern') || lowerField === 'issues') {
          redFlagFields[field] = (redFlagFields[field] || 0) + 1;
          
          if (isEmpty) emptyRedFlagCount++;
        }
        
        // Summary fields
        if (lowerField.includes('summary') || lowerField.includes('overview')) {
          summaryFields[field] = (summaryFields[field] || 0) + 1;
          
          if (isEmpty) emptySummaryCount++;
        }
        
        // Education fields
        if (lowerField.includes('education') || lowerField.includes('academic') || 
            lowerField.includes('degree')) {
          educationFields[field] = (educationFields[field] || 0) + 1;
        }
      }
    }
    
    // Display results
    console.log("\n===== ANALYSIS RESULTS =====");
    console.log(`\nTotal records analyzed: ${records.length}`);
    
    console.log("\n===== TOP-LEVEL FIELD NAMES =====");
    printSortedCounts(fieldCounts);
    
    console.log("\n===== SKILLS FIELD VARIATIONS =====");
    printSortedCounts(skillsFields);
    
    console.log("\n===== WORK HISTORY FIELD VARIATIONS =====");
    printSortedCounts(workHistoryFields);
    console.log(`Empty work history: ${emptyWorkHistoryCount} records (${Math.round(emptyWorkHistoryCount/records.length*100)}%)`);
    
    console.log("\n===== RED FLAGS FIELD VARIATIONS =====");
    printSortedCounts(redFlagFields);
    console.log(`Empty red flags: ${emptyRedFlagCount} records (${Math.round(emptyRedFlagCount/records.length*100)}%)`);
    
    console.log("\n===== SUMMARY FIELD VARIATIONS =====");
    printSortedCounts(summaryFields);
    console.log(`Empty summaries: ${emptySummaryCount} records (${Math.round(emptySummaryCount/records.length*100)}%)`);
    
    console.log("\n===== EDUCATION FIELD VARIATIONS =====");
    printSortedCounts(educationFields);
    
    // Also check if there are many records without work history or red flags
    const missingWorkHistoryCount = records.length - Object.values(workHistoryFields).reduce((a, b) => a + b, 0);
    const missingRedFlagsCount = records.length - Object.values(redFlagFields).reduce((a, b) => a + b, 0);
    
    console.log(`\nRecords without any work history field: ${missingWorkHistoryCount} (${Math.round(missingWorkHistoryCount/records.length*100)}%)`);
    console.log(`Records without any red flags field: ${missingRedFlagsCount} (${Math.round(missingRedFlagsCount/records.length*100)}%)`);
    
  } catch (error) {
    console.error("Error analyzing field variations:", error);
  }
}

// Helper to print sorted counts
function printSortedCounts(counts) {
  const sortedCounts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]); // Sort by count (descending)
  
  if (sortedCounts.length === 0) {
    console.log("  No fields found in this category");
    return;
  }
  
  sortedCounts.forEach(([field, count]) => {
    console.log(`  ${field}: ${count}`);
  });
}

// Run the analysis
analyzeFieldVariations()
  .then(() => console.log("\nAnalysis complete!"))
  .catch(error => console.error("Error:", error))
  .finally(() => process.exit(0));