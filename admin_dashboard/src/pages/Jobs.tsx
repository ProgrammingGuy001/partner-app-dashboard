import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminAPI, type Job, type IPUser } from '@/api/services';
import { useJobs, useDeleteJob } from '@/hooks/useJobs';
import { Plus, Search, Filter, RefreshCw, History, User, MoreVertical } from 'lucide-react';
import JobFormModal from '@/components/JobFormModal';
import JobActionsModal from '@/components/JobActionsModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const Jobs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [actionJob, setActionJob] = useState<Job | null>(null);
  const [actionModalTab, setActionModalTab] = useState<'actions' | 'checklists'>('actions');
  const [deleteJobId, setDeleteJobId] = useState<number | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    search: searchTerm || undefined,
  }), [statusFilter, typeFilter, searchTerm]);

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useJobs(filters);

  const deleteJobMutation = useDeleteJob();

  const { data: workersData, isLoading: workersLoading } = useQuery({
    queryKey: ['workers'],
    queryFn: () => adminAPI.getIPUsers(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const jobs = jobsData || [];
  const workers = workersData || [];

  const getWorkerName = (ipId?: number) => {
    if (!ipId) return null;
    const worker = workers.find(w => w.id === ipId);
    return worker ? `${worker.first_name} ${worker.last_name}` : 'Unknown';
  };

  const getStatusStyle = (status?: string): { variant: "default" | "secondary" | "destructive" | "outline"; className: string } => {
    switch (status) {
      case 'completed':
        return { variant: 'default', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' };
      case 'in_progress':
        return { variant: 'default', className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' };
      case 'paused':
        return { variant: 'secondary', className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' };
      case 'created':
      default:
        return { variant: 'outline', className: 'text-muted-foreground' };
    }
  };

  const handleDelete = async () => {
    if (!deleteJobId) return;
    try {
      await deleteJobMutation.mutateAsync(deleteJobId);
      toast.success("Job deleted successfully");
    } catch {
      toast.error("Failed to delete job");
    } finally {
      setDeleteJobId(null);
    }
  };

  const handleSuccess = () => {
    refetchJobs();
    setShowCreateModal(false);
    setEditingJob(null);
    setActionJob(null);
  };

  const isLoading = jobsLoading || workersLoading;

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Jobs Management</h1>
          <p className="text-muted-foreground">Manage all jobs and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchJobs()}
            disabled={isLoading}
            aria-label="Refresh jobs"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Job
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
          <CardDescription>A list of all jobs in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search jobs..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search jobs"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by status">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by type">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="site_readiness">Site Readiness</SelectItem>
                  <SelectItem value="site_validation">Site Validation</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="measurement">Measurement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            {isLoading ? (
              <TableSkeleton />
            ) : jobs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No jobs found. Create your first job!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Assigned Personnel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      workers={workers}
                      getWorkerName={getWorkerName}
                      getStatusStyle={getStatusStyle}
                      onEdit={() => setEditingJob(job)}
                      onDelete={(id) => setDeleteJobId(id)}
                      onAction={(tab) => {
                        setActionJob(job);
                        setActionModalTab(tab);
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteJobId !== null} onOpenChange={(open) => !open && setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modals */}
      {showCreateModal && (
        <JobFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {editingJob && (
        <JobFormModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSuccess={handleSuccess}
        />
      )}

      {actionJob && (
        <JobActionsModal
          job={actionJob}
          initialTab={actionModalTab}
          onClose={() => setActionJob(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

// Sub-components
const TableSkeleton: React.FC = () => (
  <div className="p-4 space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center justify-between">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/6" />
      </div>
    ))}
  </div>
);

const JobRow: React.FC<{
  job: Job;
  workers: IPUser[];
  getWorkerName: (id?: number) => string | null;
  getStatusStyle: (status?: string) => { variant: "default" | "secondary" | "destructive" | "outline"; className: string };
  onEdit: () => void;
  onDelete: (id: number) => void;
  onAction: (tab: 'actions' | 'checklists') => void;
}> = ({ job, workers, getWorkerName, getStatusStyle, onEdit, onDelete, onAction }) => {
  const workerName = getWorkerName(job.assigned_ip_id);
  const worker = workers.find(w => w.id === job.assigned_ip_id);
  const statusStyle = getStatusStyle(job.status);

  const isPastStartDate = useMemo(() => {
    if (!job.start_date || job.status !== 'created') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(job.start_date);
    return start < today;
  }, [job.start_date, job.status]);

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {job.name}
          {isPastStartDate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-2 w-2 rounded-full bg-destructive" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start date passed! Please update start date.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell>{job.customer_name}</TableCell>
      <TableCell>{job.city}</TableCell>
      <TableCell>
        {job.assigned_ip_id ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-muted-foreground">
                {workerName?.split(' ').map(n => n[0]).join('') || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">{workerName}</span>
              <span className="text-xs text-muted-foreground">
                {worker?.is_assigned ? 'Assigned' : 'Unassigned'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-xs">Not assigned</span>
          </div>
        )}
      </TableCell>
      <TableCell className="capitalize">{job.type?.replace('_', ' ')}</TableCell>
      <TableCell>₹{job.rate}</TableCell>
      <TableCell>
        <Badge variant={statusStyle.variant} className={statusStyle.className}>
          {job.status?.replace('_', ' ').toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Open job actions menu"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onAction('actions')}>
              Actions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('checklists')}>
              Checklists
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/dashboard/jobs/${job.id}/history`}>
                <History className="mr-2 h-4 w-4" />
                History
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(job.id!)}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

export default Jobs;