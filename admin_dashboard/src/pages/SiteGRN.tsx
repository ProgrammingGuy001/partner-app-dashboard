import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Plus, Search, AlertTriangle, CheckCircle2,
  Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { grnAPI, adminAPI, type GRN, type OdooPickingInfo } from '@/api/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

// ─── Status badge ─────────────────────────────────────────────────────────────

const getErrorDetail = (err: unknown, fallback: string) => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
};

const StatusBadge = ({ status, hasMissing }: { status: string; hasMissing: boolean }) => {
  if (status === 'submitted' && hasMissing) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Missing
      </Badge>
    );
  }
  if (status === 'submitted') {
    return (
      <Badge className="gap-1 bg-green-600 text-white">
        <CheckCircle2 className="h-3 w-3" /> Complete
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
};

// ─── GRN row ──────────────────────────────────────────────────────────────────

const GRNRow = ({ grn }: { grn: GRN }) => {
  const [expanded, setExpanded] = useState(false);
  const ipName = getIPName(grn);

  return (
    <div className={`border rounded-lg overflow-hidden ${grn.has_missing ? 'border-red-300 dark:border-red-700' : 'border-border'}`}>
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
            Assigned to: <span className="font-medium">{ipName}</span>
            {' · '}
            {grn.packages.length} package{grn.packages.length !== 1 ? 's' : ''}
            {' · '}
            {new Date(grn.created_at).toLocaleDateString()}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Packages</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {grn.packages.map(pkg => (
              <div key={pkg.id} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${pkg.is_received ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200'}`}>
                {pkg.is_received
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 shrink-0" />
                }
                <span>{pkg.package_name}</span>
              </div>
            ))}
          </div>
          {grn.submitted_at && (
            <p className="text-xs text-muted-foreground mt-3">
              Submitted: {new Date(grn.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

type GRNGroup = {
  key: string;
  ipName: string;
  phone: string;
  grns: GRN[];
  latestMs: number;
};

const getIPName = (grn: GRN) =>
  grn.ip_user
    ? `${grn.ip_user.first_name ?? ''} ${grn.ip_user.last_name ?? ''}`.trim() || grn.ip_user.phone_number
    : `IP #${grn.ip_user_id}`;

const groupGRNsByIP = (grns: GRN[]) => {
  const groups = new Map<string, GRNGroup>();
  for (const grn of grns) {
    const key = String(grn.ip_user_id);
    const createdMs = new Date(grn.created_at).getTime();
    const group = groups.get(key);
    if (group) {
      group.grns.push(grn);
      group.latestMs = Math.max(group.latestMs, createdMs);
      continue;
    }
    groups.set(key, {
      key,
      ipName: getIPName(grn),
      phone: grn.ip_user?.phone_number ?? `IP #${grn.ip_user_id}`,
      grns: [grn],
      latestMs: createdMs,
    });
  }
  return [...groups.values()].sort((a, b) => b.latestMs - a.latestMs);
};

const IPGRNGroup = ({ group }: { group: GRNGroup }) => {
  const pendingCount = group.grns.filter(g => g.status === 'pending').length;
  const missingCount = group.grns.filter(g => g.has_missing).length;
  const packageCount = group.grns.reduce((sum, g) => sum + g.packages.length, 0);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{group.ipName}</p>
          <p className="text-xs text-muted-foreground">
            {group.phone} · {packageCount} package{packageCount !== 1 ? 's' : ''}
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

// ─── Create GRN modal ─────────────────────────────────────────────────────────

const CreateGRNModal = ({
  open, onClose
}: { open: boolean; onClose: () => void }) => {
  const qc = useQueryClient();
  const [sourceDoc, setSourceDoc] = useState('');
  const [ipUserId, setIpUserId] = useState('');
  const [pickings, setPickings] = useState<OdooPickingInfo[]>([]);
  const [selectedPickingIds, setSelectedPickingIds] = useState<number[]>([]);
  const [lookupError, setLookupError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const { data: ipUsers = [] } = useQuery({
    queryKey: ['ip-users', 'approved'],
    queryFn: () => adminAPI.getApprovedIPUsers(),
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: () => grnAPI.create({
      source_document: sourceDoc.trim(),
      ip_user_id: Number(ipUserId),
      picking_ids: selectedPickingIds,
    }),
    onSuccess: (created) => {
      toast.success(created.length === 1 ? 'GRN created successfully' : `${created.length} GRNs created successfully`);
      qc.invalidateQueries({ queryKey: ['site-grn'] });
      handleClose();
    },
    onError: (err: unknown) => {
      toast.error(getErrorDetail(err, 'Failed to create GRN'));
    },
  });

  const handleLookup = async () => {
    if (!sourceDoc.trim()) return;
    setLookingUp(true);
    setLookupError('');
    setPickings([]);
    setSelectedPickingIds([]);
    try {
      const info = await grnAPI.lookup(sourceDoc.trim());
      setPickings(info);
      setSelectedPickingIds(info.filter(picking => picking.packages.length > 0).map(picking => picking.picking_id));
    } catch (err: unknown) {
      setLookupError(getErrorDetail(err, 'Delivery order not found'));
    } finally {
      setLookingUp(false);
    }
  };

  const handleClose = () => {
    setSourceDoc('');
    setIpUserId('');
    setPickings([]);
    setSelectedPickingIds([]);
    setLookupError('');
    onClose();
  };

  const togglePicking = (pickingId: number, checked: boolean) => {
    setSelectedPickingIds(prev => {
      if (checked) return prev.includes(pickingId) ? prev : [...prev, pickingId];
      return prev.filter(id => id !== pickingId);
    });
  };

  const selectablePickings = pickings.filter(picking => picking.packages.length > 0);
  const canCreate = selectedPickingIds.length > 0 && ipUserId && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Site GRN</DialogTitle>
          <DialogDescription>
            Enter the delivery order reference and assign an IP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Source document lookup */}
          <div className="space-y-1.5">
            <Label>Delivery Order / Source Document</Label>
            <div className="flex gap-2">
              <Input
                placeholder="WH/OUT/00001, WH/RO/00001 or SO-XXXXX"
                value={sourceDoc}
                onChange={e => {
                  setSourceDoc(e.target.value);
                  setPickings([]);
                  setSelectedPickingIds([]);
                  setLookupError('');
                }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
              />
              <Button variant="outline" onClick={handleLookup} disabled={!sourceDoc.trim() || lookingUp}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {lookupError && <p className="text-xs text-red-500">{lookupError}</p>}
          </div>

          {/* Picking previews — only selected delivery orders will become assigned GRNs */}
          {pickings.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Select the delivery GRN(s) to assign to the IP.
                </p>
                {selectablePickings.length > 1 && (
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setSelectedPickingIds(selectablePickings.map(p => p.picking_id))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                      onClick={() => setSelectedPickingIds([])}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              {pickings.map(picking => (
                <div
                  key={picking.picking_id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    selectedPickingIds.includes(picking.picking_id) ? 'border-primary bg-primary/5' : 'bg-muted/40'
                  } ${picking.packages.length === 0 ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedPickingIds.includes(picking.picking_id)}
                      disabled={picking.packages.length === 0}
                      onCheckedChange={checked => togglePicking(picking.picking_id, checked === true)}
                      className="mt-0.5"
                      aria-label={`Select ${picking.picking_name}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{picking.picking_name}</span>
                        <span className="text-xs text-muted-foreground">{picking.origin}</span>
                      </div>
                      {picking.partner_name && (
                        <p className="text-xs text-muted-foreground">Partner: {picking.partner_name}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">{picking.packages.length} package(s):</p>
                    <div className="flex flex-wrap gap-1">
                      {picking.packages.length === 0 && (
                        <span className="text-xs text-amber-600">No packages — this delivery cannot be assigned</span>
                      )}
                      {picking.packages.map((p, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{p.package_name}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* IP selection */}
          <div className="space-y-1.5">
            <Label>Assign IP</Label>
            <Select value={ipUserId} onValueChange={setIpUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select IP user..." />
              </SelectTrigger>
              <SelectContent>
                {ipUsers.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.first_name} {u.last_name} · {u.phone_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!canCreate}>
              {createMutation.isPending ? 'Creating...' : `Create ${selectedPickingIds.length || ''} selected GRN${selectedPickingIds.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    (g.ip_user?.phone_number ?? '').includes(search)
  );
  const grouped = groupGRNsByIP(filtered);

  const missingCount = grns.filter(g => g.has_missing).length;

  return (
    <div className="space-y-6">
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
          { label: 'Pending', value: grns.filter(g => g.status === 'pending').length, color: 'text-amber-600' },
          { label: 'Submitted', value: grns.filter(g => g.status === 'submitted').length, color: 'text-green-600' },
          { label: 'Missing', value: missingCount, color: 'text-red-600' },
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
          {grouped.map(group => <IPGRNGroup key={group.key} group={group} />)}
        </div>
      )}

      <CreateGRNModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default SiteGRN;
