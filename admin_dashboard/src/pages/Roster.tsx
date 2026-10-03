import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { closestCenter, DndContext, DragOverlay, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, GripVertical, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { authAPI, rosterAPI, type RosterEntry, type RosterJob, type RosterSlot } from "@/api/services";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type Status } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/apiError";

const toIso = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const fromIso = (value: string) => new Date(`${value}T00:00:00`);
// The roster's day boundary is the API's, not the browser's. en-CA renders YYYY-MM-DD.
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const addDays = (value: string, days: number) => {
  const date = fromIso(value);
  date.setDate(date.getDate() + days);
  return toIso(date);
};
const formatDay = (value: string) => fromIso(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
// Roster day states share the app's status tones (see StatusBadge), and the same
// wording the partner apps show, so a supervisor and an IP describe a day identically.
const ROSTER_STATUS_TONE: Record<string, Status> = {
  scheduled: "info",
  blocked: "neutral",
  check_in_open: "warning",
  checked_in: "info",
  report_due: "warning",
  completed: "success",
  missed: "danger",
  auto_closed: "neutral",
};

const ROSTER_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  blocked: "Not started",
  check_in_open: "Check-in open",
  checked_in: "On site",
  report_due: "Report due",
  completed: "Completed",
  missed: "Missed",
  auto_closed: "Auto closed",
};
const activeJobStatuses = new Set(["created", "in_progress", "paused"]);
type DragItem = { kind: "ip" | "supervisor"; id: number; name: string; sub: string };

function DraggablePerson({ item }: { item: DragItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${item.kind}-${item.id}`, data: item });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Assign ${item.name}`}
      className={`flex touch-none items-center gap-2 rounded-md border bg-background p-3 text-left transition-[border-color,opacity] ease-out hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDragging ? "cursor-grabbing opacity-40" : "cursor-grab"}`}
    >
      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
      </div>
    </div>
  );
}

