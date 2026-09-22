import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  MapPin,
  Play,
  UserRound,
  XCircle,
} from "lucide-react";

import { attendanceAPI, authAPI } from "@/api/services";
import JobActionsModal from "@/components/JobActionsModal";
import { StatusBadge, type Status } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobChecklists } from "@/hooks/useChecklists";
import { useJob } from "@/hooks/useJobs";

const JobFormModal = lazy(() => import("@/components/JobFormModal"));

const STATUS_TONE: Record<string, Status> = {
  completed: "success",
  in_progress: "info",
  paused: "warning",
  pending_approval: "warning",
  creation_rejected: "danger",
  created: "neutral",
};

export default function JobWorkspace() {
  const [editing, setEditing] = useState(false);
  const jobId = Number(useParams().jobId);
  const [modalTab, setModalTab] = useState<"actions" | "checklists" | null>(null);
  const { data: job, isLoading, isError, refetch: refetchJob } = useJob(jobId);
  const { data: checklists = [], isLoading: checklistsLoading, isError: checklistsError, refetch: refetchChecklists } = useJobChecklists(jobId);
  const { data: attendance, isLoading: attendanceLoading, isError: attendanceError, refetch: refetchAttendance } = useQuery({
    queryKey: ["attendance", "job", jobId],
    queryFn: () => attendanceAPI.getAll({ job_id: jobId, limit: 100 }),
    enabled: Number.isInteger(jobId) && jobId > 0,
  });
  const { data: user } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: authAPI.getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="mx-auto h-[520px] w-full max-w-6xl" />;
  if (isError || !job) {
    return (
      <Card className="mx-auto max-w-xl"><CardContent className="space-y-4 py-12 text-center">
        <p className="font-semibold">This job could not be loaded.</p>
        <Button asChild variant="outline"><Link to="/dashboard/jobs">Back to jobs</Link></Button>
      </CardContent></Card>
    );
  }

  const reports = (attendance?.records || []).filter(
    (record) => record.attendance_type === "check_out" && record.report_document_url,
  );
  const missingReports = attendance?.missing_reports || [];
  const startRequirements = [
    { label: "Supervisor assigned", met: Boolean(job.user_id || job.admin_assigned) },
    { label: "Partner assigned", met: Boolean(job.assigned_ip_id) },
    { label: "Checklist mapped", met: checklists.length > 0 },
  ];
  const readyToStart = Boolean(job.assigned_ip_id) && checklists.length > 0 && !checklistsLoading && !checklistsError;
  const canOpenStart = ["created", "paused"].includes(job.status);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const scheduleDate = job.start_date && today < job.start_date ? job.start_date
    : job.delivery_date && today > job.delivery_date ? job.delivery_date : today;
  const scheduleParams = new URLSearchParams({ job: String(job.id), date_from: scheduleDate });
  const supervisorId = job.admin_assigned || job.user_id;
  if (supervisorId) scheduleParams.set("admin_id", String(supervisorId));
  const documents = [
    { label: "Handover", url: job.handover_document_link },
    { label: "NCR", url: job.ncr_document_link },
    { label: "Project report", url: job.project_report_document_link },
  ];
  const handleSuccess = async () => {
    setModalTab(null);
    setEditing(false);
    await Promise.all([refetchJob(), refetchChecklists(), refetchAttendance()]);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
        <Link to="/dashboard/jobs"><ArrowLeft className="mr-2 size-4" />Back to jobs</Link>
      </Button>

      <section className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-l-4 border-l-primary p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={STATUS_TONE[job.status] || "neutral"}>{job.status.replaceAll("_", " ")}</StatusBadge>
            <Badge variant="outline">Job #{job.id}</Badge>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{job.name || "Untitled job"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{job.type?.replaceAll("_", " ") || "Job type pending"}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{job.city || "Location pending"}</span>
            <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" />{job.assigned_ip ? `${job.assigned_ip.first_name} ${job.assigned_ip.last_name}`.trim() : job.assigned_ip_name || "Partner not assigned"}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{job.start_date || "Start date pending"} → {job.delivery_date}</span>
          </div>
          {job.drawing_document_link ? (
            <Button asChild variant="outline" className="mt-5 w-fit">
              <a href={job.drawing_document_link} target="_blank" rel="noreferrer">
                <FileText className="mr-2 size-4" />View job drawing<ExternalLink className="ml-2 size-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
        <div className="border-t bg-muted/25 p-5 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next action</p>
          <h2 className="mt-2 text-lg font-semibold">{canOpenStart ? (job.status === "paused" ? "Resume this job" : "Prepare to start") : job.status === "in_progress" ? "Review work and approvals" : job.status === "pending_approval" ? "Waiting for job approval" : job.status === "creation_rejected" ? "Job request rejected" : "Job completed"}</h2>
          {canOpenStart ? (
            <>
              {checklistsLoading ? <p className="mt-4 text-sm text-muted-foreground">Checking start requirements…</p> : checklistsError ? (
                <div className="mt-4 space-y-2"><p role="alert" className="text-sm text-destructive">Start requirements could not be checked.</p><Button variant="outline" onClick={() => refetchChecklists()}>Try again</Button></div>
              ) : (
                <div className="mt-4 space-y-2">
                  {startRequirements.map((item) => (
                    <p key={item.label} className="flex items-center gap-2 text-sm">
                      {item.met ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                      <span>{item.label}</span>
                    </p>
                  ))}
                </div>
              )}
              <Button className="mt-5 w-full" size="lg" onClick={() => setModalTab("actions")} disabled={!readyToStart}>
                <Play className="mr-2 size-4" />{job.status === "paused" ? "Resume job" : "Start job"}
              </Button>
              <div className="mt-2 flex flex-wrap gap-2">
                {!job.assigned_ip_id && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Assign a partner</Button>}
                {!checklistsLoading && !checklistsError && !checklists.length && <Button asChild size="sm" variant="outline"><Link to="/dashboard/mappings">Set up job checklist</Link></Button>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{job.customer_phone ? `Ask the customer for the code sent to ${job.customer_phone} when starting.` : "No customer phone is saved. Open Start job to follow the required approval steps."}</p>
            </>
          ) : job.status === "in_progress" ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">Review submitted checklist items. Complete the job only after all work, approvals and required documents are ready.</p>
              <Button className="mt-5 w-full" onClick={() => setModalTab("checklists")}>Review checklists</Button>
              <Button className="mt-2 w-full" variant="outline" onClick={() => setModalTab("actions")}>Completion documents &amp; job actions</Button>
            </>
          ) : job.status === "pending_approval" ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">A superadmin must approve this job before work can start.</p>
              {user?.is_superadmin && <Button asChild className="mt-5 w-full"><Link to="/dashboard/jobs#job-approvals">Review pending jobs</Link></Button>}
            </>
          ) : job.status === "creation_rejected" ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">Review the job history and contact the approving administrator before arranging work.</p>
              <Button asChild className="mt-5 w-full" variant="outline"><Link to={`/dashboard/jobs/${job.id}/history`}>View job history</Link></Button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted-foreground">Work is finished. View the submitted reports, history and billing records.</p>
              <Button className="mt-5 w-full" variant="outline" onClick={() => setModalTab("actions")}>View job records &amp; billing</Button>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" />Job checklists</CardTitle>
              <CardDescription className="mt-1">The mapped checklist and live approval progress for this job.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setModalTab("checklists")}>Review</Button>
          </CardHeader>
          <CardContent>
            {checklistsLoading ? <Skeleton className="h-24 w-full" /> : checklistsError ? (
              <div className="space-y-2"><p role="alert" className="text-sm text-destructive">Checklists could not be loaded.</p><Button variant="outline" onClick={() => refetchChecklists()}>Retry checklists</Button></div>
            ) : checklists.length ? (
              <div className="divide-y rounded-lg border">
                {checklists.map((checklist) => {
                  const approved = checklist.items.filter((item) => item.status?.review_status === "approved").length;
                  return (
                    <div key={checklist.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{checklist.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{approved} of {checklist.items.length} items approved</p>
                      </div>
                      <Badge variant={approved === checklist.items.length && checklist.items.length ? "secondary" : "outline"}>{approved}/{checklist.items.length}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-destructive">No checklist is attached to this job.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />Visit reports</CardTitle>
            <CardDescription>Reports submitted by the partner when checking out of this job.</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? <Skeleton className="h-24 w-full" /> : attendanceError ? (
              <div className="space-y-2"><p role="alert" className="text-sm text-destructive">Visit reports could not be loaded.</p><Button variant="outline" onClick={() => refetchAttendance()}>Retry reports</Button></div>
            ) : reports.length ? (
              <div className="divide-y rounded-lg border">
                {reports.map((report) => (
                  <a key={report.id} href={report.report_document_url!} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-4 text-sm transition-colors hover:bg-muted/40">
                    <span><span className="block font-semibold">{new Date(report.recorded_at).toLocaleDateString("en-IN")}</span><span className="text-xs text-muted-foreground">Filed by {report.phone}</span></span>
                    <ExternalLink className="size-4 text-primary" />
                  </a>
                ))}
              </div>
            ) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No visit report has been filed for this job yet.</p>}
            {missingReports.length ? <p className="mt-3 text-xs font-medium text-destructive">{missingReports.length} rostered day{missingReports.length === 1 ? " is" : "s are"} missing a report.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to={`/dashboard/roster?${scheduleParams}`}>Open work schedule</Link></Button>
        <Button asChild variant="outline"><Link to={`/dashboard/jobs/${job.id}/history`}>View history</Link></Button>
        <Button asChild variant="outline"><Link to={`/dashboard/document-automation?job=${job.id}`}>Generate documents</Link></Button>
      </div>

      {documents.some((document) => document.url) && <Card>
        <CardHeader><CardTitle className="text-base">Completion documents</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {documents.filter((document) => document.url).map((document) => <Button key={document.label} asChild variant="outline">
            <a href={document.url!} download target="_blank" rel="noreferrer"><FileText className="mr-2 size-4" />Download {document.label}</a>
          </Button>)}
        </CardContent>
      </Card>}

      {editing && <Suspense fallback={<p role="status">Opening job form…</p>}><JobFormModal job={job} onClose={() => setEditing(false)} onSuccess={handleSuccess} isSuperadmin={Boolean(user?.is_superadmin)} /></Suspense>}

      {modalTab ? (
        <JobActionsModal
          job={job}
          initialTab={modalTab}
          onClose={() => setModalTab(null)}
          onSuccess={handleSuccess}
          isSuperadmin={Boolean(user?.is_superadmin)}
        />
      ) : null}
    </div>
  );
}
