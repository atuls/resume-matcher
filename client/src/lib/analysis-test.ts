/**
 * Test utility for analyzing resume analysis data structures
 * This will help us identify the correct paths for accessing data in the analysis results
 */

import { apiRequest } from "@/lib/queryClient";

interface DebugResult {
  skills: {
    foundPath: string;
    data: string[];
  };
  workHistory: {
    foundPath: string;
    data: any[];
  };
  redFlags: {
    foundPath: string;
    data: any[];
  };
  matchingScore: {
    foundPath: string;
    score: number;
  };
  summary: {
    foundPath: string;
    text: string;
  };
  allPaths: {
    skills: Record<string, any>;
    workHistory: Record<string, any>;
    redFlags: Record<string, any>;
    score: Record<string, any>;
    summary: Record<string, any>;
  };
}

/**
 * Tests all possible access paths for a resume analysis
 * @param resumeId The resume ID to analyze
 * @returns A debug result with all found data paths and values
 */
export async function testAnalysisDataPaths(resumeId: string): Promise<DebugResult> {
  try {
    // Fetch the analysis result
    const analysisResult = await apiRequest(`/api/resumes/${resumeId}/analysis`);
    console.log("Full analysis result:", analysisResult);
    
    // Try different access paths for skills
    const skillsPaths = {
      "rawResponse.rawResponse.parsedJson.Skills": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "Skills"]),
      "rawResponse.rawResponse.extractedSections.skills": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "extractedSections", "skills"]),
      "rawResponse.skills": getNestedValue(analysisResult, ["rawResponse", "skills"]),
      "analysis.skills": getNestedValue(analysisResult, ["analysis", "skills"])
    };
    
    // Try different access paths for work history
    const workHistoryPaths = {
      "rawResponse.rawResponse.parsedJson.Work History": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "Work History"]),
      "rawResponse.rawResponse.parsedJson.work_history": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "work_history"]),
      "rawResponse.rawResponse.parsedJson.WorkHistory": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "WorkHistory"]),
      "rawResponse.rawResponse.extractedSections.workHistory": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "extractedSections", "workHistory"]),
      "rawResponse.workHistory": getNestedValue(analysisResult, ["rawResponse", "workHistory"]),
      "analysis.workHistory": getNestedValue(analysisResult, ["analysis", "workHistory"]),
      "analysis.recentRoles": getNestedValue(analysisResult, ["analysis", "recentRoles"])
    };
    
    // Try different access paths for red flags
    const redFlagsPaths = {
      "rawResponse.rawResponse.parsedJson.Red Flags": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "Red Flags"]),
      "rawResponse.rawResponse.parsedJson.RedFlags": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "RedFlags"]),
      "rawResponse.rawResponse.parsedJson.red_flags": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "red_flags"]),
      "rawResponse.rawResponse.extractedSections.redFlags": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "extractedSections", "redFlags"]),
      "rawResponse.redFlags": getNestedValue(analysisResult, ["rawResponse", "redFlags"]),
      "analysis.redFlags": getNestedValue(analysisResult, ["analysis", "redFlags"]),
      "analysis.potentialRedFlags": getNestedValue(analysisResult, ["analysis", "potentialRedFlags"])
    };
    
    // Try different access paths for matching score
    const scorePaths = {
      "overallScore": getNestedValue(analysisResult, ["overallScore"]),
      "rawResponse.score": getNestedValue(analysisResult, ["rawResponse", "score"]),
      "rawResponse.rawResponse.parsedJson.matching_score": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "matching_score"]),
      "rawResponse.rawResponse.parsedJson.matchingScore": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "matchingScore"]),
      "rawResponse.rawResponse.parsedJson.score": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "score"])
    };
    
    // Try different access paths for summary
    const summaryPaths = {
      "rawResponse.rawResponse.parsedJson.Summary": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "Summary"]),
      "rawResponse.rawResponse.parsedJson.summary": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "parsedJson", "summary"]),
      "rawResponse.rawResponse.extractedSections.summary": getNestedValue(analysisResult, ["rawResponse", "rawResponse", "extractedSections", "summary"]),
      "rawResponse.summary": getNestedValue(analysisResult, ["rawResponse", "summary"]),
      "analysis.summary": getNestedValue(analysisResult, ["analysis", "summary"])
    };
    
    // Find the first working path for each data type
    const skillsResult = findFirstValidPath(skillsPaths);
    const workHistoryResult = findFirstValidPath(workHistoryPaths);
    const redFlagsResult = findFirstValidPath(redFlagsPaths);
    const scoreResult = findFirstValidPath(scorePaths);
    const summaryResult = findFirstValidPath(summaryPaths);
    
    // Return the debug result
    return {
      skills: {
        foundPath: skillsResult.path,
        data: skillsResult.value || []
      },
      workHistory: {
        foundPath: workHistoryResult.path,
        data: workHistoryResult.value || []
      },
      redFlags: {
        foundPath: redFlagsResult.path,
        data: redFlagsResult.value || []
      },
      matchingScore: {
        foundPath: scoreResult.path,
        score: scoreResult.value || 0
      },
      summary: {
        foundPath: summaryResult.path,
        text: summaryResult.value || ""
      },
      allPaths: {
        skills: skillsPaths,
        workHistory: workHistoryPaths,
        redFlags: redFlagsPaths,
        score: scorePaths,
        summary: summaryPaths
      }
    };
  } catch (error) {
    console.error("Error testing analysis data paths:", error);
    throw error;
  }
}

