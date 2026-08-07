import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authAPI, devAPI, type DevIPUser, type DevUser } from '@/api/services';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarPlus, Loader2, ShieldAlert, UserPlus, Users } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/apiError';
import { useJobs } from '@/hooks/useJobs';

const DEV_USERS_KEY = ['dev', 'users'];
const DEV_IPS_KEY = ['dev', 'ip-users'];
const DEV_AUDIT_KEY = ['dev', 'audit-log'];

const errorMessage = getApiErrorMessage;

const ipLabel = (user: DevIPUser) =>
  [[user.first_name, user.last_name].filter(Boolean).join(' '), user.phone_number]
    .filter(Boolean).join(' · ');

const Dev: React.FC = () => {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // The backend gates every /dev route; this only avoids rendering a broken page.
  if (!currentUser?.is_dev) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="text-sm text-muted-foreground">This page is restricted to dev accounts.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Dev</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Manage accounts and IP profiles, and record attendance somebody could not mark themselves.
        </p>
      </header>

      <CreateAccountCard />
      <AccountsCard currentUserId={currentUser.id} />
      <IPProfilesCard />
      <BackfillAttendanceCard />
      <AuditLogCard />
    </div>
  );
};

const CreateAccountCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => devAPI.createUser({
      email: email.trim().toLowerCase(),
      name: name.trim() || undefined,
      password,
      is_superadmin: isSuperadmin,
    }),
    onSuccess: (user) => {
      toast.success(`Created ${user.email}`);
      setEmail(''); setName(''); setPassword(''); setIsSuperadmin(false);
      queryClient.invalidateQueries({ queryKey: DEV_USERS_KEY });
      queryClient.invalidateQueries({ queryKey: DEV_AUDIT_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to create account')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 8) {
      toast.error('Enter an email and a password of at least 8 characters');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UserPlus className="h-5 w-5" /> Create account
        </CardTitle>
        <CardDescription>New accounts are active and approved immediately.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dev-email">Email</Label>
            <Input
              id="dev-email" type="email" value={email} required
              onChange={(e) => setEmail(e.target.value)} placeholder="admin@modula.in"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-name">Name</Label>
            <Input
              id="dev-name" value={name} maxLength={255}
              onChange={(e) => setName(e.target.value)} placeholder="Full name (optional)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-password">Password</Label>
            <Input
              id="dev-password" type="password" value={password} required minLength={8}
              onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
            />
          </div>
          <div className="flex items-end gap-3 pb-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dev-superadmin"
                checked={isSuperadmin}
                onCheckedChange={(checked) => setIsSuperadmin(checked === true)}
              />
              <Label htmlFor="dev-superadmin" className="font-normal">Superadmin</Label>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                : 'Create account'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const AccountsCard: React.FC<{ currentUserId: number }> = ({ currentUserId }) => {
  const queryClient = useQueryClient();
  const [resetTarget, setResetTarget] = useState<DevUser | null>(null);
  const [editTarget, setEditTarget] = useState<DevUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: DEV_USERS_KEY,
    queryFn: () => devAPI.listUsers(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: DEV_USERS_KEY });
    queryClient.invalidateQueries({ queryKey: DEV_AUDIT_KEY });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof devAPI.updateUser>[1] }) =>
      devAPI.updateUser(id, data),
    onSuccess: () => { toast.success('Account updated'); invalidate(); },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update account')),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => devAPI.revokeSessions(id),
    onSuccess: (result) => { toast.success(`Sessions revoked for ${result.email}`); invalidate(); },
    onError: (error) => toast.error(errorMessage(error, 'Failed to revoke sessions')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Accounts</CardTitle>
        <CardDescription>Every admin account, including inactive and unapproved ones.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const busy = updateMutation.isPending || revokeMutation.isPending;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="text-muted-foreground">{user.name || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.is_dev && <Badge>Dev</Badge>}
                          <Badge variant={user.is_superadmin ? 'default' : 'secondary'}>
                            {user.is_superadmin ? 'Superadmin' : 'Admin'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={user.isActive ? 'secondary' : 'destructive'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {!user.isApproved && <Badge variant="outline">Unapproved</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditTarget(user)}>
                            Edit profile
                          </Button>
                          <Button
                            size="sm" variant="outline" disabled={busy || (isSelf && user.isActive)}
                            onClick={() => updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } })}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          {!user.isApproved && (
                            <Button
                              size="sm" variant="outline" disabled={busy}
                              onClick={() => updateMutation.mutate({ id: user.id, data: { isApproved: true } })}
                            >
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm" variant="outline" disabled={busy}
                            onClick={() => updateMutation.mutate({ id: user.id, data: { is_superadmin: !user.is_superadmin } })}
                          >
                            {user.is_superadmin ? 'Demote' : 'Promote'}
                          </Button>
                          <Button
                            size="sm" variant="outline" disabled={busy}
                            onClick={() => revokeMutation.mutate(user.id)}
                          >
                            Revoke sessions
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setResetTarget(user)}>
                            Reset password
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <EditAccountDialog target={editTarget} onClose={() => setEditTarget(null)} onDone={invalidate} />
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} onDone={invalidate} />
    </Card>
  );
};

