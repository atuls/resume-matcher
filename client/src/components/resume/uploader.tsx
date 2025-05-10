import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Plus } from 'lucide-react';
import { uploadResume } from '@/lib/api';
import { Resume } from '@shared/schema';

interface ResumeUploaderProps {
  onSuccess?: (data: Resume) => void;
  buttonText?: string;
}

export default function ResumeUploader({ onSuccess, buttonText = 'Add Resumes' }: ResumeUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: uploadResume,
    onSuccess: (data) => {
      toast({
        title: 'Resume uploaded',
        description: 'The resume was successfully uploaded.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
      if (onSuccess) onSuccess(data);
      setFiles([]);
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
  });

  const handleUpload = (file: File) => {
    uploadMutation.mutate(file);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Candidate Resumes</h2>
        <Button 
          variant="ghost" 
          className="text-primary hover:text-blue-700 text-sm font-medium"
          onClick={() => document.getElementById('resume-file-input')?.click()}
        >
          <Plus className="mr-1.5 h-4 w-4" /> {buttonText}
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div 
        {...getRootProps()}
        className={`upload-zone rounded-lg p-6 mb-4 text-center cursor-pointer 
          border-2 border-dashed 
          ${isDragActive ? 'border-primary bg-blue-50' : 'border-gray-200 hover:border-primary hover:bg-blue-50/30'}`}
      >
        <input {...getInputProps()} id="resume-file-input" />
        <div className="flex flex-col items-center">
          <div className="bg-blue-50 text-primary p-2.5 rounded-full mb-2">
            <FileUp className="h-5 w-5" />
          </div>
          <p className="font-medium text-sm mb-1">Upload Candidate Resumes</p>
          <p className="text-xs text-gray-500 mb-2">Drag & drop or click to upload multiple files</p>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            className="text-primary border-primary hover:bg-blue-50"
          >
            Select Files
          </Button>
        </div>
      </div>
      
      {files.length > 0 && (
        <div className="space-y-3 mb-4">
          {files.map((file, index) => (
            <div key={index} className="flex justify-between items-center border border-gray-200 rounded-lg p-3 hover:shadow-sm bg-white">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-50 text-primary p-2 rounded">
                  {file.type.includes('pdf') ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : file.type.includes('word') || file.type.includes('document') ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-sm">{file.name}</h3>
                  <p className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB • Selected</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-primary p-1.5"
                  onClick={() => handleUpload(file)}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-destructive p-1.5"
                  onClick={() => handleRemoveFile(index)}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <Button 
          className="w-full"
          disabled={uploadMutation.isPending}
          onClick={() => {
            // Upload the first file in the list
            if (files.length > 0) {
              handleUpload(files[0]);
            }
          }}
        >
          {uploadMutation.isPending ? 'Uploading...' : `Upload ${files.length > 1 ? 'Resumes' : 'Resume'}`}
        </Button>
      )}
    </div>
  );
}
