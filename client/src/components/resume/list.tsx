import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, Trash2, Search, Download, AlertCircle } from 'lucide-react';
import { getResumes, deleteResume, getResume } from '@/lib/api';
import { Resume } from '@shared/schema';

interface ResumeListProps {
  onSelect?: (resumeIds: string[]) => void;
  selectedResumeIds?: string[];
}

export default function ResumeList({ onSelect, selectedResumeIds = [] }: ResumeListProps) {
  const [selectedResumes, setSelectedResumes] = useState<string[]>(selectedResumeIds);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all resumes
  const { data: resumes, isLoading, error } = useQuery({
    queryKey: ['/api/resumes'],
    queryFn: getResumes
  });

  // Mutation for deleting a resume
  const deleteMutation = useMutation({
    mutationFn: deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
      toast({
        title: 'Resume deleted',
        description: 'The resume was successfully deleted.',
      });
      setDeleteConfirmOpen(false);
      setResumeToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Fetch a specific resume for preview
  const handlePreview = async (id: string) => {
    try {
      const resume = await getResume(id);
      setPreviewResume(resume);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load resume preview',
        variant: 'destructive',
      });
    }
  };

  // Toggle resume selection
  const toggleResumeSelection = (id: string) => {
    setSelectedResumes(prev => {
      const newSelection = prev.includes(id)
        ? prev.filter(resumeId => resumeId !== id)
        : [...prev, id];
      
      // Call the onSelect callback if provided
      if (onSelect) {
        onSelect(newSelection);
      }
      
      return newSelection;
    });
  };

  // Handle delete confirmation
  const handleDeleteClick = (id: string) => {
    setResumeToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Execute delete
  const confirmDelete = () => {
    if (resumeToDelete) {
      deleteMutation.mutate(resumeToDelete);
    }
  };

  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    } else {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  // Format date
  const formatDate = (dateString: Date) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} days ago`;
    
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 animate-pulse bg-white">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-200 h-10 w-10 rounded"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <p>Failed to load resumes. Please try again.</p>
        </div>
      </div>
    );
  }

  if (!resumes || resumes.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 text-center bg-gray-50">
        <Search className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-700">No resumes found</h3>
        <p className="text-gray-500 mt-1">Upload candidate resumes to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {resumes.map(resume => (
          <div 
            key={resume.id}
            className={`
              flex justify-between items-center border rounded-lg p-3 hover:shadow-sm transition-all
              ${selectedResumes.includes(resume.id) 
                ? 'border-primary bg-blue-50' 
                : 'border-gray-200 bg-white'}
            `}
            onClick={() => toggleResumeSelection(resume.id)}
          >
            <div className="flex items-center space-x-3">
              <div className="bg-blue-50 text-primary p-2 rounded">
                {getFileIcon(resume.fileType)}
              </div>
              <div>
                <h3 className="font-medium text-sm">
                  {resume.fileName}
                </h3>
                <p className="text-xs text-gray-500">
                  {formatFileSize(resume.fileSize)} • Uploaded {formatDate(resume.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-primary p-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(resume.id);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-destructive p-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(resume.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {selectedResumes.length > 0 && onSelect && (
        <div className="mt-4 flex justify-center">
          <Button 
            className="w-full"
            onClick={() => onSelect(selectedResumes)}
          >
            Analyze {selectedResumes.length} {selectedResumes.length === 1 ? 'Resume' : 'Resumes'}
          </Button>
        </div>
      )}

      {/* Resume Preview Dialog */}
      {previewResume && (
        <Dialog open={!!previewResume} onOpenChange={(open) => !open && setPreviewResume(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Resume Preview: {previewResume.fileName}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {previewResume.candidateName && (
                <h3 className="text-xl font-semibold mb-1">{previewResume.candidateName}</h3>
              )}
              {previewResume.candidateTitle && (
                <p className="text-gray-600 mb-4">{previewResume.candidateTitle}</p>
              )}
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {previewResume.extractedText}
                </pre>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" className="mr-2" onClick={() => setPreviewResume(null)}>
                Close
              </Button>
              <Button disabled>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this resume and any associated analysis results.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Resume'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