const EditAccountDialog: React.FC<{
  target: DevUser | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ target, onClose, onDone }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Reset the fields whenever a different account is opened.
  const [loadedId, setLoadedId] = useState<number | null>(null);
  if (target && target.id !== loadedId) {
    setLoadedId(target.id);
    setName(target.name ?? '');
    setEmail(target.email ?? '');
  }

  const emailChanged = Boolean(target && email.trim().toLowerCase() !== (target.email ?? ''));

  const saveMutation = useMutation({
    mutationFn: () => devAPI.updateUser(target!.id, {
      name: name.trim() || null,
      ...(emailChanged ? { email: email.trim().toLowerCase() } : {}),
    }),
    onSuccess: (user) => {
      toast.success(`Updated ${user.email}`);
      onClose();
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update account')),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {target?.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dev-edit-name">Name</Label>
            <Input
              id="dev-edit-name" value={name} maxLength={255}
              onChange={(e) => setName(e.target.value)} placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-edit-email">Email</Label>
            <Input
              id="dev-edit-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="admin@modula.in"
            />
            {emailChanged && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Changing the email is changing the login. It signs the account out everywhere.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ResetPasswordDialog: React.FC<{
  target: DevUser | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ target, onClose, onDone }) => {
  const [password, setPassword] = useState('');

  const resetMutation = useMutation({
    mutationFn: () => authAPI.resetPassword(target!.email!, password),
    onSuccess: () => {
      toast.success(`Password reset for ${target?.email}`);
      setPassword('');
      onClose();
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to reset password')),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) { setPassword(''); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password for {target?.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dev-reset-password">New password</Label>
          <Input
            id="dev-reset-password" type="password" value={password} minLength={8}
            onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
          />
          <p className="text-xs text-muted-foreground">This signs the account out of every device.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={password.length < 8 || resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
            {resetMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</>
              : 'Reset password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const IPProfilesCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<DevIPUser | null>(null);

  const { data: ipUsers, isLoading } = useQuery({
    queryKey: DEV_IPS_KEY,
    queryFn: () => devAPI.listIPUsers(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Users className="h-5 w-5" /> IP profiles
        </CardTitle>
        <CardDescription>
          Correct name, phone and location. PAN, bank and education stay behind the verification flow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : ipUsers?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ipUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.phone_number}</TableCell>
                    <TableCell>
                      {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.city || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{user.pincode ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={user.is_id_verified ? 'secondary' : 'outline'}>
                          {user.is_id_verified ? 'Verified' : 'Unverified'}
                        </Badge>
                        {user.is_internal && <Badge variant="outline">Internal</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditTarget(user)}>
                        Edit profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No IP users yet.</p>
        )}
      </CardContent>

      <EditIPDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onDone={() => queryClient.invalidateQueries({ queryKey: DEV_IPS_KEY })}
      />
    </Card>
  );
};

const EditIPDialog: React.FC<{
  target: DevIPUser | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ target, onClose, onDone }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ first_name: '', last_name: '', phone_number: '', city: '', pincode: '' });
  const [isInternal, setIsInternal] = useState(false);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  if (target && target.id !== loadedId) {
    setLoadedId(target.id);
    setForm({
      first_name: target.first_name ?? '',
      last_name: target.last_name ?? '',
      phone_number: target.phone_number,
      city: target.city ?? '',
      pincode: target.pincode == null ? '' : String(target.pincode),
    });
    setIsInternal(target.is_internal);
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: () => devAPI.updateIPUser(target!.id, {
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      phone_number: form.phone_number.trim(),
      city: form.city.trim() || null,
      pincode: form.pincode.trim() ? Number(form.pincode) : null,
      is_internal: isInternal,
    }),
    onSuccess: (user) => {
      toast.success(`Updated ${user.phone_number}`);
      onClose();
      onDone();
      queryClient.invalidateQueries({ queryKey: DEV_AUDIT_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to update IP profile')),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit IP {target?.phone_number}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dev-ip-first">First name</Label>
            <Input id="dev-ip-first" value={form.first_name} maxLength={255} onChange={set('first_name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-ip-last">Last name</Label>
            <Input id="dev-ip-last" value={form.last_name} maxLength={255} onChange={set('last_name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-ip-phone">Phone</Label>
            <Input
              id="dev-ip-phone" value={form.phone_number} onChange={set('phone_number')}
              placeholder="10 digits, or 12 with the 91 prefix"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-ip-city">City</Label>
            <Input id="dev-ip-city" value={form.city} maxLength={255} onChange={set('city')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-ip-pincode">Pincode</Label>
            <Input
              id="dev-ip-pincode" inputMode="numeric" value={form.pincode}
              onChange={set('pincode')} placeholder="6 digits"
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox
              id="dev-ip-internal" checked={isInternal}
              onCheckedChange={(checked) => setIsInternal(checked === true)}
            />
            <Label htmlFor="dev-ip-internal" className="font-normal">Internal</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BackfillAttendanceCard: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [subjectType, setSubjectType] = useState<'ip' | 'admin'>('ip');
  const [subjectId, setSubjectId] = useState('');
  const [jobId, setJobId] = useState('');
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out'>('check_in');
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [reason, setReason] = useState('');

  const { data: ipUsers } = useQuery({ queryKey: DEV_IPS_KEY, queryFn: () => devAPI.listIPUsers() });
  const { data: admins } = useQuery({ queryKey: DEV_USERS_KEY, queryFn: () => devAPI.listUsers() });
  const { data: jobs } = useJobs({ limit: 200 });

  // Only a job the chosen IP is actually assigned to can carry their attendance.
  const jobsForIP = useMemo(() => {
    if (subjectType !== 'ip' || !subjectId) return [];
    return (jobs ?? []).filter((job) => String(job.assigned_ip_id) === subjectId);
  }, [jobs, subjectId, subjectType]);

  // Superadmins never mark attendance, so they are not offerable subjects.
  const supervisors = useMemo(
    () => (admins ?? []).filter((user) => !user.is_superadmin),
    [admins],
  );

  const reset = () => { setSubjectId(''); setJobId(''); setReason(''); };

  const backfillMutation = useMutation({
    mutationFn: () => devAPI.backfillAttendance({
      subject_type: subjectType,
      subject_id: Number(subjectId),
      attendance_date: attendanceDate,
      reason: reason.trim(),
      ...(subjectType === 'ip' ? { job_id: Number(jobId), attendance_type: attendanceType } : {}),
    }),
    onSuccess: (result) => {
      toast.success(`Attendance recorded for ${result.record.subject_label}`);
      reset();
      queryClient.invalidateQueries({ queryKey: DEV_AUDIT_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to record attendance')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return toast.error('Pick who the attendance is for');
    if (subjectType === 'ip' && !jobId) return toast.error('Pick the job the attendance belongs to');
    if (reason.trim().length < 3) return toast.error('Give a reason — it goes in the audit log');
    backfillMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CalendarPlus className="h-5 w-5" /> Record missing attendance
        </CardTitle>
        <CardDescription>
          For a day somebody genuinely worked but could not mark. This skips the check-in window,
          the GPS fix and the photo, so the reason is recorded in the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Who</Label>
            <Select
              value={subjectType}
              onValueChange={(value) => {
                setSubjectType(value as 'ip' | 'admin');
                reset();
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ip">IP</SelectItem>
                <SelectItem value="admin">Supervisor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{subjectType === 'ip' ? 'IP' : 'Supervisor'}</Label>
            <Select value={subjectId} onValueChange={(value) => { setSubjectId(value); setJobId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${subjectType === 'ip' ? 'an IP' : 'a supervisor'}`} />
              </SelectTrigger>
              <SelectContent>
                {subjectType === 'ip'
                  ? ipUsers?.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>{ipLabel(user)}</SelectItem>
                    ))
                  : supervisors.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name ? `${user.name} · ${user.email}` : user.email}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {subjectType === 'ip' && (
            <>
              <div className="space-y-2">
                <Label>Job</Label>
                <Select value={jobId} onValueChange={setJobId} disabled={!subjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={subjectId ? 'Select a job' : 'Pick an IP first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {jobsForIP.map((job) => (
                      <SelectItem key={job.id} value={String(job.id)}>
                        #{job.id} · {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subjectId && jobsForIP.length === 0 && (
                  <p className="text-xs text-muted-foreground">No jobs assigned to this IP.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={attendanceType}
                  onValueChange={(value) => setAttendanceType(value as 'check_in' | 'check_out')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check_in">Check in</SelectItem>
                    <SelectItem value="check_out">Check out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="dev-attendance-date">Date</Label>
            <Input
              id="dev-attendance-date" type="date" value={attendanceDate} max={today}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="dev-attendance-reason">Reason</Label>
            <Textarea
              id="dev-attendance-reason" value={reason} maxLength={500} rows={2}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why the attendance could not be marked on the day"
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={backfillMutation.isPending}>
              {backfillMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</>
                : 'Record attendance'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const AuditLogCard: React.FC = () => {
  const { data: entries, isLoading } = useQuery({
    queryKey: DEV_AUDIT_KEY,
    queryFn: () => devAPI.getAuditLog(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Audit log</CardTitle>
        <CardDescription>Most recent privileged actions.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : entries?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{entry.actor_email || '—'}</TableCell>
                    <TableCell className="font-medium">{entry.action}</TableCell>
                    <TableCell>{entry.target_email || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.detail || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default Dev;
