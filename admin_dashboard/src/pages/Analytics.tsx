import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useJobs } from '@/hooks/useJobs';
import { jobAPI, type Job } from '@/api/services';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Briefcase, RefreshCw, Edit2, Save, X } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const Analytics: React.FC = () => {
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editExpense, setEditExpense] = useState<string>('');


  const { data: jobsData, isLoading, error, refetch } = useJobs();

  const jobs = React.useMemo(() => jobsData || [], [jobsData]);

  // Calculate totals
  const totals = useCallback(() => {
    const totalJobs = jobs.length;
    const totalPayout = jobs.reduce((sum: number, job: Job) => {
      const rate = Number(job.rate) || 0;
      const size = Number(job.size) || 0;
      return sum + (rate * size);
    }, 0);

    const totalExpenses = jobs.reduce((sum: number, job: Job) => sum + (Number(job.additional_expense) || 0), 0);
    const totalSize = jobs.reduce((sum: number, job: Job) => sum + (Number(job.size) || 0), 0);
    const totalCost = totalPayout + totalExpenses;
    const avgRatePerUnit = totalSize > 0 ? totalCost / totalSize : 0;

    return {
      totalJobs,
      totalPayout,
      totalExpenses,
      totalSize,
      totalCost,
      avgRatePerUnit,
    };
  }, [jobs]);

  const handleEditExpense = (jobId: number, currentExpense: number) => {
    setEditingJobId(jobId);
    setEditExpense(currentExpense.toString());
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setEditExpense('');
  };

  const handleSaveExpense = async (jobId: number) => {
    try {
      const expenseValue = Number(editExpense) || 0;
      await jobAPI.update(jobId, {
        additional_expense: expenseValue
      });

      toast.success("Expense updated successfully");

      refetch();
      setEditingJobId(null);
      setEditExpense('');
    } catch {
      toast.error("Failed to update expense");
    }
  };

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Analytics</h3>
            <p className="text-muted-foreground mb-4">
              Failed to fetch analytics data. Please try again.
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totalJobs, totalExpenses, avgRatePerUnit } = totals();

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Job Cost Analytics</h1>
          <p className="text-muted-foreground">Track individual job costs and rates</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
            aria-label="Refresh analytics data"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
        </div>
      </header>

      {/* Project Analytics Link */}
      <Link to="/dashboard/project-analytics" className="group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-2 border-transparent group-focus:border-primary">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-muted p-3 rounded-lg group-hover:bg-background transition">
              <Briefcase className="text-foreground" size={28} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Project-wise Analytics</h3>
              <p className="text-sm text-muted-foreground">Analyze performance and costs by project</p>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Jobs"
          value={totalJobs}
          description="All jobs"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          title="Additional Expenses"
          value={`₹${totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          description="Total misc costs"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Avg Rate per Unit"
          value={`₹${avgRatePerUnit.toFixed(2)}`}
          description="Price/area"
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Job Cost Chart & Table */}
      <div className="grid grid-cols-1 gap-6">
        <CostChart jobs={jobs} />
        <JobDetailsTable
          jobs={jobs}
          editingJobId={editingJobId}
          editExpense={editExpense}
          onEditExpense={handleEditExpense}
          onSaveExpense={handleSaveExpense}
          onCancelEdit={handleCancelEdit}
          setEditExpense={setEditExpense}
        />
      </div>
    </div>
  );
};

// Helper Components
const AnalyticsSkeleton: React.FC = () => (
  <div className="flex flex-col gap-6 p-6">
    <Skeleton className="h-10 w-64" />
    <div className="grid grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
    <Skeleton className="h-[400px]" />
    <Skeleton className="h-[600px]" />
  </div>
);

// Removed: KPICard moved to shared @/components/StatCard

const CostChart: React.FC<{ jobs: Array<{ id?: number; name?: string | null; rate?: number | null; size?: number | null; additional_expense?: number | null }> }> = ({ jobs }) => {
  const chartData = jobs.slice(0, 20).map(job => {
    const rate = Number(job.rate) || 0;
    const size = Number(job.size) || 0;
    const expense = Number(job.additional_expense) || 0;
    const totalCost = rate * size + expense;

    return {
      name: (job.name || 'Untitled').length > 15
        ? (job.name || 'Untitled').substring(0, 15) + '...'
        : (job.name || 'Untitled'),
      totalCost,
      expense,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-muted-foreground" /> Cost per Job
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length > 0 ? (
          <div className="h-[400px]" role="img" aria-label="Job cost comparison chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(1)}k`}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  formatter={(value: number) => [
                    `₹${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                  ]}
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  cursor={{ fill: 'var(--muted)' }}
                />
                <Legend />
                <Bar
                  dataKey="totalCost"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  name="Total Cost"
                  maxBarSize={40}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                  name="Additional Expense"
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={<DollarSign size={48} />} message="No job data available" />
        )}
      </CardContent>
    </Card>
  );
};

const JobDetailsTable: React.FC<{
  jobs: Job[];
  editingJobId: number | null;
  editExpense: string;
  onEditExpense: (id: number, expense: number) => void;
  onSaveExpense: (id: number) => void;
  onCancelEdit: () => void;
  setEditExpense: (value: string) => void;
}> = ({ jobs, editingJobId, editExpense, onEditExpense, onSaveExpense, onCancelEdit, setEditExpense }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-muted-foreground" /> All Jobs Cost Details
      </CardTitle>
    </CardHeader>
    <CardContent>
      {jobs.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Area</TableHead>
                <TableHead className="text-right">Rate/area</TableHead>
                <TableHead className="text-right">Payout</TableHead>
                <TableHead className="text-right">Expense</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Rate/Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <JobTableRow
                  key={job.id}
                  job={job}
                  isEditing={editingJobId === job.id}
                  editExpense={editExpense}
                  onEditExpense={onEditExpense}
                  onSaveExpense={onSaveExpense}
                  onCancelEdit={onCancelEdit}
                  setEditExpense={setEditExpense}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={<Briefcase size={48} />} message="No job data available" />
      )}
    </CardContent>
  </Card>
);

const JobTableRow: React.FC<{
  job: Job;
  isEditing: boolean;
  editExpense: string;
  onEditExpense: (id: number, expense: number) => void;
  onSaveExpense: (id: number) => void;
  onCancelEdit: () => void;
  setEditExpense: (value: string) => void;
}> = ({ job, isEditing, editExpense, onEditExpense, onSaveExpense, onCancelEdit, setEditExpense }) => {
  const rate = Number(job.rate) || 0;
  const size = Number(job.size) || 0;
  const expense = Number(job.additional_expense) || 0;
  const payout = rate * size;
  const totalCost = payout + expense;
  const ratePerUnit = size > 0 ? totalCost / size : 0;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{job.name || 'Untitled'}</div>
        <div className="text-xs text-muted-foreground">{job.city || '-'}</div>
      </TableCell>
      <TableCell>{job.customer_name || '-'}</TableCell>
      <TableCell className="text-center">
        <div className="text-xs font-medium capitalize text-muted-foreground">
          {(job.status || 'created').replace('_', ' ')}
        </div>
      </TableCell>
      <TableCell className="text-right">{size}</TableCell>
      <TableCell className="text-right">₹{rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
      <TableCell className="text-right">₹{payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-2">
            <Input
              type="number"
              value={editExpense}
              onChange={(e) => setEditExpense(e.target.value)}
              className="w-24 h-8 text-right"
              placeholder="0"
              autoFocus
              min="0"
              step="0.01"
              aria-label="Edit expense amount"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onSaveExpense(job.id!)}
              className="h-8 w-8 text-foreground hover:text-foreground/80"
              aria-label="Save expense"
            >
              <Save size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onCancelEdit}
              className="h-8 w-8"
              aria-label="Cancel edit"
            >
              <X size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span className="font-medium text-muted-foreground">
              ₹{expense.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEditExpense(job.id!, expense)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Edit expense"
            >
              <Edit2 size={12} />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right font-semibold">
        ₹{totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="text-right font-medium text-muted-foreground">
        ₹{ratePerUnit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </TableCell>
    </TableRow>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
    <div className="text-center">
      <div className="mx-auto mb-2 opacity-50" aria-hidden="true">
        {icon}
      </div>
      <p>{message}</p>
    </div>
  </div>
);

export default Analytics;
