import React from 'react';
import { CircleDashed, Database, ListChecks, ListTree, FileText, Download, FileJson } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AnalysisSummaryStatsProps {
  scores: {
    [resumeId: string]: { 
      score: number, 
      matchedAt: Date,
      skills?: string[],
      redFlags?: string[],
      currentPosition?: { title: string, company: string } | null,
      parsingStatus?: string,
      parsedJson?: any
    }
  };
  jobId?: string;
  onLoadRawResponses?: () => void;
}

export default function AnalysisSummaryStats({ 
  scores, 
  jobId, 
  onLoadRawResponses 
}: AnalysisSummaryStatsProps) {
  // Calculate stats
  const resumeCount = Object.keys(scores).length;
  // Analysis was performed if score exists (we can't directly check rawResponse as it's not returned to the client)
  const hasAnalysisCount = resumeCount;
  const parsedCompleteCount = Object.values(scores).filter(score => 
    score.parsingStatus === 'complete'
  ).length;
  const hasSkillsCount = Object.values(scores).filter(score => 
    Array.isArray(score.skills) && score.skills.length > 0
  ).length;
  // Count work history based on actual work history array or fallback to current position
  const hasWorkHistoryCount = Object.values(scores).filter(score => 
    (Array.isArray(score.skills) && score.skills.length > 0) && 
    (score.currentPosition !== null || 
     (Array.isArray(score.workHistory) && score.workHistory.length > 0))
  ).length;
  
  // Consider structured data present if we have at least skills, which is the most common field
  const hasStructuredDataCount = Object.values(scores).filter(score => 
    Array.isArray(score.skills) && score.skills.length > 0
  ).length;

  return (
    <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mb-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <Database className="h-4 w-4 mr-2" />
          Analysis Summary
        </h3>
        {jobId && onLoadRawResponses && (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center text-xs"
            onClick={onLoadRawResponses}
          >
            <Download className="h-3 w-3 mr-1.5" />
            Load Raw Responses
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <FileText className="h-3 w-3 mr-1" />
            Raw responses available
          </span>
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800 mr-2">{hasAnalysisCount}</span>
              <span className="text-sm text-gray-500">/ {resumeCount}</span>
            </div>
            {resumeCount > 0 && (
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.round((hasAnalysisCount / resumeCount) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {Math.round((hasAnalysisCount / resumeCount) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <CircleDashed className="h-3 w-3 mr-1" />
            Parsing status complete
          </span>
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800 mr-2">{parsedCompleteCount}</span>
              <span className="text-sm text-gray-500">/ {resumeCount}</span>
            </div>
            {resumeCount > 0 && (
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.round((parsedCompleteCount / resumeCount) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {Math.round((parsedCompleteCount / resumeCount) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <FileJson className="h-3 w-3 mr-1" />
            Has structured data
          </span>
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800 mr-2">{hasStructuredDataCount}</span>
              <span className="text-sm text-gray-500">/ {resumeCount}</span>
            </div>
            {resumeCount > 0 && (
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`${hasStructuredDataCount > 0 ? 'bg-green-500' : 'bg-blue-500'} h-1.5 rounded-full`}
                    style={{ width: `${Math.round((hasStructuredDataCount / resumeCount) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {Math.round((hasStructuredDataCount / resumeCount) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <ListChecks className="h-3 w-3 mr-1" />
            Has parsed skills
          </span>
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800 mr-2">{hasSkillsCount}</span>
              <span className="text-sm text-gray-500">/ {resumeCount}</span>
            </div>
            {resumeCount > 0 && (
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.round((hasSkillsCount / resumeCount) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {Math.round((hasSkillsCount / resumeCount) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <ListTree className="h-3 w-3 mr-1" />
            Has parsed work history
          </span>
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800 mr-2">{hasWorkHistoryCount}</span>
              <span className="text-sm text-gray-500">/ {resumeCount}</span>
            </div>
            {resumeCount > 0 && (
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.round((hasWorkHistoryCount / resumeCount) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {Math.round((hasWorkHistoryCount / resumeCount) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}