import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authAPI, jobAPI, type InvoiceRequest, type Job, type IPUser, type JobApprovalRequest } from '@/api/services';
import {
  useApproveJobApprovalRequest,
  useApproveJobCreation,
  useDeleteJob,
  useJobs,
  usePendingApprovalJobs,
  usePendingJobApprovalRequests,
  useRejectJobApprovalRequest,
  useRejectJobCreation,
} from '@/hooks/useJobs';
import { useIPUsers } from '@/hooks/useIPUsers';
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Search, Filter, RefreshCw, History, User, MoreVertical, Pencil, XCircle, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import JobFormModal from '@/components/JobFormModal';
import JobActionsModal from '@/components/JobActionsModal';
import { StatusBadge, type Status } from '@/components/StatusBadge';
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
import { getApiErrorMessage } from '@/lib/apiError';

const JOB_STATUS_META: Record<string, { status: Status; label: string }> = {
  completed: { status: 'success', label: 'Completed' },
  in_progress: { status: 'info', label: 'In Progress' },
  paused: { status: 'neutral', label: 'Paused' },
  pending_approval: { status: 'warning', label: 'Pending Approval' },
  creation_rejected: { status: 'danger', label: 'Rejected' },
  created: { status: 'neutral', label: 'Created' },
};

const getJobStatusMeta = (status?: string) =>
  JOB_STATUS_META[status ?? 'created'] ?? JOB_STATUS_META.created;

const JOBS_PAGE_SIZE = 25;

const JobsEmptyState: React.FC<{
  isFiltered: boolean;
  page: number;
  onCreate: () => void;
}> = ({ isFiltered, page, onCreate }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="rounded-full bg-muted p-4 mb-4">
      <Search className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold">No jobs found</h3>
    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
      {page > 1
        ? "You've paged past the last job. Go back to the previous page."
        : isFiltered
          ? "We couldn't find any jobs matching your current filters. Try adjusting your search criteria."
          : "Get started by creating your first job assignment."}
    </p>
    {!isFiltered && page === 1 && (
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" /> Create Job
      </Button>
    )}
  </div>
);

