import React, { useState } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ExternalLink, FileText, ChevronDown, ChevronUp, Zap, FileBadge, Bug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  examineSkillsAccessPaths,
  examineWorkHistoryAccessPaths,
  extractSkillsFromAnalysis,
  categorizeSkills,
  extractWorkHistory,
  findFieldPath
} from "@/lib/debug-utils";

interface DebugPanelProps {
  resumeId: string;
  analysis: any;
  redFlagData: any;
}

function formatSectionName(key: string): string {
  // Convert camelCase or snake_case to Title Case with spaces
  return key
    .replace(/([A-Z])/g, ' $1') // Insert space before uppercase letters
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
    .trim();
}

function isPrimitive(value: any): boolean {
  return value === null || 
    typeof value === 'string' || 
    typeof value === 'number' || 
    typeof value === 'boolean';
}

// Component to display an object in a tree-like format
// This is more readable than JSON.stringify for nested objects
function ObjectTree({ data, level = 0 }: { data: any, level?: number }) {
  if (data === null || data === undefined) {
    return <span className="text-gray-400">null</span>;
  }
  
  if (isPrimitive(data)) {
    if (typeof data === 'string') {
      return <span className="text-green-600">"{data}"</span>;
    }
    if (typeof data === 'number') {
      return <span className="text-blue-600">{data}</span>;
    }
    if (typeof data === 'boolean') {
      return <span className="text-purple-600">{String(data)}</span>;
    }
    return <span>{String(data)}</span>;
  }
  
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-400">[]</span>;
    }
    
    return (
      <div className="ml-4">
        [
        {data.map((item, index) => (
          <div key={index} className="ml-4">
            <ObjectTree data={item} level={level + 1} />
            {index < data.length - 1 && ','}
          </div>
        ))}
        ]
      </div>
    );
  }
  
  // Handle object
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return <span className="text-gray-400">{"{}"}</span>;
  }
  
  return (
    <div className="ml-4">
      {"{"}
      {keys.map((key, index) => (
        <div key={key} className="ml-4">
          <span className="text-yellow-600">{key}</span>: <ObjectTree data={data[key]} level={level + 1} />
          {index < keys.length - 1 && ','}
        </div>
      ))}
      {"}"}
    </div>
  );
}

function DataSection({ title, data, icon: Icon }: { title: string, data: any, icon: React.ElementType }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-md border overflow-hidden">
      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
        <div className="flex items-center">
          <Icon className="h-4 w-4 mr-2 text-primary" />
          <h4 className="font-medium">{title}</h4>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="p-4">
          <Tabs defaultValue="pretty">
            <TabsList className="mb-4">
              <TabsTrigger value="pretty">Structured View</TabsTrigger>
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="pretty">
              <div className="overflow-auto text-xs max-h-80 p-3 rounded bg-gray-50 font-mono">
                <ObjectTree data={data} />
              </div>
            </TabsContent>
            <TabsContent value="raw">
              <pre className="overflow-auto text-xs max-h-80 p-3 rounded bg-black text-green-400">
                {JSON.stringify(data, null, 2) || "No data available"}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExtractedTextSection({ extractedText }: { extractedText: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-md border overflow-hidden">
      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
        <div className="flex items-center">
          <FileText className="h-4 w-4 mr-2 text-primary" />
          <h4 className="font-medium">Extracted Resume Text</h4>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="p-4">
          <div className="overflow-auto max-h-80 p-3 rounded bg-gray-50">
            <pre className="text-sm whitespace-pre-wrap font-mono text-slate-800">
              {extractedText}
            </pre>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DebugPanel({ resumeId, analysis, redFlagData }: DebugPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-lg">Resume Analysis Debug Info</h3>
        <Badge variant="secondary" className="ml-2">
          Resume ID: {resumeId}
        </Badge>
      </div>
      
      {/* Data Structure Diagnosis Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <div className="ml-2">
          <p className="font-medium text-sm">Data Structure Diagnosis</p>
          <p className="text-xs text-gray-500">
            This panel displays the raw data from the AI analysis. Use these views to troubleshoot issues with
            data extraction and formatting across the different tabs.
          </p>
        </div>
      </Alert>
      
      {/* Skills Analysis */}
      <DataSection title="Skills Analysis Data" data={analysis} icon={Zap} />
      
      {/* Red Flag Analysis */}
      <DataSection title="Red Flag Analysis Data" data={redFlagData} icon={Bug} />
      
      {/* Raw Response Section if available */}
      {analysis?.rawResponse && (
        <DataSection title="Raw AI Response" data={
          (() => {
            if (typeof analysis.rawResponse === 'string') {
              try {
                return JSON.parse(analysis.rawResponse);
              } catch (e) {
                // If it's not valid JSON, just return the string
                return analysis.rawResponse;
              }
            }
            return analysis.rawResponse;
          })()
        } icon={FileBadge} />
      )}
      
      {/* Data Path Analysis */}
      <Collapsible className="rounded-md border overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <div className="flex items-center">
            <FileText className="h-4 w-4 mr-2 text-primary" />
            <h4 className="font-medium">Data Access Paths</h4>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="p-4 space-y-4">
            <div>
              <h5 className="text-sm font-medium">Skills Access Paths:</h5>
              <pre className="overflow-auto text-xs max-h-40 p-3 rounded bg-black text-green-400">
                {JSON.stringify(examineSkillsAccessPaths(analysis), null, 2)}
              </pre>
            </div>
            
            <div className="mt-4">
              <h5 className="text-sm font-medium">Work History Access Paths:</h5>
              <pre className="overflow-auto text-xs max-h-40 p-3 rounded bg-black text-green-400">
                {JSON.stringify(examineWorkHistoryAccessPaths(redFlagData), null, 2)}
              </pre>
            </div>
            
            <div className="mt-4">
              <h5 className="text-sm font-medium">Extracted Skills:</h5>
              <pre className="overflow-auto text-xs max-h-40 p-3 rounded bg-black text-green-400">
                {JSON.stringify(extractSkillsFromAnalysis(analysis), null, 2)}
              </pre>
            </div>
            
            <div className="mt-4">
              <h5 className="text-sm font-medium">Categorized Skills:</h5>
              <pre className="overflow-auto text-xs max-h-40 p-3 rounded bg-black text-green-400">
                {JSON.stringify(categorizeSkills(extractSkillsFromAnalysis(analysis)), null, 2)}
              </pre>
            </div>
            
            <div className="mt-4">
              <h5 className="text-sm font-medium">Extracted Work History:</h5>
              <pre className="overflow-auto text-xs max-h-40 p-3 rounded bg-black text-green-400">
                {JSON.stringify(extractWorkHistory(redFlagData), null, 2)}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Extracted Text Section (if available in analysis) */}
      {analysis?.extracted_text && (
        <ExtractedTextSection extractedText={analysis.extracted_text} />
      )}
    </div>
  );
}