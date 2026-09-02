import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Link2, Users } from "lucide-react";
import { toast } from "sonner";

import { adminAPI, authAPI, checklistAPI, jobRateAPI } from "@/api/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChecklists } from "@/hooks/useChecklists";
import { IP_USERS_QUERY_KEY } from "@/hooks/useIPUsers";
import { getApiErrorMessage } from "@/lib/apiError";
import { normalizeJobType } from "@/lib/jobDocuments";

const DEFAULT_JOB_TYPES = [
  ["site_validation", "Site Validation"],
  ["measurement", "Site Measurement"],
  ["site_readiness", "Site Readiness"],
  ["grn", "GRN"],
  ["installation", "Installation"],
] as const;

export default function Mappings() {
  const queryClient = useQueryClient();
  const [supervisorId, setSupervisorId] = useState("");
  const [ipDraft, setIpDraft] = useState<{ supervisorId: string; ipIds: number[] } | null>(null);
  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, number[]>>({});

  const { data: user } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: authAPI.getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });
  const { data: admins = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminAPI.getAdminUsers,
    enabled: Boolean(user?.is_superadmin),
    staleTime: 5 * 60 * 1000,
  });
  const { data: ips = [] } = useQuery({
    queryKey: IP_USERS_QUERY_KEY,
    queryFn: adminAPI.getIPUsers,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
  const { data: jobRates = [] } = useQuery({
    queryKey: ["job-rates"],
    queryFn: jobRateAPI.getAll,
    staleTime: 5 * 60 * 1000,
  });
  const { data: jobTypeMappings = [] } = useQuery({
    queryKey: ["job-type-checklist-mappings"],
    queryFn: checklistAPI.getJobTypeMappings,
    enabled: Boolean(user),
  });
  const { data: checklists = [] } = useChecklists();

  const supervisors = useMemo(
    () => admins.filter((admin) => !admin.is_superadmin),
    [admins],
  );
  const verifiedIps = useMemo(() => ips.filter((ip) => ip.is_id_verified), [ips]);
  const activeSupervisorId = supervisorId || String(supervisors[0]?.id || "");
  const mappedIpIds = verifiedIps
    .filter((ip) => !user?.is_superadmin || ip.assigned_admin_ids?.includes(Number(activeSupervisorId)))
    .map((ip) => ip.id);
  const selectedIpIds = ipDraft?.supervisorId === activeSupervisorId ? ipDraft.ipIds : mappedIpIds;
  const jobTypes = useMemo(() => {
    const labels = new Map<string, string>(DEFAULT_JOB_TYPES);
    jobRates.forEach((rate) => {
      const key = normalizeJobType(rate.job_type_name);
      if (key && !labels.has(key)) labels.set(key, rate.job_type_name.trim());
    });
    return [...labels].map(([key, label]) => ({ key, label }));
  }, [jobRates]);
  const savedChecklistIds = useMemo(
    () => Object.fromEntries(jobTypeMappings.map((mapping) => [mapping.job_type, mapping.checklist_ids])),
    [jobTypeMappings],
  );

  const saveIpMapping = useMutation({
    mutationFn: () => adminAPI.assignIPsToAdmin(Number(activeSupervisorId), selectedIpIds),
    onSuccess: async () => {
      setIpDraft(null);
      await queryClient.invalidateQueries({ queryKey: IP_USERS_QUERY_KEY });
      toast.success("Supervisor IP mapping updated");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not update the IP mapping")),
  });
  const saveChecklistMapping = useMutation({
    mutationFn: ({ jobType, checklistIds }: { jobType: string; checklistIds: number[] }) =>
      checklistAPI.updateJobTypeMapping(jobType, checklistIds),
    onSuccess: async (mapping, variables) => {
      setChecklistDrafts((current) => {
        const next = { ...current };
        delete next[variables.jobType];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["job-type-checklist-mappings"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Job type mapping updated for ${mapping.updated_jobs} existing job${mapping.updated_jobs === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not update the checklist mapping")),
  });

  const checklistIds = (jobType: string) =>
    checklistDrafts[jobType] ?? savedChecklistIds[jobType] ?? [];
  const toggleChecklist = (jobType: string, checklistId: number) => {
    const current = checklistIds(jobType);
    setChecklistDrafts((drafts) => ({
      ...drafts,
      [jobType]: current.includes(checklistId)
        ? current.filter((id) => id !== checklistId)
        : [...current, checklistId],
    }));
  };
  const missingCount = jobTypes.filter(({ key }) => !savedChecklistIds[key]?.length).length;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <header>
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Link2 className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Mappings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Keep job ownership, available IPs, and required checklists explicit.
        </p>
      </header>

      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5" />{user?.is_superadmin ? "Supervisor and IP" : "Your IP mapping"}</CardTitle>
            <CardDescription>{user?.is_superadmin ? "Choose a supervisor first, then select the verified IPs they can assign to jobs." : "These are the verified IPs mapped to you and available for your jobs and roster."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>{user?.is_superadmin ? "Supervisor" : "Mapped supervisor"}</Label>
              {user?.is_superadmin ? (
                <Select value={activeSupervisorId} onValueChange={(value) => { setSupervisorId(value); setIpDraft(null); }}>
                  <SelectTrigger><SelectValue placeholder="Choose a supervisor" /></SelectTrigger>
                  <SelectContent>
                    {supervisors.map((admin) => (
                      <SelectItem key={admin.id} value={String(admin.id)}>{admin.name || admin.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">{user?.name || user?.email}</div>
              )}
              <p className="text-xs text-muted-foreground">{selectedIpIds.length} of {verifiedIps.length} verified IPs mapped</p>
            </div>
            <div className="space-y-4">
              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-3">
                {verifiedIps.map((ip) => (
                  <Label key={ip.id} htmlFor={`mapping-ip-${ip.id}`} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50">
                    <Checkbox
                      id={`mapping-ip-${ip.id}`}
                      checked={selectedIpIds.includes(ip.id)}
                      disabled={!user?.is_superadmin}
                      onCheckedChange={() => setIpDraft({
                        supervisorId: activeSupervisorId,
                        ipIds: selectedIpIds.includes(ip.id)
                          ? selectedIpIds.filter((id) => id !== ip.id)
                          : [...selectedIpIds, ip.id],
                      })}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{ip.first_name} {ip.last_name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">{ip.phone_number}</span>
                    </span>
                  </Label>
                ))}
                {!verifiedIps.length ? <p className="p-3 text-sm text-muted-foreground">No verified IP personnel available.</p> : null}
              </div>
              {user?.is_superadmin ? <Button onClick={() => saveIpMapping.mutate()} disabled={!activeSupervisorId || saveIpMapping.isPending}>
                {saveIpMapping.isPending ? "Saving…" : "Save IP mapping"}
              </Button> : null}
            </div>
          </CardContent>
        </Card>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-lg">Job type and checklist</CardTitle>
            <CardDescription className="mt-1">{user?.is_superadmin ? "Choose checklists once per job type. Existing jobs are updated and future jobs inherit the mapping." : "Read-only view of the checklist mapping inherited by each job type."}</CardDescription>
          </div>
          <Badge variant={missingCount ? "destructive" : "secondary"} className="w-fit">
            {missingCount ? `${missingCount} types need mapping` : "All types mapped"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job type</TableHead>
                  <TableHead>Checklist mapping</TableHead>
                  {user?.is_superadmin ? <TableHead className="text-right">Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobTypes.map(({ key, label }) => {
                  const selected = checklistIds(key);
                  const selectedChecklists = checklists.filter((checklist) => selected.includes(checklist.id));
                  const dirty = checklistDrafts[key] !== undefined;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell>
                        {user?.is_superadmin ? <div className="space-y-2"><DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="min-w-52 justify-between font-normal">
                              <span>{selected.length ? `${selected.length} checklist${selected.length === 1 ? "" : "s"}` : "Choose checklists"}</span>
                              <ChevronDown className="size-4 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="max-h-72 w-72 overflow-y-auto" align="start">
                            <DropdownMenuLabel>Available checklists</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {checklists.map((checklist) => (
                              <DropdownMenuCheckboxItem
                                key={checklist.id}
                                checked={selected.includes(checklist.id)}
                                onCheckedChange={() => toggleChecklist(key, checklist.id)}
                              >
                                {checklist.name}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {selectedChecklists.length ? <div className="flex flex-wrap gap-1.5">{selectedChecklists.map((checklist) => <Badge key={checklist.id} variant="secondary" className="font-normal">{checklist.name}</Badge>)}</div> : null}
                        </div> : selectedChecklists.length ? (
                          <div className="flex flex-wrap gap-1.5">{selectedChecklists.map((checklist) => <Badge key={checklist.id} variant="secondary" className="font-normal">{checklist.name}</Badge>)}</div>
                        ) : <span className="text-sm text-destructive">Not mapped</span>}
                      </TableCell>
                      {user?.is_superadmin ? <TableCell className="text-right">
                        {selected.length && !dirty ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-4" />Mapped</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => saveChecklistMapping.mutate({ jobType: key, checklistIds: selected })}
                            disabled={!selected.length || saveChecklistMapping.isPending}
                          >
                            Save
                          </Button>
                        )}
                      </TableCell> : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
