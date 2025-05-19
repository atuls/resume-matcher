import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface WorkHistoryItem {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
  isCurrentRole?: string | boolean;
  durationMonths?: number;
  location?: string;
}

interface ParsedJsonData {
  skills: string[];
  workHistory: WorkHistoryItem[];
  redFlags: string[];
  summary: string;
  score: number;
}

interface ParsedJsonDisplayProps {
  data: ParsedJsonData;
}

export function ParsedJsonDisplay({ data }: ParsedJsonDisplayProps) {
  if (!data) {
    return <div>No parsed data available</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Score Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Match Score</h2>
        <Badge className={`text-lg px-3 py-1 ${getScoreColorClass(data.score)}`}>
          {data.score}%
        </Badge>
      </div>
      
      {/* Summary Section */}
      {data.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{data.summary}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Skills Section */}
      {data.skills && data.skills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.skills.map((skill, index) => (
                <Badge key={index} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Work History Section */}
      {data.workHistory && data.workHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Work History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {data.workHistory.map((job, index) => (
                  <div key={index} className="border-l-2 border-primary pl-4 py-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{job.title}</h3>
                      {job.isCurrentRole === true || job.isCurrentRole === "true" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Current
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-600">{job.company}</p>
                    <p className="text-xs text-gray-500">
                      {job.startDate} - {job.endDate === "current" ? "Present" : job.endDate}
                      {job.durationMonths ? ` · ${formatDuration(job.durationMonths)}` : ''}
                    </p>
                    {job.description && (
                      <p className="text-sm mt-2">{job.description}</p>
                    )}
                    {index < data.workHistory.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      {/* Red Flags Section */}
      {data.redFlags && data.redFlags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Potential Concerns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1">
              {data.redFlags.map((flag, index) => (
                <li key={index} className="text-sm text-gray-600">
                  {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to format duration
function formatDuration(months: number): string {
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (remainingMonths === 0) {
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  
  return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
}

// Helper function to get score color class
function getScoreColorClass(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 hover:bg-green-100';
  if (score >= 60) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
  return 'bg-red-100 text-red-800 hover:bg-red-100';
}