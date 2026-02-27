import React, { useState, useEffect } from 'react';
import { type Job, type JobUpdate, type Customer, type JobRate, type SOLookupResult, adminAPI, checklistAPI, jobAPI } from '@/api/services';
import { useCreateJob, useUpdateJob } from '@/hooks/useJobs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChevronDown, Trash2, Search, Loader2, CheckCircle2 } from "lucide-react"

const jobSchema = z.object({
  name: z.string().min(1, "Job Name is required"),
  customer_id: z.string().optional(),
  customer_name: z.string().min(1, "Customer Name is required"),
  customer_phone: z.string().min(10, "Phone must be at least 10 digits").regex(/^\d+$/, "Must be numbers").optional().or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  pincode: z.string().min(6, "Pincode must be 6 digits").max(6, "Pincode must be 6 digits").regex(/^\d+$/, "Must be numbers"),
  google_map_link: z.string().url("Invalid URL").optional().or(z.literal("")),
  type: z.string().min(1, "Type is required"),
  job_rate_id: z.string().optional(),
  rate: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, { message: "Rate must be a positive number" }),
  size: z.string().optional().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), { message: "Size must be a positive number" }),
  assigned_ip_id: z.string().optional(),
  start_date: z.string().min(1, "Start Date is required"),
  delivery_date: z.string().min(1, "Delivery Date is required"),
  checklist_link: z.string().url("Invalid URL").optional().or(z.literal("")),
}).superRefine((values, ctx) => {
  if (!values.start_date || !values.delivery_date) return;
  if (new Date(values.delivery_date) < new Date(values.start_date)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Delivery date must be on or after start date",
      path: ['delivery_date'],
    });
  }
});

type JobFormValues = z.infer<typeof jobSchema>;

interface IPUser {
  id: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  is_assigned: boolean;
}

interface Checklist {
  id: number;
  name: string;
  description?: string;
}

interface JobFormModalProps {
  job?: Job;
  onClose: () => void;
  onSuccess: () => void;
}

