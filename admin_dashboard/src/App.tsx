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
import { ThemeToggle } from "@/components/theme-toggle"

import { RequisiteProvider } from '@/context/RequisiteContext';
import './App.css';

// Lazy load pages for better performance
const Login = React.lazy(() => import('@/pages/Login'));
const SignUp = React.lazy(() => import('@/pages/SignUp'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Jobs = React.lazy(() => import('@/pages/Jobs'));
const Workers = React.lazy(() => import('@/pages/Workers'));
const JobHistory = React.lazy(() => import('@/pages/JobHistory'));
const Checklists = React.lazy(() => import('@/pages/Checklist'));
const BOMHistory = React.lazy(() => import('@/pages/BOMHistory'));
const SiteRequisite = React.lazy(() => import('@/pages/SiteRequisite'));
const SiteRequisiteBucket = React.lazy(() => import('@/pages/SiteRequisiteBucket'));
const SiteRequisiteSubmit = React.lazy(() => import('@/pages/SiteRequisiteSubmit'));
const Attendance = React.lazy(() => import('@/pages/Attendance'));

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
    queryFn: () => authAPI.getCurrentUser(),
    retry: false,
    staleTime: 1000 * 60 * 5,   // keep successful responses fresh for 5 min
    refetchOnMount: 'always',    // always re-verify on navigation to a protected page
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
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:h-16 sm:px-4">
            <SidebarTrigger className="-ml-1 size-9 sm:size-7" />
            <Separator orientation="vertical" className="mr-2 hidden h-4 sm:block" />
            <div className="hidden min-w-0 flex-1 sm:block">
              <BreadcrumbNav />
            </div>
            <div className="ml-auto flex items-center">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-6">
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
              <Route path="jobs/:jobId/history" element={<JobHistory />} />
              <Route path="checklists" element={<Checklists />} />
              <Route path="bom" element={<BOMHistory />} />
              <Route path="site-requisite" element={
                <RequisiteProvider>
                  <Outlet />
                </RequisiteProvider>
              }>
                <Route index element={<SiteRequisite />} />
                <Route path="bucket" element={<SiteRequisiteBucket />} />
                <Route path="submit" element={<SiteRequisiteSubmit />} />
              </Route>
              <Route path="attendance" element={<Attendance />} />
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
