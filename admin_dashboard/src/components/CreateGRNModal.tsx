import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { grnAPI, adminAPI, type OdooPickingInfo } from '@/api/services';
import { useJobs } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiErrorMessage as getErrorDetail } from '@/lib/apiError';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

/** Shared by the Site GRN page and the job actions modal. Passing lockedJobId pins the
 *  GRN to that job and hides the job picker. */
const CreateGRNModal = ({
  open, onClose, lockedJobId, defaultSourceDoc = '',
}: {
  open: boolean;
  onClose: () => void;
  lockedJobId?: number;
  defaultSourceDoc?: string;
}) => {
  const qc = useQueryClient();
  const [sourceDoc, setSourceDoc] = useState(defaultSourceDoc);
  const [ipUserId, setIpUserId] = useState('');
  const [jobId, setJobId] = useState(lockedJobId ? String(lockedJobId) : '');
  const [pickings, setPickings] = useState<OdooPickingInfo[]>([]);
  const [selectedPickingIds, setSelectedPickingIds] = useState<number[]>([]);
  const [lookupError, setLookupError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const { data: ipUsers = [] } = useQuery({
    queryKey: ['ip-users', 'approved'],
    queryFn: () => adminAPI.getApprovedIPUsers(),
    staleTime: 1000 * 60 * 5,
  });
  // Only the free-standing picker needs the job list.
  const { data: jobs = [] } = useJobs({ limit: 1000 }, { enabled: !lockedJobId });
  const grnJobs = jobs.filter(job => job.type === 'grn');

  const createMutation = useMutation({
    mutationFn: () => grnAPI.create({
      source_document: sourceDoc.trim(),
      ip_user_id: ipUserId === 'self' ? null : Number(ipUserId),
      assign_to_self: ipUserId === 'self',
      job_id: jobId ? Number(jobId) : null,
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
    setSourceDoc(defaultSourceDoc);
    setIpUserId('');
    setJobId(lockedJobId ? String(lockedJobId) : '');
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
            Find an open GRN by SO, delivery order, or repair order and choose who will receive it.
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
            {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
            <p className="text-xs text-muted-foreground">
              An SO lookup also includes open GRNs raised through repair orders linked to that SO.
            </p>
          </div>

          {/* Picking previews — only selected delivery orders will become assigned GRNs */}
          {pickings.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Select the delivery GRN(s) to assign.
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
                        <span className="text-xs text-warning">No packages — this delivery cannot be assigned</span>
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

          {/* Optional job link — hidden when the caller already pinned the job */}
          {!lockedJobId && (
          <div className="space-y-1.5">
            <Label>GRN job (optional)</Label>
            <Select value={jobId || 'none'} onValueChange={value => setJobId(value === 'none' ? '' : value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No job</SelectItem>
                {grnJobs.map(j => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.name || `Job ${j.id}`} {j.type ? `· ${j.type.replace('_', ' ')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You can link this GRN later. A GRN job can be completed only once its linked GRN is submitted.
            </p>
          </div>
          )}

          {/* Receiver selection */}
          <div className="space-y-1.5">
            <Label>Assign receiver</Label>
            <Select value={ipUserId} onValueChange={setIpUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select receiver..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Myself (GRN creator)</SelectItem>
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

export default CreateGRNModal;