const JobFormModal: React.FC<JobFormModalProps> = ({ job, onClose, onSuccess }) => {
  const [ipUsers, setIpUsers] = useState<IPUser[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobRates, setJobRates] = useState<JobRate[]>([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<number[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [submitError, setSubmitError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [soNumber, setSoNumber] = useState('');
  const [soLoading, setSoLoading] = useState(false);
  const [soError, setSoError] = useState('');
  const [soResult, setSoResult] = useState<SOLookupResult | null>(null);

  const createJobMutation = useCreateJob();
  const updateJobMutation = useUpdateJob();

  const { register, handleSubmit, setValue, formState: { errors }, reset, watch } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      name: '',
      customer_id: '',
      customer_name: '',
      customer_phone: '',
      address: '',
      city: '',
      pincode: '',
      google_map_link: '',
      type: '',
      job_rate_id: '',
      rate: '',
      size: '',
      assigned_ip_id: '',
      start_date: '',
      delivery_date: '',
      checklist_link: '',
    }
  });

  const assignedIpId = watch('assigned_ip_id');
  const jobType = watch('type');

  useEffect(() => {
    if (jobType && jobType !== 'installation') {
      setValue('size', '1');
    }
  }, [jobType, setValue]);

  useEffect(() => {
    if (job) {
      const editCustomerId = job.customer_id?.toString() || '';
      reset({
        name: job.name || '',
        customer_id: editCustomerId,
        customer_name: job.customer_name || '',
        customer_phone: job.customer_phone || '',
        address: job.address || '',
        city: job.city || '',
        pincode: (job.pincode ?? '').toString(),
        google_map_link: job.google_map_link || '',
        type: job.type || '',
        job_rate_id: job.job_rate_id?.toString() || '',
        rate: (job.rate ?? '').toString(),
        size: job.size?.toString() || '',
        assigned_ip_id: job.assigned_ip_id?.toString() || '',
        start_date: job.start_date || '',
        delivery_date: job.delivery_date || '',
        checklist_link: job.checklist_link || '',
      });
      setSelectedCustomerId(editCustomerId);

      const ids: number[] = [];
      if (job.job_checklists && Array.isArray(job.job_checklists)) {
        ids.push(...job.job_checklists.map(jc => jc.checklist_id));
      }
      setSelectedChecklistIds(ids);
    }
  }, [job, reset]);

  useEffect(() => {
    const fetchIPUsers = async () => {
      try {
        const data = await adminAPI.getApprovedIPUsers();
        setIpUsers(data);
      } catch (error) {
        console.error('Error fetching IPUsers:', error);
      }
    };
    fetchIPUsers();
  }, []);

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const data = await checklistAPI.getAll();
        setChecklists(data);
      } catch (error) {
        console.error('Error fetching checklists:', error);
      }
    };
    fetchChecklists();
  }, []);

  useEffect(() => {
    const fetchCustomersAndRates = async () => {
      try {
        const [customersData, jobRatesData] = await Promise.all([
          jobAPI.getCustomers({ limit: 500 }),
          jobAPI.getJobRates(),
        ]);
        setCustomers(customersData || []);
        setJobRates(jobRatesData || []);
      } catch (error) {
        console.error('Error fetching customers/job rates:', error);
      }
    };
    fetchCustomersAndRates();
  }, []);

  const handleChecklistToggle = (id: number) => {
    setSelectedChecklistIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleCustomerChange = (value: string) => {
    if (value === '__new__') {
      setSelectedCustomerId('');
      setValue('customer_id', '');
      setValue('customer_name', '', { shouldValidate: true });
      setValue('customer_phone', '', { shouldValidate: true });
      setValue('address', '', { shouldValidate: true });
      setValue('city', '', { shouldValidate: true });
      setValue('pincode', '', { shouldValidate: true });
      setSoResult(null);
      setSoError('');
      setSoNumber('');
      return;
    }

    setSelectedCustomerId(value);
    setValue('customer_id', value);
    setSoResult(null);

    const selectedCustomer = customers.find((c) => c.id.toString() === value);
    if (!selectedCustomer) return;

    setValue('customer_name', selectedCustomer.name || '', { shouldValidate: true });
    setValue('customer_phone', selectedCustomer.phone_number || '', { shouldValidate: true });
    setValue('address', selectedCustomer.address || '', { shouldValidate: true });
    setValue('city', selectedCustomer.city || '', { shouldValidate: true });
    setValue('pincode', selectedCustomer.pincode ? String(selectedCustomer.pincode) : '', { shouldValidate: true });
  };

  const handleSOLookup = async () => {
    if (!soNumber.trim()) return;
    setSoLoading(true);
    setSoError('');
    setSoResult(null);
    try {
      const result = await jobAPI.lookupSalesOrder(soNumber.trim());
      setSoResult(result);
      // Auto-fill form fields from Odoo data
      setSelectedCustomerId('');
      setValue('customer_id', '');
      if (result.customer_name) setValue('customer_name', result.customer_name, { shouldValidate: true });
      if (result.phone) {
        // Clean phone: remove +91, spaces, and take last 10 digits
        const cleaned = result.phone.replace(/[\s\-+]/g, '').slice(-10);
        setValue('customer_phone', cleaned, { shouldValidate: true });
      }
      if (result.address) setValue('address', result.address, { shouldValidate: true });
      if (result.city) setValue('city', result.city, { shouldValidate: true });
      if (result.pincode) setValue('pincode', result.pincode, { shouldValidate: true });
      // Use project name or SO+PO as job name
      const jobName = result.project_name || `${result.sales_order}${result.client_order_ref ? ' - ' + result.client_order_ref : ''}`;
      setValue('name', jobName, { shouldValidate: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSoError(err.message);
      } else {
        setSoError('Failed to lookup Sales Order');
      }
    } finally {
      setSoLoading(false);
    }
  };

  const handleTypeChange = (value: string) => {
    setValue('type', value, { shouldValidate: true });

    const selectedRate = jobRates.find((rate) => rate.job_type_name === value);
    if (!selectedRate) {
      setValue('job_rate_id', '');
      return;
    }

    setValue('job_rate_id', selectedRate.id.toString());
    setValue('rate', String(selectedRate.base_rate), { shouldValidate: true });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await jobAPI.uploadFile(file);
      setValue('checklist_link', response.url, { shouldValidate: true });
    } catch (error) {
      console.error("Upload failed", error);
      setSubmitError("File upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: JobFormValues) => {
    setSubmitError('');

    try {
      const payload: any = {
        name: data.name,
        customer_id: data.customer_id ? parseInt(data.customer_id, 10) : undefined,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || undefined,
        address: data.address,
        city: data.city,
        pincode: parseInt(data.pincode, 10),
        type: data.type,
        job_rate_id: data.job_rate_id ? parseInt(data.job_rate_id, 10) : undefined,
        rate: parseFloat(data.rate),
        size: data.size ? parseInt(data.size, 10) : 0,
        assigned_ip_id: data.assigned_ip_id ? parseInt(data.assigned_ip_id, 10) : undefined,
        start_date: data.start_date,
        delivery_date: data.delivery_date,
        google_map_link: data.google_map_link || undefined,
        checklist_ids: selectedChecklistIds,
      };

      if (data.checklist_link) payload.checklist_link = data.checklist_link;

      if (job?.id) {
        await updateJobMutation.mutateAsync({ id: job.id, data: payload as JobUpdate });
      } else {
        await createJobMutation.mutateAsync(payload as Job);
      }
      onSuccess();
    } catch (err: unknown) {
      console.error('Error saving job:', err);
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Operation failed');
      }
    }
  };

  const isLoading = createJobMutation.isPending || updateJobMutation.isPending;
  const isExistingCustomerSelected = !!selectedCustomerId;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b shrink-0">
          <DialogTitle>{job ? 'Edit Job' : 'Create New Job'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="job-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* SO Lookup Section — only for new jobs */}
            {!job && (
              <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/50 p-4 space-y-3">
                <Label className="text-sm font-semibold text-blue-700">Auto-fill from Odoo Sales Order</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. S00311"
                    value={soNumber}
                    onChange={(e) => setSoNumber(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSOLookup(); } }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSOLookup}
                    disabled={soLoading || !soNumber.trim()}
                    className="shrink-0"
                  >
                    {soLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {soLoading ? 'Looking up...' : 'Lookup'}
                  </Button>
                </div>
                {soError && <p className="text-xs text-destructive">{soError}</p>}
                {soResult && (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Found: {soResult.customer_name} — fields auto-filled below
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="hidden" {...register("customer_id")} />
              <input type="hidden" {...register("job_rate_id")} />

              <div className="space-y-2">
                <Label htmlFor="name">Job Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_select">Customer</Label>
                <Select value={selectedCustomerId || '__new__'} onValueChange={handleCustomerChange}>
                  <SelectTrigger id="customer_select">
                    <SelectValue placeholder="Select existing customer or create new" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">+ Use New Customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name} {customer.phone_number ? `(${customer.phone_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  {...register("customer_name")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? 'bg-gray-100' : ''}
                  aria-invalid={!!errors.customer_name}
                />
                {errors.customer_name && <p className="text-xs text-destructive">{errors.customer_name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_phone">Customer Phone (for OTP)</Label>
                <Input
                  id="customer_phone"
                  type="tel"
                  placeholder="10-digit phone number"
                  {...register("customer_phone")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? 'bg-gray-100' : ''}
                  aria-invalid={!!errors.customer_phone}
                />
                {errors.customer_phone && <p className="text-xs text-destructive">{errors.customer_phone.message}</p>}
                <p className="text-xs text-gray-500">OTP will be sent to this number for job start/complete</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={jobType}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger aria-invalid={!!errors.type}>
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobRates.length === 0 ? (
                      <SelectItem value="loading" disabled>Loading job types...</SelectItem>
                    ) : (
                      jobRates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.job_type_name}>
                          {rate.job_type_name.replace(/_/g, ' ')}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">Rate (₹) *</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  readOnly
                  className="bg-gray-100"
                  {...register("rate")}
                  aria-invalid={!!errors.rate}
                />
                {errors.rate && <p className="text-xs text-destructive">{errors.rate.message}</p>}
                <p className="text-xs text-gray-500">Auto-filled from selected job type</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  {...register("address")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? 'bg-gray-100' : ''}
                  aria-invalid={!!errors.address}
                />
                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_map_link">Google Map Link</Label>
                <Input
                  id="google_map_link"
                  type="url"
                  placeholder="https://maps.google.com/..."
                  {...register("google_map_link")}
                  aria-invalid={!!errors.google_map_link}
                />
                {errors.google_map_link && <p className="text-xs text-destructive">{errors.google_map_link.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  {...register("city")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? 'bg-gray-100' : ''}
                  aria-invalid={!!errors.city}
                />
                {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  type="number"
                  {...register("pincode")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? 'bg-gray-100' : ''}
                  aria-invalid={!!errors.pincode}
                />
                {errors.pincode && <p className="text-xs text-destructive">{errors.pincode.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="size">Size {jobType === 'installation' ? '' : '(Auto-set to 1 for non-installation jobs)'}</Label>
                <Input
                  id="size"
                  type="number"
                  {...register("size")}
                  disabled={jobType !== 'installation'}
                  className={jobType !== 'installation' ? 'bg-gray-100 cursor-not-allowed' : ''}
                  aria-invalid={!!errors.size}
                />
                {errors.size && <p className="text-xs text-destructive">{errors.size.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_ip_id">Assigned IP</Label>
                <Select
                  value={assignedIpId}
                  onValueChange={(value) => setValue("assigned_ip_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an IP User" />
                  </SelectTrigger>
                  <SelectContent>
                    {ipUsers.map((ipUser) => (
                      <SelectItem
                        key={ipUser.id}
                        value={ipUser.id.toString()}
                        disabled={ipUser.is_assigned && ipUser.id !== job?.assigned_ip_id}
                      >
                        {ipUser.first_name} {ipUser.last_name} {ipUser.is_assigned && ipUser.id !== job?.assigned_ip_id ? '(Assigned)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_date">Delivery Date *</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  {...register("delivery_date")}
                  aria-invalid={!!errors.delivery_date}
                />
                {errors.delivery_date && <p className="text-xs text-destructive">{errors.delivery_date.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  {...register("start_date")}
                  aria-invalid={!!errors.start_date}
                />
                {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3">
                <Label>Checklists</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span>{selectedChecklistIds.length > 0 ? `${selectedChecklistIds.length} selected` : "Select Checklists"}</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto" align="start">
                    <DropdownMenuLabel>Available Checklists</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {checklists.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No checklists available</div>
                    ) : (
                      checklists.map((checklist) => (
                        <DropdownMenuCheckboxItem
                          key={checklist.id}
                          checked={selectedChecklistIds.includes(checklist.id)}
                          onCheckedChange={() => handleChecklistToggle(checklist.id)}
                        >
                          {checklist.name}
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="checklist_link">Final Drawing (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="cursor-pointer"
                  />
                  {isUploading && <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span>}
                </div>

                <input
                  type="hidden"
                  {...register("checklist_link")}
                />

                {watch('checklist_link') && (
                  <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded-md border">
                    <span className="text-sm font-medium">Uploaded:</span>
                    <a
                      href={watch('checklist_link')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline truncate max-w-[300px]"
                    >
                      View Final Drawing
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-auto"
                      onClick={() => setValue('checklist_link', '', { shouldValidate: true })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {errors.checklist_link && <p className="text-xs text-destructive">{errors.checklist_link.message}</p>}
              </div>
            </div>
          </form>
        </div>

        <DialogFooter className="p-6 border-t shrink-0">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="job-form" disabled={isLoading}>
            {isLoading ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JobFormModal;
