import React from 'react';
import { CircleDashed, Database, ListChecks, ListTree, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AnalysisSummaryStatsProps {
  scores: {
    [resumeId: string]: { 
      score: number, 
      matchedAt: Date,
      skills?: string[],
      redFlags?: string[],
      currentPosition?: { title: string, company: string } | null,
      parsingStatus?: string
    }
  };
}

export default function AnalysisSummaryStats({ scores }: AnalysisSummaryStatsProps) {
  // Calculate stats
  const resumeCount = Object.keys(scores).length;
  const hasRawResponseCount = Object.values(scores).filter(score => 
    // Can't directly check rawResponse as it's not returned to the client
    // Instead checking if parsingStatus exists, which indicates analysis was performed
    score.parsingStatus
  ).length;
  const parsedCompleteCount = Object.values(scores).filter(score => 
    score.parsingStatus === 'complete'
  ).length;
  const hasSkillsCount = Object.values(scores).filter(score => 
    Array.isArray(score.skills) && score.skills.length > 0
  ).length;
  const hasWorkHistoryCount = Object.values(scores).filter(score => 
    score.currentPosition !== null && score.currentPosition !== undefined
  ).length;

  return (
    <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mb-5">
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
        <Database className="h-4 w-4 mr-2" />
        Analysis Summary
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <FileText className="h-3 w-3 mr-1" />
            Raw responses available
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 mr-2">{rawResponseCount}</span>
            <span className="text-sm text-gray-500">/ {resumeCount}</span>
            {resumeCount > 0 && (
              <Badge 
                variant={rawResponseCount === resumeCount ? "default" : "outline"}
                className="ml-auto"
              >
                {Math.round((rawResponseCount / resumeCount) * 100)}%
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <CircleDashed className="h-3 w-3 mr-1" />
            Parsing status complete
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 mr-2">{parsedCompleteCount}</span>
            <span className="text-sm text-gray-500">/ {resumeCount}</span>
            {resumeCount > 0 && (
              <Badge 
                variant={parsedCompleteCount === resumeCount ? "default" : "outline"}
                className="ml-auto"
              >
                {Math.round((parsedCompleteCount / resumeCount) * 100)}%
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <ListChecks className="h-3 w-3 mr-1" />
            Has parsed skills
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 mr-2">{hasSkillsCount}</span>
            <span className="text-sm text-gray-500">/ {resumeCount}</span>
            {resumeCount > 0 && (
              <Badge 
                variant={hasSkillsCount === resumeCount ? "default" : "outline"}
                className="ml-auto"
              >
                {Math.round((hasSkillsCount / resumeCount) * 100)}%
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center mb-1">
            <ListTree className="h-3 w-3 mr-1" />
            Has parsed work history
          </span>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-800 mr-2">{hasWorkHistoryCount}</span>
            <span className="text-sm text-gray-500">/ {resumeCount}</span>
            {resumeCount > 0 && (
              <Badge 
                variant={hasWorkHistoryCount === resumeCount ? "default" : "outline"}
                className="ml-auto"
              >
                {Math.round((hasWorkHistoryCount / resumeCount) * 100)}%
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}