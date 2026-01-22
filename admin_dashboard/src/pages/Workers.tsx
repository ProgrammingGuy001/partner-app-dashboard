import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import debounce from 'lodash.debounce';
import { adminAPI, type IPUser, type AdminUser } from '@/api/services';
import {
  Users, CheckCircle, XCircle, Search, MapPin, Phone, Calendar,
  CreditCard, Building2, Award, Briefcase, RefreshCw, Eye, AlertCircle, UserPlus
} from 'lucide-react';
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
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['workers'],
    queryFn: () => adminAPI.getIPUsers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

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
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      toast.success("Worker verified successfully");
      setShowDetails(false);
      setSelectedAdminIds([]);
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || "Failed to verify worker");
    },
  });

  // Load existing admin assignments when worker is selected
  useEffect(() => {
    if (selectedWorker?.assigned_admin_ids) {
      setSelectedAdminIds(selectedWorker.assigned_admin_ids);
    } else {
      setSelectedAdminIds([]);
    }
  }, [selectedWorker]);

  // Debounced search handler
  const handleSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
    }, 300),
    []
  );

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    handleSearch(value);
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
    if (window.confirm('Are you sure you want to verify this worker?')) {
      verifyMutation.mutate({ phoneNumber, adminIds: selectedAdminIds.length > 0 ? selectedAdminIds : undefined });
    }
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
      <div className="p-6">
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
    <div className="flex flex-col gap-8 p-6 max-w-[1600px] mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Personnel</h1>
          <p className="text-muted-foreground mt-1">Manage personnel, verifications, and assignments</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Personnel"
          value={stats.total}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
        />
        <StatCard
          title="Verified"
          value={stats.verified}
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
        />
        <StatCard
          title="Unassigned"
          value={stats.unassigned}
          icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
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
          <div className="flex flex-col md:flex-row gap-4 mb-6">
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
            <div className="flex gap-2 flex-wrap">
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
            <div className="rounded-md border">
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
                      onViewDetails={() => {
                        setSelectedWorker(worker);
                        setShowDetails(true);
                      }}
                      onVerify={handleVerify}
                      isVerifying={verifyMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
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
      />
    </div>
  );
};

// Sub-components
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
}> = ({ title, value, icon, loading }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
    </CardContent>
  </Card>
);

const TableSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1 ml-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    ))}
  </div>
);

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
        <div className="w-[120px] space-y-1">
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
}> = ({ worker, open, onOpenChange, onVerify, getVerificationScore, adminUsers, selectedAdminIds, toggleAdminSelection }) => {
  if (!worker) return null;

  const score = getVerificationScore(worker);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 border-b shrink-0">
          <DialogTitle>Personnel Details</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="space-y-6">
            {/* Worker Header */}
            <div className="bg-muted/30 rounded-xl p-6 flex gap-4 items-center border">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl">
                  {worker.first_name[0]}{worker.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-bold">{worker.first_name} {worker.last_name}</h3>
                <p className="text-muted-foreground">ID: {worker.id}</p>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-3">
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
                    Select which admins can manage jobs for this personnel
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                    {adminUsers.map((admin) => (
                      <div
                        key={admin.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer min-w-0"
                        onClick={() => toggleAdminSelection(admin.id)}
                      >
                        <Checkbox
                          id={`admin-${admin.id}`}
                          checked={selectedAdminIds.includes(admin.id)}
                          onCheckedChange={() => toggleAdminSelection(admin.id)}
                          className="shrink-0"
                        />
                        <Label
                          htmlFor={`admin-${admin.id}`}
                          className="flex-1 cursor-pointer flex items-center justify-between gap-2 min-w-0"
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

            <div className="grid md:grid-cols-2 gap-6">
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
        <div key={idx} className="flex justify-between">
          <span className="text-muted-foreground">{item.label}:</span>
          <span className="font-medium font-mono">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

export default Workers;