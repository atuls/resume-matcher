import { useState, useCallback } from 'react';
import { FileWithPreview, UploadState } from '@/types';

interface UseFileUploadProps<T> {
  uploadFn: (file: File) => Promise<T>;
  uploadMultipleFn?: (files: File[]) => Promise<T[]>;
  onSuccess?: (data: T | T[]) => void;
  onError?: (error: Error) => void;
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean; // Allow selecting multiple files
}

interface UseFileUploadReturn<T> {
  uploadState: UploadState;
  files: FileWithPreview[];
  uploadedData: T | T[] | null;
  errorMessage: string | null;
  handleDrop: (acceptedFiles: File[]) => void;
  handleUpload: (file?: File) => Promise<T | T[] | null>;
  handleRemoveAll: () => void;
  handleRemove: (index: number) => void;
  clearFiles: () => void;
  resetState: () => void;
  uploadProgress: number; // 0-100 percent
}

export function useFileUpload<T>({
  uploadFn,
  uploadMultipleFn,
  onSuccess,
  onError,
  accept = 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = false, // Default to single file upload
}: UseFileUploadProps<T>): UseFileUploadReturn<T> {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadedData, setUploadedData] = useState<T | T[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

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

  const handleUpload = useCallback(async (file?: File): Promise<T | T[] | null> => {
    setUploadState('uploading');
    setErrorMessage(null);
    setUploadProgress(0);
    
    try {
      // If we're uploading a single file
      if (file || (!multiple && files.length > 0)) {
        const fileToUpload = file || files[0];
        
        if (!fileToUpload) {
          throw new Error('No file selected');
        }
        
        if (!validateFile(fileToUpload)) {
          setUploadState('error');
          return null;
        }
        
        // Single file upload
        setUploadProgress(30);
        const data = await uploadFn(fileToUpload);
        setUploadedData(data);
        setUploadState('success');
        setUploadProgress(100);
        
        if (onSuccess) {
          onSuccess(data);
        }
        
        return data;
      } 
      // Multiple files upload
      else if (multiple && files.length > 0) {
        // If we have a dedicated multiple upload function
        if (uploadMultipleFn) {
          // First validate all files
          for (let i = 0; i < files.length; i++) {
            if (!validateFile(files[i])) {
              setUploadState('error');
              return null;
            }
          }
          
          setUploadProgress(20);
          const data = await uploadMultipleFn(files);
          setUploadedData(data);
          setUploadState('success');
          setUploadProgress(100);
          
          if (onSuccess) {
            onSuccess(data);
          }
          
          return data;
        } 
        // Otherwise upload files sequentially
        else {
          const results: T[] = [];
          
          for (let i = 0; i < files.length; i++) {
            if (!validateFile(files[i])) {
              continue; // Skip invalid files
            }
            
            try {
              // Update progress for each file
              setUploadProgress(Math.round((i / files.length) * 100));
              const data = await uploadFn(files[i]);
              results.push(data);
            } catch (error) {
              console.error(`Error uploading ${files[i].name}:`, error);
              // Continue with other files
            }
          }
          
          if (results.length === 0) {
            throw new Error('Failed to upload any files');
          }
          
          setUploadedData(results);
          setUploadState('success');
          setUploadProgress(100);
          
          if (onSuccess) {
            onSuccess(results);
          }
          
          return results;
        }
      } else {
        throw new Error('No files selected');
      }
    } catch (error) {
      setUploadState('error');
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMessage(message);
      setUploadProgress(0);
      
      if (onError && error instanceof Error) {
        onError(error);
      }
      
      return null;
    }
  }, [files, uploadFn, uploadMultipleFn, validateFile, onSuccess, onError, multiple]);

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

  const handleRemoveAll = useCallback(() => {
    clearFiles();
  }, [clearFiles]);
  
  const resetState = useCallback(() => {
    clearFiles();
    setUploadState('idle');
    setUploadedData(null);
    setErrorMessage(null);
    setUploadProgress(0);
  }, [clearFiles]);

  return {
    uploadState,
    files,
    uploadedData,
    errorMessage,
    handleDrop,
    handleUpload,
    handleRemove,
    handleRemoveAll,
    clearFiles,
    resetState,
    uploadProgress,
  };
}
