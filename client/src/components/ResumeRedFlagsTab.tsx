import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ResumeRedFlagsTabProps {
  redFlags: string[] | null;
  isLoading: boolean;
  dataSource: string;
}

export function ResumeRedFlagsTab({ redFlags, isLoading, dataSource }: ResumeRedFlagsTabProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    );
  }

  if (!redFlags || redFlags.length === 0) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <AlertCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          No red flags were identified for this candidate.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-gray-700">Identified Potential Issues</h3>
        <Badge variant="outline" className="text-xs font-normal">
          Data source: {dataSource}
        </Badge>
      </div>
      
      <Alert variant="destructive" className="bg-red-50 border-red-200">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800 font-medium">
          The following potential issues were identified:
        </AlertDescription>
      </Alert>
      
      <ul className="space-y-3 mt-3">
        {redFlags.map((flag, i) => (
          <li key={i} className="flex gap-2 bg-gray-50 p-3 rounded-md border text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{flag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}