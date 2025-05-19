import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ParsedData {
  skills?: string[];
  workHistory?: any[];
  redFlags?: string[];
  summary?: string;
  score?: number;
}

interface ParsedDataViewerProps {
  data: ParsedData;
  className?: string;
}

export function ParsedDataViewer({ data, className }: ParsedDataViewerProps) {
  if (!data) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Structured Data</CardTitle>
          <CardDescription>No structured data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const formatWorkHistory = (workHistory: any[] = []) => {
    if (!workHistory || workHistory.length === 0) {
      return <p className="text-muted-foreground">No work history available</p>;
    }

    return (
      <div className="space-y-4">
        {workHistory.map((job, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{job.title || job.role || 'Unknown Position'}</h4>
                <p className="text-sm text-muted-foreground">
                  {job.company || job.organization || 'Unknown Company'}
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {job.dates || job.period || 'Unknown Period'}
              </div>
            </div>
            {job.description && (
              <p className="text-sm">{job.description}</p>
            )}
            <Separator className="my-2" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Structured Data</CardTitle>
            <CardDescription>
              Parsed from AI analysis
            </CardDescription>
          </div>
          {data.score !== undefined && (
            <Badge variant={data.score >= 75 ? "default" : data.score >= 50 ? "secondary" : "outline"} className="ml-2">
              Match: {data.score}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="skills">
          <TabsList className="mb-4">
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="workHistory">Work History</TabsTrigger>
            <TabsTrigger value="redFlags">Red Flags</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="skills">
            <ScrollArea className="h-[300px] pr-4">
              {data.skills && data.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.skills.map((skill, index) => (
                    <Badge key={index} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No skills extracted</p>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="workHistory">
            <ScrollArea className="h-[300px] pr-4">
              {formatWorkHistory(data.workHistory)}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="redFlags">
            <ScrollArea className="h-[300px] pr-4">
              {data.redFlags && data.redFlags.length > 0 ? (
                <ul className="list-disc pl-6 space-y-2">
                  {data.redFlags.map((flag, index) => (
                    <li key={index} className="text-destructive">
                      {flag}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No red flags detected</p>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="summary">
            <ScrollArea className="h-[300px] pr-4">
              {data.summary ? (
                <p className="whitespace-pre-line">{data.summary}</p>
              ) : (
                <p className="text-muted-foreground">No summary available</p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}