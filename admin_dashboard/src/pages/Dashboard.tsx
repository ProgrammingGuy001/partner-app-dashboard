import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useJobs } from '@/hooks/useJobs';
import { adminAPI, type Job } from '@/api/services';
import { Briefcase, ArrowRight, Shield, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="flex flex-col gap-8 p-6 max-w-[1600px] mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your operations and daily activities.</p>
      </header>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Jobs"
              value={stats.totalJobs}
              description="All time records"
            />
            <StatCard
              title="Active Jobs"
              value={stats.activeJobs}
              description="Currently in progress"
            />
            <StatCard
              title="Completed"
              value={stats.completedJobs}
              description="Successfully finished"
            />
            <StatCard
              title="Total Personnel"
              value={stats.totalIPs}
              description={`${stats.availableIPs} available for assignment`}
            />
          </>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold mb-4 tracking-tight">Quick Actions</h2>
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
const StatCard: React.FC<{
  title: string;
  value: number;
  description: string;
}> = ({ title, value, description }) => (
  <Card className="@container/card">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold tabular-nums @[200px]/card:text-3xl @[300px]/card:text-4xl transition-all duration-300">
        {value.toLocaleString()}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </CardContent>
  </Card>
);

const QuickActionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}> = ({ title, description, icon, to }) => (
  <Link to={to} className="group block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg">
    <Card className="hover:bg-muted/50 transition-colors h-full border-2 border-transparent group-focus:border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
          Go to {title} <ArrowRight className="ml-2 h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

const RecentJobsCard: React.FC<{ jobs: Job[]; isLoading: boolean }> = ({ jobs, isLoading }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between">
      <div>
        <CardTitle>Recent Jobs</CardTitle>
        <CardDescription>Latest created jobs</CardDescription>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link to="/dashboard/jobs">View All</Link>
      </Button>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                to={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none group-hover:underline">
                    {job.name || 'Untitled Job'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.customer_name || 'Unknown'} • {job.city || 'No city'}
                  </p>
                </div>
                <Badge variant="secondary" className="font-normal capitalize">
                  {job.status?.replace('_', ' ') || 'created'}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <p>No recent jobs found.</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const PendingApprovalsCard: React.FC<{ pendingCount: number }> = ({ pendingCount }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between">
      <div>
        <CardTitle>Pending Approvals</CardTitle>
        <CardDescription>Personnel waiting for verification</CardDescription>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link to="/dashboard/workers">Manage</Link>
      </Button>
    </CardHeader>
    <CardContent>
      {pendingCount > 0 ? (
        <div className="flex items-center gap-4 rounded-md border p-4 bg-muted/50">
          <div className="bg-primary/10 p-2 rounded-full">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">Verification Request</p>
            <p className="text-sm text-muted-foreground">
              {pendingCount} worker{pendingCount !== 1 ? 's' : ''} need verification.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link to="/dashboard/workers">Review</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mb-3 opacity-20" />
          <p className="text-sm">No pending approvals.</p>
          <p className="text-xs">All personnel are up to date.</p>
        </div>
      )}
    </CardContent>
  </Card>
);

export default Dashboard;