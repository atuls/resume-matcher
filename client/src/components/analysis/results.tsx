import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Eye, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getAnalysisResults, getResume } from '@/lib/api';
import { AnalysisStatus, EnrichedAnalysisResult, SkillMatch } from '@/types';
import { Resume } from '@shared/schema';

interface AnalysisResultsProps {
  jobDescriptionId: string;
  analysisStatus: AnalysisStatus;
}

export default function AnalysisResults({ jobDescriptionId, analysisStatus }: AnalysisResultsProps) {
  const [sortBy, setSortBy] = useState<string>('match');
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<EnrichedAnalysisResult | null>(null);
  
  // Fetch analysis results
  const { 
    data: results,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: [`/api/job-descriptions/${jobDescriptionId}/results`],
    queryFn: () => getAnalysisResults(jobDescriptionId),
    enabled: !!jobDescriptionId && analysisStatus.status !== 'loading',
    refetchInterval: analysisStatus.status === 'loading' ? 2000 : false
  });

  // Handle sorting results
  const sortedResults = results ? [...results].sort((a, b) => {
    if (sortBy === 'match') {
      return b.overallScore - a.overallScore;
    } else if (sortBy === 'name') {
      const nameA = a.resume.candidateName || '';
      const nameB = b.resume.candidateName || '';
      return nameA.localeCompare(nameB);
    } else if (sortBy === 'date') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  }) : [];

  // Handle viewing resume details
  const handleViewResume = async (resumeId: string) => {
    try {
      const resume = await getResume(resumeId);
      setSelectedResume(resume);
    } catch (error) {
      console.error('Failed to load resume:', error);
    }
  };

  // Handle viewing analysis details
  const handleViewAnalysis = (analysis: EnrichedAnalysisResult) => {
    setSelectedAnalysis(analysis);
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

  // Get appropriate badge styling for match type
  const getMatchBadgeClass = (match: 'full' | 'partial' | 'none') => {
    switch(match) {
      case 'full':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'none':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get appropriate icon for match type
  const getMatchIcon = (match: 'full' | 'partial' | 'none') => {
    switch(match) {
      case 'full':
        return <CheckCircle className="h-3.5 w-3.5 mr-1" />;
      case 'partial':
        return <AlertCircle className="h-3.5 w-3.5 mr-1" />;
      case 'none':
        return <XCircle className="h-3.5 w-3.5 mr-1" />;
      default:
        return null;
    }
  };

  // Get background color based on score
  const getScoreBackgroundColor = (score: number) => {
    if (score >= 80) return 'bg-secondary';
    if (score >= 70) return 'bg-blue-500';
    return 'bg-yellow-500';
  };

  // Render loading state
  if (isLoading || analysisStatus.status === 'loading') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">Analysis Results</h2>
        </div>
        <div className="flex flex-col items-center justify-center p-10">
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Processing resumes...</h3>
          <p className="text-gray-500 mt-2">
            {analysisStatus.message || 'This might take a few moments as our AI analyzes each resume.'}
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (isError) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">Analysis Results</h2>
        </div>
        <Card className="bg-red-50">
          <CardContent className="flex flex-col items-center justify-center p-10">
            <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Failed to load results</h3>
            <p className="text-gray-500 mt-2">
              There was an error loading the analysis results. Please try again.
            </p>
            <Button className="mt-4" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render no results state
  if (!results || results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">Analysis Results</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-10">
            <svg className="h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">No Analysis Results Yet</h3>
            <p className="text-gray-500 mt-2 text-center">
              Select resumes from the left panel and click "Analyze Resumes" to start comparing candidates.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-semibold">Analysis Results</h2>
        <div className="flex space-x-2">
          <Button variant="outline" className="text-gray-700">
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by Match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match">Sort by Match</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="date">Sort by Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-4">
        {sortedResults.map((result) => {
          const skillMatches = result.skillMatches as unknown as SkillMatch[];
          return (
            <div key={result.id} className="border border-gray-200 rounded-lg hover:shadow-sm transition-all">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start">
                    <div className="rounded-full bg-blue-100 text-primary h-10 w-10 flex items-center justify-center font-medium mr-3">
                      {result.resume.candidateName ? result.resume.candidateName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??'}
                    </div>
                    <div>
                      <h3 className="font-semibold">{result.resume.candidateName || 'Unnamed Candidate'}</h3>
                      <p className="text-sm text-gray-600">{result.resume.candidateTitle || 'Position not specified'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-1 mb-1">
                      <span className="font-bold text-lg">{result.overallScore}</span>
                      <span className="text-sm text-gray-500">/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className={`${getScoreBackgroundColor(result.overallScore)} h-1.5 rounded-full`} style={{ width: `${result.overallScore}%` }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {skillMatches?.slice(0, 4).map((skill, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline"
                        className={`inline-flex items-center ${getMatchBadgeClass(skill.match)} text-xs px-2 py-0.5 rounded`}
                      >
                        {getMatchIcon(skill.match)}
                        {skill.requirement.length > 30 
                          ? `${skill.requirement.substring(0, 30)}...` 
                          : skill.requirement}
                      </Badge>
                    ))}
                    {skillMatches && skillMatches.length > 4 && (
                      <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                        +{skillMatches.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="border-t border-gray-200 p-3 bg-gray-50 rounded-b-lg flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {result.resume.fileType.includes('pdf') ? (
                    <svg className="inline-block h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="inline-block h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )} {result.resume.fileName}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-700 hover:text-primary text-sm"
                    onClick={() => handleViewResume(result.resume.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-700 hover:text-primary text-sm"
                    onClick={() => handleViewAnalysis(result)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" /> Details
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resume Preview Dialog */}
      {selectedResume && (
        <Dialog open={!!selectedResume} onOpenChange={(open) => !open && setSelectedResume(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Resume Preview: {selectedResume.fileName}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {selectedResume.candidateName && (
                <h3 className="text-xl font-semibold mb-1">{selectedResume.candidateName}</h3>
              )}
              {selectedResume.candidateTitle && (
                <p className="text-gray-600 mb-4">{selectedResume.candidateTitle}</p>
              )}
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {selectedResume.extractedText}
                </pre>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" className="mr-2" onClick={() => setSelectedResume(null)}>
                Close
              </Button>
              <Button disabled>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Analysis Details Dialog */}
      {selectedAnalysis && (
        <Dialog open={!!selectedAnalysis} onOpenChange={(open) => !open && setSelectedAnalysis(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                Analysis Details: {selectedAnalysis.resume.candidateName || 'Unnamed Candidate'}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedAnalysis.resume.candidateName || 'Unnamed Candidate'}</h3>
                  <p className="text-gray-600">{selectedAnalysis.resume.candidateTitle || 'Position not specified'}</p>
                </div>
                <div className="flex items-center bg-gray-100 px-3 py-1 rounded-full">
                  <span className="font-bold text-2xl mr-1">{selectedAnalysis.overallScore}</span>
                  <span className="text-gray-500">/100</span>
                </div>
              </div>

              <h4 className="font-medium text-gray-900 mb-2">Skill Matches</h4>
              <div className="border rounded-lg divide-y">
                {(selectedAnalysis.skillMatches as unknown as SkillMatch[])?.map((skill, idx) => (
                  <div key={idx} className="p-3">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{skill.requirement}</span>
                      <Badge 
                        variant="outline"
                        className={`${getMatchBadgeClass(skill.match)}`}
                      >
                        {skill.match.charAt(0).toUpperCase() + skill.match.slice(1)} Match
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <p><span className="font-medium">Confidence:</span> {Math.round(skill.confidence * 100)}%</p>
                      {skill.evidence && (
                        <p className="mt-1">
                          <span className="font-medium">Evidence:</span> {skill.evidence}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setSelectedAnalysis(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