function RosterSlot({
  job,
  day,
  slot,
  entry,
  visit,
  disabled,
  removing,
  onRemove,
  onRemoveVisit,
}: {
  job: RosterJob;
  day: string;
  slot: RosterSlot;
  entry?: RosterEntry;
  visit?: { id: number; name: string };
  disabled: boolean;
  removing: boolean;
  onRemove: (id: number) => void;
  onRemoveVisit: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `job-${job.id}-${day}-${slot.slot_number}`,
    data: { jobId: job.id, jobName: job.name, day, slotNumber: slot.slot_number, entryId: entry?.id },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 rounded-md border p-2 transition-[border-color,background-color] ease-out ${isOver ? "border-primary bg-primary/10" : entry ? "bg-background" : disabled ? "border-transparent bg-muted/30" : "border-dashed bg-background/60"}`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">Slot {slot.slot_number}</span>
        <span>{entry ? `${entry.slot_start}–${entry.slot_end}` : `${slot.start_time}–${slot.end_time}`}</span>
      </div>
      {entry ? (
        <div className="space-y-2 border-l-2 border-primary pl-2">
          <div>
            <p className="line-clamp-2 font-medium">{entry.ip.name}</p>
            <p className={`mt-0.5 flex items-center gap-1 text-[10px] ${isOver ? "font-semibold text-primary" : "text-muted-foreground"}`}>
              <ArrowLeftRight className="size-3" /> {isOver ? "Release to swap" : entry.is_job_default ? "Preassigned from job · drop to swap this day" : "Dated assignment · drop to swap"}
            </p>
          </div>
          <div className="flex items-center justify-between gap-1">
            <StatusBadge status={ROSTER_STATUS_TONE[entry.status] || "neutral"} className="text-[10px]">{ROSTER_STATUS_LABEL[entry.status] || entry.status.replaceAll("_", " ")}</StatusBadge>
            <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove ${entry.ip.name}`} onClick={() => onRemove(entry.id)} disabled={removing}><Trash2 className="size-3.5" /></Button>
          </div>
        </div>
      ) : (
        <div className={`flex min-h-12 items-center justify-center rounded text-xs ${disabled ? "text-muted-foreground/60" : "font-medium text-muted-foreground"}`}>
          {disabled ? "Unavailable" : isOver ? "Release to assign" : "Drop IP here"}
        </div>
      )}
      {visit ? (
        <div className="mt-2 flex items-center justify-between gap-1 border-t pt-1 text-xs">
          <span className="truncate">Supervisor: {visit.name}</span>
          <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove supervisor ${visit.name}`} onClick={() => onRemoveVisit(visit.id)} disabled={removing || day < todayIst()}><Trash2 className="size-3.5" /></Button>
        </div>
      ) : null}
    </div>
  );
}

function SlotEditor({ slot }: { slot: RosterSlot }) {
  const queryClient = useQueryClient();
  const [start, setStart] = useState(slot.start_time);
  const [end, setEnd] = useState(slot.end_time);
  useEffect(() => {
    setStart(slot.start_time);
    setEnd(slot.end_time);
  }, [slot]);
  const update = useMutation({
    mutationFn: () => rosterAPI.updateSlot(slot.slot_number, { start_time: start, end_time: end }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      toast.success(`Slot ${slot.slot_number} hours updated`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not update slot hours")),
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Slot {slot.slot_number} starts</label>
        <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="w-32" />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Ends</label>
        <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="w-32" />
      </div>
      <Button variant="outline" onClick={() => update.mutate()} disabled={update.isPending || !start || !end}>
        Save
      </Button>
    </div>
  );
}

export default function Roster() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const jobFilter = Number(searchParams.get("job")) || undefined;
  const [weekStart, setWeekStart] = useState(() => {
    const requested = searchParams.get("date_from") || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(fromIso(requested).getTime()) ? requested : todayIst();
  });
  const [supervisorId, setSupervisorId] = useState(() => String(Number(searchParams.get("admin_id")) || ""));
  const [dragged, setDragged] = useState<DragItem | null>(null);
  const weekEnd = addDays(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const { data: user } = useQuery({ queryKey: ["auth", "user"], queryFn: authAPI.getCurrentUser });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["roster", supervisorId, weekStart],
    queryFn: () => rosterAPI.get({ admin_id: supervisorId ? Number(supervisorId) : undefined, date_from: weekStart, date_to: weekEnd }),
  });
  const { data: visits, isError: visitsError, refetch: refetchVisits } = useQuery({
    queryKey: ["supervisor-roster", weekStart, weekEnd],
    queryFn: () => rosterAPI.getSupervisors({ date_from: weekStart, date_to: weekEnd }),
  });
  const activeSupervisorId = supervisorId || String(data?.selected_admin_id || "");
  const today = todayIst();
  const exportRoster = useMutation({
    mutationFn: () => rosterAPI.exportXlsx({ admin_id: activeSupervisorId ? Number(activeSupervisorId) : undefined, job_id: jobFilter, date_from: weekStart, date_to: weekEnd }),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not export the roster. Please try again.")),
  });

  const create = useMutation({
    mutationFn: (payload: { job_id: number; ip_user_id: number; work_date: string; slot_number: 1 | 2 }) => rosterAPI.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roster"] }),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not schedule this job")),
  });
  const replace = useMutation({
    mutationFn: ({ entryId, ipUserId }: { entryId: number; ipUserId: number }) => rosterAPI.replace(entryId, ipUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      toast.success("Dated roster slot swapped");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not swap this roster slot")),
  });
  const remove = useMutation({
    mutationFn: rosterAPI.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roster"] }),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not remove this assignment")),
  });
  const createVisit = useMutation({
    mutationFn: rosterAPI.createSupervisor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supervisor-roster"] }),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not roster supervisor")),
  });
  const removeVisit = useMutation({
    mutationFn: rosterAPI.deleteSupervisor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supervisor-roster"] }),
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not remove supervisor")),
  });
  const jobSupervisor = (jobId: number) => visits?.jobs.find((job) => job.id === jobId)?.admin_assigned;
  const poolSupervisors = (visits?.supervisors || []).filter((supervisor) => !activeSupervisorId || String(supervisor.id) === activeSupervisorId);
  const findVisit = (jobId: number, day: string, slot: number) => {
    const visit = visits?.entries.find((entry) => entry.job_id === jobId && entry.work_date === day && entry.slot_number === slot);
    return visit && { id: visit.id, name: visits?.supervisors.find((supervisor) => supervisor.id === visit.supervisor_id)?.name || `Supervisor #${visit.supervisor_id}` };
  };

  const rosterJobs = (data?.jobs || []).filter((job) =>
    (!jobFilter || job.id === jobFilter) && (activeJobStatuses.has(job.status) || data?.entries.some((entry) => entry.job_id === job.id))
  );
  const findEntry = (jobId: number, day: string, slot: number) =>
    data?.entries.find((entry) => entry.job_id === jobId && entry.work_date === day && entry.slot_number === slot);
  const isUnavailable = (job: RosterJob, day: string) =>
    !activeJobStatuses.has(job.status) || day < today || Boolean(job.start_date && day < job.start_date) || Boolean(job.delivery_date && day > job.delivery_date);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    if (!over || !data || create.isPending || replace.isPending || createVisit.isPending) return;
    const item = active.data.current as DragItem | undefined;
    const jobId = over.data.current?.jobId as number | undefined;
    const day = over.data.current?.day as string | undefined;
    const slotNumber = over.data.current?.slotNumber as 1 | 2 | undefined;
    const entryId = over.data.current?.entryId as number | undefined;
    if (!item || !jobId || !day || !slotNumber) return;
    if (item.kind === "supervisor") {
      // ponytail: backend also enforces this; checked here only for a clearer message.
      if (jobSupervisor(jobId) !== item.id) {
        toast.error(`${item.name} is not the supervisor of this job`);
        return;
      }
      createVisit.mutate({ supervisor_id: item.id, job_id: jobId, work_date: day, slot_number: slotNumber });
      return;
    }
    const ipId = item.id;
    const ipName = item.name;
    const currentEntry = entryId ? data.entries.find((entry) => entry.id === entryId) : undefined;
    if (currentEntry?.ip_user_id === ipId) return;
    // Only the slot clashes now: the same IP may hold both halves of one day on one
    // job, which is how a full-day job is rostered.
    const conflict = data.entries.some((entry) => entry.id !== entryId &&
      entry.work_date === day && entry.ip_user_id === ipId && entry.slot_number === slotNumber
    );
    if (conflict) {
      toast.error(`${ipName || "This IP"} is already assigned to that slot on ${formatDay(day)}`);
      return;
    }
    if (entryId) {
      replace.mutate({ entryId, ipUserId: ipId });
    } else {
      create.mutate({ job_id: jobId, ip_user_id: ipId, work_date: day, slot_number: slotNumber });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Job roster</h1>
          <p className="mt-1 text-sm text-muted-foreground">A dated view of job assignments. IPs come from the selected supervisor's mapping.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => exportRoster.mutate()} disabled={!data || isError || exportRoster.isPending}><Download className="size-4" />{exportRoster.isPending ? "Exporting…" : "Export XLSX"}</Button>
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft /></Button>
          <Button variant="outline" onClick={() => setWeekStart(todayIst())}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight /></Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">{formatDay(weekStart)} – {formatDay(weekEnd)}</span>
        {jobFilter && <><span>Job #{jobFilter}</span><Button variant="outline" size="sm" onClick={() => setSearchParams((params) => { params.delete("job"); return params; })}>Show all jobs</Button></>}
      </div>
      {isError && <div role="alert" className="flex items-center gap-3 rounded-lg border p-4"><p>The roster could not be loaded.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>}

      {(user?.is_superadmin || user?.is_dev || user?.is_city_ops) ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-sm space-y-2">
              <label className="text-sm font-medium">Supervisor</label>
              <Select value={activeSupervisorId || "all"} onValueChange={(value) => { setSupervisorId(value === "all" ? "" : value); setSearchParams((params) => { params.delete("job"); params.set("admin_id", value); return params; }); }}>
                <SelectTrigger><SelectValue placeholder="Choose a supervisor" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All mapped supervisors</SelectItem>{data?.admins.map((admin) => <SelectItem key={admin.id} value={String(admin.id)}>{admin.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{data?.ips.length || 0} mapped IPs · {data?.jobs.length || 0} jobs</p>
          </CardContent>
        </Card>
      ) : null}

      {user?.is_superadmin && data?.slots.length ? (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium"><Clock3 className="mr-2 inline size-4" />Global slot hours</summary>
          <div className="mt-4 flex flex-wrap gap-6">{data.slots.map((slot) => <SlotEditor key={slot.slot_number} slot={slot} />)}</div>
        </details>
      ) : null}

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setDragged((active.data.current as DragItem) || null)}
        onDragCancel={() => setDragged(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="h-fit xl:sticky xl:top-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" />IP &amp; supervisor pool</CardTitle>
              <CardDescription>Drop an IP on an open slot to assign, or an occupied slot to swap that day only. Drop a supervisor on a slot of their job to roster a visit.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[65vh] space-y-2 overflow-y-auto">
              {data?.ips.map((ipUser) => <DraggablePerson key={`ip-${ipUser.id}`} item={{ kind: "ip", id: ipUser.id, name: ipUser.name, sub: ipUser.phone_number }} />)}
              {!isLoading && !isError && !data?.ips.length ? <p className="py-6 text-center text-sm text-muted-foreground">No verified IP is mapped to this supervisor.</p> : null}
              {poolSupervisors.length ? <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Supervisors</p> : null}
              {poolSupervisors.map((supervisor) => <DraggablePerson key={`supervisor-${supervisor.id}`} item={{ kind: "supervisor", id: supervisor.id, name: supervisor.name, sub: "Supervisor" }} />)}
              {visitsError ? <div role="alert" className="space-y-2 py-2 text-xs text-muted-foreground"><p>Supervisor visits could not be loaded. IP roster is still usable.</p><Button variant="outline" size="sm" onClick={() => refetchVisits()}>Retry</Button></div> : null}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[1640px] border-collapse text-sm">
                <caption className="sr-only">Jobs by day with two slots; drag IP personnel from the side panel to assign them</caption>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky left-0 z-10 w-60 bg-muted px-4 py-3 text-left font-medium">Job</th>
                    {days.map((day) => <th key={day} className={`w-52 border-l px-3 py-3 text-left font-medium ${day === today ? "text-primary" : ""}`}>{formatDay(day)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rosterJobs.map((job) => (
                    <tr key={job.id} className="border-b align-top last:border-0">
                      <td className="sticky left-0 z-10 bg-background px-4 py-4">
                        <Link to={`/dashboard/jobs/${job.id}`} className="line-clamp-2 font-medium text-primary underline-offset-4 hover:underline">{job.name}</Link>
                        <p className="mt-1 text-xs text-muted-foreground">{job.type || "Unspecified type"}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{job.assigned_ip_name ? `IP: ${job.assigned_ip_name}` : "IP not assigned"}</p>
                        <Badge variant="outline" className="mt-3 text-[10px]">{job.status.replaceAll("_", " ")}</Badge>
                      </td>
                      {days.map((day) => (
                        <td key={day} className={`border-l p-2 ${day === today ? "bg-primary/[0.025]" : ""}`}>
                          <div className="space-y-2">
                            {(data?.slots || []).map((slot) => (
                              <RosterSlot
                                key={slot.slot_number}
                                job={job}
                                day={day}
                                slot={slot}
                                entry={findEntry(job.id, day, slot.slot_number)}
                                visit={findVisit(job.id, day, slot.slot_number)}
                                disabled={isUnavailable(job, day)}
                                removing={remove.isPending || removeVisit.isPending}
                                onRemove={remove.mutate}
                                onRemoveVisit={removeVisit.mutate}
                              />
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isLoading && !isError && !rosterJobs.length ? <div className="p-10 text-center text-sm text-muted-foreground">{jobFilter ? "This job has no schedule in the selected week. Change the week or show all jobs." : "No schedulable jobs belong to this supervisor."}</div> : null}
              {isLoading ? <div className="p-10 text-center text-sm text-muted-foreground">Loading roster…</div> : null}
            </div>
          </Card>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged ? (
            <div className="flex w-56 items-center gap-2 rounded-md border border-primary/50 bg-background p-3 shadow-xl">
              <GripVertical className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{dragged.name}</p>
                <p className="truncate text-xs text-muted-foreground">{dragged.sub}</p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
