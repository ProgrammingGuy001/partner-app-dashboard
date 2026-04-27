import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { adminAPI, authAPI, type IPUser, type AdminUser } from '@/api/services';
import { useIPUsers, IP_USERS_QUERY_KEY } from '@/hooks/useIPUsers';
import {
  Users, CheckCircle, XCircle, Search, MapPin, Phone, Calendar,
  CreditCard, Building2, Award, Briefcase, RefreshCw, Eye, AlertCircle, UserPlus
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
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
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const Workers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending' | 'unassigned'>('all');
  const [selectedWorker, setSelectedWorker] = useState<IPUser | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAdminIds, setSelectedAdminIds] = useState<number[]>([]);
  const [pendingVerifyPhone, setPendingVerifyPhone] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useIPUsers();
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 1000 * 60 * 5,
  });
  const canManageAssignments = Boolean(currentUser?.is_superadmin);

  // Fetch admin users for assignment dropdown
  const { data: adminUsers = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminAPI.getAdminUsers(),
    staleTime: 1000 * 60 * 5,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ phoneNumber, adminIds }: { phoneNumber: string, adminIds?: number[] }) =>
      adminAPI.verifyIPUser(phoneNumber, adminIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IP_USERS_QUERY_KEY });
      toast.success("Worker verified successfully");
      setShowDetails(false);
      setSelectedAdminIds([]);
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Failed to verify worker");
    },
  });

  const assignAdminsMutation = useMutation({
    mutationFn: ({ ipId, adminIds }: { ipId: number; adminIds: number[] }) =>
      adminAPI.assignAdminsToIP(ipId, adminIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: IP_USERS_QUERY_KEY });
      setSelectedWorker((prev) => (
        prev ? { ...prev, assigned_admin_ids: variables.adminIds } : prev
      ));
      toast.success("Admin assignments updated");
    },
    onError: (error: AxiosError<{ detail?: string; message?: string }>) => {
      toast.error(error.response?.data?.detail || error.response?.data?.message || "Failed to update assignments");
    },
  });

  const openWorkerDetails = (worker: IPUser) => {
    setSelectedWorker(worker);
    setSelectedAdminIds(worker.assigned_admin_ids || []);
    setShowDetails(true);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const workers = data || [];

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch =
      worker.first_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      worker.last_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      worker.phone_number.includes(debouncedSearchTerm) ||
      worker.city.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'verified' && worker.is_id_verified) ||
      (filterStatus === 'pending' && !worker.is_id_verified) ||
      (filterStatus === 'unassigned' && !worker.is_assigned);

    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: workers.length,
    verified: workers.filter(w => w.is_id_verified).length,
    pending: workers.filter(w => !w.is_id_verified).length,
    unassigned: workers.filter(w => !w.is_assigned).length,
  };

  const getVerificationScore = (worker: IPUser) => {
    let score = 0;
    if (worker.is_id_verified) score++;
    if (worker.is_pan_verified) score++;
    if (worker.is_bank_details_verified) score++;
    if (worker.is_verified) score++;
    return score;
  };

  const handleVerify = (phoneNumber: string) => {
    setPendingVerifyPhone(phoneNumber);
  };

  const confirmVerify = () => {
    if (!pendingVerifyPhone) return;
    verifyMutation.mutate({
      phoneNumber: pendingVerifyPhone,
      adminIds: canManageAssignments && selectedAdminIds.length > 0 ? selectedAdminIds : undefined,
    });
    setPendingVerifyPhone(null);
  };

  const handleSaveAssignments = () => {
    if (!selectedWorker?.id) return;
    assignAdminsMutation.mutate({ ipId: selectedWorker.id, adminIds: selectedAdminIds });
  };

  const toggleAdminSelection = (adminId: number) => {
    setSelectedAdminIds(prev =>
      prev.includes(adminId)
        ? prev.filter(id => id !== adminId)
        : [...prev, adminId]
    );
  };

  if (error) {
    return (
      <div className="p-3 sm:p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to load workers</h3>
            <p className="text-muted-foreground mb-4">
              {(error as AxiosError).message || 'An error occurred'}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 sm:gap-6 lg:gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Personnel</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Manage personnel, verifications, and assignments</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Personnel"
          value={stats.total}
          icon={<Users className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Verified"
          value={stats.verified}
          icon={<CheckCircle className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<AlertCircle className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Unassigned"
          value={stats.unassigned}
          icon={<Briefcase className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Personnel List</CardTitle>
          <CardDescription>Manage verified and pending workers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:gap-4 lg:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or city..."
                className="pl-8"
                value={searchTerm}
                onChange={onSearchChange}
                aria-label="Search personnel"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {(['all', 'verified', 'pending', 'unassigned'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={filterStatus === filter ? "default" : "outline"}
                  onClick={() => setFilterStatus(filter)}
                  className="capitalize"
                  disabled={isLoading}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No personnel found</p>
            </div>
          ) : (
            <>
            <div className="rounded-md border md:hidden">
              <div className="divide-y">
                {filteredWorkers.map((worker) => (
                  <WorkerMobileCard
                    key={worker.id}
                    worker={worker}
                    getVerificationScore={getVerificationScore}
                    onViewDetails={() => openWorkerDetails(worker)}
                    onVerify={handleVerify}
                    isVerifying={verifyMutation.isPending}
                  />
                ))}
              </div>
            </div>

            <div className="hidden rounded-md border md:block md:overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Admins</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => (
                    <WorkerRow
                      key={worker.id}
                      worker={worker}
                      getVerificationScore={getVerificationScore}
                      onViewDetails={() => openWorkerDetails(worker)}
                      onVerify={handleVerify}
                      isVerifying={verifyMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      <DetailsModal
        worker={selectedWorker}
        open={showDetails}
        onOpenChange={setShowDetails}
        onVerify={handleVerify}
        getVerificationScore={getVerificationScore}
        adminUsers={adminUsers}
        selectedAdminIds={selectedAdminIds}
        toggleAdminSelection={toggleAdminSelection}
        canManageAssignments={canManageAssignments}
        onSaveAssignments={handleSaveAssignments}
        isSavingAssignments={assignAdminsMutation.isPending}
      />

      {/* Verify Confirmation Dialog */}
      <Dialog open={pendingVerifyPhone !== null} onOpenChange={(open) => !open && setPendingVerifyPhone(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify Personnel</DialogTitle>
            <DialogDescription>
              Are you sure you want to verify this worker? This will grant them full access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingVerifyPhone(null)}>
              Cancel
            </Button>
            <Button onClick={confirmVerify} disabled={verifyMutation.isPending}>
              {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Removed: inline StatCard moved to shared @/components/StatCard

const TableSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center justify-between rounded-lg border p-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="ml-4 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3 sm:w-1/4" />
          <Skeleton className="h-3 w-1/2 sm:w-1/3" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    ))}
  </div>
);

const WorkerMobileCard: React.FC<{
  worker: IPUser;
  getVerificationScore: (worker: IPUser) => number;
  onViewDetails: () => void;
  onVerify: (phoneNumber: string) => void;
  isVerifying: boolean;
}> = ({ worker, getVerificationScore, onViewDetails, onVerify, isVerifying }) => {
  const score = getVerificationScore(worker);

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-muted font-medium text-muted-foreground">
              {worker.first_name[0]}{worker.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {worker.first_name} {worker.last_name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">ID: {worker.id}</p>
          </div>
        </div>
        <Badge variant={worker.is_assigned ? "secondary" : "outline"} className="shrink-0">
          {worker.is_assigned ? 'Assigned' : 'Unassigned'}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" />
          <span>{worker.phone_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          <span>{worker.city}, {worker.pincode}</span>
        </div>
        <div className="flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5" />
          <span>{worker.assigned_admin_ids?.length || 0} admin(s)</span>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Verification progress</span>
          <span>{score}/4</span>
        </div>
        <Progress value={(score / 4) * 100} className="h-2" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onViewDetails}>
          <Eye className="mr-2 h-4 w-4" />
          Details
        </Button>
        {!worker.is_id_verified ? (
          <Button
            size="sm"
            onClick={() => onVerify(worker.phone_number)}
            disabled={isVerifying}
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled>
            Verified
          </Button>
        )}
      </div>
    </article>
  );
};

const WorkerRow: React.FC<{
  worker: IPUser;
  getVerificationScore: (worker: IPUser) => number;
  onViewDetails: () => void;
  onVerify: (phoneNumber: string) => void;
  isVerifying: boolean;
}> = ({ worker, getVerificationScore, onViewDetails, onVerify, isVerifying }) => {
  const score = getVerificationScore(worker);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              {worker.first_name[0]}{worker.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium leading-none">{worker.first_name} {worker.last_name}</p>
            <p className="text-xs text-muted-foreground mt-1">ID: {worker.id}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {worker.phone_number}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {worker.city}, {worker.pincode}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={worker.is_assigned ? "secondary" : "outline"}>
          {worker.is_assigned ? 'Assigned' : 'Unassigned'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm text-muted-foreground">
          {worker.assigned_admin_ids?.length || 0} admin(s)
        </div>
      </TableCell>
      <TableCell>
        <div className="w-full max-w-[120px] space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{score}/4</span>
          </div>
          <Progress value={(score / 4) * 100} className="h-2" />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onViewDetails}
            aria-label="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!worker.is_id_verified && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onVerify(worker.phone_number)}
              disabled={isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

const DetailsModal: React.FC<{
  worker: IPUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (phoneNumber: string) => void;
  getVerificationScore: (worker: IPUser) => number;
  adminUsers: AdminUser[];
  selectedAdminIds: number[];
  toggleAdminSelection: (adminId: number) => void;
  canManageAssignments: boolean;
  onSaveAssignments: () => void;
  isSavingAssignments: boolean;
}> = ({
  worker,
  open,
  onOpenChange,
  onVerify,
  getVerificationScore,
  adminUsers,
  selectedAdminIds,
  toggleAdminSelection,
  canManageAssignments,
  onSaveAssignments,
  isSavingAssignments,
}) => {
  if (!worker) return null;

  const score = getVerificationScore(worker);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-4 sm:p-6">
          <DialogTitle>Personnel Details</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-6">
            {/* Worker Header */}
            <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4 sm:p-6">
              <Avatar className="h-14 w-14 shrink-0 sm:h-16 sm:w-16">
                <AvatarFallback className="text-xl">
                  {worker.first_name[0]}{worker.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold sm:text-xl">{worker.first_name} {worker.last_name}</h3>
                <p className="text-muted-foreground">ID: {worker.id}</p>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label="Phone" value={worker.phone_number} icon={<Phone />} />
              <InfoField label="Location" value={`${worker.city}, ${worker.pincode}`} icon={<MapPin />} />
              <InfoField label="Registered" value={new Date(worker.registered_at).toLocaleDateString()} icon={<Calendar />} />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Status
                </p>
                <Badge variant={worker.is_assigned ? "secondary" : "outline"}>
                  {worker.is_assigned ? 'Assigned' : 'Unassigned'}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Verification Status */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Award className="h-4 w-4" /> Verification Status ({score}/4)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'ID Verified', value: worker.is_id_verified },
                  { label: 'Account Verified', value: worker.is_verified },
                  { label: 'PAN Verified', value: worker.is_pan_verified },
                  { label: 'Bank Verified', value: worker.is_bank_details_verified },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded border flex items-center justify-between">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.value ?
                      <CheckCircle className="h-4 w-4 text-primary" /> :
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Assignment Section */}
            {adminUsers.length > 0 && (
              <>
                <Separator />
                <div className="overflow-hidden">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                    <UserPlus className="h-4 w-4" /> Assign Admins to this Personnel
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {canManageAssignments
                      ? 'Select which admins can manage jobs for this personnel'
                      : 'Only superadmins can update these assignments'}
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                    {adminUsers.map((admin) => (
                      <div
                        key={admin.id}
                        className={`flex items-center gap-3 p-2 rounded min-w-0 ${canManageAssignments ? 'hover:bg-muted/50' : 'opacity-70'}`}
                      >
                        <Checkbox
                          id={`admin-${admin.id}`}
                          checked={selectedAdminIds.includes(admin.id)}
                          disabled={!canManageAssignments}
                          onCheckedChange={() => {
                            if (canManageAssignments) {
                              toggleAdminSelection(admin.id);
                            }
                          }}
                          className="shrink-0"
                        />
                        <Label
                          htmlFor={`admin-${admin.id}`}
                          className={`flex-1 flex items-center justify-between gap-2 min-w-0 ${canManageAssignments ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <span className="truncate text-sm">{admin.email}</span>
                          {admin.is_superadmin && (
                            <Badge variant="secondary" className="text-xs shrink-0">Super</Badge>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedAdminIds.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedAdminIds.length} admin(s) selected
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Financial Details */}
            {(worker.pan_number || worker.account_number) && <Separator />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {worker.pan_number && (
                <DetailSection
                  title="PAN Details"
                  icon={<CreditCard className="h-4 w-4" />}
                  items={[
                    { label: 'Number', value: worker.pan_number },
                    ...(worker.pan_name ? [{ label: 'Name', value: worker.pan_name }] : []),
                  ]}
                />
              )}

              {worker.account_number && (
                <DetailSection
                  title="Bank Details"
                  icon={<Building2 className="h-4 w-4" />}
                  items={[
                    { label: 'Account', value: worker.account_number },
                    { label: 'IFSC', value: worker.ifsc_code || '' },
                  ]}
                />
              )}
            </div>

            {/* Verify Button */}
            {!worker.is_id_verified && (
              <div className="pt-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => onVerify(worker.phone_number)}
                >
                  Verify Personnel {selectedAdminIds.length > 0 && `& Assign ${selectedAdminIds.length} Admin(s)`}
                </Button>
              </div>
            )}
            {worker.is_id_verified && canManageAssignments && (
              <div className="pt-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={onSaveAssignments}
                  disabled={isSavingAssignments}
                >
                  {isSavingAssignments ? 'Saving Assignments...' : 'Save Admin Assignments'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const InfoField: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      {icon} {label}
    </p>
    <p className="font-medium text-sm">{value}</p>
  </div>
);

const DetailSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; value: string }>;
}> = ({ title, icon, items }) => (
  <div>
    <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
      {icon} {title}
    </h4>
    <div className="bg-muted/30 border rounded-lg p-3 space-y-2 text-sm">
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col gap-1 sm:flex-row sm:justify-between">
          <span className="text-muted-foreground">{item.label}:</span>
          <span className="break-all font-mono font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

export default Workers;
