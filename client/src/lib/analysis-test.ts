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
    const response = await fetch(`/api/resumes/${resumeId}/analysis`, { 
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch analysis: ${response.status} ${response.statusText}`);
    }
    
    const analysisResult = await response.json();
    console.log("Full analysis result:", analysisResult);
    
    // First unwrap the array if it exists
    const analysisData = Array.isArray(analysisResult) ? analysisResult[0] : analysisResult;
    
    // Try to extract JSON from the rawText if it exists
    let parsedJson = null;
    try {
      const rawText = getNestedValue(analysisData, ["rawResponse", "rawResponse", "rawText"]);
      if (rawText && typeof rawText === 'string') {
        parsedJson = JSON.parse(rawText);
      }
    } catch (e) {
      console.error("Error parsing JSON from rawText:", e);
    }
    
    // Try different access paths for skills
    const skillsPaths = {
      "rawResponse.skills": getNestedValue(analysisData, ["rawResponse", "skills"]),
      "skillMatches": getNestedValue(analysisData, ["skillMatches"]),
      "parsedJson.Skills": parsedJson?.Skills || [],
      "parsedJson.skills": parsedJson?.skills || []
    };
    
    // Try different access paths for work history
    const workHistoryPaths = {
      "rawResponse.experience": getNestedValue(analysisData, ["rawResponse", "experience"]),
      "parsedJson.Work History": parsedJson?.["Work History"] || [],
      "parsedJson.work_history": parsedJson?.work_history || [],
      "parsedJson.WorkHistory": parsedJson?.WorkHistory || []
    };
    
    // Try different access paths for red flags
    const redFlagsPaths = {
      "parsedJson.Red Flags": parsedJson?.["Red Flags"] || [],
      "parsedJson.RedFlags": parsedJson?.RedFlags || [],
      "parsedJson.red_flags": parsedJson?.red_flags || []
    };
    
    // Try different access paths for matching score
    const scorePaths = {
      "overallScore": getNestedValue(analysisData, ["overallScore"]),
      "rawResponse.score": getNestedValue(analysisData, ["rawResponse", "score"]),
      "parsedJson.matching_score": parsedJson?.matching_score || 0,
      "parsedJson.matchingScore": parsedJson?.matchingScore || 0,
      "parsedJson.score": parsedJson?.score || 0
    };
    
    // Try different access paths for summary
    const summaryPaths = {
      "rawResponse.experience": getNestedValue(analysisData, ["rawResponse", "experience"]),
      "parsedJson.Summary": parsedJson?.Summary || "",
      "parsedJson.summary": parsedJson?.summary || ""
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
 * Run both analysis and red flag analysis tests
 * @param resumeId The resume ID to test
 */
export async function runAllTests(resumeId: string): Promise<{
  analysis: DebugResult;
  redFlagAnalysis: any;
}> {
  try {
    const analysis = await testAnalysisDataPaths(resumeId);
    const redFlagAnalysis = await testRedFlagDataPaths(resumeId);
    
    // Log test results
    console.log("=== ANALYSIS TEST RESULTS ===");
    console.log("Skills:", analysis.skills.foundPath, analysis.skills.data);
    console.log("Work History:", analysis.workHistory.foundPath, analysis.workHistory.data);
    console.log("Red Flags:", analysis.redFlags.foundPath, analysis.redFlags.data);
    console.log("Matching Score:", analysis.matchingScore.foundPath, analysis.matchingScore.score);
    console.log("Summary:", analysis.summary.foundPath, analysis.summary.text?.substring(0, 100) + "...");
    
    console.log("=== RED FLAG ANALYSIS TEST RESULTS ===");
    console.log("Red Flags:", redFlagAnalysis.redFlags.foundPath, redFlagAnalysis.redFlags.data);
    console.log("Work History:", redFlagAnalysis.workHistory.foundPath, redFlagAnalysis.workHistory.data);
    
    return { analysis, redFlagAnalysis };
  } catch (error) {
    console.error("Error running all tests:", error);
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
    const response = await fetch(`/api/resumes/${resumeId}/red-flag-analysis`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch red flag analysis: ${response.status} ${response.statusText}`);
    }
    
    const redFlagResult = await response.json();
    console.log("Full red flag analysis result:", redFlagResult);
    
    // Try different access paths for red flags
    const redFlagsPaths = {
      "redFlags.redFlags": getNestedValue(redFlagResult, ["redFlags", "redFlags"]),
      "redFlags.isCurrentlyEmployed": getNestedValue(redFlagResult, ["redFlags", "isCurrentlyEmployed"]),
      "redFlags.hasJobHoppingHistory": getNestedValue(redFlagResult, ["redFlags", "hasJobHoppingHistory"]),
      "redFlags.hasContractRoles": getNestedValue(redFlagResult, ["redFlags", "hasContractRoles"])
    };
    
    // Try different access paths for work history
    const workHistoryPaths = {
      "redFlags.recentRoles": getNestedValue(redFlagResult, ["redFlags", "recentRoles"]),
      "redFlags.highlights": getNestedValue(redFlagResult, ["redFlags", "highlights"])
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

