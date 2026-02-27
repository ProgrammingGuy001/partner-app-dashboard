import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useJobs } from '@/hooks/useJobs';
import { adminAPI, type Job } from '@/api/services';
import { Briefcase, ArrowRight, Shield, TrendingUp, Users, CheckCircle2, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";

const Dashboard: React.FC = () => {
  const { data: jobsData, isLoading: jobsLoading } = useJobs();

  const { data: ipsData, isLoading: ipsLoading } = useQuery({
    queryKey: ['ips', 'dashboard'],
    queryFn: () => adminAPI.getIPUsers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const stats = useMemo(() => {
    const jobs = (jobsData as Job[]) || [];
    const ips = ipsData || [];

    const activeCount = jobs.filter((job) =>
      job.status === 'in_progress' || job.status === 'created'
    ).length;

    const completedCount = jobs.filter((job) =>
      job.status === 'completed'
    ).length;

    return {
      totalJobs: jobs.length,
      activeJobs: activeCount,
      completedJobs: completedCount,
      totalIPs: ips.length,
      verifiedIPs: ips.filter((ip) => ip.is_id_verified).length,
      pendingIPs: ips.filter((ip) => !ip.is_id_verified).length,
      availableIPs: ips.filter((ip) => !ip.is_assigned).length,
    };
  }, [jobsData, ipsData]);

  const recentJobs = useMemo(() => {
    const jobs = (jobsData as Job[]) || [];
    return [...jobs]
      .sort((a, b) => {
        if (a.id && b.id) return b.id - a.id;
        return new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime();
      })
      .slice(0, 5);
  }, [jobsData]);

  const isLoading = jobsLoading || ipsLoading;

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-lg">Overview of your operations and daily activities.</p>
      </header>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Jobs"
          value={stats.totalJobs}
          description="All time records"
          icon={<Briefcase className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="In Progress Jobs"
          value={stats.activeJobs}
          description="Currently in progress"
          icon={<Activity className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Completed Jobs"
          value={stats.completedJobs}
          description="Successfully finished"
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Total Personnel"
          value={stats.totalIPs}
          description={`${stats.availableIPs} available`}
          icon={<Users className="h-4 w-4" />}
          loading={isLoading}
        />
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold mb-4 tracking-tight flex items-center gap-2 text-foreground">
          <TrendingUp className="h-5 w-5" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActionCard
            title="Jobs Management"
            description="Create, update, and track all jobs"
            icon={<Briefcase className="h-5 w-5" />}
            to="/dashboard/jobs"
          />
          <QuickActionCard
            title="Analytics"
            description="Monitor performance and insights"
            icon={<TrendingUp className="h-5 w-5" />}
            to="/dashboard/analytics"
          />
          <QuickActionCard
            title="Admin Controls"
            description="Verify IPs and manage personnel"
            icon={<Shield className="h-5 w-5" />}
            to="/dashboard/workers"
          />
        </div>
      </section>

      {/* Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentJobsCard jobs={recentJobs} isLoading={isLoading} />
        <PendingApprovalsCard pendingCount={stats.pendingIPs} />
      </section>
    </div>
  );
};

// Helper Components
const QuickActionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}> = ({ title, description, icon, to }) => (
  <Link to={to} className="group block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl">
    <Card className="h-full border shadow-none hover:bg-muted/40 transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg text-foreground">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-base text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          Open {title} <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

const RecentJobsCard: React.FC<{ jobs: Job[]; isLoading: boolean }> = ({ jobs, isLoading }) => (
  <Card className="border shadow-none">
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="space-y-1">
        <CardTitle className="text-xl">Recent Jobs</CardTitle>
        <CardDescription>Latest created jobs</CardDescription>
      </div>
      <Button variant="outline" size="sm" asChild className="gap-1 border-input hover:bg-muted/50">
        <Link to="/dashboard/jobs">
          View All <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <ul className="space-y-0 divide-y">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                to={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-md text-foreground">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none group-hover:underline">
                      {job.name || 'Untitled Job'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.customer_name || 'Unknown'} • {job.city || 'No city'}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="font-normal capitalize shadow-none text-muted-foreground border-border"
                >
                  {job.status?.replace('_', ' ') || 'created'}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-12 text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
          <Briefcase className="h-8 w-8 mb-3 mx-auto opacity-20" />
          <p>No recent jobs found.</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const PendingApprovalsCard: React.FC<{ pendingCount: number }> = ({ pendingCount }) => (
  <Card className="border shadow-none h-full">
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="space-y-1">
        <CardTitle className="text-xl">Pending Approvals</CardTitle>
        <CardDescription>Personnel waiting for verification</CardDescription>
      </div>
      <Button variant="outline" size="sm" asChild className="gap-1 border-input hover:bg-muted/50">
        <Link to="/dashboard/workers">
          Manage <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </CardHeader>
    <CardContent className="h-[calc(100%-88px)]">
      {pendingCount > 0 ? (
        <div className="flex flex-col gap-4 h-full">
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/10 border border-border rounded-xl text-center">
            <div className="bg-muted p-3 rounded-full mb-3">
              <Shield className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Action Required</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
              <span className="font-medium text-foreground">{pendingCount}</span> worker{pendingCount !== 1 ? 's' : ''} need ID verification.
            </p>
            <Button className="mt-4 bg-foreground text-background hover:bg-foreground/90 shadow-none" size="sm" asChild>
              <Link to="/dashboard/workers">Review Requests</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted-foreground bg-muted/5 border border-dashed rounded-xl">
          <div className="bg-muted/30 p-3 rounded-full mb-3">
            <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">All Caught Up</p>
          <p className="text-xs max-w-[200px] mt-1">All personnel accounts have been verified.</p>
        </div>
      )}
    </CardContent>
  </Card>
);

export default Dashboard;