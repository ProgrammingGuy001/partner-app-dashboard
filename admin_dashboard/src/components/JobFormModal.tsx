import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type Job,
  type JobUpdate,
  type SOLookupResult,
  adminAPI,
  jobAPI,
  rosterAPI,
} from "@/api/services";
import {
  useCreateJob,
  useCreateJobRate,
  useJobRates,
  useUpdateJob,
} from "@/hooks/useJobs";
import { useApprovedIPUsers } from "@/hooks/useIPUsers";
import { useCustomers } from "@/hooks/useCustomers";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trash2,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import LocationPicker, {
  type ResolvedAddress,
} from "@/components/LocationPicker";
import { getApiErrorMessage } from "@/lib/apiError";

const DRAWING_REQUIRED_TYPES = new Set(["site_validation", "installation"]);
// Mirrors app/schemas/job.py SLOT_EXCLUDED_JOB_TYPES: every other type must name a slot.
const SLOTLESS_TYPES = new Set(["installation", "grn"]);

const jobSchema = z
  .object({
    customer_id: z.string().optional(),
    customer_name: z.string().min(1, "Customer Name is required"),
    customer_phone: z
      .string()
      .optional()
      // Odoo and older customer rows carry "+91 98408 17991"; count digits only, and
      // strip the rest on submit.
      .refine((val) => !val || val.replace(/\D/g, "").length >= 10, {
        message: "Phone must be at least 10 digits",
      }),
    address_line_1: z.string().min(1, "Address Line 1 is required"),
    address_line_2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z
      .string()
      .min(6, "Pincode must be 6 digits")
      .max(6, "Pincode must be 6 digits")
      .regex(/^\d+$/, "Must be numbers"),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    geofence_radius: z.number().nullable().optional(),
    // Empty means "no rate card, type the type and rate by hand".
    job_rate_id: z.string().optional(),
    // Jobs raised from the CRM webhook arrive without one, so it stays editable after creation.
    sales_order: z.string().optional(),
    type: z.string().min(1, "Type is required"),
    // Superadmin-only, like incentive: admins never see the field, and a superadmin can
    // price the job later by editing it.
    rate: z
      .string()
      .optional()
      .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
        message: "Rate must be a positive number",
      }),
    // Superadmin-only; the server discards it from anyone else.
    incentive: z
      .string()
      .optional()
      .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
        message: "Incentive must be a positive number",
      }),
    size: z
      .string()
      .optional()
      .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
        message: "Size must be a positive number",
      }),
    // Regular admins choose their mapped IP here; superadmins choose the supervisor.
    assignee: z.string().optional(),
    ip_assignee: z.string().optional(),
    start_date: z.string().min(1, "Start Date is required"),
    delivery_date: z.string().min(1, "Delivery Date is required"),
    drawing_document_link: z.string().optional(),
    slot_start: z.string().optional(),
    slot_end: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    // Ahead of the date guard below, which returns early.
    const slotless = SLOTLESS_TYPES.has((values.type || "").trim().toLowerCase());
    if (!slotless && !values.slot_start && !values.slot_end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An attendance slot is required for this job type",
        path: ["slot_start"],
      });
    } else if (Boolean(values.slot_start) !== Boolean(values.slot_end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set both a slot start and a slot end, or neither",
        path: [values.slot_start ? "slot_end" : "slot_start"],
      });
    } else if (
      values.slot_start &&
      values.slot_end &&
      values.slot_end <= values.slot_start
    ) {
      // Zero-padded HH:MM, so a plain string compare is ordered correctly.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slot end must be after slot start",
        path: ["slot_end"],
      });
    }
    if (!values.start_date || !values.delivery_date) return;
    if (new Date(values.delivery_date) < new Date(values.start_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery date must be on or after start date",
        path: ["delivery_date"],
      });
    }
    if (
      DRAWING_REQUIRED_TYPES.has((values.type || "").trim().toLowerCase()) &&
      !values.drawing_document_link
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A drawing is required upfront for this job type",
        path: ["drawing_document_link"],
      });
    }
  });

