import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  getResume, 
  getResumeAnalysis, 
  getJobDescriptions, 
  getResumeScores, 
  updateResumeContactedStatus, 
  getResumeRedFlagAnalysis,
  downloadResume,
  analyzeResumes,
  getParsedAnalysisData
} from "@/lib/api";
import { 
  User, FileText, Calendar, ArrowLeft, Mail, MapPin, Phone, Award, 
  Briefcase, Code, AlertCircle, BarChart3, CheckCircle, XCircle,
  RefreshCw, UserCheck, Sparkles, AlertTriangle, Download, ExternalLink,
  Linkedin, FileText as FileIcon, FileSearch
} from "lucide-react";
import { DebugPanel } from "@/components/DebugPanel";
import { ResumeRedFlagsTab } from "@/components/ResumeRedFlagsTab";
import { ResumeSkillsTab } from "@/components/ResumeSkillsTab";
import { ResumeWorkHistoryTab } from "@/components/ResumeWorkHistoryTab";
import { ParsedDataViewer } from "@/components/ParsedDataViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import websocketService from "@/lib/websocket";

export default function ResumeProfilePage() {
  const [, params] = useRoute<{ id: string }>("/resume/:id");
  const resumeId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for loading states
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [redFlagLoading, setRedFlagLoading] = useState(false);
  const [isContactingCandidate, setIsContactingCandidate] = useState(false);
  const [isRunningJobAnalysis, setIsRunningJobAnalysis] = useState(false);
  
  // Get the job ID from URL query parameters if available
  const urlParams = new URLSearchParams(window.location.search);
  const jobIdFromUrl = urlParams.get('jobId');
  
  // State for selected job description for analysis
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobIdFromUrl);
  
  // Resume query
  const { data: resume, error: resumeError, isLoading: resumeLoading } = useQuery({
    queryKey: [`/api/resumes/${resumeId}`],
    queryFn: () => getResume(resumeId!),
    enabled: !!resumeId,
  });

  // Analysis query (legacy - kept for backward compatibility)
  const { 
    data: analysis, 
    error: analysisError, 
    isLoading: isAnalysisLoading 
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/analysis`],
    queryFn: () => getResumeAnalysis(resumeId!),
    enabled: !!resumeId,
  });
  
  // Red flag analysis query (legacy - kept for backward compatibility)
  const { 
    data: redFlagData, 
    error: redFlagError, 
    isLoading: isRedFlagLoading 
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/red-flag-analysis`],
    queryFn: () => getResumeRedFlagAnalysis(resumeId!),
    enabled: !!resumeId,
  });
  
  // New parsed analysis data query - uses the same data source as the candidates table
  const {
    data: parsedAnalysisData,
    error: parsedAnalysisError,
    isLoading: isParsedAnalysisLoading
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/parsed-analysis`, selectedJobId],
    queryFn: () => getParsedAnalysisData(resumeId!, selectedJobId || undefined),
    enabled: !!resumeId,
  });
  
  // Job descriptions query - needed for job analysis
  const { data: jobDescriptions } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions,
  });

  // Job scores query
  const { data: resumeScore } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/job-connections`],
    queryFn: () => getResumeScores(resumeId!),
    enabled: !!resumeId,
  });
  
  // State for WebSocket progress tracking
  const [analysisProgress, setAnalysisProgress] = useState({
    inProgress: false,
    message: '',
    progress: 0
  });
  
  // Setup WebSocket connection
  useEffect(() => {
    // Connect to WebSocket
    websocketService.connect();
    
    // WebSocket event listener
    const handleMessage = (event: any) => {
      console.log('Resume profile page received event:', event.type, event);
      
      // Handle progress events
      if (event.type === 'batchAnalysisProgress' && event.resumeId === resumeId) {
        setAnalysisProgress({
          inProgress: true,
          message: event.message || `Processing: ${event.current}/${event.total}`,
          progress: event.progress || 0
        });
      }
      
      // Handle completion events
      if (event.type === 'batchAnalysisComplete' && event.resumeId === resumeId) {
        setAnalysisProgress({
          inProgress: false,
          message: 'Analysis complete',
          progress: 100
        });
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/job-connections`] });
        queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/analysis`] });
      }
    };
    
    // Register event listener
    websocketService.addEventListener('all', handleMessage);
    
    // Cleanup function
    return () => {
      websocketService.removeEventListener('all', handleMessage);
    };
  }, [resumeId, queryClient]);

  // Function to handle contacting a candidate
  const handleContactCandidate = async () => {
    if (!resumeId) return;
    
    setIsContactingCandidate(true);
    
    try {
      await updateResumeContactedStatus(resumeId, true);
      
      toast({
        title: "Success",
        description: "Candidate has been marked as contacted.",
      });
      
      // Refresh the resume data
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}`] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark candidate as contacted",
        variant: "destructive",
      });
    } finally {
      setIsContactingCandidate(false);
    }
  };

  // Handle loading and error states
  if (resumeLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (resumeError) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load resume. Please try again later.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/candidates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to All Candidates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Resume not found
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/candidates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to All Candidates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Date formatting
  const formatDate = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // Run skills analysis function
  const runSkillsAnalysis = async () => {
    if (!resumeId) return;
    
    setAnalysisLoading(true);
    
    try {
      await apiRequest("POST", `/api/resumes/${resumeId}/analysis`);
      
      toast({
        title: "Analysis complete",
        description: "Skills have been analyzed and updated.",
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/analysis`] });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setAnalysisLoading(false);
    }
  };
  
  // Function to run analysis against a specific job description
  const runJobAnalysis = async () => {
    if (!resumeId || !selectedJobId) {
      toast({
        title: "Cannot run analysis",
        description: "Please select a job description first",
        variant: "destructive"
      });
      return;
    }
    
    setIsRunningJobAnalysis(true);
    
    try {
      // Pass force=true to ensure a fresh analysis is performed
      await analyzeResumes(selectedJobId, [resumeId], true);
      
      toast({
        title: "Analysis complete",
        description: "Resume has been re-analyzed against the selected job description.",
      });
      
      // Refresh the job connections data
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/job-connections`] });
    } catch (error) {
      console.error("Error running job analysis:", error);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunningJobAnalysis(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link href="/candidates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {resume.candidateName && resume.candidateName.startsWith("# ") 
              ? resume.candidateName.substring(2) 
              : (resume.candidateName || "Unnamed Candidate")}
          </h1>
          {resume.candidateTitle && (
            <Badge className="ml-2" variant="secondary">{resume.candidateTitle}</Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              const downloadUrl = `/api/resumes/${resumeId}/download`;
              window.open(downloadUrl, '_blank');
            }}
          >
            <FileSearch className="mr-2 h-4 w-4" />
            View Resume
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center"
            disabled={isContactingCandidate || resume.contactedInRippling}
            onClick={handleContactCandidate}
          >
            {resume.contactedInRippling ? (
              <>
                <UserCheck className="mr-2 h-4 w-4 text-green-500" />
                Contacted
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Mark as Contacted
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Resume details */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5 text-primary" />
                Resume Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="flex items-center">
                <Calendar className="mr-3 h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">Uploaded</div>
                  <div>{formatDate(resume.createdAt)}</div>
                </div>
              </div>
              
              <div className="flex items-start">
                <FileText className="mr-3 h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-500">File</div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`/api/resumes/${resumeId}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        const downloadUrl = `/api/resumes/${resumeId}/download`;
                        window.open(downloadUrl, '_blank');
                        
                        toast({
                          title: "Opening resume",
                          description: "Resume file opened in a new tab"
                        });
                      }}
                    >
                      {resume.fileName}
                    </a>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 px-2 text-xs"
                      onClick={async () => {
                        try {
                          toast({
                            title: "Downloading...",
                            description: "Preparing file for download"
                          });
                          
                          // Try direct download link first (more reliable approach)
                          const downloadUrl = `/api/resumes/${resumeId}/download`;
                          window.open(downloadUrl, '_blank');
                          
                          // Show success message
                          toast({
                            title: "Download started",
                            description: "Your file should begin downloading shortly."
                          });
                        } catch (error) {
                          // If direct download fails, try blob approach as backup
                          try {
                            console.log("Attempting alternative download method...");
                            
                            // Get file as blob
                            const blob = await downloadResume(resumeId!);
                            
                            // Create download link
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = resume.fileName || 'resume.pdf';
                            document.body.appendChild(a);
                            a.click();
                            
                            // Clean up
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            toast({
                              title: "Download complete",
                              description: "Your file has been downloaded successfully."
                            });
                          } catch (fallbackError) {
                            console.error("Both download methods failed:", fallbackError);
                            toast({
                              title: "Download failed",
                              description: "Unable to download the resume file. Please try again later.",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500">
                    {(resume.fileSize / 1024).toFixed(2)} KB - {resume.fileType}
                  </div>
                </div>
              </div>

              {/* LinkedIn Profile Link */}
              <div className="flex items-center">
                <Linkedin className="mr-3 h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-sm text-gray-500">LinkedIn</div>
                  <Button 
                    size="sm" 
                    variant="link" 
                    className="h-7 px-0 text-blue-600"
                    onClick={() => {
                      // Extract candidate name
                      const name = resume.candidateName || 'Unnamed Candidate';
                      // Create a LinkedIn search URL with the candidate name
                      const searchQuery = encodeURIComponent(name);
                      window.open(`https://www.linkedin.com/search/results/people/?keywords=${searchQuery}`, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Find on LinkedIn
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              {/* Job Analysis Section */}
              <div>
                <h3 className="font-medium mb-2">Job Analysis</h3>
                
                {/* Job Selection */}
                <div className="mb-3">
                  <select 
                    className="w-full p-2 border rounded-md text-sm mb-2"
                    value={selectedJobId || ""}
                    onChange={(e) => setSelectedJobId(e.target.value || null)}
                  >
                    <option value="">-- Select a job description --</option>
                    {jobDescriptions?.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                  
                  <Button 
                    onClick={runJobAnalysis} 
                    size="sm" 
                    variant="outline" 
                    disabled={!selectedJobId || isRunningJobAnalysis}
                    className="w-full"
                  >
                    {isRunningJobAnalysis || analysisProgress.inProgress ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        {analysisProgress.inProgress 
                          ? `${analysisProgress.progress}% - ${analysisProgress.message}`
                          : 'Analyzing...'}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Re-run Analysis
                      </>
                    )}
                  </Button>
                </div>
              
                {/* Matched Jobs List */}
                {resumeScore && Array.isArray(resumeScore) && resumeScore.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm text-gray-500 mb-1">Matched Jobs</h4>
                    {resumeScore.map((score: any) => {
                      // Extract score values safely
                      const scoreValue = score.score ? 
                        (typeof score.score === 'number' ? score.score : parseInt(score.score)) : 0;
                      
                      return (
                        <div key={score.jobDescriptionId} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex justify-between items-center">
                            <div className="font-medium">{score.jobDescription?.title || "Untitled Job"}</div>
                            <Badge className={scoreValue >= 70 ? "bg-green-500" : "bg-amber-500"}>
                              {scoreValue}%
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-500">
                            Matched {formatDistance(new Date(score.matchedAt), new Date(), { addSuffix: true })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )} 
                
                {(!resumeScore || !Array.isArray(resumeScore) || resumeScore.length === 0) && (
                  <div className="text-sm text-gray-500 italic">
                    No job matches yet. Select a job and run analysis to find matches.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right column - Analysis tabs */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-primary" />
                Resume Analysis
              </CardTitle>
              <CardDescription>
                AI-powered analysis of the candidate's resume
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="skills" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="skills">
                    <Code className="h-4 w-4 mr-2" />
                    Skills
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Work History
                  </TabsTrigger>
                  <TabsTrigger value="structured-data">
                    <FileIcon className="h-4 w-4 mr-2" />
                    Structured Data
                  </TabsTrigger>
                  <TabsTrigger value="raw-text">
                    <FileSearch className="h-4 w-4 mr-2" />
                    Raw Text
                  </TabsTrigger>
                  <TabsTrigger value="red-flags">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Red Flags
                  </TabsTrigger>
                  <TabsTrigger value="debug">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Debug
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="skills">
                  {isParsedAnalysisLoading ? (
                    <div className="flex justify-center items-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : parsedAnalysisData?.status === "success" && parsedAnalysisData.parsedData.skills.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <h3 className="text-lg font-medium">Skills</h3>
                        <span className="text-sm text-gray-500">{parsedAnalysisData.parsedData.skills.length} skills identified</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parsedAnalysisData.parsedData.skills.map((skill, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      <p>No skills data available for this resume</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4"
                        onClick={runSkillsAnalysis}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Run Skills Analysis
                      </Button>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="history">
                  {isParsedAnalysisLoading ? (
                    <div className="flex justify-center items-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : parsedAnalysisData?.status === "success" && parsedAnalysisData.parsedData.workHistory.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex justify-between">
                        <h3 className="text-lg font-medium">Work History</h3>
                        <span className="text-sm text-gray-500">{parsedAnalysisData.parsedData.workHistory.length} positions</span>
                      </div>
                      <div className="space-y-4">
                        {parsedAnalysisData.parsedData.workHistory.map((job, index) => (
                          <div key={index} className="border rounded-md p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{job.title || job.Title}</div>
                                <div className="text-gray-600">{job.company || job.Company}</div>
                              </div>
                              <div className="text-sm text-gray-500">
                                {job.startDate} - {job.endDate === "current" || job.endDate === "Present" ? "Present" : job.endDate}
                              </div>
                            </div>
                            {job.description && (
                              <div className="mt-2 text-sm text-gray-600">{job.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      <p>No work history data available for this resume</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="raw-text">
                  {resume?.extractedText ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Extracted Resume Text</h3>
                        <div className="flex items-center text-sm text-gray-500">
                          <FileText className="h-4 w-4 mr-1" />
                          <span>{(resume.extractedText.length / 1000).toFixed(1)}K characters</span>
                        </div>
                      </div>
                      <div className="border rounded-md p-4 bg-gray-50 overflow-auto max-h-[500px]">
                        <pre className="text-sm whitespace-pre-wrap font-mono">{resume.extractedText}</pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-gray-400">
                      <p>No extracted text found for this resume.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="structured-data">
                  {isParsedAnalysisLoading ? (
                    <div className="flex justify-center items-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : parsedAnalysisData?.status === "success" ? (
                    <ParsedDataViewer 
                      data={{
                        skills: parsedAnalysisData.parsedData.skills || [],
                        workHistory: parsedAnalysisData.parsedData.workHistory || [],
                        redFlags: parsedAnalysisData.parsedData.redFlags || [],
                        summary: parsedAnalysisData.parsedData.summary || '',
                        score: resumeScore && resumeScore.length > 0 && resumeScore[0].score ? 
                          Number(resumeScore[0].score) : undefined
                      }} 
                    />
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      <p>No structured data available for this resume</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4"
                        onClick={() => window.location.href = '/structured-data-parser'}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Go to Data Parser
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="red-flags">
                  {isParsedAnalysisLoading ? (
                    <div className="flex justify-center items-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : parsedAnalysisData?.status === "success" && parsedAnalysisData.parsedData.redFlags.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex justify-between">
                        <h3 className="text-lg font-medium">Potential Red Flags</h3>
                        <span className="text-sm text-gray-500">{parsedAnalysisData.parsedData.redFlags.length} items identified</span>
                      </div>
                      <ul className="space-y-2 list-disc pl-5">
                        {parsedAnalysisData.parsedData.redFlags.map((flag, index) => (
                          <li key={index} className="text-red-600">
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      <p>No red flags identified for this resume</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="debug">
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium">Data Sources:</h3>
                    </div>
                    {parsedAnalysisData && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Parsed Analysis Data:</h4>
                        <pre className="text-xs overflow-auto max-h-40 p-3 bg-gray-100 rounded-md">
                          {JSON.stringify(parsedAnalysisData, null, 2)}
                        </pre>
                      </div>
                    )}
                    {redFlagData && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Red Flag Data:</h4>
                        <pre className="text-xs overflow-auto max-h-40 p-3 bg-gray-100 rounded-md">
                          {JSON.stringify(redFlagData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="debug-raw">
                  <DebugPanel
                    resumeId={resumeId!}
                    analysis={analysis}
                    redFlagData={redFlagData}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}