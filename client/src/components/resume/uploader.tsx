import { useState } from "react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { uploadResume, uploadMultipleResumes } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Upload, X, AlertCircle, Check, Loader2, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { Resume } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ResumeUploaderProps {
  onSuccess?: (data: Resume | Resume[]) => void;
  buttonText?: string;
  multipleDefault?: boolean;
}

export default function ResumeUploader({ 
  onSuccess, 
  buttonText = "Upload Resume", 
  multipleDefault = false 
}: ResumeUploaderProps) {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(multipleDefault);
  
  const {
    uploadState,
    files,
    handleDrop,
    handleUpload,
    handleRemove,
    handleRemoveAll,
    errorMessage,
    uploadProgress,
  } = useFileUpload<Resume>({
    uploadFn: uploadResume,
    uploadMultipleFn: uploadMultipleResumes,
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        toast({
          title: `${data.length} resumes uploaded`,
          description: "The candidate resumes have been successfully uploaded.",
        });
      } else {
        toast({
          title: "Resume uploaded",
          description: "The candidate resume has been successfully uploaded.",
        });
      }
      if (onSuccess) onSuccess(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    maxSize: 10 * 1024 * 1024, // 10 MB
    multiple: allowMultiple,
  });

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDragDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDrop(Array.from(e.dataTransfer.files));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Error message */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {/* Multiple files toggle */}
      <div className="flex items-center space-x-2">
        <Switch 
          id="allow-multiple" 
          checked={allowMultiple}
          onCheckedChange={(checked) => setAllowMultiple(checked)}
        />
        <Label htmlFor="allow-multiple">Allow multiple resume uploads</Label>
      </div>
      
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          dragActive ? "border-primary bg-primary/5" : "border-gray-300"
        } transition-colors duration-200 cursor-pointer`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDragDrop}
        onClick={() => document.getElementById("resume-upload")?.click()}
      >
        <input
          id="resume-upload"
          type="file"
          className="hidden"
          multiple={allowMultiple}
          accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
          onChange={(e) => e.target.files && handleDrop(Array.from(e.target.files))}
        />
        
        <div className="space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">Drag and drop or click to upload</p>
            <p className="text-gray-500">
              Supports PDF, DOCX, DOC (Max 10MB{allowMultiple ? ' per file' : ''})
            </p>
            {allowMultiple && (
              <p className="text-xs text-blue-600 mt-1">Multiple file upload enabled</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Upload progress */}
      {uploadState === 'uploading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}
      
      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">
              {allowMultiple ? `Selected files (${files.length})` : 'Selected file'}
            </h3>
            {allowMultiple && files.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveAll}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash className="h-4 w-4 mr-1" />
                Remove All
              </Button>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {files.map((file, index) => (
              <Card key={index} className="p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-100 p-2 rounded">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Upload button */}
      {files.length > 0 && (
        <Button 
          onClick={() => handleUpload()} 
          disabled={uploadState === 'uploading'}
          className="w-full"
        >
          {uploadState === 'uploading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading {allowMultiple && files.length > 1 ? `${files.length} files` : 'file'}...
            </>
          ) : uploadState === 'success' ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              {buttonText} {allowMultiple && files.length > 1 ? `(${files.length} files)` : ''}
            </>
          ) : (
            <>
              {buttonText} {allowMultiple && files.length > 1 ? `(${files.length} files)` : ''}
            </>
          )}
        </Button>
      )}
    </div>
  );
}