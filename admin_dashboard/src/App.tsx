import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/sonner"
import { authAPI } from "@/api/services"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { BreadcrumbNav } from "@/components/BreadcrumbNav"
import { Loader2 } from "lucide-react"

import './App.css';

// Lazy load pages for better performance
const Login = React.lazy(() => import('@/pages/Login'));
const SignUp = React.lazy(() => import('@/pages/SignUp'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Jobs = React.lazy(() => import('@/pages/Jobs'));
const Workers = React.lazy(() => import('@/pages/Workers'));
const Analytics = React.lazy(() => import('@/pages/Analytics'));
const ProjectAnalytics = React.lazy(() => import('@/pages/ProjectAnalytics'));
const JobHistory = React.lazy(() => import('@/pages/JobHistory'));
const Checklists = React.lazy(() => import('@/pages/Checklist'));
const BOMHistory = React.lazy(() => import('@/pages/BOMHistory'));

// Loading Fallback
const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(), // Use existing getCurrentUser
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const DashboardLayout = () => {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <BreadcrumbNav />
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4">
            <Suspense fallback={<div className="flex items-center justify-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
              <Outlet />
            </Suspense>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
};

function App() {
  return (
    <>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/register" element={<SignUp />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="workers" element={<Workers />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="project-analytics" element={<ProjectAnalytics />} />
              <Route path="advanced-analytics" element={<ProjectAnalytics />} />
              <Route path="jobs/:jobId/history" element={<JobHistory />} />
              <Route path="checklists" element={<Checklists />} />
              <Route path="bom" element={<BOMHistory />} />
              <Route path="admin" element={<Navigate to="/dashboard/workers" replace />} />
            </Route>

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Router>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          className: 'toast group',
        }}
      />
    </>
  );
}

export default App;