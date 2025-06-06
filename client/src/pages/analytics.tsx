import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getJobDescriptions, getAnalysisResults, getJobDescription } from "@/lib/api";
import { useState, useEffect } from "react";
import { EnrichedAnalysisResult, SkillMatch } from "@/types";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Sample colors for charts
const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  // Check if we're on a job-specific route
  const [jobMatch, jobParams] = useRoute("/jobs/:id/analytics");
  const routeJobId = jobMatch ? jobParams.id : null;
  
  // Selected job for analytics (from route or manual selection)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(routeJobId);
  
  // Fetch job descriptions
  const { data: jobDescriptions } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });

  // Fetch the specific job details if we're on a job route
  const { data: jobDetail } = useQuery({
    queryKey: [`/api/job-descriptions/${routeJobId}`],
    queryFn: () => getJobDescription(routeJobId!),
    enabled: !!routeJobId,
  });

  // Set first job as selected by default if not on a specific job route
  useEffect(() => {
    if (jobDescriptions && jobDescriptions.length > 0 && !selectedJobId) {
      setSelectedJobId(jobDescriptions[0].id);
    }
  }, [jobDescriptions, selectedJobId]);
  
  // Update selected job when route changes
  useEffect(() => {
    if (routeJobId) {
      setSelectedJobId(routeJobId);
    }
  }, [routeJobId]);

  // Fetch analysis results for selected job
  const { data: analysisResults, isLoading: isLoadingResults } = useQuery<EnrichedAnalysisResult[]>({
    queryKey: [`/api/job-descriptions/${selectedJobId}/results`],
    queryFn: () => selectedJobId ? getAnalysisResults(selectedJobId) : Promise.resolve([]),
    enabled: !!selectedJobId
  });

  // Prepare data for score distribution chart
  const scoreData = [
    { name: '0-20', count: 0 },
    { name: '21-40', count: 0 },
    { name: '41-60', count: 0 },
    { name: '61-80', count: 0 },
    { name: '81-100', count: 0 },
  ];

  // Calculate score distribution
  if (analysisResults) {
    analysisResults.forEach(result => {
      const score = result.overallScore;
      if (score <= 20) scoreData[0].count++;
      else if (score <= 40) scoreData[1].count++;
      else if (score <= 60) scoreData[2].count++;
      else if (score <= 80) scoreData[3].count++;
      else scoreData[4].count++;
    });
  }

  // Prepare skill match data
  const skillMatchData: {name: string, value: number}[] = [];
  
  if (analysisResults) {
    // Count top skills with 'full' matches
    const skillCounts: Record<string, number> = {};
    
    analysisResults.forEach(result => {
      // Safely access skillMatches if it exists
      const skillMatches = result.skillMatches as SkillMatch[] || [];
      if (Array.isArray(skillMatches)) {
        skillMatches.forEach((match: SkillMatch) => {
          if (match.match === 'full') {
            if (!skillCounts[match.requirement]) {
              skillCounts[match.requirement] = 0;
            }
            skillCounts[match.requirement]++;
          }
        });
      }
    });
    
    // Convert to chart data format
    Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .forEach(([skill, count]) => {
        skillMatchData.push({
          name: skill.length > 20 ? skill.substring(0, 17) + '...' : skill,
          value: count
        });
      });
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        {jobMatch && jobDetail ? (
          <div className="flex items-center">
            <Link href={`/jobs/${routeJobId}`}>
              <Button variant="ghost" size="sm" className="mr-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Job
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Analytics: {jobDetail.title}</h1>
              <p className="text-gray-500">{jobDetail.company}</p>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-bold">Analytics</h1>
        )}
        
        <Select 
          value={selectedJobId || ''} 
          onValueChange={setSelectedJobId}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select a job" />
          </SelectTrigger>
          <SelectContent>
            {jobDescriptions?.map(job => (
              <SelectItem key={job.id} value={job.id}>
                {job.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Total Candidates</CardTitle>
                <CardDescription>Number of analyzed resumes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analysisResults?.length || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Average Score</CardTitle>
                <CardDescription>Mean match score across all candidates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analysisResults && analysisResults.length > 0 
                    ? Math.round(analysisResults.reduce((sum, result) => sum + result.overallScore, 0) / analysisResults.length) 
                    : 0}%
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Top Candidates</CardTitle>
                <CardDescription>Candidates with 80%+ match</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analysisResults?.filter(result => result.overallScore >= 80).length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
              <CardDescription>Number of candidates by score range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={scoreData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Candidates" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Matching Skills</CardTitle>
              <CardDescription>Most common skills found in candidates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={skillMatchData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {skillMatchData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Skill Frequency</CardTitle>
              <CardDescription>Number of candidates with each skill</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={skillMatchData}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" />
                    <Tooltip />
                    <Bar dataKey="value" name="Candidates" fill="#059669" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}