import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authAPI, type Job, type IPUser } from '@/api/services';
import {
  useApproveJobCreation,
  useDeleteJob,
  useJobs,
  usePendingApprovalJobs,
  useRejectJobCreation,
} from '@/hooks/useJobs';
import { useIPUsers } from '@/hooks/useIPUsers';
import { CheckCircle2, Plus, Search, Filter, RefreshCw, History, User, MoreVertical, XCircle } from 'lucide-react';
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [actionJob, setActionJob] = useState<Job | null>(null);
  const [actionModalTab, setActionModalTab] = useState<'actions' | 'checklists'>('actions');
  const [deleteJobId, setDeleteJobId] = useState<number | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchTerm || undefined,
  }), [statusFilter, searchTerm]);

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useJobs(filters);
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 1000 * 60 * 5,
  });
  const isSuperadmin = Boolean(currentUser?.is_superadmin);
  const {
    data: pendingJobs = [],
    isLoading: pendingLoading,
    refetch: refetchPendingJobs,
  } = usePendingApprovalJobs(isSuperadmin);

  const deleteJobMutation = useDeleteJob();
  const approveJobMutation = useApproveJobCreation();
  const rejectJobMutation = useRejectJobCreation();

  const { data: workersData, isLoading: workersLoading } = useIPUsers();

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
      case 'pending_approval':
        return { variant: 'secondary', className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' };
      case 'creation_rejected':
        return { variant: 'destructive', className: '' };
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
    if (isSuperadmin) {
      refetchPendingJobs();
    }
    setShowCreateModal(false);
    setEditingJob(null);
    setActionJob(null);
  };

  const isLoading = jobsLoading || workersLoading;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 sm:gap-6 lg:gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Jobs Management</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Manage all jobs and assignments</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => refetchJobs()}
            disabled={isLoading}
            aria-label="Refresh jobs"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="flex-1 sm:flex-none">
            <Plus className="mr-2 h-4 w-4" /> Create Job
          </Button>
        </div>
      </header>

      {isSuperadmin && (
        <PendingApprovalSection
          jobs={pendingJobs}
          workers={workers}
          isLoading={pendingLoading || workersLoading}
          getWorkerName={getWorkerName}
          onApprove={(id) => approveJobMutation.mutate(id)}
          onReject={(id) => rejectJobMutation.mutate({ id })}
          isMutating={approveJobMutation.isPending || rejectJobMutation.isPending}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
          <CardDescription>A list of all jobs in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:gap-4 lg:mb-6">
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
            <div className="grid grid-cols-1 gap-2 sm:w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
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
            </div>
          </div>

          <div className="rounded-md border md:hidden">
            {isLoading ? (
              <TableSkeleton />
            ) : jobs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No jobs found. Create your first job!</p>
              </div>
            ) : (
              <div className="divide-y">
                {jobs.map((job) => (
                  <JobMobileCard
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
              </div>
            )}
          </div>

          <div className="hidden rounded-md border md:block md:overflow-x-auto">
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
          isSuperadmin={isSuperadmin}
        />
      )}

      {editingJob && (
        <JobFormModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSuccess={handleSuccess}
          isSuperadmin={isSuperadmin}
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
const PendingApprovalSection: React.FC<{
  jobs: Job[];
  workers: IPUser[];
  isLoading: boolean;
  getWorkerName: (id?: number) => string | null;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  isMutating: boolean;
}> = ({ jobs, workers, isLoading, getWorkerName, onApprove, onReject, isMutating }) => (
  <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/10">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
        <CheckCircle2 className="h-5 w-5" />
        Pending Superadmin Approval
      </CardTitle>
      <CardDescription>
        Jobs submitted by admins stay here until approved. Approved jobs move into the normal created-job list.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <TableSkeleton />
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
          No jobs are waiting for approval.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {jobs.map((job) => {
            const workerName = getWorkerName(job.assigned_ip_id);
            const worker = workers.find(w => w.id === job.assigned_ip_id);
            return (
              <article key={job.id} className="rounded-xl border bg-background p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{job.name || 'Untitled Job'}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.customer_name || 'Unknown customer'} · {job.city || 'No city'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="w-fit bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    PENDING
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="mt-0.5 font-medium capitalize">{job.type?.replace('_', ' ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rate</p>
                    <p className="mt-0.5 font-medium">₹{job.rate ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p className="mt-0.5 font-medium">{job.start_date || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Delivery</p>
                    <p className="mt-0.5 font-medium">{job.delivery_date || '-'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {job.assigned_ip_id ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                          {workerName?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{workerName}</p>
                        <p className="text-[11px] text-muted-foreground">{worker?.is_assigned ? 'Assigned' : 'Available'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-4 w-4" />
                      Not assigned
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button
                      size="sm"
                      onClick={() => job.id && onApprove(job.id)}
                      disabled={isMutating || !job.id}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => job.id && onReject(job.id)}
                      disabled={isMutating || !job.id}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);

const TableSkeleton: React.FC = () => (
  <div className="p-4 space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between md:border-0 md:p-0">
        <Skeleton className="h-4 w-3/4 md:w-1/4" />
        <Skeleton className="h-4 w-1/2 md:w-1/6" />
        <Skeleton className="h-4 w-2/3 md:w-1/6" />
        <Skeleton className="h-4 w-20 md:w-1/6" />
      </div>
    ))}
  </div>
);

const JobMobileCard: React.FC<{
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
  const isPastStartDate = (() => {
    if (!job.start_date || job.status !== 'created') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(job.start_date) < today;
  })();

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{job.name || 'Untitled Job'}</h3>
            {isPastStartDate && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {job.customer_name || 'Unknown customer'} · {job.city || 'No city'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-2 h-9 w-9" aria-label="Open job actions menu">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onAction('actions')}>Actions</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('checklists')}>Checklists</DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
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
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Type</p>
          <p className="mt-0.5 font-medium capitalize">{job.type?.replace('_', ' ') || '-'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Rate</p>
          <p className="mt-0.5 font-medium">₹{job.rate ?? '-'}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {job.assigned_ip_id ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                {workerName?.split(' ').map(n => n[0]).join('') || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{workerName}</p>
              <p className="text-[11px] text-muted-foreground">{worker?.is_assigned ? 'Assigned' : 'Unassigned'}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-4 w-4" />
            Not assigned
          </div>
        )}
        <Badge variant={statusStyle.variant} className={`shrink-0 ${statusStyle.className}`}>
          {job.status?.replace('_', ' ').toUpperCase() || 'CREATED'}
        </Badge>
      </div>
    </article>
  );
};

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