// ponytail: prev/next only — GET /jobs returns a bare array with no total, so
// there is no page count to render. Add numbered pages when the endpoint returns one.
const JobsPagination: React.FC<{
  page: number;
  count: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
}> = ({ page, count, isFetching, onPageChange }) => {
  const hasPrev = page > 1;
  const hasNext = count === JOBS_PAGE_SIZE;
  if (!hasPrev && !hasNext) return null;

  const start = count === 0 ? 0 : (page - 1) * JOBS_PAGE_SIZE + 1;
  const end = (page - 1) * JOBS_PAGE_SIZE + count;

  return (
    <nav
      aria-label="Jobs pagination"
      className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {count === 0 ? `Page ${page} — no jobs here` : `Showing ${start}–${end} · page ${page}`}
      </p>
      <div className="flex w-full gap-2 sm:w-auto">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 sm:flex-none"
          disabled={!hasPrev || isFetching}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 sm:flex-none"
          disabled={!hasNext || isFetching}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
};

const Jobs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [actionJob, setActionJob] = useState<Job | null>(null);
  const [actionModalTab, setActionModalTab] = useState<'actions' | 'checklists'>('actions');
  const [deleteJobId, setDeleteJobId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  // A narrower filter can leave you stranded past the last page.
  useEffect(() => setPage(1), [statusFilter, typeFilter, searchTerm]);

  const filters = useMemo(() => ({
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: searchTerm || undefined,
    page,
    limit: JOBS_PAGE_SIZE,
  }), [statusFilter, typeFilter, searchTerm, page]);

  const { data: jobsData, isLoading: jobsLoading, isFetching: jobsFetching, refetch: refetchJobs } = useJobs(filters);
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 1000 * 60 * 5,
  });
  const isSuperadmin = Boolean(currentUser?.is_superadmin);
  const {
    data: pendingInvoiceData,
    isLoading: pendingInvoicesLoading,
    error: pendingInvoicesError,
    refetch: refetchPendingInvoices,
  } = useQuery({
    queryKey: ['jobs', 'invoice-requests', 'pending'],
    queryFn: () => jobAPI.getPendingInvoiceRequests(),
    staleTime: 60 * 1000,
  });
  const {
    data: pendingJobs = [],
    isLoading: pendingLoading,
    refetch: refetchPendingJobs,
  } = usePendingApprovalJobs(isSuperadmin);

  const { data: pendingApprovalRequests = [], isLoading: approvalRequestsLoading } =
    usePendingJobApprovalRequests(isSuperadmin);

  const deleteJobMutation = useDeleteJob();
  const approveJobMutation = useApproveJobCreation();
  const rejectJobMutation = useRejectJobCreation();
  const approveRequestMutation = useApproveJobApprovalRequest();
  const rejectRequestMutation = useRejectJobApprovalRequest();

  const { data: workersData, isLoading: workersLoading } = useIPUsers();

  const jobs = jobsData || [];
  const workers = workersData || [];

  const getWorkerName = (ipId?: number | null) => {
    if (!ipId) return null;
    const worker = workers.find(w => w.id === ipId);
    return worker ? `${worker.first_name} ${worker.last_name}` : 'Unknown';
  };

  const handleReviewInvoice = async (request: InvoiceRequest) => {
    if (!request.job_id) {
      toast.error('This invoice request has no linked job');
      return;
    }
    try {
      const job = jobs.find((item) => item.id === request.job_id)
        || await jobAPI.getById(request.job_id);
      setActionJob(job);
      setActionModalTab('actions');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not open invoice request'));
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
    refetchPendingInvoices();
  };

  const isLoading = jobsLoading || workersLoading;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 sm:gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          onEdit={(job) => setEditingJob(job)}
          onApprove={(id) => approveJobMutation.mutate(id)}
          onReject={(id) => rejectJobMutation.mutate({ id })}
          isMutating={approveJobMutation.isPending || rejectJobMutation.isPending}
        />
      )}

      {isSuperadmin && (
        <StartFinishApprovalSection
          requests={pendingApprovalRequests}
          isLoading={approvalRequestsLoading}
          onApprove={(id) => approveRequestMutation.mutate(id)}
          onReject={(id) => rejectRequestMutation.mutate({ requestId: id })}
          isMutating={approveRequestMutation.isPending || rejectRequestMutation.isPending}
        />
      )}

      <PendingInvoiceSection
        requests={pendingInvoiceData?.requests || []}
        isLoading={pendingInvoicesLoading}
        error={pendingInvoicesError instanceof Error ? pendingInvoicesError.message : ''}
        onReview={handleReviewInvoice}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
          <CardDescription>Open a job directly to start work, review checklists, and see daily reports.</CardDescription>
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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by status">
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
                <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by type">
                  <SelectValue placeholder="Job Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="measurement">Site Measurement</SelectItem>
                  <SelectItem value="site_validation">Site Validation</SelectItem>
                  <SelectItem value="site_readiness">Site Readiness</SelectItem>
                  <SelectItem value="grn">GRN</SelectItem>
                  <SelectItem value="b2b">B2B</SelectItem>
                  <SelectItem value="b2c">B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border md:hidden">
            {isLoading ? (
              <TableSkeleton />
            ) : jobs.length === 0 ? (
              <JobsEmptyState
                isFiltered={Boolean(searchTerm) || statusFilter !== 'all' || typeFilter !== 'all'}
                page={page}
                onCreate={() => setShowCreateModal(true)}
              />
            ) : (
              <div className="divide-y">
                {jobs.map((job) => (
                  <JobMobileCard
                    key={job.id}
                    job={job}
                    workers={workers}
                    isSuperadmin={isSuperadmin}
                    getWorkerName={getWorkerName}
                    onEdit={() => setEditingJob(job)}
                    onDelete={(id) => setDeleteJobId(id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hidden rounded-md border md:block md:overflow-x-auto">
            {isLoading ? (
              <TableSkeleton />
            ) : jobs.length === 0 ? (
              <JobsEmptyState
                isFiltered={Boolean(searchTerm) || statusFilter !== 'all' || typeFilter !== 'all'}
                page={page}
                onCreate={() => setShowCreateModal(true)}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Assigned Personnel</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Type</TableHead>
                    {isSuperadmin && <TableHead>Rate</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[150px] text-right">Next action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      workers={workers}
                      isSuperadmin={isSuperadmin}
                      getWorkerName={getWorkerName}
                      onEdit={() => setEditingJob(job)}
                      onDelete={(id) => setDeleteJobId(id)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {!isLoading && (
            <JobsPagination
              page={page}
              count={jobs.length}
              isFetching={jobsFetching}
              onPageChange={setPage}
            />
          )}
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
          isSuperadmin={isSuperadmin}
        />
      )}
    </div>
  );
};

// Sub-components
const PendingInvoiceSection: React.FC<{
  requests: InvoiceRequest[];
  isLoading: boolean;
  error: string;
  onReview: (request: InvoiceRequest) => void;
}> = ({ requests, isLoading, error, onReview }) => (
  <Card className="border-warning/30 bg-warning/10">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Pending invoice requests</CardTitle>
      <CardDescription>Requests are already scoped by the backend to jobs you can manage.</CardDescription>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <p className="rounded-lg border border-destructive/30 bg-background p-4 text-sm text-destructive">{error}</p>
      ) : requests.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">No invoice requests are waiting for approval.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{request.job_name || `Job #${request.job_id}`}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Requested {new Date(request.requested_at).toLocaleDateString('en-IN')}</p>
                </div>
                <StatusBadge status="warning">PENDING</StatusBadge>
              </div>
              {request.completion_percentage != null && <p className="mt-3 text-sm">Completion: {request.completion_percentage}%</p>}
              {request.notes && <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{request.notes}</p>}
              <Button className="mt-4 w-full sm:w-auto" size="sm" onClick={() => onReview(request)}>Review invoice</Button>
            </article>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const StartFinishApprovalSection: React.FC<{
  requests: JobApprovalRequest[];
  isLoading: boolean;
  onApprove: (requestId: number) => void;
  onReject: (requestId: number) => void;
  isMutating: boolean;
}> = ({ requests, isLoading, onApprove, onReject, isMutating }) => (
  <Card className="border-warning/30 bg-warning/10">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-warning">
        <ShieldCheck className="h-5 w-5" />
        Start / Complete Without Customer OTP
      </CardTitle>
      <CardDescription>
        Supervisors raise these when the customer can't verify by OTP. Approving performs the start or completion.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <TableSkeleton />
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
          No start or completion requests are waiting for approval.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{request.job_name || `Job #${request.job_id}`}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requested by {request.requested_by_name || 'a supervisor'}
                  </p>
                </div>
                <StatusBadge status="warning" className="w-fit">
                  {request.action === 'start' ? 'START' : 'COMPLETE'}
                </StatusBadge>
              </div>

              <p className="mt-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{request.reason}</p>

              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1" disabled={isMutating} onClick={() => onApprove(request.id)}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={isMutating} onClick={() => onReject(request.id)}>
                  <XCircle className="mr-1.5 h-4 w-4" /> Reject
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const PendingApprovalSection: React.FC<{
  jobs: Job[];
  workers: IPUser[];
  isLoading: boolean;
  getWorkerName: (id?: number | null) => string | null;
  onEdit: (job: Job) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  isMutating: boolean;
}> = ({ jobs, workers, isLoading, getWorkerName, onEdit, onApprove, onReject, isMutating }) => (
  <Card className="border-info/30 bg-info/10">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-info">
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
                  <StatusBadge status="warning" className="w-fit">
                    PENDING
                  </StatusBadge>
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

                  <div className="grid grid-cols-3 gap-2 sm:flex">
                    {/* CRM-created jobs land here with no supervisor, rate or size; this
                        is where a superadmin fills them in before approving. */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(job)}
                      disabled={isMutating}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
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
  getWorkerName: (id?: number | null) => string | null;
  onEdit: () => void;
  onDelete: (id: number) => void;
  isSuperadmin: boolean;
}> = ({ job, workers, getWorkerName, onEdit, onDelete, isSuperadmin }) => {
  const workerName = getWorkerName(job.assigned_ip_id);
  const worker = workers.find(w => w.id === job.assigned_ip_id);
  const statusMeta = getJobStatusMeta(job.status);
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
            <Link to={`/dashboard/jobs/${job.id}`} className="block truncate text-sm font-semibold hover:underline">{job.name || 'Untitled Job'}</Link>
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
            <DropdownMenuItem asChild>
              <Link to={`/dashboard/document-automation?job=${job.id}`}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Generate documents
              </Link>
            </DropdownMenuItem>
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
        {isSuperadmin && (
          <div>
            <p className="text-muted-foreground">Rate</p>
            <p className="mt-0.5 font-medium">₹{job.rate ?? '-'}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Supervisor</p>
          <p className="mt-0.5 font-medium">{job.assigned_admin_name || '-'}</p>
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
        <StatusBadge status={statusMeta.status} className="shrink-0">
          {statusMeta.label.toUpperCase()}
        </StatusBadge>
      </div>
      <Button asChild className="mt-4 w-full" variant={job.status === 'created' || job.status === 'paused' ? 'default' : 'outline'}>
        <Link to={`/dashboard/jobs/${job.id}`}>{job.status === 'created' ? 'Start job' : job.status === 'paused' ? 'Resume job' : 'Open job'}</Link>
      </Button>
    </article>
  );
};

const JobRow: React.FC<{
  job: Job;
  workers: IPUser[];
  getWorkerName: (id?: number | null) => string | null;
  onEdit: () => void;
  onDelete: (id: number) => void;
  isSuperadmin: boolean;
}> = ({ job, workers, getWorkerName, onEdit, onDelete, isSuperadmin }) => {
  const workerName = getWorkerName(job.assigned_ip_id);
  const worker = workers.find(w => w.id === job.assigned_ip_id);
  const statusMeta = getJobStatusMeta(job.status);

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
          <Link to={`/dashboard/jobs/${job.id}`} className="hover:underline">{job.name}</Link>
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
      <TableCell className="text-sm text-muted-foreground">{job.assigned_admin_name || '-'}</TableCell>
      <TableCell className="capitalize">{job.type?.replace('_', ' ')}</TableCell>
      {isSuperadmin && <TableCell>₹{job.rate ?? '-'}</TableCell>}
      <TableCell>
        <StatusBadge status={statusMeta.status}>
          {statusMeta.label.toUpperCase()}
        </StatusBadge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button asChild size="sm" variant={job.status === 'created' || job.status === 'paused' ? 'default' : 'outline'}>
            <Link to={`/dashboard/jobs/${job.id}`}>{job.status === 'created' ? 'Start' : job.status === 'paused' ? 'Resume' : 'Open'}</Link>
          </Button>
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
            <DropdownMenuItem asChild>
              <Link to={`/dashboard/document-automation?job=${job.id}`}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Generate documents
              </Link>
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
        </div>
      </TableCell>
    </TableRow>
  );
};

export default Jobs;
