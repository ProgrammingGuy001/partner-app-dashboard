import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, Search, AlertTriangle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { grnAPI, type GRN } from '@/api/services';
import CreateGRNModal from '@/components/CreateGRNModal';
import { StatusBadge as BaseStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiErrorMessage, sanitizeErrorText } from '@/lib/apiError';

// ─── Status badge ─────────────────────────────────────────────────────────────

const getErrorDetail = getApiErrorMessage;

const StatusBadge = ({ status, hasMissing }: { status: string; hasMissing: boolean }) => {
  if (status === 'submitted' && hasMissing) {
    return (
      <BaseStatusBadge status="danger" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Missing
      </BaseStatusBadge>
    );
  }
  if (status === 'submitted') {
    return (
      <BaseStatusBadge status="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Complete
      </BaseStatusBadge>
    );
  }
  return (
    <BaseStatusBadge status="warning" className="gap-1">
      <Clock className="h-3 w-3" /> Pending
    </BaseStatusBadge>
  );
};

// ─── GRN row ──────────────────────────────────────────────────────────────────

const GRNRow = ({ grn }: { grn: GRN }) => {
  const [expanded, setExpanded] = useState(false);
  const [received, setReceived] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();
  const assigneeName = getAssignee(grn).name;
  const retrySync = useMutation({
    mutationFn: () => grnAPI.retrySync(grn.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-grn'] });
      toast.success('GRN synchronized with Odoo');
    },
    onError: (error) => toast.error(getErrorDetail(error, 'Odoo sync retry failed')),
  });
  const submit = useMutation({
    mutationFn: () => grnAPI.submit(
      grn.id,
      grn.packages.map(pkg => ({
        package_id: pkg.id,
        is_received: received[pkg.id] ?? pkg.is_received,
      })),
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-grn'] });
      toast.success('GRN completed');
    },
    onError: (error) => toast.error(getErrorDetail(error, 'Failed to complete GRN')),
  });

  const handleSubmit = () => {
    const missingCount = grn.packages.filter(pkg => !(received[pkg.id] ?? pkg.is_received)).length;
    if (missingCount && !window.confirm(`Complete this GRN with ${missingCount} missing package${missingCount === 1 ? '' : 's'}?`)) {
      return;
    }
    submit.mutate();
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${grn.has_missing ? 'border-destructive/30' : 'border-border'}`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{grn.source_document}</span>
            {grn.odoo_picking_name && grn.odoo_picking_name !== grn.source_document && (
              <span className="text-xs text-muted-foreground">{grn.odoo_picking_name}</span>
            )}
            <StatusBadge status={grn.status} hasMissing={grn.has_missing} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assigned to: <span className="font-medium">{assigneeName}</span>
            {' · '}
            {grn.packages.length} package{grn.packages.length !== 1 ? 's' : ''}
            {' · '}
            {new Date(grn.created_at).toLocaleDateString()}
            {grn.job && (
              <>
                {' · Job: '}
                <span className="font-medium">{grn.job.name || `#${grn.job.id}`}</span>
              </>
            )}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Packages</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {grn.packages.map(pkg => {
              const isReceived = received[pkg.id] ?? pkg.is_received;
              return (
                <label key={pkg.id} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isReceived ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {grn.status === 'pending' ? (
                    <Checkbox
                      checked={isReceived}
                      onCheckedChange={checked => setReceived(current => ({ ...current, [pkg.id]: checked === true }))}
                      aria-label={`Mark ${pkg.package_name} as received`}
                    />
                  ) : isReceived ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{pkg.package_name}</span>
                </label>
              );
            })}
          </div>
          {grn.status === 'pending' && (
            <Button
              type="button"
              className="mt-3"
              disabled={submit.isPending}
              onClick={handleSubmit}
            >
              {submit.isPending ? 'Completing...' : 'Complete GRN'}
            </Button>
          )}
          {grn.submitted_at && (
            <p className="text-xs text-muted-foreground mt-3">
              Submitted: {new Date(grn.submitted_at).toLocaleString()}
            </p>
          )}
          {grn.odoo_sync_error && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <p className="font-semibold">Odoo sync failed</p>
              <p className="mt-1 break-words">{sanitizeErrorText(grn.odoo_sync_error)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-2"
                disabled={retrySync.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  retrySync.mutate();
                }}
              >
                <RefreshCw className={`h-3 w-3 ${retrySync.isPending ? 'animate-spin' : ''}`} />
                Retry Odoo sync
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type GRNGroup = {
  key: string;
  assigneeName: string;
  contact: string;
  grns: GRN[];
  latestMs: number;
};

const getAssignee = (grn: GRN) => grn.ip_user ? {
  key: `ip:${grn.ip_user.id}`,
  name: `${grn.ip_user.first_name ?? ''} ${grn.ip_user.last_name ?? ''}`.trim() || grn.ip_user.phone_number,
  contact: grn.ip_user.phone_number,
} : {
  key: `admin:${grn.created_by_admin_id}`,
  name: grn.created_by?.name || grn.created_by?.email || `Supervisor #${grn.created_by_admin_id}`,
  contact: 'GRN creator',
};

const groupGRNsByAssignee = (grns: GRN[]) => {
  const groups = new Map<string, GRNGroup>();
  for (const grn of grns) {
    const assignee = getAssignee(grn);
    const key = assignee.key;
    const createdMs = new Date(grn.created_at).getTime();
    const group = groups.get(key);
    if (group) {
      group.grns.push(grn);
      group.latestMs = Math.max(group.latestMs, createdMs);
      continue;
    }
    groups.set(key, {
      key,
      assigneeName: assignee.name,
      contact: assignee.contact,
      grns: [grn],
      latestMs: createdMs,
    });
  }
  return [...groups.values()].sort((a, b) => b.latestMs - a.latestMs);
};

const GRNAssigneeGroup = ({ group }: { group: GRNGroup }) => {
  const pendingCount = group.grns.filter(g => g.status === 'pending').length;
  const missingCount = group.grns.filter(g => g.has_missing).length;
  const packageCount = group.grns.reduce((sum, g) => sum + g.packages.length, 0);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{group.assigneeName}</p>
          <p className="text-xs text-muted-foreground">
            {group.contact} · {packageCount} package{packageCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{group.grns.length} GRN{group.grns.length !== 1 ? 's' : ''}</Badge>
          {pendingCount > 0 && <Badge variant="secondary">{pendingCount} pending</Badge>}
          {missingCount > 0 && <Badge variant="destructive">{missingCount} missing</Badge>}
        </div>
      </div>
      <div className="space-y-3 p-3 bg-background">
        {group.grns.map(g => <GRNRow key={g.id} grn={g} />)}
      </div>
    </div>
  );
};


// ─── Main page ────────────────────────────────────────────────────────────────

const SiteGRN: React.FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: grns = [], isLoading } = useQuery<GRN[]>({
    queryKey: ['site-grn'],
    queryFn: () => grnAPI.list(),
    refetchInterval: 30000,
  });

  const filtered = grns.filter(g =>
    g.source_document.toLowerCase().includes(search.toLowerCase()) ||
    (g.odoo_picking_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (g.ip_user?.first_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (g.ip_user?.last_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (g.ip_user?.phone_number ?? '').includes(search) ||
    (g.created_by?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (g.created_by?.email ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupGRNsByAssignee(filtered);

  const missingCount = grns.filter(g => g.has_missing).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Site GRN</h1>
            <p className="text-sm text-muted-foreground">Goods Receipt Notes for delivery orders</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New GRN
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: grns.length, color: 'text-foreground' },
          { label: 'Pending', value: grns.filter(g => g.status === 'pending').length, color: 'text-warning' },
          { label: 'Submitted', value: grns.filter(g => g.status === 'submitted').length, color: 'text-success' },
          { label: 'Missing', value: missingCount, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by source doc or IP..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
          <Package className="h-12 w-12 opacity-30" />
          <p>{search ? 'No GRNs match your search.' : 'No GRNs yet. Create one to get started.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => <GRNAssigneeGroup key={group.key} group={group} />)}
        </div>
      )}

      <CreateGRNModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default SiteGRN;