type JobFormValues = z.infer<typeof jobSchema>;

interface JobFormModalProps {
  job?: Job;
  onClose: () => void;
  onSuccess: () => void;
  isSuperadmin?: boolean;
}

const JobFormModal: React.FC<JobFormModalProps> = ({
  job,
  onClose,
  onSuccess,
  isSuperadmin = false,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [submitError, setSubmitError] = useState("");
  const [isUploadingDrawing, setIsUploadingDrawing] = useState(false);
  const [soLoading, setSoLoading] = useState(false);
  const [soError, setSoError] = useState("");
  const [soResult, setSoResult] = useState<SOLookupResult | null>(null);
  const [soLookup, setSoLookup] = useState("");

  const [showNewRate, setShowNewRate] = useState(false);
  const [newRate, setNewRate] = useState({
    job_type_name: "",
    location: "",
    base_rate: "",
    description: "",
  });

  const createJobMutation = useCreateJob();
  const updateJobMutation = useUpdateJob();
  const { data: jobRates = [] } = useJobRates();
  const createJobRateMutation = useCreateJobRate();

  // Use React Query hooks instead of direct API calls - enables caching and deduplication
  const { data: ipUsers = [] } = useApprovedIPUsers();
  const { data: customers = [] } = useCustomers();
  const { data: admins } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminAPI.getAdminUsers(),
    staleTime: 1000 * 60 * 5,
  });
  const rosterDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: roster } = useQuery({
    queryKey: ["roster", "slot-settings"],
    queryFn: () => rosterAPI.get({ date_from: rosterDate, date_to: rosterDate }),
    staleTime: 1000 * 60 * 5,
  });
  // Superadmins never run a site, so they aren't offerable as the assignee.
  const supervisors = useMemo(
    () => (admins ?? []).filter((a) => !a.is_superadmin),
    [admins],
  );

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
    reset,
    watch,
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      customer_id: "",
      customer_name: "",
      customer_phone: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      pincode: "",
      latitude: null,
      longitude: null,
      geofence_radius: 100,
      job_rate_id: "",
      sales_order: "",
      type: "",
      rate: "",
      incentive: "",
      size: "",
      assignee: "",
      ip_assignee: "",
      start_date: "",
      delivery_date: "",
      drawing_document_link: "",
      slot_start: "",
      slot_end: "",
    },
  });

  const assignee = watch("assignee");
  const ipAssignee = watch("ip_assignee");
  const selectedSupervisorId = (assignee || "").startsWith("admin:")
    ? Number(assignee?.slice(6))
    : null;
  const mappedIpUsers = selectedSupervisorId
    ? ipUsers.filter((ipUser) =>
        ipUser.assigned_admin_ids?.includes(selectedSupervisorId),
      )
    : [];
  const jobType = watch("type");
  const slotStart = watch("slot_start");
  const slotEnd = watch("slot_end");
  const latitude = watch("latitude");
  const longitude = watch("longitude");
  const geofenceRadius = watch("geofence_radius");
  const normalizedJobType = (jobType || "").trim().toLowerCase();
  const jobRateId = watch("job_rate_id");
  const selectedRateCard = useMemo(
    () => jobRates.find((r) => r.id.toString() === jobRateId),
    [jobRates, jobRateId],
  );
  const isOutsideGlobalSlot = Boolean(
    normalizedJobType !== "installation" &&
      slotStart &&
      slotEnd &&
      slotEnd > slotStart &&
      roster?.slots?.length &&
      !roster.slots.some(
        (slot) =>
          slotStart >= slot.start_time.slice(0, 5) &&
          slotEnd <= slot.end_time.slice(0, 5),
      ),
  );
  const globalSlotSummary = roster?.slots
    ?.map((slot) => `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`)
    .join(", ");

  // A picked card is the source of truth for type and rate; mirror it into the
  // inputs so what's submitted matches what the server will stamp on.
  useEffect(() => {
    if (!selectedRateCard) return;
    setValue("type", selectedRateCard.job_type_name, { shouldValidate: true });
    setValue("rate", selectedRateCard.base_rate.toString(), {
      shouldValidate: true,
    });
  }, [selectedRateCard, setValue]);

  useEffect(() => {
    if (jobType && normalizedJobType !== "installation") {
      setValue("size", "1");
    }
    if (!DRAWING_REQUIRED_TYPES.has(normalizedJobType)) {
      setValue("drawing_document_link", "", { shouldValidate: true });
    }
    // Installation keeps the 10:30 cutoff and GRN is not a site visit: neither is slotted.
    if (SLOTLESS_TYPES.has(normalizedJobType)) {
      setValue("slot_start", "", { shouldValidate: true });
      setValue("slot_end", "", { shouldValidate: true });
    }
  }, [jobType, normalizedJobType, setValue]);

  useEffect(() => {
    if (job) {
      const editCustomerId = job.customer_id?.toString() || "";
      reset({
        customer_id: editCustomerId,
        customer_name: job.customer_name || "",
        customer_phone: job.customer_phone || "",
        address_line_1: job.address_line_1 || "",
        address_line_2: job.address_line_2 || "",
        city: job.city || "",
        state: job.state || "",
        pincode: (job.pincode ?? "").toString(),
        latitude: job.latitude ?? null,
        longitude: job.longitude ?? null,
        geofence_radius: job.geofence_radius ?? 100,
        job_rate_id: job.job_rate_id?.toString() || "",
        sales_order: job.sales_order || "",
        type: job.type || "",
        rate: (job.rate ?? "").toString(),
        incentive: (job.incentive ?? "").toString(),
        size: job.size?.toString() || "",
        assignee: isSuperadmin
          ? (job.user_id && supervisors.some((admin) => admin.id === job.user_id)
              ? `admin:${job.user_id}`
              : "")
          : (job.assigned_ip_id ? `ip:${job.assigned_ip_id}` : ""),
        ip_assignee: isSuperadmin && job.assigned_ip_id
          ? `ip:${job.assigned_ip_id}`
          : "",
        start_date: job.start_date || "",
        delivery_date: job.delivery_date || "",
        drawing_document_link: job.drawing_document_link || "",
        // The API sends HH:MM:SS; <input type="time"> wants HH:MM.
        slot_start: job.slot_start?.slice(0, 5) || "",
        slot_end: job.slot_end?.slice(0, 5) || "",
      });
      setSelectedCustomerId(editCustomerId);
    }
  }, [isSuperadmin, job, reset, supervisors]);

  const handleCustomerChange = (value: string) => {
    if (value === "__new__") {
      setSelectedCustomerId("");
      setValue("customer_id", "");
      setValue("customer_name", "", { shouldValidate: true });
      setValue("customer_phone", "", { shouldValidate: true });
      setValue("address_line_1", "", { shouldValidate: true });
      setValue("address_line_2", "", { shouldValidate: true });
      setValue("city", "", { shouldValidate: true });
      setValue("state", "", { shouldValidate: true });
      setValue("pincode", "", { shouldValidate: true });
      setSoResult(null);
      setSoError("");
      return;
    }

    setSelectedCustomerId(value);
    setValue("customer_id", value);
    setSoResult(null);

    const selectedCustomer = customers.find((c) => c.id.toString() === value);
    if (!selectedCustomer) return;

    setValue("customer_name", selectedCustomer.name || "", {
      shouldValidate: true,
    });
    setValue("customer_phone", selectedCustomer.phone_number || "", {
      shouldValidate: true,
    });
    setValue("address_line_1", selectedCustomer.address_line_1 || "", {
      shouldValidate: true,
    });
    setValue("address_line_2", selectedCustomer.address_line_2 || "", {
      shouldValidate: true,
    });
    setValue("city", selectedCustomer.city || "", { shouldValidate: true });
    setValue("state", selectedCustomer.state || "", { shouldValidate: true });
    setValue(
      "pincode",
      selectedCustomer.pincode ? String(selectedCustomer.pincode) : "",
      { shouldValidate: true },
    );
  };

  const handleSOLookup = async () => {
    const soNumber = soLookup.trim();
    if (!soNumber) return;
    setSoLoading(true);
    setSoError("");
    setSoResult(null);
    try {
      const result = await jobAPI.lookupSalesOrder(soNumber);
      setSoResult(result);
      setValue("sales_order", soNumber, { shouldValidate: true });
      // Auto-fill form fields from Odoo data
      setSelectedCustomerId("");
      setValue("customer_id", "");
      if (result.customer_name)
        setValue("customer_name", result.customer_name, {
          shouldValidate: true,
        });
      if (result.phone) {
        // Clean phone: remove +91, spaces, and take last 10 digits
        const cleaned = result.phone.replace(/[\s\-+]/g, "").slice(-10);
        setValue("customer_phone", cleaned, { shouldValidate: true });
      }
      if (result.address_line_1)
        setValue("address_line_1", result.address_line_1, {
          shouldValidate: true,
        });
      if (result.address_line_2)
        setValue("address_line_2", result.address_line_2, {
          shouldValidate: true,
        });
      if (result.city) setValue("city", result.city, { shouldValidate: true });
      if (result.state)
        setValue("state", result.state, { shouldValidate: true });
      if (result.pincode)
        setValue("pincode", result.pincode, { shouldValidate: true });
    } catch (err: unknown) {
      setSoError(getApiErrorMessage(err, "Could not find that Sales Order"));
    } finally {
      setSoLoading(false);
    }
  };

  // Reverse-geocoded address from a pasted Maps link. It only fills gaps — whatever
  // the SO lookup, the customer record, or the admin already typed always wins.
  const fillEmptyAddress = (address: ResolvedAddress) => {
    (
      ["address_line_1", "address_line_2", "city", "state", "pincode"] as const
    ).forEach((field) => {
      const value = address[field];
      if (value && !getValues(field)?.trim()) {
        setValue(field, value, { shouldValidate: true });
      }
    });
  };

  const handleDrawingUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDrawing(true);
    try {
      const response = await jobAPI.uploadFile(file);
      setValue("drawing_document_link", response.url, { shouldValidate: true });
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, "Drawing upload failed"));
    } finally {
      setIsUploadingDrawing(false);
    }
  };

  const onSubmit = async (data: JobFormValues) => {
    setSubmitError("");
    if (!data.assignee) {
      setSubmitError(`Select ${isSuperadmin ? "a supervisor" : "an Installation Partner"}`);
      return;
    }
    try {
      const payload: JobUpdate = {
        customer_id: data.customer_id
          ? parseInt(data.customer_id, 10)
          : undefined,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone?.replace(/\D/g, "") || undefined,
        address_line_1: data.address_line_1,
        address_line_2: data.address_line_2 || undefined,
        city: data.city,
        state: data.state,
        pincode: parseInt(data.pincode, 10),
        type: data.type,
        // Explicit null, not undefined: clearing the SO has to reach the server.
        sales_order: data.sales_order?.trim() || null,
        // Left unset when blank so an unpriced job stays unpriced instead of becoming 0.
        rate: data.rate ? parseFloat(data.rate) : undefined,
        size: data.size ? parseInt(data.size, 10) : undefined,
        assigned_ip_id: isSuperadmin
          ? (data.ip_assignee?.startsWith("ip:")
              ? parseInt(data.ip_assignee.slice(3), 10)
              : null)
          : (data.assignee.startsWith("ip:")
              ? parseInt(data.assignee.slice(3), 10)
              : undefined),
        admin_assigned: isSuperadmin && data.assignee.startsWith("admin:")
          ? parseInt(data.assignee.slice(6), 10)
          : undefined,
        start_date: data.start_date,
        delivery_date: data.delivery_date,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        geofence_radius: data.geofence_radius ?? undefined,
        // Explicit null, not undefined: clearing the slot has to reach the server.
        slot_start: data.slot_start || null,
        slot_end: data.slot_end || null,
      };

      // A picked card wins server-side, but don't send a stale hand-typed rate with it.
      if (data.job_rate_id)
        payload.job_rate_id = parseInt(data.job_rate_id, 10);
      // The server drops this for non-superadmins; the field isn't rendered for them either.
      if (isSuperadmin && data.incentive)
        payload.incentive = parseFloat(data.incentive);
      if (data.drawing_document_link)
        payload.drawing_document_link = data.drawing_document_link;

      if (job?.id) {
        await updateJobMutation.mutateAsync({ id: job.id, data: payload });
      } else {
        await createJobMutation.mutateAsync(payload as Omit<Job, "id">);
      }
      onSuccess();
    } catch (err: unknown) {
      setSubmitError(
        getApiErrorMessage(
          err,
          "Could not save the job. Check the form and try again.",
        ),
      );
    }
  };

  const isLoading = createJobMutation.isPending || updateJobMutation.isPending;
  const isExistingCustomerSelected = !!selectedCustomerId;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b p-4 sm:p-6">
          <DialogTitle>{job ? "Edit Job" : "Create New Job"}</DialogTitle>
          <DialogDescription>
            {job
              ? "Update the customer, schedule and assignment for this job."
              : "Set up a customer, schedule and assignment for a new job."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <form
            id="job-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* Saved on the job: GRN creation prefills its source document from it, and
                jobs raised by the CRM webhook arrive without one. */}
            <div className="space-y-2">
              <Label htmlFor="sales_order" className="text-sm font-semibold">
                Sales Order (SO) number
              </Label>
              <Input
                id="sales_order"
                placeholder="e.g. S00311"
                {...register("sales_order")}
              />
            </div>

            {/* Its own box and its own state: this one searches Odoo, it is not the
                field above. A hit fills the field above along with the customer. */}
            <div className="rounded-lg border border-dashed border-info/30 bg-info/10 p-4 space-y-3">
                <Label htmlFor="so_lookup" className="text-sm font-semibold text-info">
                  Look up a Sales Order in Odoo
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="so_lookup"
                    placeholder="e.g. S00311"
                    value={soLookup}
                    onChange={(e) => setSoLookup(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSOLookup();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSOLookup}
                    disabled={soLoading || !soLookup.trim()}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    {soLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {soLoading ? "Looking up..." : "Lookup"}
                  </Button>
                </div>
                {soError && (
                  <p className="text-xs text-destructive">{soError}</p>
                )}
                {soResult && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Found: {soResult.customer_name} — fields auto-filled below
                  </div>
                )}
              </div>

            {!job && !isSuperadmin && (
              <Alert>
                <AlertDescription>
                  This job will be sent to the superadmin for approval. It will
                  become an active created job only after approval.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="hidden" {...register("customer_id")} />

              <div className="space-y-2">
                <Label htmlFor="customer_select">Customer</Label>
                <Select
                  value={selectedCustomerId || "__new__"}
                  onValueChange={handleCustomerChange}
                >
                  <SelectTrigger id="customer_select">
                    <SelectValue placeholder="Select existing customer or create new" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">+ Use New Customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem
                        key={customer.id}
                        value={customer.id.toString()}
                      >
                        {customer.name}{" "}
                        {customer.phone_number
                          ? `(${customer.phone_number})`
                          : ""}
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
                  className={isExistingCustomerSelected ? "bg-muted" : ""}
                  aria-invalid={!!errors.customer_name}
                />
                {errors.customer_name && (
                  <p className="text-xs text-destructive">
                    {errors.customer_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_phone">Customer Phone (for OTP)</Label>
                <Input
                  id="customer_phone"
                  type="tel"
                  placeholder="10-digit phone number"
                  {...register("customer_phone")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? "bg-muted" : ""}
                  aria-invalid={!!errors.customer_phone}
                />
                {errors.customer_phone && (
                  <p className="text-xs text-destructive">
                    {errors.customer_phone.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  OTP will be sent to this number for job start/complete
                </p>
              </div>

              {/* Commercials are superadmin-only: the card writes both type and rate. */}
              {isSuperadmin && (
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="job_rate_id">Rate Card</Label>
                  {isSuperadmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewRate((v) => !v)}
                    >
                      {showNewRate ? "Cancel" : "+ New rate card"}
                    </Button>
                  )}
                </div>
                <Select
                  value={jobRateId || "__none__"}
                  onValueChange={(value) =>
                    setValue("job_rate_id", value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger id="job_rate_id">
                    <SelectValue placeholder="Pick a rate card, or enter type and rate manually" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      Enter type and rate manually
                    </SelectItem>
                    {jobRates.map((card) => (
                      <SelectItem key={card.id} value={card.id.toString()}>
                        {card.job_type_name}
                        {card.location ? ` — ${card.location}` : ""} (₹
                        {card.base_rate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRateCard?.description && (
                  <p className="text-xs text-muted-foreground">
                    {selectedRateCard.description}
                  </p>
                )}

                {showNewRate && (
                  <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                    <Input
                      placeholder="Job type (e.g. installation)"
                      value={newRate.job_type_name}
                      onChange={(e) =>
                        setNewRate({
                          ...newRate,
                          job_type_name: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Location (e.g. Pune)"
                      value={newRate.location}
                      onChange={(e) =>
                        setNewRate({ ...newRate, location: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Base rate"
                      value={newRate.base_rate}
                      onChange={(e) =>
                        setNewRate({ ...newRate, base_rate: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newRate.description}
                      onChange={(e) =>
                        setNewRate({ ...newRate, description: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="sm:col-span-2"
                      disabled={
                        !newRate.job_type_name ||
                        !newRate.base_rate ||
                        createJobRateMutation.isPending
                      }
                      onClick={async () => {
                        const card = await createJobRateMutation.mutateAsync({
                          job_type_name: newRate.job_type_name.trim(),
                          location: newRate.location.trim(),
                          base_rate: parseFloat(newRate.base_rate),
                          description: newRate.description.trim() || null,
                        });
                        setValue("job_rate_id", card.id.toString());
                        setNewRate({
                          job_type_name: "",
                          location: "",
                          base_rate: "",
                          description: "",
                        });
                        setShowNewRate(false);
                      }}
                    >
                      {createJobRateMutation.isPending
                        ? "Saving…"
                        : "Save rate card"}
                    </Button>
                  </div>
                )}
              </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={jobType || ""}
                  disabled={!!selectedRateCard}
                  onValueChange={(value) =>
                    setValue("type", value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="type" aria-invalid={!!errors.type}>
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="site_validation">
                      Site Validation
                    </SelectItem>
                    <SelectItem value="measurement">
                      Site Measurement
                    </SelectItem>
                    <SelectItem value="site_readiness">
                      Site Readiness
                    </SelectItem>
                    <SelectItem value="grn">GRN</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-xs text-destructive">
                    {errors.type.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Checklists are assigned automatically from this job type.
                </p>
              </div>

              {normalizedJobType && !SLOTLESS_TYPES.has(normalizedJobType) && (
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Service slot
                    <span className="font-normal text-xs text-destructive"> *</span>
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="slot_start"
                      type="time"
                      aria-label="Slot start"
                      aria-invalid={!!errors.slot_start}
                      {...register("slot_start")}
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      id="slot_end"
                      type="time"
                      aria-label="Slot end"
                      aria-invalid={!!errors.slot_end}
                      {...register("slot_end")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Check-in opens at the slot start and closes 30 minutes
                    later. Installation and GRN jobs use the 10:30 AM cutoff
                    instead.
                  </p>
                  {(errors.slot_start || errors.slot_end) && (
                    <p className="text-xs text-destructive">
                      {errors.slot_start?.message || errors.slot_end?.message}
                    </p>
                  )}
                  {isOutsideGlobalSlot && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p>
                        This service time is outside the global roster shifts
                        {globalSlotSummary ? ` (${globalSlotSummary})` : ""}. Attendance
                        will use this job time; the roster will place it in the nearest
                        global slot.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {DRAWING_REQUIRED_TYPES.has(normalizedJobType) && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="drawing-upload">
                    Drawing *{" "}
                    <span className="font-normal text-xs text-muted-foreground">
                      (required upfront for site validation and installation
                      jobs)
                    </span>
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="drawing-upload"
                      type="file"
                      onChange={handleDrawingUpload}
                      disabled={isUploadingDrawing}
                      className="cursor-pointer"
                      aria-label="Upload drawing (PDF, JPG, PNG or DOCX)"
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                    />
                    {isUploadingDrawing && (
                      <span className="text-sm text-muted-foreground animate-pulse">
                        Uploading...
                      </span>
                    )}
                  </div>

                  <input type="hidden" {...register("drawing_document_link")} />

                  {watch("drawing_document_link") && (
                    <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted p-2">
                      <span className="text-sm font-medium">Uploaded:</span>
                      <a
                        href={watch("drawing_document_link")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-info hover:underline truncate max-w-full sm:max-w-[300px]"
                      >
                        View Drawing
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-auto"
                        onClick={() =>
                          setValue("drawing_document_link", "", {
                            shouldValidate: true,
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {errors.drawing_document_link && (
                    <p className="text-xs text-destructive">
                      {errors.drawing_document_link.message}
                    </p>
                  )}
                </div>
              )}

              {isSuperadmin && (
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate per Unit</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    min="0"
                    readOnly={!!selectedRateCard}
                    placeholder="Enter agreed job rate"
                    {...register("rate")}
                    aria-invalid={!!errors.rate}
                  />
                  {selectedRateCard && (
                    <p className="text-xs text-muted-foreground">
                      Set by the rate card. Clear it to type a rate.
                    </p>
                  )}
                  {errors.rate && (
                    <p className="text-xs text-destructive">
                      {errors.rate.message}
                    </p>
                  )}
                </div>
              )}

              {isSuperadmin && (
                <div className="space-y-2">
                  <Label htmlFor="incentive">Incentive</Label>
                  <Input
                    id="incentive"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register("incentive")}
                    aria-invalid={!!errors.incentive}
                  />
                  {errors.incentive && (
                    <p className="text-xs text-destructive">
                      {errors.incentive.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="address_line_1">Address Line 1 *</Label>
                <Input
                  id="address_line_1"
                  {...register("address_line_1")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? "bg-muted" : ""}
                  aria-invalid={!!errors.address_line_1}
                  placeholder="Street, Building, Apartment"
                />
                {errors.address_line_1 && (
                  <p className="text-xs text-destructive">
                    {errors.address_line_1.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line_2">Address Line 2</Label>
                <Input
                  id="address_line_2"
                  {...register("address_line_2")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? "bg-muted" : ""}
                  aria-invalid={!!errors.address_line_2}
                  placeholder="Landmark, Area (Optional)"
                />
                {errors.address_line_2 && (
                  <p className="text-xs text-destructive">
                    {errors.address_line_2.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <LocationPicker
                  value={{
                    latitude: latitude ?? null,
                    longitude: longitude ?? null,
                    geofenceRadius: geofenceRadius ?? null,
                  }}
                  onChange={(v) => {
                    setValue("latitude", v.latitude, { shouldValidate: true });
                    setValue("longitude", v.longitude, {
                      shouldValidate: true,
                    });
                    setValue("geofence_radius", v.geofenceRadius, {
                      shouldValidate: true,
                    });
                  }}
                  onAddress={fillEmptyAddress}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  {...register("city")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? "bg-muted" : ""}
                  aria-invalid={!!errors.city}
                />
                {errors.city && (
                  <p className="text-xs text-destructive">
                    {errors.city.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  {...register("state")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? "bg-muted" : ""}
                  aria-invalid={!!errors.state}
                  placeholder="State"
                />
                {errors.state && (
                  <p className="text-xs text-destructive">
                    {errors.state.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  type="number"
                  {...register("pincode")}
                  readOnly={isExistingCustomerSelected}
                  className={isExistingCustomerSelected ? "bg-muted" : ""}
                  aria-invalid={!!errors.pincode}
                />
                {errors.pincode && (
                  <p className="text-xs text-destructive">
                    {errors.pincode.message}
                  </p>
                )}
              </div>

              {isSuperadmin && (
                <div className="space-y-2">
                  <Label htmlFor="size">
                    Size{" "}
                    {normalizedJobType === "installation"
                      ? ""
                      : "(Auto-set to 1 for non-installation jobs)"}
                  </Label>
                  <Input
                    id="size"
                    type="number"
                    {...register("size")}
                    disabled={normalizedJobType !== "installation"}
                    className={
                      normalizedJobType !== "installation"
                        ? "bg-muted cursor-not-allowed"
                        : ""
                    }
                    aria-invalid={!!errors.size}
                  />
                  {errors.size && (
                    <p className="text-xs text-destructive">
                      {errors.size.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="assignee">
                  {isSuperadmin ? "Supervisor" : "Installation Partner"} *
                </Label>
                <Select
                  value={assignee}
                  onValueChange={(value) => {
                    setValue("assignee", value);
                    if (isSuperadmin) setValue("ip_assignee", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${isSuperadmin ? "a supervisor" : "a mapped IP"}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperadmin
                      ? supervisors.map((admin) => (
                          <SelectItem
                            key={`admin:${admin.id}`}
                            value={`admin:${admin.id}`}
                          >
                            {admin.name || admin.email}
                          </SelectItem>
                        ))
                      : ipUsers.map((ipUser) => (
                          <SelectItem
                            key={`ip:${ipUser.id}`}
                            value={`ip:${ipUser.id}`}
                          >
                            {ipUser.first_name} {ipUser.last_name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
                {!isSuperadmin && !ipUsers.length && (
                  <p className="text-xs text-warning">No IP is mapped to you. Ask a superadmin to add the mapping.</p>
                )}
                {!isSuperadmin && ipUsers.length ? (
                  <p className="text-xs text-muted-foreground">Date and slot availability is checked when you save.</p>
                ) : null}
              </div>

              {isSuperadmin && (
                <div className="space-y-2">
                  <Label htmlFor="ip-assignee">Installation Partner <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Select
                    value={ipAssignee || ""}
                    onValueChange={(value) => setValue("ip_assignee", value)}
                    disabled={!(assignee || "").startsWith("admin:")}
                  >
                    <SelectTrigger id="ip-assignee">
                      <SelectValue placeholder={assignee ? "Select a mapped IP" : "Choose a supervisor first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">No IP assigned</SelectItem>
                      {!mappedIpUsers.length ? (
                        <SelectItem value="no-mapped-ip" disabled>
                          No mapped IP available
                        </SelectItem>
                      ) : null}
                      {mappedIpUsers.map((ipUser) => (
                        <SelectItem
                          key={`ip:${ipUser.id}`}
                          value={`ip:${ipUser.id}`}
                        >
                          {ipUser.first_name} {ipUser.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Only verified, mapped IPs are shown. Date and slot availability is checked when you save.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="delivery_date">Delivery Date *</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  {...register("delivery_date")}
                  aria-invalid={!!errors.delivery_date}
                />
                {errors.delivery_date && (
                  <p className="text-xs text-destructive">
                    {errors.delivery_date.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  {...register("start_date")}
                  aria-invalid={!!errors.start_date}
                />
                {errors.start_date && (
                  <p className="text-xs text-destructive">
                    {errors.start_date.message}
                  </p>
                )}
              </div>

            </div>
          </form>
        </div>

        <DialogFooter className="shrink-0 border-t p-4 sm:p-6">
          <Button
            variant="outline"
            onClick={onClose}
            type="button"
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="job-form"
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading
              ? "Saving..."
              : job
                ? "Update Job"
                : isSuperadmin
                  ? "Create Job"
                  : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JobFormModal;
