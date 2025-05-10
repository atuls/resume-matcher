import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FileUp } from 'lucide-react';
import { uploadJobDescription } from '@/lib/api';
import { JobDescription } from '@shared/schema';

interface JobDescriptionUploaderProps {
  onSuccess?: (data: JobDescription) => void;
}

export default function JobDescriptionUploader({ onSuccess }: JobDescriptionUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: uploadJobDescription,
    onSuccess: (data) => {
      toast({
        title: 'Job description uploaded',
        description: 'The job description was successfully uploaded.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/job-descriptions'] });
      if (onSuccess) onSuccess(data);
      setFile(null);
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
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
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
    multiple: false,
  });

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Job Description</h2>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div 
        {...getRootProps()}
        className={`upload-zone rounded-lg p-8 mb-4 text-center cursor-pointer 
          border-2 border-dashed 
          ${isDragActive ? 'border-primary bg-blue-50' : 'border-gray-200 hover:border-primary hover:bg-blue-50/30'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <div className="bg-blue-50 text-primary p-3 rounded-full mb-3">
            <FileUp className="h-6 w-6" />
          </div>
          <p className="font-medium mb-1">Upload Job Description</p>
          <p className="text-sm text-gray-500 mb-3">Drag & drop or click to upload PDF or text file</p>
          <Button 
            type="button" 
            variant="outline" 
            className="text-primary border-primary hover:bg-blue-50"
          >
            Browse Files
          </Button>
        </div>
      </div>
      
      {file && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 mb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <div className="bg-blue-100 text-primary p-1.5 rounded mr-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-sm">{file.name}</h3>
                <p className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB • Selected</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-danger" onClick={() => setFile(null)}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      )}

      {file && (
        <Button 
          className="w-full"
          disabled={uploadMutation.isPending}
          onClick={handleUpload}
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload Job Description'}
        </Button>
      )}
    </div>
  );
}
