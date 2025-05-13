import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import JobsPage from "@/pages/jobs";
import CandidatesPage from "@/pages/candidates";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings";
import ResumeProfilePage from "@/pages/resume-profile";
import AnalysisTestPage from "@/pages/analysis-test";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      
      {/* Job routes */}
      <Route path="/jobs" component={JobsPage} />
      <Route path="/jobs/:id" component={JobsPage} />
      <Route path="/jobs/:id/candidates" component={CandidatesPage} />
      <Route path="/jobs/:id/analytics" component={AnalyticsPage} />
      
      {/* Candidate routes */}
      <Route path="/candidates" component={CandidatesPage} />
      <Route path="/candidates/:jobId" component={CandidatesPage} />
      <Route path="/resume/:id" component={ResumeProfilePage} />
      
      {/* Other routes */}
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/analysis-test" component={AnalysisTestPage} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Router />
          </main>
          <Footer />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
