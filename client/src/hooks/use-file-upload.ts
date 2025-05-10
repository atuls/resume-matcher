import { useState, useCallback } from 'react';
import { FileWithPreview, UploadState } from '@/types';

interface UseFileUploadProps<T> {
  uploadFn: (file: File) => Promise<T>;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  accept?: string;
  maxSize?: number; // in bytes
}

interface UseFileUploadReturn<T> {
  uploadState: UploadState;
  files: FileWithPreview[];
  uploadedData: T | null;
  errorMessage: string | null;
  handleDrop: (acceptedFiles: File[]) => void;
  handleUpload: (file?: File) => Promise<T | null>;
  handleRemove: (index: number) => void;
  clearFiles: () => void;
  resetState: () => void;
}

export function useFileUpload<T>({
  uploadFn,
  onSuccess,
  onError,
  accept = 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
  maxSize = 10 * 1024 * 1024, // 10MB default
}: UseFileUploadProps<T>): UseFileUploadReturn<T> {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadedData, setUploadedData] = useState<T | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    // Check file type
    if (accept && accept.length > 0) {
      const acceptedTypes = accept.split(',');
      const fileType = file.type;
      
      if (!acceptedTypes.some(type => fileType === type || 
          // Handle special cases for documents
          (type === 'application/pdf' && fileType === 'application/pdf') ||
          (type === 'application/msword' && (fileType === 'application/msword' || file.name.endsWith('.doc'))) ||
          (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && 
           (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx'))) ||
          (type === 'text/plain' && (fileType === 'text/plain' || file.name.endsWith('.txt')))
      )) {
        setErrorMessage(`File type not accepted. Please upload: ${accept}`);
        return false;
      }
    }
    
    // Check file size
    if (maxSize && file.size > maxSize) {
      setErrorMessage(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      return false;
    }
    
    return true;
  }, [accept, maxSize]);

  const handleDrop = useCallback((acceptedFiles: File[]) => {
    setErrorMessage(null);
    
    const validFiles = acceptedFiles.filter(validateFile);
    
    if (validFiles.length === 0) {
      return;
    }
    
    const filesWithPreview = validFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    
    setFiles(prev => [...prev, ...filesWithPreview]);
  }, [validateFile]);

  const handleUpload = useCallback(async (file?: File): Promise<T | null> => {
    setUploadState('uploading');
    setErrorMessage(null);
    
    try {
      const fileToUpload = file || files[0];
      
      if (!fileToUpload) {
        throw new Error('No file selected');
      }
      
      if (!validateFile(fileToUpload)) {
        setUploadState('error');
        return null;
      }
      
      const data = await uploadFn(fileToUpload);
      setUploadedData(data);
      setUploadState('success');
      
      if (onSuccess) {
        onSuccess(data);
      }
      
      return data;
    } catch (error) {
      setUploadState('error');
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMessage(message);
      
      if (onError && error instanceof Error) {
        onError(error);
      }
      
      return null;
    }
  }, [files, uploadFn, validateFile, onSuccess, onError]);

  const handleRemove = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      const removedFile = newFiles[index];
      
      if (removedFile.preview) {
        URL.revokeObjectURL(removedFile.preview);
      }
      
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const clearFiles = useCallback(() => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    
    setFiles([]);
  }, [files]);

  const resetState = useCallback(() => {
    clearFiles();
    setUploadState('idle');
    setUploadedData(null);
    setErrorMessage(null);
  }, [clearFiles]);

  return {
    uploadState,
    files,
    uploadedData,
    errorMessage,
    handleDrop,
    handleUpload,
    handleRemove,
    clearFiles,
    resetState,
  };
}
