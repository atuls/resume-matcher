import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, PenLine } from 'lucide-react';
import { JobDescription } from '@shared/schema';

interface JobDescriptionPreviewProps {
  jobDescription: JobDescription;
  onDelete?: () => void;
}

export default function JobDescriptionPreview({ jobDescription, onDelete }: JobDescriptionPreviewProps) {
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);

  // Function to determine the icon based on file type
  const getFileIcon = () => {
    const fileType = jobDescription.fileType;
    
    if (fileType?.includes('pdf')) {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    } else if (fileType?.includes('word') || fileType?.includes('doc')) {
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

  // Format the file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  // Format the date
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

  // Split the content into sections for display
  const getFormattedContent = () => {
    const lines = jobDescription.description.split('\n').filter(line => line.trim().length > 0);
    
    // Find potential headers and sections
    const sections = [];
    let currentSection = { title: '', content: [] };
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Check if this looks like a section header
      if (trimmedLine.length < 50 && 
          (trimmedLine.endsWith(':') || 
           trimmedLine.toUpperCase() === trimmedLine ||
           /^(requirements|qualifications|responsibilities|about|we offer|benefits):/i.test(trimmedLine))) {
        
        // Save previous section if it has content
        if (currentSection.content.length > 0) {
          sections.push({ ...currentSection });
        }
        
        // Start new section
        currentSection = { 
          title: trimmedLine.endsWith(':') ? trimmedLine.slice(0, -1) : trimmedLine, 
          content: [] 
        };
      } else {
        currentSection.content.push(trimmedLine);
      }
    });
    
    // Add the last section
    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  const formattedContent = getFormattedContent();

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <div className="bg-blue-100 text-primary p-1.5 rounded mr-2">
              {getFileIcon()}
            </div>
            <div>
              <h3 className="font-medium text-sm">{jobDescription.fileName || jobDescription.title}</h3>
              <p className="text-xs text-gray-500">
                {formatFileSize(jobDescription.fileSize)} • Uploaded {formatDate(jobDescription.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-primary" onClick={() => setIsFullViewOpen(true)}>
              <PenLine className="h-4 w-4" />
            </Button>
            {onDelete && (
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm h-48 overflow-y-auto custom-scrollbar">
          {formattedContent.length > 0 ? (
            <>
              <h4 className="font-semibold mb-1">{jobDescription.title}</h4>
              {jobDescription.company && (
                <p className="mb-2 text-xs text-gray-500">{jobDescription.company}</p>
              )}
              
              {formattedContent.map((section, index) => (
                <div key={index} className="mb-2">
                  {section.title && <p className="font-medium mt-3 mb-1">{section.title}:</p>}
                  {section.content.map((paragraph, pIndex) => (
                    <p key={pIndex} className="mb-1">{paragraph}</p>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <p>No content available</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isFullViewOpen} onOpenChange={setIsFullViewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{jobDescription.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {jobDescription.company && (
              <p className="text-sm text-gray-500">{jobDescription.company}</p>
            )}
            
            {formattedContent.map((section, index) => (
              <div key={index} className="space-y-2">
                {section.title && <h3 className="text-lg font-medium">{section.title}</h3>}
                {section.content.map((paragraph, pIndex) => (
                  <p key={pIndex} className="text-sm">{paragraph}</p>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
