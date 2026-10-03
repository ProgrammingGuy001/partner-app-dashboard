import { useState } from 'react';
import { toast } from 'sonner';
import { devAPI, type DevUser } from '@/api/services';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/apiError';

export default function CityOpsMapping({ user, users }: { user: DevUser; users: DevUser[] }) {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setIds((await devAPI.getSupervisors(user.id)).supervisor_ids); setOpen(true); }
    catch (e) { toast.error(getApiErrorMessage(e, 'Could not load mappings')); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try { await devAPI.setSupervisors(user.id, ids); setOpen(false); toast.success('Supervisor mappings saved'); }
    catch (e) { toast.error(getApiErrorMessage(e, 'Could not save mappings')); }
    finally { setBusy(false); }
  };
  return <><Button size="sm" variant="outline" disabled={busy} onClick={load}>Map supervisors</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Supervisors for {user.name || user.email}</DialogTitle><DialogDescription>City Ops can manage only these supervisors and their work.</DialogDescription></DialogHeader>
      <div className="max-h-80 space-y-3 overflow-y-auto">{users.filter(u => !u.is_dev && !u.is_superadmin && !u.is_city_ops && u.isActive && u.isApproved).map(u =>
        <label key={u.id} className="flex items-center gap-2"><Checkbox checked={ids.includes(u.id)} onCheckedChange={checked => setIds(checked ? [...ids, u.id] : ids.filter(id => id !== u.id))} />{u.name || u.email}</label>)}</div>
      <DialogFooter><Button disabled={busy} onClick={save}>Save mappings</Button></DialogFooter>
    </DialogContent></Dialog></>;
}


