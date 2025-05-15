import { db } from '../db';
import { analysisResults } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface WorkHistoryItem {
  Title: string;
  Company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  durationMonths?: number;
  isCurrentRole?: boolean;
}

/**
 * Process and parse raw AI response from analysis results
 * Extracts structured data and stores it in dedicated fields
 */
export class ResponseParserService {
  
  /**
   * Parse a JSON string safely
   */
  private static parseJsonSafely(jsonStr: string): any {
    try {
      // Remove any markdown code blocks if present
      const cleanJson = jsonStr.replace(/```json\s*|\s*```/g, '');
      
      // Try to fix common JSON issues
      const normalizedJson = cleanJson
        .replace(/:\s*True/g, ': true')
        .replace(/:\s*False/g, ': false')
        .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
        .replace(/,\s*}/g, '}') // Remove trailing commas in objects
        .replace(/\\'/g, "'") // Fix escaped single quotes
        .replace(/"matched"\s*:\s*partially/g, '"matched": "partial"')
        .replace(/"matched"\s*:\s*fully/g, '"matched": "full"')
        .replace(/"matched"\s*:\s*no/g, '"matched": "none"');
      
      // Parse the normalized JSON
      return JSON.parse(normalizedJson);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      console.error('JSON string:', jsonStr);
      return null;
    }
  }
  
  /**
   * Extract raw response content from a potentially nested structure
   * This function will specifically focus on finding and extracting the parsedJson object
   */
  private static extractRawResponseContent(rawResponse: any): any {
    if (!rawResponse) {
      console.log("extractRawResponseContent: rawResponse is null or undefined");
      return null;
    }
    
    console.log("extractRawResponseContent: Raw response type:", typeof rawResponse);
    if (typeof rawResponse === 'object') {
      console.log("extractRawResponseContent: Raw response keys:", Object.keys(rawResponse));
    }
    
    // Direct access to parsedJson if available
    if (rawResponse.parsedJson) {
      console.log("extractRawResponseContent: Found parsedJson at top level");
      return rawResponse.parsedJson;
    }
    
    // Check for nested rawResponse.parsedJson
    if (rawResponse.rawResponse && rawResponse.rawResponse.parsedJson) {
      console.log("extractRawResponseContent: Found parsedJson in nested rawResponse");
      return rawResponse.rawResponse.parsedJson;
    }
    
    // Check for deeply nested rawResponse.rawResponse.parsedJson
    if (rawResponse.rawResponse && 
        rawResponse.rawResponse.rawResponse && 
        rawResponse.rawResponse.rawResponse.parsedJson) {
      console.log("extractRawResponseContent: Found parsedJson in deeply nested rawResponse.rawResponse");
      return rawResponse.rawResponse.rawResponse.parsedJson;
    }
    
    // If we can't find a parsedJson object, look for specific fields we need
    // in the current object or nested objects
    
    // Check current object for expected fields - also check the parsedJson field name specifically
    const hasExpectedFields = 
      rawResponse.matching_score !== undefined || 
      rawResponse.skills !== undefined ||
      rawResponse.work_history !== undefined ||
      rawResponse.red_flags !== undefined ||
      rawResponse.summary !== undefined;
      
    if (hasExpectedFields) {
      console.log("extractRawResponseContent: Found expected fields at top level");
      return rawResponse;
    }
    
    // Check if there's a nested rawResponse object
    if (rawResponse.rawResponse) {
      console.log("extractRawResponseContent: Checking nested rawResponse object");
      
      // Look for parsedJson in the nested rawResponse.extractedSections - from screenshot
      if (rawResponse.rawResponse.extractedSections && 
          rawResponse.rawResponse.extractedSections.parsedJson) {
        console.log("extractRawResponseContent: Found parsedJson in rawResponse.extractedSections");
        return rawResponse.rawResponse.extractedSections.parsedJson;
      }
      
      const nestedHasExpectedFields = 
        rawResponse.rawResponse.matching_score !== undefined || 
        rawResponse.rawResponse.skills !== undefined ||
        rawResponse.rawResponse.work_history !== undefined ||
        rawResponse.rawResponse.red_flags !== undefined ||
        rawResponse.rawResponse.summary !== undefined;
        
      if (nestedHasExpectedFields) {
        console.log("extractRawResponseContent: Found expected fields in nested rawResponse");
        return rawResponse.rawResponse;
      }
      
      // Check if the nested structure has these fields directly
      // I see from screenshot it has a skills array
      if (Array.isArray(rawResponse.rawResponse.skills) ||
          Array.isArray(rawResponse.rawResponse.red_flags) ||
          rawResponse.rawResponse.score !== undefined) {
        console.log("extractRawResponseContent: Found expected field arrays directly in rawResponse.rawResponse");
        return rawResponse.rawResponse;
      }
    }
    
    // As a last resort, try to parse rawText if it exists
    if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
      console.log("extractRawResponseContent: Attempting to parse rawText");
      return this.parseJsonSafely(rawResponse.rawText);
    }
    
