/**
 * Fix Empty Parsed Fields Script
 * 
 * This script identifies analysis results with empty parsed fields but 
 * that have data in the raw_response, and updates them with the correct data.
 */

import { db } from './server/db.js';
import { eq, and, isNull, or } from 'drizzle-orm';
import { analysisResults } from './shared/schema.js';

// This makes the script work with CommonJS modules
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Extract the work history, red flags, summary, and skills from a raw response object
 * taking into account the various nested structures we've found in the database
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
  
  // Try to get score from various places
  if (rawResponse.matching_score) {
    result.score = rawResponse.matching_score;
  } else if (rawResponse.score) {
    result.score = rawResponse.score;
  }
  
  // CASE 1: Direct work_history, red_flags, etc. fields at the top level
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
  
  // CASE 3: From extractedSections
  if (rawResponse.extractedSections) {
    const sections = rawResponse.extractedSections;
    
    // Extract from workHistory/work_history section
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
          // String couldn't be parsed as JSON, ignore
        }
      }
    }
    
    if (sections.work_history) {
      if (Array.isArray(sections.work_history)) {
        result.workHistory = sections.work_history;
      } else if (typeof sections.work_history === 'string') {
        try {
          const parsed = JSON.parse(sections.work_history);
          if (Array.isArray(parsed)) {
            result.workHistory = parsed;
          }
        } catch (e) {
          // String couldn't be parsed as JSON, ignore
        }
      }
    }
    
    // Extract from redFlags/red_flags section
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
          // If it's not JSON, try comma-separated list
          result.redFlags = sections.redFlags.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
    }
    
    if (sections.red_flags) {
      if (Array.isArray(sections.red_flags)) {
        result.redFlags = sections.red_flags;
      } else if (typeof sections.red_flags === 'string') {
        try {
          const parsed = JSON.parse(sections.red_flags);
          if (Array.isArray(parsed)) {
            result.redFlags = parsed;
          }
        } catch (e) {
          // If it's not JSON, try comma-separated list
          result.redFlags = sections.red_flags.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
    }
    
    // Extract summary
    if (sections.summary && typeof sections.summary === 'string') {
      result.summary = sections.summary;
    }
    
    // Extract skills
    if (sections.skills) {
      if (Array.isArray(sections.skills)) {
        result.skills = sections.skills;
      } else if (typeof sections.skills === 'string') {
        try {
          const parsed = JSON.parse(sections.skills);
          if (Array.isArray(parsed)) {
            result.skills = parsed;
          } else {
            // Try comma-separated list
            result.skills = sections.skills.split(',').map(s => s.trim()).filter(Boolean);
          }
        } catch (e) {
          // If it's not JSON, try comma-separated list
          result.skills = sections.skills.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
    }
  }
  
  // CASE 4: From rawResponse.rawResponse (nested structure)
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
    
    // If we successfully parsed or it was already an object
    if (typeof nestedRawResponse === 'object' && nestedRawResponse !== null) {
      // Extract from top level fields
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
      
      if (nestedRawResponse.summary && typeof nestedRawResponse.summary === 'string') {
        result.summary = nestedRawResponse.summary;
      }
      
      if (nestedRawResponse.skills && Array.isArray(nestedRawResponse.skills)) {
        result.skills = nestedRawResponse.skills;
      }
      
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
      
      // Check for extractedSections in nested structure
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
              // String couldn't be parsed as JSON, ignore
            }
          }
        }
        
        if (sections.work_history) {
          if (Array.isArray(sections.work_history)) {
            result.workHistory = sections.work_history;
          } else if (typeof sections.work_history === 'string') {
            try {
              const parsed = JSON.parse(sections.work_history);
              if (Array.isArray(parsed)) {
                result.workHistory = parsed;
              }
            } catch (e) {
              // String couldn't be parsed as JSON, ignore
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
              // If it's not JSON, try comma-separated list
              result.redFlags = sections.redFlags.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
        }
        
        if (sections.red_flags) {
          if (Array.isArray(sections.red_flags)) {
            result.redFlags = sections.red_flags;
          } else if (typeof sections.red_flags === 'string') {
            try {
              const parsed = JSON.parse(sections.red_flags);
              if (Array.isArray(parsed)) {
                result.redFlags = parsed;
              }
            } catch (e) {
              // If it's not JSON, try comma-separated list
              result.redFlags = sections.red_flags.split(',').map(s => s.trim()).filter(Boolean);
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
                // Try comma-separated list
                result.skills = sections.skills.split(',').map(s => s.trim()).filter(Boolean);
              }
            } catch (e) {
              // If it's not JSON, try comma-separated list
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
 * Main function to fix empty parsed fields
 */
async function fixEmptyParsedFields() {
  try {
    console.log('Starting to fix empty parsed fields...');
    
    // Find records that have raw_response but empty parsed_work_history or parsed_red_flags
    const incompleteRecords = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          // Only process records with raw_response
          analysisResults.raw_response.isNotNull(),
          // And where at least one of the parsed fields is empty
          or(
            isNull(analysisResults.parsed_work_history),
            isNull(analysisResults.parsed_red_flags),
            isNull(analysisResults.parsed_summary),
            analysisResults.parsed_work_history.equals('[]'),
            analysisResults.parsed_red_flags.equals('[]'),
            analysisResults.parsed_summary.equals('')
          )
        )
      )
      .limit(100); // Process in batches to avoid memory issues
    
    console.log(`Found ${incompleteRecords.length} records to fix`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each record
    for (const record of incompleteRecords) {
      try {
        console.log(`Processing record ${record.id}...`);
        
        // Extract data from raw_response
        const extractedData = extractDataFromRawResponse(record.raw_response);
        
        if (!extractedData) {
          console.log(`No data could be extracted from record ${record.id}`);
          continue;
        }
        
        const { workHistory, redFlags, summary, skills, score } = extractedData;
        
        console.log(`Extracted data from record ${record.id}:`);
        console.log(`- Work History: ${workHistory.length} entries`);
        console.log(`- Red Flags: ${redFlags.length} entries`);
        console.log(`- Summary: ${summary ? 'Yes' : 'No'}`);
        console.log(`- Skills: ${skills.length} entries`);
        console.log(`- Score: ${score}`);
        
        // Skip if we couldn't extract meaningful data
        if (workHistory.length === 0 && redFlags.length === 0 && !summary && skills.length === 0) {
          console.log(`No meaningful data extracted for record ${record.id}`);
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
        
        // Update the record
        await db
          .update(analysisResults)
          .set({
            parsed_work_history: workHistory.length > 0 ? JSON.stringify(workHistory) : null,
            parsed_red_flags: redFlags.length > 0 ? JSON.stringify(redFlags) : null,
            parsed_summary: summary || null,
            parsed_skills: skills.length > 0 ? JSON.stringify(skills) : null,
            parsed_json: JSON.stringify(parsedJson),
            parsing_status: 'complete'
          })
          .where(eq(analysisResults.id, record.id));
        
        console.log(`Successfully updated record ${record.id}`);
        successCount++;
      } catch (e) {
        console.error(`Error processing record ${record.id}:`, e);
        errorCount++;
      }
    }
    
    console.log('Fix empty parsed fields completed:');
    console.log(`- Successfully processed ${successCount} records`);
    console.log(`- Errors processing ${errorCount} records`);
    
  } catch (e) {
    console.error('Error fixing empty parsed fields:', e);
  }
}

// Run the function
fixEmptyParsedFields()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });