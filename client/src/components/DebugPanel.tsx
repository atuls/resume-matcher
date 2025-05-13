import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
            This section uses debug utilities to identify the correct data access paths for Skills, Work History, and Red Flags.
            Use this information to fix data access paths in the UI components.
          </p>
        </div>
      </Alert>
      
      {/* Skills Analysis Object Structure */}
      <div className="rounded-md border overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h4 className="font-medium">Skills Analysis Object Structure</h4>
          <p className="text-xs text-gray-500">Full data returned from the Skills Analysis API</p>
        </div>
        <div className="p-4">
          <pre className="overflow-auto text-xs max-h-80 p-3 rounded bg-black text-green-400">
            {JSON.stringify(analysis, null, 2) || "No analysis data available"}
          </pre>
        </div>
      </div>
      
      {/* Work History Analysis Object Structure */}
      <div className="rounded-md border overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h4 className="font-medium">Work History Analysis Object Structure</h4>
          <p className="text-xs text-gray-500">Full data returned from the Red Flag Analysis API</p>
        </div>
        <div className="p-4">
          <pre className="overflow-auto text-xs max-h-80 p-3 rounded bg-black text-green-400">
            {JSON.stringify(redFlagData, null, 2) || "No work history data available"}
          </pre>
        </div>
      </div>
      
      {/* Data Structure Path Analysis */}
      <div className="rounded-md border overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h4 className="font-medium">Data Structure Path Analysis</h4>
          <p className="text-xs text-gray-500">Using debug utility functions to examine common access paths</p>
        </div>
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
      </div>
    </div>
  );
}