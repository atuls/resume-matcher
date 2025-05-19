import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default function Header() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-3">
          <div className="flex items-center space-x-2">
            <div className="bg-primary text-white rounded-md p-1.5">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold text-gray-900 cursor-pointer" onClick={() => window.location.href = '/'}>
              ResumAI
            </span>
          </div>
          
          <div className="flex items-center space-x-6">
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/">
                <span className={`cursor-pointer ${isActive('/') ? 'text-primary font-medium' : 'text-gray-700 hover:text-primary'}`}>
                  Dashboard
                </span>
              </Link>
              <Link href="/jobs">
                <span className={`cursor-pointer ${isActive('/jobs') ? 'text-primary font-medium' : 'text-gray-500 hover:text-primary'}`}>
                  Jobs
                </span>
              </Link>
              <Link href="/candidates">
                <span className={`cursor-pointer ${isActive('/candidates') ? 'text-primary font-medium' : 'text-gray-500 hover:text-primary'}`}>
                  Candidates
                </span>
              </Link>
              <Link href="/analytics">
                <span className={`cursor-pointer ${isActive('/analytics') ? 'text-primary font-medium' : 'text-gray-500 hover:text-primary'}`}>
                  Analytics
                </span>
              </Link>
              <Link href="/settings">
                <span className={`cursor-pointer ${isActive('/settings') ? 'text-primary font-medium' : 'text-gray-500 hover:text-primary'}`}>
                  Settings
                </span>
              </Link>
              <Link href="/structured-data-parser">
                <span className={`cursor-pointer ${isActive('/structured-data-parser') ? 'text-primary font-medium' : 'text-gray-500 hover:text-primary'}`}>
                  Data Parser
                </span>
              </Link>
            </nav>
            
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" className="text-gray-500 hover:text-primary">
                <span className="sr-only">Notifications</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </Button>
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-sm font-medium">JD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
