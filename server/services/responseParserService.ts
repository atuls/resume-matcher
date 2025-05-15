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
   */
  private static extractRawResponseContent(rawResponse: any): any {
    if (!rawResponse) return null;
    
    // If it's a string, try to parse it
    if (typeof rawResponse === 'string') {
      return this.parseJsonSafely(rawResponse);
    }
    
    // If it has a rawText property and it's a string, parse that
    if (rawResponse.rawText && typeof rawResponse.rawText === 'string') {
      return this.parseJsonSafely(rawResponse.rawText);
    }
    
    // If it has a parsedJson property, use that directly
    if (rawResponse.parsedJson) {
      return rawResponse.parsedJson;
    }
    
    // If it's already an object with the expected fields, use it directly
    if (rawResponse.matching_score !== undefined || 
        rawResponse.Summary || 
        rawResponse.Work_History || 
        rawResponse.Skills || 
        rawResponse.Red_Flags) {
      return rawResponse;
    }
    
    // If it's an object but doesn't have the expected fields, check for nested rawResponse
    if (rawResponse.rawResponse) {
      return this.extractRawResponseContent(rawResponse.rawResponse);
    }
    
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
      
      // Extract the structured data
      const skills = content.Skills || [];
      const workHistory = content.Work_History || [];
      const redFlags = content.Red_Flags || [];
      const summary = content.Summary || '';
      const score = content.matching_score !== undefined ? content.matching_score : result.overallScore;
      
      console.log(`Extracted from analysis ${analysisResultId}:`, {
        skillsCount: skills.length,
        workHistoryCount: workHistory.length,
        redFlagsCount: redFlags.length,
        hasSummary: !!summary,
        score
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