/**
 * Same test function but for red flag analysis
 * @param resumeId The resume ID to analyze
 * @returns A debug result with red flag data paths and values
 */
export async function testRedFlagDataPaths(resumeId: string): Promise<any> {
  try {
    // Fetch the red flag analysis result
    const redFlagResult = await apiRequest(`/api/resumes/${resumeId}/red-flag-analysis`);
    console.log("Full red flag analysis result:", redFlagResult);
    
    // Try different access paths for red flags
    const redFlagsPaths = {
      "analysis.potentialRedFlags": getNestedValue(redFlagResult, ["analysis", "potentialRedFlags"]),
      "analysis.redFlags": getNestedValue(redFlagResult, ["analysis", "redFlags"]),
      "rawResponse.parsedJson.Red Flags": getNestedValue(redFlagResult, ["rawResponse", "parsedJson", "Red Flags"]),
      "rawResponse.parsedJson.RedFlags": getNestedValue(redFlagResult, ["rawResponse", "parsedJson", "RedFlags"]),
      "rawResponse.parsedJson.red_flags": getNestedValue(redFlagResult, ["rawResponse", "parsedJson", "red_flags"]),
      "rawResponse.extractedSections.redFlags": getNestedValue(redFlagResult, ["rawResponse", "extractedSections", "redFlags"])
    };
    
    // Try different access paths for work history
    const workHistoryPaths = {
      "analysis.recentRoles": getNestedValue(redFlagResult, ["analysis", "recentRoles"]),
      "analysis.workHistory": getNestedValue(redFlagResult, ["analysis", "workHistory"]),
      "rawResponse.parsedJson.Work History": getNestedValue(redFlagResult, ["rawResponse", "parsedJson", "Work History"]),
      "rawResponse.parsedJson.work_history": getNestedValue(redFlagResult, ["rawResponse", "parsedJson", "work_history"]),
      "rawResponse.parsedJson.WorkHistory": getNestedValue(redFlagResult, ["rawResponse", "parsedJson", "WorkHistory"]),
      "rawResponse.extractedSections.workHistory": getNestedValue(redFlagResult, ["rawResponse", "extractedSections", "workHistory"])
    };
    
    // Find the first working path for each data type
    const redFlagsResult = findFirstValidPath(redFlagsPaths);
    const workHistoryResult = findFirstValidPath(workHistoryPaths);
    
    return {
      redFlags: {
        foundPath: redFlagsResult.path,
        data: redFlagsResult.value || []
      },
      workHistory: {
        foundPath: workHistoryResult.path,
        data: workHistoryResult.value || []
      },
      allPaths: {
        redFlags: redFlagsPaths,
        workHistory: workHistoryPaths
      }
    };
  } catch (error) {
    console.error("Error testing red flag data paths:", error);
    throw error;
  }
}

/**
 * Helper function to safely get a nested value from an object
 * @param obj The object to get the value from
 * @param path The path to the value as an array of keys
 * @returns The value at the path or undefined if not found
 */
function getNestedValue(obj: any, path: string[]): any {
  try {
    return path.reduce((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[key];
    }, obj);
  } catch (e) {
    return undefined;
  }
}

/**
 * Helper function to find the first valid path in a paths object
 * @param paths An object mapping path strings to their values
 * @returns The first path with a valid value and the value itself
 */
function findFirstValidPath(paths: Record<string, any>): { path: string, value: any } {
  for (const [path, value] of Object.entries(paths)) {
    // Check if the value is valid (not null, undefined, or empty array)
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          return { path, value };
        }
      } else if (typeof value === "string") {
        if (value.trim() !== "") {
          return { path, value };
        }
      } else if (typeof value === "number") {
        return { path, value };
      } else if (typeof value === "object") {
        if (Object.keys(value).length > 0) {
          return { path, value };
        }
      } else {
        return { path, value };
      }
    }
  }
  
  // If no valid path is found, return the first path
  const firstPath = Object.keys(paths)[0];
  return { path: firstPath || "", value: paths[firstPath] };
}

/**
 * Run both analysis and red flag analysis tests
 * @param resumeId The resume ID to test
 */
export async function runAllTests(resumeId: string): Promise<{
  analysis: DebugResult;
  redFlagAnalysis: any;
}> {
  const analysis = await testAnalysisDataPaths(resumeId);
  const redFlagAnalysis = await testRedFlagDataPaths(resumeId);
  
  // Log test results
  console.log("=== ANALYSIS TEST RESULTS ===");
  console.log("Skills:", analysis.skills.foundPath, analysis.skills.data);
  console.log("Work History:", analysis.workHistory.foundPath, analysis.workHistory.data);
  console.log("Red Flags:", analysis.redFlags.foundPath, analysis.redFlags.data);
  console.log("Matching Score:", analysis.matchingScore.foundPath, analysis.matchingScore.score);
  console.log("Summary:", analysis.summary.foundPath, analysis.summary.text.substring(0, 100) + "...");
  
  console.log("=== RED FLAG ANALYSIS TEST RESULTS ===");
  console.log("Red Flags:", redFlagAnalysis.redFlags.foundPath, redFlagAnalysis.redFlags.data);
  console.log("Work History:", redFlagAnalysis.workHistory.foundPath, redFlagAnalysis.workHistory.data);
  
  return { analysis, redFlagAnalysis };
}