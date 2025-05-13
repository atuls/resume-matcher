import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Briefcase, AlertTriangle, CheckCircle } from "lucide-react";
import { extractWorkHistory } from "@/lib/debug-utils";
import { extractResumeData, extractRedFlagData } from "@/lib/resume-data-extractor";

interface ResumeWorkHistoryTabProps {
  redFlagData: any;
  redFlagLoading: boolean;
  isRedFlagLoading: boolean;
  redFlagError: any;
  analysis?: any; // Add analysis data
}

export function ResumeWorkHistoryTab({
  redFlagData,
  redFlagLoading,
  isRedFlagLoading,
  redFlagError,
  analysis
}: ResumeWorkHistoryTabProps) {
  if (redFlagLoading || isRedFlagLoading) {
    return (
      <div className="flex justify-center items-center h-36">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-sm">Analyzing work history...</span>
      </div>
    );
  }
  
  if (redFlagError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to analyze work history. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // Extract work history from both analysis and red flag data
  const rfExtractedData = extractResumeData(redFlagData);
  
  // Also extract from analysis data if available
  const analysisExtractedData = analysis ? extractResumeData(analysis) : {
    workHistory: [],
    skills: [],
    redFlags: []
  };
  
  // Use work history from either source, prioritizing analysis data
  const workHistory = analysisExtractedData.workHistory.length > 0 
    ? analysisExtractedData.workHistory 
    : (rfExtractedData.workHistory.length > 0 
      ? rfExtractedData.workHistory 
      : extractWorkHistory(redFlagData)); // Fallback to old method if needed
  
  console.log("Work history from analysis:", analysisExtractedData.workHistory);
  console.log("Work history from red flags:", rfExtractedData.workHistory);
  console.log("Final work history:", workHistory);
    
  // Extract red flags using our specialized extractor
  const redFlags = extractRedFlagData(redFlagData);
  // Fallback to old method if our extractor doesn't find anything
  const potentialRedFlags = redFlags.length > 0 
    ? redFlags.map(flag => ({ description: flag })) 
    : redFlagData?.analysis?.potentialRedFlags || [];
  
  return (
    <div className="space-y-6">
      {/* Work History Debug Section */}
      <div className="mb-4 p-4 bg-gray-50 rounded-md">
        <h3 className="text-sm font-medium mb-2">Work History Analysis Debug:</h3>
        <pre className="text-xs overflow-auto max-h-40 p-3 bg-gray-100 rounded-md">
          {JSON.stringify(redFlagData, null, 2) || "No red flag analysis data available"}
        </pre>
      </div>
      
      {/* Red Flags Section */}
      <div className="rounded-md border p-4">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-medium">Potential Red Flags</h3>
        </div>
        
        {potentialRedFlags.length > 0 ? (
          <div className="space-y-4">
            {potentialRedFlags.map((flag: any, index: number) => (
              <div key={index} className="p-3 bg-amber-50 text-amber-800 rounded-md">
                <div className="font-medium mb-1">
                  {flag.title || (typeof flag === 'string' ? "Potential Issue" : "Potential Issue")}
                </div>
                <p className="text-sm">
                  {flag.description || flag.issue || (typeof flag === 'string' ? flag : JSON.stringify(flag))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-3 px-4 bg-green-50 text-green-800 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            <p>No red flags detected in work history</p>
          </div>
        )}
      </div>
      
      {/* Work History Roles */}
      <div className="rounded-md border p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Briefcase className="h-5 w-5 text-blue-500" />
          <h3 className="font-medium">Work History</h3>
        </div>
        
        {workHistory.length > 0 ? (
          <div className="space-y-4">
            {workHistory.map((role: any, index: number) => (
              <div key={index} className="p-4 border rounded-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">
                      {role.title || role.Title || role.position || role.Position || "Role"}
                    </h4>
                    <div className="text-sm text-gray-600">
                      {role.company || role.Company || role.organization || role.Organization || "Company"}
                      {(role.location || role.Location) && 
                        <span className="ml-1">• {role.location || role.Location}</span>
                      }
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {role.startDate || role.StartDate || role.dates?.start || ""} - {role.endDate || role.EndDate || role.dates?.end || (role.isCurrentRole || role.isCurrentlyEmployed) ? "Present" : ""}
                  </div>
                </div>
                {(role.description || role.Description) && (
                  <p className="text-sm mt-2">{role.description || role.Description}</p>
                )}
                {(role.achievements || role.Achievements) && Array.isArray(role.achievements || role.Achievements) && (
                  <div className="mt-2">
                    <h5 className="text-sm font-medium">Key Achievements:</h5>
                    <ul className="list-disc pl-5 text-sm mt-1">
                      {(role.achievements || role.Achievements).map((achievement: string, i: number) => (
                        <li key={i}>{achievement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No work history information found</p>
        )}
      </div>
    </div>
  );
}