    if (rawResponse.rawResponse && rawResponse.rawResponse.rawText && typeof rawResponse.rawResponse.rawText === 'string') {
      console.log("extractRawResponseContent: Attempting to parse nested rawText");
      return this.parseJsonSafely(rawResponse.rawResponse.rawText);
    }
    
    console.log("extractRawResponseContent: Could not find parsedJson or expected fields");
    return null;
  }
  
  /**
   * Process a specific analysis result and extract structured data
   */
  static async processAnalysisResult(analysisResultId: string): Promise<boolean> {
    try {
      // Fetch the analysis result
      const [result] = await db
        .select()
        .from(analysisResults)
        .where(eq(analysisResults.id, analysisResultId));
      
      if (!result) {
        console.error(`Analysis result not found: ${analysisResultId}`);
        return false;
      }
      
      // Skip if rawResponse is null
      if (!result.rawResponse) {
        console.log(`Analysis result has no rawResponse: ${analysisResultId}`);
        await db
          .update(analysisResults)
          .set({ 
            parsingStatus: 'no_data'
          })
          .where(eq(analysisResults.id, analysisResultId));
        return false;
      }
      
      // Extract content from the raw response
      const content = this.extractRawResponseContent(result.rawResponse);
      
      if (!content) {
        console.error(`Failed to extract content from raw response: ${analysisResultId}`);
        await db
          .update(analysisResults)
          .set({ 
            parsingStatus: 'failed'
          })
          .where(eq(analysisResults.id, analysisResultId));
        return false;
      }
      
      // Extract the structured data using the specific field names
      // Use case-insensitive field matching to be more robust
      const skills = content.skills || content.Skills || [];
      const workHistory = content.work_history || content.Work_History || content.workHistory || [];
      const redFlags = content.red_flags || content.Red_Flags || content.redFlags || [];
      const summary = content.summary || content.Summary || '';
      const score = content.matching_score !== undefined ? content.matching_score : 
                   (content.score !== undefined ? content.score : result.overallScore);
      
      console.log(`Extracted from analysis ${analysisResultId}:`, {
        skillsCount: skills.length,
        workHistoryCount: workHistory.length, 
        redFlagsCount: redFlags.length,
        hasSummary: !!summary,
        score
      });
      
      // Log the raw content structure to help with debugging
      console.log("Content structure:", {
        hasSkills: !!content.skills || !!content.Skills,
        hasWorkHistory: !!content.work_history || !!content.Work_History || !!content.workHistory,
        hasRedFlags: !!content.red_flags || !!content.Red_Flags || !!content.redFlags,
        hasSummary: !!content.summary || !!content.Summary,
        hasScore: content.matching_score !== undefined || content.score !== undefined,
        contentKeys: Object.keys(content)
      });
      
      // Update the analysis result with the extracted data
      await db
        .update(analysisResults)
        .set({ 
          parsedSkills: skills,
          parsedWorkHistory: workHistory,
          parsedRedFlags: redFlags,
          parsedSummary: summary,
          overallScore: score,
          parsingStatus: 'success',
          updatedAt: new Date()
        })
        .where(eq(analysisResults.id, analysisResultId));
      
      console.log(`Successfully processed analysis result: ${analysisResultId}`);
      return true;
    } catch (error) {
      console.error(`Error processing analysis result ${analysisResultId}:`, error);
      
      // Update the parsing status to failed
      try {
        await db
          .update(analysisResults)
          .set({ 
            parsingStatus: 'error',
            updatedAt: new Date()
          })
          .where(eq(analysisResults.id, analysisResultId));
      } catch (updateError) {
        console.error(`Failed to update parsing status: ${updateError}`);
      }
      
      return false;
    }
  }
  
  /**
   * Process all analysis results for a specific resume
   */
  static async processAnalysisResultsForResume(resumeId: string): Promise<{
    successful: number;
    failed: number;
    total: number;
  }> {
    try {
      // Fetch all analysis results for the resume
      const results = await db
        .select()
        .from(analysisResults)
        .where(eq(analysisResults.resumeId, resumeId));
      
      console.log(`Processing ${results.length} analysis results for resume ${resumeId}`);
      
      let successful = 0;
      let failed = 0;
      
      // Process each analysis result
      for (const result of results) {
        const success = await this.processAnalysisResult(result.id);
        if (success) {
          successful++;
        } else {
          failed++;
        }
      }
      
      return {
        successful,
        failed,
        total: results.length
      };
    } catch (error) {
      console.error(`Error processing analysis results for resume ${resumeId}:`, error);
      throw error;
    }
  }
  
  /**
   * Process all analysis results in the database
   */
  static async processAllAnalysisResults(): Promise<{
    successful: number;
    failed: number;
    total: number;
  }> {
    try {
      // Fetch all analysis results
      const results = await db
        .select()
        .from(analysisResults);
      
      console.log(`Processing ${results.length} analysis results`);
      
      let successful = 0;
      let failed = 0;
      
      // Process each analysis result
      for (const result of results) {
        const success = await this.processAnalysisResult(result.id);
        if (success) {
          successful++;
        } else {
          failed++;
        }
      }
      
      return {
        successful,
        failed,
        total: results.length
      };
    } catch (error) {
      console.error('Error processing all analysis results:', error);
      throw error;
    }
  }
}