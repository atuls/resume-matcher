import { useState } from "react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { uploadResume } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Upload, X, AlertCircle, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Resume } from "@shared/schema";

interface ResumeUploaderProps {
  onSuccess?: (data: Resume) => void;
  buttonText?: string;
}

export default function ResumeUploader({ onSuccess, buttonText = "Upload Resume" }: ResumeUploaderProps) {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  
  const {
    uploadState,
    files,
    handleDrop,
    handleUpload,
    handleRemove,
    errorMessage,
  } = useFileUpload<Resume>({
    uploadFn: uploadResume,
    onSuccess: (data) => {
      toast({
        title: "Resume uploaded",
        description: "The candidate resume has been successfully uploaded.",
      });
      if (onSuccess) onSuccess(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    accept: ".pdf,.docx,.doc",
    maxSize: 10 * 1024 * 1024, // 10 MB
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
          accept=".pdf,.docx,.doc"
          onChange={(e) => e.target.files && handleDrop(Array.from(e.target.files))}
        />
        
        <div className="space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">Drag and drop or click to upload</p>
            <p className="text-gray-500">
              Supports PDF, DOCX, DOC (Max 10MB)
            </p>
          </div>
        </div>
      </div>
      
      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Selected file</h3>
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
              Uploading...
            </>
          ) : uploadState === 'success' ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              {buttonText}
            </>
          ) : (
            buttonText
          )}
        </Button>
      )}
    </div>
  );
}