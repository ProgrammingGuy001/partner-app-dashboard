import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { useJobs } from '@/hooks/useJobs';
import { useIPUsers } from '@/hooks/useIPUsers';
import { authAPI, type Job } from '@/api/services';
import { useIPPerformance, useJobStages, usePayoutReport } from '@/hooks/useAnalytics';
import { Briefcase, ArrowRight, Shield, Users, CheckCircle2, Activity, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const JOB_STATUS_ORDER = ['created', 'pending_approval', 'in_progress', 'paused', 'completed', 'creation_rejected'] as const;

const jobStatusChartConfig = {
  count: { label: 'Jobs' },
  created: { label: 'Created', color: 'var(--muted-foreground)' },
  pending_approval: { label: 'Pending Approval', color: 'var(--warning)' },
  in_progress: { label: 'In Progress', color: 'var(--info)' },
  paused: { label: 'Paused', color: 'var(--muted-foreground)' },
  completed: { label: 'Completed', color: 'var(--success)' },
  creation_rejected: { label: 'Rejected', color: 'var(--destructive)' },
} satisfies ChartConfig;

const Dashboard: React.FC = () => {
  const { data: jobsData, isLoading: jobsLoading } = useJobs();
  const { data: ipsData, isLoading: ipsLoading } = useIPUsers();
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 5 * 60 * 1000,
  });
  const isSuperadmin = Boolean(currentUser?.is_superadmin);
  const [payoutPeriod, setPayoutPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const { data: payout, isLoading: payoutLoading, error: payoutError } = usePayoutReport({ period: payoutPeriod }, isSuperadmin);
  const { data: jobStages = [], isLoading: stagesLoading } = useJobStages(isSuperadmin);
  const { data: ipPerformance = [], isLoading: performanceLoading, error: performanceError } = useIPPerformance(isSuperadmin);

  const stats = useMemo(() => {
    const jobs = Array.isArray(jobsData) ? jobsData : [];
    const ips = Array.isArray(ipsData) ? ipsData : [];

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

  const jobStatusChartData = useMemo(() => {
    const counts: Record<string, number> = isSuperadmin && jobStages.length > 0
      ? Object.fromEntries(jobStages.map((stage) => [stage.status, stage.count]))
      : (Array.isArray(jobsData) ? jobsData : []).reduce<Record<string, number>>((result, job) => {
          const key = job.status || 'created';
          result[key] = (result[key] || 0) + 1;
          return result;
        }, {});
    return JOB_STATUS_ORDER
      .map((status) => ({ status, label: jobStatusChartConfig[status].label, count: counts[status] || 0 }))
      .filter((entry) => entry.count > 0);
  }, [isSuperadmin, jobStages, jobsData]);

  const recentJobs = useMemo(() => {
    const jobs = (jobsData as Job[]) || [];
    return [...jobs]
      .sort((a, b) => {
        if (a.id && b.id) return b.id - a.id;
        return new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime();
      })
      .slice(0, 5);
  }, [jobsData]);

  const isLoading = jobsLoading || ipsLoading || (isSuperadmin && stagesLoading);
  const formatCurrency = (value?: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 sm:gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-lg">Overview of your operations and daily activities.</p>
      </header>

      {/* Jobs by status — the one chart in the app, so it carries the most visual weight on this screen */}
      <Card className="border shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Jobs by Status</CardTitle>
          <CardDescription>Where every job in the system currently stands</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : jobStatusChartData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
              <Activity className="h-8 w-8 mb-3 mx-auto opacity-20" />
              <p>No jobs yet — this chart fills in once jobs are created.</p>
            </div>
          ) : (
            <ChartContainer config={jobStatusChartConfig} className="h-64 w-full">
              <BarChart data={jobStatusChartData} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" radius={6}>
                  {jobStatusChartData.map((entry) => (
                    <Cell key={entry.status} fill={`var(--color-${entry.status})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-6">
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

      {isSuperadmin && (
        <section className="space-y-4" aria-labelledby="payout-analytics-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="payout-analytics-title" className="text-xl font-semibold">Payout analytics</h2>
              <p className="text-sm text-muted-foreground">Global payout and IP performance visible to superadmins.</p>
            </div>
            <label className="space-y-1 text-sm">
              <span className="block text-xs font-medium text-muted-foreground">Period</span>
              <select
                value={payoutPeriod}
                onChange={(event) => setPayoutPeriod(event.target.value as typeof payoutPeriod)}
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="week">Current week</option>
                <option value="month">Current month</option>
                <option value="quarter">Current quarter</option>
                <option value="year">Current year</option>
              </select>
            </label>
          </div>

          {payoutError || performanceError ? (
            <Card className="border-destructive/40"><CardContent className="p-5 text-sm text-destructive">Analytics could not be loaded. Refresh to retry.</CardContent></Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard title="Period jobs" value={payout?.total_jobs ?? 0} description={payout?.period || payoutPeriod} icon={<Briefcase className="h-4 w-4" />} loading={payoutLoading} />
                <StatCard title="Total payout" value={formatCurrency(payout?.total_payout)} description={payout?.start_date && payout?.end_date ? `${payout.start_date} to ${payout.end_date}` : 'Selected period'} icon={<IndianRupee className="h-4 w-4" />} loading={payoutLoading} />
                <StatCard title="Additional expense" value={formatCurrency(payout?.total_additional_expense)} description="Selected period" icon={<Activity className="h-4 w-4" />} loading={payoutLoading} />
              </div>
              <Card className="border shadow-none">
                <CardHeader><CardTitle className="text-lg">IP performance</CardTitle><CardDescription>All-time jobs and payouts from the backend report</CardDescription></CardHeader>
                <CardContent>
                  {performanceLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : ipPerformance.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No IP performance data yet.</p>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {ipPerformance.map((ip) => (
                        <div key={ip.ip_id} className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                          <p className="font-medium">{ip.ip_name}</p>
                          <p className="text-muted-foreground">{ip.job_count} job{ip.job_count === 1 ? '' : 's'}</p>
                          <p className="font-semibold">{formatCurrency(ip.total_payout)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>
      )}

      

      {/* Recent Activity */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <RecentJobsCard jobs={recentJobs} isLoading={isLoading} />
        <PendingApprovalsCard pendingCount={stats.pendingIPs} />
      </section>
    </div>
  );
};


const RecentJobsCard: React.FC<{ jobs: Job[]; isLoading: boolean }> = ({ jobs, isLoading }) => (
  <Card className="border shadow-none">
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                className="flex flex-col gap-3 p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:p-4 group"
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
                  className="w-fit border-border font-normal capitalize text-muted-foreground shadow-none"
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
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border bg-muted/10 p-5 text-center sm:p-6">
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
