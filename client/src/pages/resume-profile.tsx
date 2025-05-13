import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getResume, getResumeAnalysis, getJobDescriptions, getResumeScores, updateResumeContactedStatus, getResumeRedFlagAnalysis } from "@/lib/api";
import { 
  User, FileText, Calendar, ArrowLeft, Mail, MapPin, Phone, Award, 
  Briefcase, Code, AlertCircle, BarChart3, CheckCircle, XCircle,
  RefreshCw, UserCheck, Sparkles, AlertTriangle
} from "lucide-react";
import { DebugPanel } from "@/components/DebugPanel";
import { ResumeSkillsTab } from "@/components/ResumeSkillsTab";
import { ResumeWorkHistoryTab } from "@/components/ResumeWorkHistoryTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ResumeProfilePage() {
  const [, params] = useRoute<{ id: string }>("/resume/:id");
  const resumeId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for loading states
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [redFlagLoading, setRedFlagLoading] = useState(false);
  const [isContactingCandidate, setIsContactingCandidate] = useState(false);
  
  // Resume query
  const { data: resume, error: resumeError, isLoading: resumeLoading } = useQuery({
    queryKey: [`/api/resumes/${resumeId}`],
    queryFn: () => getResume(resumeId!),
    enabled: !!resumeId,
  });

  // Analysis query
  const { 
    data: analysis, 
    error: analysisError, 
    isLoading: isAnalysisLoading 
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/analysis`],
    queryFn: () => getResumeAnalysis(resumeId!),
    enabled: !!resumeId,
  });
  
  // Red flag analysis query
  const { 
    data: redFlagData, 
    error: redFlagError, 
    isLoading: isRedFlagLoading 
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/red-flag-analysis`],
    queryFn: () => getResumeRedFlagAnalysis(resumeId!),
    enabled: !!resumeId,
  });
  
  // Job scores query
  const { data: resumeScore } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/job-connections`],
    queryFn: () => getResumeScores(resumeId!),
    enabled: !!resumeId,
  });

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
      await apiRequest(`/api/resumes/${resumeId}/analysis`, { method: "POST" });
      
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
            {resume.candidateName || "Unnamed Candidate"}
          </h1>
          {resume.candidateTitle && (
            <Badge className="ml-2" variant="secondary">{resume.candidateTitle}</Badge>
          )}
        </div>
        
        <div className="flex gap-2">
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
              {resume.candidateName && (
                <div className="flex items-start">
                  <User className="mr-3 h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <div className="font-medium">{resume.candidateName}</div>
                    {resume.candidateTitle && (
                      <div className="text-sm text-gray-500">{resume.candidateTitle}</div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center">
                <Calendar className="mr-3 h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">Uploaded</div>
                  <div>{formatDate(resume.createdAt)}</div>
                </div>
              </div>
              
              <div className="flex items-center">
                <FileText className="mr-3 h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">File</div>
                  <div>{resume.fileName}</div>
                  <div className="text-sm text-gray-500">
                    {(resume.fileSize / 1024).toFixed(2)} KB - {resume.fileType}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {resumeScore && Object.keys(resumeScore).length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Matched Jobs</h3>
                  <div className="space-y-2">
                    {Object.entries(resumeScore).map(([jobId, scoreData]) => (
                      <div key={jobId} className="p-3 bg-gray-50 rounded-md">
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{"Job Match"}</div>
                          <Badge className={typeof scoreData.score === 'number' && scoreData.score >= 70 ? "bg-green-500" : "bg-amber-500"}>
                            {typeof scoreData.score === 'number' ? scoreData.score : 0}%
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          Matched {formatDistance(new Date(scoreData.matchedAt), new Date(), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  <TabsTrigger value="skills">Skills</TabsTrigger>
                  <TabsTrigger value="history">Work History</TabsTrigger>
                  <TabsTrigger value="debug">Debug Info</TabsTrigger>
                </TabsList>
                
                <TabsContent value="skills">
                  <ResumeSkillsTab
                    analysis={analysis}
                    analysisLoading={analysisLoading || isAnalysisLoading}
                    analysisError={analysisError}
                    resumeId={resumeId!}
                    runSkillsAnalysis={runSkillsAnalysis}
                    setAnalysisLoading={setAnalysisLoading}
                  />
                </TabsContent>
                
                <TabsContent value="history">
                  <ResumeWorkHistoryTab
                    redFlagData={redFlagData}
                    redFlagLoading={redFlagLoading}
                    isRedFlagLoading={isRedFlagLoading}
                    redFlagError={redFlagError}
                  />
                </TabsContent>
                
                <TabsContent value="debug">
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