import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type Job, type BillingData, type CompletionDocumentLinks, type InvoiceRequest, jobAPI, checklistAPI, grnAPI } from '@/api/services';
import { useJobAction, useJobApprovalRequests, useCreateJobApprovalRequest } from '@/hooks/useJobs';
import { useJobChecklists } from '@/hooks/useChecklists';
import { Play, Pause, CheckCircle, AlertCircle, ListChecks, FileText, CheckSquare, Square, Phone, Key, Loader2, XCircle, Receipt, Upload, Download, Trash2, Package, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/lib/apiError"

interface JobActionsModalProps {
  job: Job;
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: 'actions' | 'checklists';
  isSuperadmin?: boolean;
}

interface ChecklistItemStatus {
  id: number;
  checked: boolean;
  comment?: string;
  document_link?: string;
  is_approved?: boolean;
  review_status?: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
}

interface ChecklistItem {
  id: number;
  text: string;
  position: number;
  status?: ChecklistItemStatus;
}

interface ChecklistWithStatus {
  id: number;
  name: string;
  description?: string;
  document_link?: string | null;
  template_available?: boolean;
  items: ChecklistItem[];
}

type OTPFlow = 'none' | 'start' | 'finish';

const JobActionsModal: React.FC<JobActionsModalProps> = ({ job, onClose, onSuccess, initialTab = 'actions', isSuperadmin = false }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalFormOpen, setApprovalFormOpen] = useState(false);

  // OTP flow state
  const [otpFlow, setOtpFlow] = useState<OTPFlow>('none');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [adminComments, setAdminComments] = useState<Record<number, string>>({});
  const [itemActionLoading, setItemActionLoading] = useState<Record<number, 'approve' | 'reject'>>({});
  const [itemUploadLoading, setItemUploadLoading] = useState<Record<number, boolean>>({});
  const [itemDocuments, setItemDocuments] = useState<Record<number, string>>({});;
  const [checklistBusy, setChecklistBusy] = useState<Record<number, 'download' | 'upload' | 'export'>>({});
  const [handoverDocument, setHandoverDocument] = useState<File | null>(null);
  const [ncrDocument, setNcrDocument] = useState<File | null>(null);
  const [projectReportDocument, setProjectReportDocument] = useState<File | null>(null);
  const [completionUploadLoading, setCompletionUploadLoading] = useState(false);
  const uploadedDocumentsRef = useRef<CompletionDocumentLinks | null>(null);

  const isExternalIP = job.assigned_ip?.is_internal === false;

  // billing state
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');

  // Use React Query hook for checklists - enabled only when checklist tab is active
  const { data: checklistsData, isLoading: loadingChecklists, refetch: refetchChecklists } = useJobChecklists(
    activeTab === 'checklists' ? job.id : undefined
  );
  const checklists = (checklistsData as unknown as ChecklistWithStatus[]) || [];

  const { mutateAsync: performAction, isPending: isActionLoading } = useJobAction();
  const { data: approvalRequests = [] } = useJobApprovalRequests(job.customer_phone ? job.id : undefined);
  const { mutateAsync: requestApproval, isPending: approvalSubmitting } = useCreateJobApprovalRequest();

  const isInstallation = job.type === 'installation';
  const { data: jobGrns = [], isLoading: grnLoading, isError: grnError, refetch: refetchGrns } = useQuery({
    queryKey: ['site-grn', 'job', job.id],
    queryFn: () => grnAPI.list(50, 0, job.id),
    // Also needed before the job starts: a linked GRN is the first prerequisite.
    enabled: isInstallation && !!job.id && ['created', 'paused', 'in_progress'].includes(job.status),
  });
  const hasSubmittedGrn = jobGrns.some((grn) => grn.status === 'submitted');
  const hasLinkedGrn = jobGrns.length > 0;
  const incompleteGrnCount = jobGrns.filter((grn) => grn.status !== 'submitted').length;
  const allLinkedGrnsSubmitted = hasLinkedGrn && incompleteGrnCount === 0;
  const grnBlocksStart = isInstallation && (grnLoading || grnError || !allLinkedGrnsSubmitted);

  useEffect(() => {
    const data = (checklistsData as unknown as ChecklistWithStatus[]) || [];
    const nextComments: Record<number, string> = {};
    data.forEach((checklist) => {
      checklist.items.forEach((item) => {
        nextComments[item.id] = item.status?.admin_comment || '';
      });
    });
    setAdminComments(nextComments);
  }, [checklistsData]); // checklists is derived from checklistsData — using it directly avoids new [] ref each render

  useEffect(() => {
    if (activeTab !== 'checklists' || !isExternalIP || !job.id) return;
    setBillingLoading(true);
    setBillingError('');
    jobAPI.getBilling(job.id)
      .then(setBillingData)
      .catch((err: unknown) => setBillingError(getApiErrorMessage(err, 'Failed to load billing data')))
      .finally(() => setBillingLoading(false));
  }, [activeTab, job.id, isExternalIP]);

  // Handle legacy start/pause/finish without OTP (for jobs without customer phone)
  const completionDocumentsSelected = !!(handoverDocument || job.handover_document_link)
    && !!(ncrDocument || job.ncr_document_link)
    && !!(projectReportDocument || job.project_report_document_link);
  const canCompleteJob = completionDocumentsSelected
    && (!isInstallation || (!grnLoading && !grnError && hasSubmittedGrn));

  const uploadCompletionDocuments = async () => {
    if ((!handoverDocument && !job.handover_document_link) || (!ncrDocument && !job.ncr_document_link) || (!projectReportDocument && !job.project_report_document_link)) {
      throw new Error('Handover, NCR, and Project Report documents are required');
    }
    if (uploadedDocumentsRef.current) return uploadedDocumentsRef.current;
    setCompletionUploadLoading(true);
    try {
      const [handover, ncr, projectReport] = await Promise.all([
        handoverDocument
          ? jobAPI.uploadFile(handoverDocument, { jobId: job.id!, documentType: 'handover' })
          : Promise.resolve({ url: job.handover_document_link! }),
        ncrDocument
          ? jobAPI.uploadFile(ncrDocument, { jobId: job.id!, documentType: 'ncr' })
          : Promise.resolve({ url: job.ncr_document_link! }),
        projectReportDocument
          ? jobAPI.uploadFile(projectReportDocument, { jobId: job.id!, documentType: 'project_report' })
          : Promise.resolve({ url: job.project_report_document_link! }),
      ]);
      const documents = {
        handover_document_link: handover.url,
        ncr_document_link: ncr.url,
        project_report_document_link: projectReport.url,
      };
      uploadedDocumentsRef.current = documents;
      return documents;
    } finally {
      setCompletionUploadLoading(false);
    }
  };

  const handleAction = async (action: 'start' | 'pause' | 'finish') => {
    setError('');
    try {
      const documents = action === 'finish' ? await uploadCompletionDocuments() : undefined;
      await performAction({ id: job.id!, action, notes, documents });
      onSuccess();
    } catch (err: unknown) {
      // The backend signals the OTP flow in response.data.detail — an AxiosError's
      // .message is only "Request failed with status code 400", so read the detail.
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (typeof detail === 'string' && detail.includes('OTP verification')) {
        if (action === 'start') {
          handleRequestStartOTP();
        } else if (action === 'finish') {
          handleRequestEndOTP();
        }
        return;
      }
      setError(getApiErrorMessage(err, 'Action failed'));
    }
  };

  // Request start OTP
  const handleRequestStartOTP = async () => {
    if (!job.id) return;
    setOtpLoading(true);
    setError('');
    try {
      const result = await jobAPI.requestStartOTP(job.id);
      if (result.success) {
        setOtpFlow('start');
        setOtpSent(true);
        toast.success(result.message || 'OTP request accepted');
      } else {
        setError(result.message || 'Failed to send OTP');
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setOtpLoading(false);
    }
  };

  // Request end OTP
  const handleRequestEndOTP = async () => {
    if (!job.id) return;
    if (!completionDocumentsSelected) {
      setError('Upload Handover, then upload or generate the Level 2 NCR and Project Report before completing the job.');
      return;
    }
    if (isInstallation && grnLoading) {
      setError('Wait for the Site GRN check to finish before completing the job.');
      return;
    }
    if (isInstallation && grnError) {
      setError('Could not verify the Site GRN. Retry the GRN check before completing the job.');
      return;
    }
    if (isInstallation && !hasSubmittedGrn) {
      setError('Submit the linked Site GRN before completing this installation job.');
      return;
    }
    setOtpLoading(true);
    setError('');
    try {
      const result = await jobAPI.requestEndOTP(job.id);
      if (result.success) {
        setOtpFlow('finish');
        setOtpSent(true);
        toast.success(result.message || 'OTP request accepted');
      } else {
        setError(result.message || 'Failed to send OTP');
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP and perform action
  const handleVerifyOTP = async () => {
    if (!job.id || !otp.trim()) return;
    setOtpLoading(true);
    setError('');
    try {
      if (otpFlow === 'start') {
        await jobAPI.verifyStartOTP(job.id, otp.trim(), notes);
        toast.success('Job started successfully');
      } else if (otpFlow === 'finish') {
        const documents = await uploadCompletionDocuments();
        await jobAPI.verifyEndOTP(job.id, otp.trim(), notes, documents);
        toast.success('Job completed successfully');
      }
      onSuccess();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Invalid or expired OTP'));
    } finally {
      setOtpLoading(false);
    }
  };

  // Superadmin approval — the fallback when the customer can't supply an OTP.
  const handleRequestApproval = async (action: 'start' | 'finish') => {
    if (!job.id || !approvalReason.trim()) return;
    setError('');
    try {
      const documents = action === 'finish' ? await uploadCompletionDocuments() : undefined;
      await requestApproval({ id: job.id, action, reason: approvalReason.trim(), documents });
      setApprovalReason('');
      setApprovalFormOpen(false);
      onSuccess();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to request approval'));
    }
  };

  const renderApprovalFallback = (action: 'start' | 'finish', blocked: boolean) => {
    if (!requiresOTP) return null;

    const pending = approvalRequests.find((request) => request.action === action && request.status === 'pending');
    if (pending) {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="flex items-center gap-1.5 font-medium">
            <ShieldCheck size={14} /> Awaiting superadmin approval
          </p>
          <p className="mt-1 text-xs">{pending.reason}</p>
        </div>
      );
    }

    if (!approvalFormOpen) {
      return (
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setApprovalFormOpen(true)}>
          <ShieldCheck size={14} className="mr-2" />
          {isSuperadmin
            ? `${action === 'start' ? 'Start' : 'Complete'} without customer OTP`
            : 'Customer unreachable? Request superadmin approval'}
        </Button>
      );
    }

    return (
      <div className="space-y-2 rounded-md border p-3">
        <label htmlFor="approval-reason" className="text-sm font-medium">
          Why can't the customer verify by OTP? <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="approval-reason"
          value={approvalReason}
          onChange={(e) => setApprovalReason(e.target.value)}
          placeholder="e.g. customer phone unreachable, site handed to facilities team"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleRequestApproval(action)}
            disabled={!approvalReason.trim() || blocked || approvalSubmitting || completionUploadLoading}
          >
            {approvalSubmitting || completionUploadLoading ? <Loader2 className="animate-spin" size={14} /> : (isSuperadmin ? 'Confirm' : 'Send for approval')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setApprovalFormOpen(false); setApprovalReason(''); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  const resetOTPFlow = () => {
    setOtpFlow('none');
    setOtp('');
    setOtpSent(false);
    setError('');
  };

  const handleReviewAction = async (item: ChecklistItem, action: 'approve' | 'reject') => {
    if (!job.id) return;

    const adminComment = (adminComments[item.id] ?? item.status?.admin_comment ?? '').trim();
    if (action === 'reject' && !adminComment) {
      toast.error('Add an admin comment before rejecting this item');
      return;
    }

    setItemActionLoading((prev) => ({ ...prev, [item.id]: action }));
    try {
      await checklistAPI.updateJobChecklistItemStatus(job.id, item.id, {
        checked: action === 'approve',
        is_approved: action === 'approve',
        review_status: action === 'approve' ? 'approved' : 'rejected',
        admin_comment: adminComment || null,
      });
      await refetchChecklists();
      toast.success(action === 'approve' ? 'Checklist item approved' : 'Checklist item rejected');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to update checklist item'));
    } finally {
      setItemActionLoading((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const setChecklistTask = (checklistId: number, task: 'download' | 'upload' | 'export' | null) =>
    setChecklistBusy((prev) => {
      if (task) return { ...prev, [checklistId]: task };
      const next = { ...prev };
      delete next[checklistId];
      return next;
    });

  const handleChecklistTemplateDownload = async (checklist: ChecklistWithStatus) => {
    if (!job.id) return;

    setChecklistTask(checklist.id, 'download');
    try {
      await checklistAPI.downloadJobChecklistTemplate(job.id, checklist.id);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to download the checklist workbook'));
    } finally {
      setChecklistTask(checklist.id, null);
    }
  };

  const handleChecklistExport = async (checklist: ChecklistWithStatus) => {
    if (!job.id) return;

    setChecklistTask(checklist.id, 'export');
    try {
      await checklistAPI.exportJobChecklist(job.id, checklist.id, checklist.name);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to export the checklist'));
    } finally {
      setChecklistTask(checklist.id, null);
    }
  };

  const handleChecklistDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, checklist: ChecklistWithStatus) => {
    if (!job.id || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    setChecklistTask(checklist.id, 'upload');
    try {
      await checklistAPI.uploadJobChecklistDocument(job.id, checklist.id, file);
      await refetchChecklists();
      toast.success('Completed checklist uploaded');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to upload the completed checklist'));
    } finally {
      setChecklistTask(checklist.id, null);
      if (e.target) e.target.value = '';
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, item: ChecklistItem) => {
    if (!job.id || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    setItemUploadLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      const response = await jobAPI.uploadFile(file);
      const documentUrl = response.url;

      // Update checklist item status with document link
      await checklistAPI.updateJobChecklistItemStatus(job.id, item.id, {
        document_link: documentUrl,
      });

      // Update local state
      setItemDocuments((prev) => ({ ...prev, [item.id]: documentUrl }));
      await refetchChecklists();
      toast.success('Document uploaded successfully');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to upload document'));
    } finally {
      setItemUploadLoading((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveDocument = async (item: ChecklistItem) => {
    if (!job.id) return;

    setItemUploadLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      await checklistAPI.updateJobChecklistItemStatus(job.id, item.id, {
        document_link: null,
      });
      setItemDocuments((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await refetchChecklists();
      toast.success('Document removed');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to remove document'));
    } finally {
      setItemUploadLoading((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const getItemStatusMeta = (item: ChecklistItem) => {
    if (item.status?.review_status === 'approved') {
      return {
        label: 'Approved',
        variant: 'secondary' as const,
        className: 'bg-green-100 text-green-800 hover:bg-green-100 gap-1',
        icon: <CheckCircle size={10} />,
      };
    }

    if (item.status?.review_status === 'rejected') {
      return {
        label: 'Rejected',
        variant: 'destructive' as const,
        className: 'gap-1',
        icon: <XCircle size={10} />,
      };
    }

    if (item.status?.checked) {
      return {
        label: 'Under Review',
        variant: 'outline' as const,
        className: 'border-amber-200 text-amber-700 bg-amber-50 gap-1',
        icon: null,
      };
    }

    return {
      label: 'Pending',
      variant: 'outline' as const,
      className: 'text-muted-foreground',
      icon: null,
    };
  };

  const requiresOTP = !!job.customer_phone;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-4 sm:p-6">
          <DialogTitle className="flex justify-between items-center">
            <span>Job Management</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="shrink-0 border-b bg-muted/30 p-4">
            <h3 className="font-semibold text-foreground mb-1">{job.name}</h3>
            <p className="text-sm text-muted-foreground">Customer: {job.customer_name}</p>
            {job.customer_phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Phone size={12} /> {job.customer_phone}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                {job.status?.replace('_', ' ').toUpperCase()}
              </Badge>
              {requiresOTP && (
                <Badge variant="outline" className="text-xs">
                  <Key size={10} className="mr-1" /> OTP Required
                </Badge>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="shrink-0 px-4 pt-4 sm:px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="actions" className="flex items-center gap-2">
                  <Play size={16} /> <span>Actions</span>
                </TabsTrigger>
                <TabsTrigger value="checklists" className="flex items-center gap-2">
                  <ListChecks size={16} /> <span className="hidden sm:inline">Checklists & Status</span><span className="sm:hidden">Checklists</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="actions" className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 min-h-0">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* OTP Input Section */}
              {otpSent && otpFlow !== 'none' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Key size={16} />
                    <span className="font-medium">
                      OTP sent to customer ({job.customer_phone})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="flex-1"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="Enter 6-digit OTP"
                    />
                    <Button
                      onClick={handleVerifyOTP}
                      disabled={otpLoading || completionUploadLoading || otp.length < 4 || (otpFlow === 'finish' && !canCompleteJob)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {otpLoading ? <Loader2 className="animate-spin" size={16} /> : 'Verify'}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetOTPFlow}
                    className="text-gray-500"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Notes Section */}
              {!otpSent && (
                <div className="space-y-2">
                  <label htmlFor="action-notes" className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                  <Textarea
                    id="action-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes for this action..."
                    className="min-h-[100px]"
                  />
                </div>
              )}

              {/* Action Buttons */}
              {!otpSent && (
                <div className="space-y-3 pt-2">
                  {job.status === 'in_progress' && (
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                      <div>
                        <h4 className="text-sm font-semibold">Required completion documents</h4>
                        <p className="text-xs text-muted-foreground">Uploads: PDF, JPG, PNG, DOC, DOCX or Project Report XLSX · maximum 10 MB each</p>
                      </div>
                      <label className="block space-y-1 text-sm font-medium">
                        <span>Handover Document <span className="text-destructive">*</span></span>
                        <Input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                          onChange={(event) => {
                            uploadedDocumentsRef.current = null;
                            setHandoverDocument(event.target.files?.[0] || null);
                          }}
                          required={!job.handover_document_link}
                        />
                        {handoverDocument?.name ? <span className="block text-xs text-muted-foreground">{handoverDocument.name}</span> : null}
                        {job.handover_document_link && <a href={job.handover_document_link} download target="_blank" rel="noreferrer" className="block text-xs font-medium text-primary underline">Download attached Handover Document</a>}
                      </label>
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Project Report <span className="text-destructive">*</span></p>
                        <p className="mb-2 text-xs text-muted-foreground">Upload a completed report or generate it from the supplied Monthly executed projects workbook.</p>
                        <Input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xlsx"
                          onChange={(event) => {
                            uploadedDocumentsRef.current = null;
                            setProjectReportDocument(event.target.files?.[0] || null);
                          }}
                        />
                        {projectReportDocument?.name ? <span className="mt-1 block text-xs text-muted-foreground">{projectReportDocument.name}</span> : null}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {job.project_report_document_link && (
                            <a href={job.project_report_document_link} download target="_blank" rel="noreferrer" className="text-primary underline">Download attached Project Report</a>
                          )}
                          <Link to={`/dashboard/document-automation?job=${job.id}&tab=monthly&attach=project-report`} className="font-medium text-primary underline">Generate from template</Link>
                        </div>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Level 2 NCR <span className="text-destructive">*</span></p>
                        <p className="mb-2 text-xs text-muted-foreground">Upload a completed NCR or generate it from the supplied template.</p>
                        <Input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                          onChange={(event) => {
                            uploadedDocumentsRef.current = null;
                            setNcrDocument(event.target.files?.[0] || null);
                          }}
                        />
                        {ncrDocument?.name ? <span className="mt-1 block text-xs text-muted-foreground">{ncrDocument.name}</span> : null}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {job.ncr_document_link && (
                            <a href={job.ncr_document_link} download target="_blank" rel="noreferrer" className="text-primary underline">Download attached NCR</a>
                          )}
                          <Link to={`/dashboard/document-automation?job=${job.id}`} className="font-medium text-primary underline">Generate from template</Link>
                        </div>
                      </div>
                      {isInstallation && (
                        <div className="rounded-md border p-3 text-sm">
                          <p className="flex items-center gap-1.5 font-medium">
                            <Package size={14} /> Site GRN <span className="text-destructive">*</span>
                          </p>
                        {grnLoading ? (
                          <p className="mt-1 text-xs text-muted-foreground">Checking the linked GRN…</p>
                        ) : grnError ? (
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchGrns()}>Retry GRN check</Button>
                        ) : hasSubmittedGrn ? (
                            <p className="mt-1 text-xs text-green-700">Submitted GRN linked to this job — requirement met.</p>
                          ) : (
                            <p className="mt-1 text-xs text-destructive">
                              No submitted GRN linked to this job yet. Create and submit one from Site GRN before completing an installation job.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(job.status === 'created' || job.status === 'paused') && (
                    <>
                    {isInstallation && (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Package size={14} /> Site GRN <span className="text-destructive">*</span>
                        </p>
                        {grnLoading ? (
                          <p className="mt-1 text-xs text-muted-foreground">Checking for a linked GRN…</p>
                        ) : grnError ? (
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchGrns()}>Retry GRN check</Button>
                        ) : allLinkedGrnsSubmitted ? (
                          <p className="mt-1 text-xs text-green-700">
                            All {jobGrns.length} linked GRN{jobGrns.length === 1 ? '' : 's'} completed — the job can be started.
                          </p>
                        ) : hasLinkedGrn ? (
                          <p className="mt-1 text-xs text-destructive">
                            Complete all linked Site GRNs before starting this job ({incompleteGrnCount} incomplete).
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-destructive">
                            No GRN linked to this job. Link one from Site GRN, then complete every linked GRN before starting.
                          </p>
                        )}
                      </div>
                    )}
                    <Button
                      onClick={() => requiresOTP ? handleRequestStartOTP() : handleAction('start')}
                      disabled={isActionLoading || otpLoading || grnBlocksStart}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      size="lg"
                    >
                      {otpLoading ? (
                        <Loader2 className="animate-spin mr-2" size={20} />
                      ) : (
                        <Play size={20} className="mr-2" />
                      )}
                      {job.status === 'paused' ? 'Resume Job' : 'Start Job'}
                      {requiresOTP && <span className="ml-2 text-xs opacity-75">(OTP)</span>}
                    </Button>
                    {renderApprovalFallback('start', grnBlocksStart)}
                    </>
                  )}

                  {job.status === 'in_progress' && (
                    <>
                      <Button
                        onClick={() => handleAction('pause')}
                        disabled={isActionLoading || otpLoading}
                        variant="outline"
                        className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                        size="lg"
                      >
                        <Pause size={20} className="mr-2" />
                        Pause Job
                      </Button>
                      <Button
                        onClick={() => requiresOTP ? handleRequestEndOTP() : handleAction('finish')}
                        disabled={isActionLoading || otpLoading || completionUploadLoading || !canCompleteJob}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {otpLoading ? (
                          <Loader2 className="animate-spin mr-2" size={20} />
                        ) : (
                          <CheckCircle size={20} className="mr-2" />
                        )}
                        Complete Job
                        {requiresOTP && <span className="ml-2 text-xs opacity-75">(OTP)</span>}
                      </Button>
                      {renderApprovalFallback('finish', !canCompleteJob)}
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="checklists" className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingChecklists ? (
                  <div className="text-center py-8 text-muted-foreground">Loading checklists...</div>
                ) : checklists.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No checklists assigned to this job.</div>
                ) : (
                  <div className="space-y-6 pb-6">
                    {checklists.map((checklist) => (
                      <div key={checklist.id} className="border rounded-lg overflow-hidden bg-card shadow-sm">
                        <div className="bg-muted/40 px-4 py-3 border-b flex flex-col">
                          <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <FileText size={16} className="text-blue-500" />
                            {checklist.name}
                          </h4>
                          {checklist.description && (
                            <p className="text-xs text-muted-foreground mt-1 pl-6">{checklist.description}</p>
                          )}
                          {checklist.document_link && (
                            <a
                              href={checklist.document_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 flex w-fit items-center gap-1 pl-6 text-xs font-semibold text-blue-600 hover:underline"
                            >
                              <FileText size={12} /> View completed checklist
                            </a>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                            {/* Export is for every checklist; the workbook controls are ISM-only. */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!!checklistBusy[checklist.id]}
                              onClick={() => handleChecklistExport(checklist)}
                            >
                              {checklistBusy[checklist.id] === 'export' ? (
                                <Loader2 size={14} className="mr-1 animate-spin" />
                              ) : (
                                <Download size={14} className="mr-1" />
                              )}
                              Export PDF
                            </Button>
                            {checklist.template_available && (
                              <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!!checklistBusy[checklist.id]}
                                onClick={() => handleChecklistTemplateDownload(checklist)}
                              >
                                {checklistBusy[checklist.id] === 'download' ? (
                                  <Loader2 size={14} className="mr-1 animate-spin" />
                                ) : (
                                  <FileText size={14} className="mr-1" />
                                )}
                                Download blank workbook
                              </Button>
                              <label htmlFor={`checklist-upload-${checklist.id}`} className="inline-flex">
                                <input
                                  id={`checklist-upload-${checklist.id}`}
                                  type="file"
                                  accept=".xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                  className="sr-only"
                                  disabled={!!checklistBusy[checklist.id]}
                                  onChange={(e) => handleChecklistDocumentUpload(e, checklist)}
                                />
                                <span
                                  className={`inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm font-medium hover:bg-accent ${
                                    checklistBusy[checklist.id] ? 'pointer-events-none opacity-50' : ''
                                  }`}
                                >
                                  {checklistBusy[checklist.id] === 'upload' ? (
                                    <Loader2 size={14} className="mr-1 animate-spin" />
                                  ) : (
                                    <Upload size={14} className="mr-1" />
                                  )}
                                  Upload completed file
                                </span>
                              </label>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="divide-y">
                          {checklist.items.map((item) => {
                            const statusMeta = getItemStatusMeta(item);
                            const hasSubmission = Boolean(
                              item.status?.checked ||
                              item.status?.comment ||
                              item.status?.document_link ||
                              item.status?.admin_comment
                            );
                            const adminComment = adminComments[item.id] ?? item.status?.admin_comment ?? '';
                            const currentAction = itemActionLoading[item.id];

                            return (
                            <div key={item.id} className="px-4 py-3 hover:bg-muted/30 transition">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 text-muted-foreground shrink-0">
                                  {item.status?.checked ? (
                                    <CheckSquare size={18} className="text-green-500" />
                                  ) : (
                                    <Square size={18} />
                                  )}
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <p className={`text-sm ${item.status?.checked ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                                      {item.text}
                                    </p>

                                    <div className="flex shrink-0 items-center gap-2 sm:ml-2">
                                      <Badge variant={statusMeta.variant} className={statusMeta.className}>
                                        {statusMeta.icon}
                                        {statusMeta.label}
                                      </Badge>
                                    </div>
                                  </div>

                                  {item.status?.comment && (
                                    <div className="text-xs text-foreground/70 bg-yellow-50/50 dark:bg-yellow-950/20 p-2 rounded border border-yellow-100/50 dark:border-yellow-900/30">
                                      <span className="font-medium text-yellow-700 dark:text-yellow-400">IP Note:</span> {item.status.comment}
                                    </div>
                                  )}
                                  {item.status?.document_link && (
                                    <div>
                                      <a
                                        href={item.status.document_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"
                                      >
                                        <FileText size={12} /> View Attached Document
                                      </a>
                                    </div>
                                  )}

                                  {/* Document Upload Section */}
                                  <div className="rounded-md border border-dashed bg-muted/20 p-3 space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Upload Document
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <label htmlFor={`doc-upload-${item.id}`} className="cursor-pointer">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={itemUploadLoading[item.id] || false}
                                          onClick={() => document.getElementById(`doc-upload-${item.id}`)?.click()}
                                          className="gap-2"
                                        >
                                          {itemUploadLoading[item.id] ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Upload className="h-3 w-3" />
                                          )}
                                          Choose File
                                        </Button>
                                      </label>
                                      <input
                                        id={`doc-upload-${item.id}`}
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => handleDocumentUpload(e, item)}
                                        disabled={itemUploadLoading[item.id] || false}
                                        accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                                      />
                                      {(item.status?.document_link || itemDocuments[item.id]) && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveDocument(item)}
                                          disabled={itemUploadLoading[item.id] || false}
                                          className="h-8 w-8 p-0"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {hasSubmission && (
                                    <div className="space-y-3 rounded-md border border-dashed bg-muted/20 p-3">
                                      <div className="space-y-1">
                                        <label
                                          htmlFor={`admin-comment-${item.id}`}
                                          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                        >
                                          Admin Comment
                                        </label>
                                        <Textarea
                                          id={`admin-comment-${item.id}`}
                                          value={adminComment}
                                          onChange={(event) =>
                                            setAdminComments((prev) => ({
                                              ...prev,
                                              [item.id]: event.target.value,
                                            }))
                                          }
                                          placeholder="Tell the IP what to fix before resubmitting."
                                          className="min-h-[84px]"
                                        />
                                      </div>

                                      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                                        <Button
                                          onClick={() => handleReviewAction(item, 'approve')}
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700"
                                          disabled={!!currentAction}
                                        >
                                          {currentAction === 'approve' ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          ) : (
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                          )}
                                          Approve
                                        </Button>
                                        <Button
                                          onClick={() => handleReviewAction(item, 'reject')}
                                          size="sm"
                                          variant="destructive"
                                          disabled={!!currentAction}
                                        >
                                          {currentAction === 'reject' ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          ) : (
                                            <XCircle className="mr-2 h-4 w-4" />
                                          )}
                                          Reject
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Billing section — external IPs only, after all checklist items */}
                {isExternalIP && (
                  <BillingSection
                    job={job}
                    billingData={billingData}
                    billingLoading={billingLoading}
                    billingError={billingError}
                    onBillingUpdate={(data) => setBillingData(data)}
                  />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BillingSection: React.FC<{
  job: Job;
  billingData: BillingData | null;
  billingLoading: boolean;
  billingError: string;
  onBillingUpdate: (data: BillingData) => void;
}> = ({ job, billingData, billingLoading, billingError, onBillingUpdate }) => {
  const [actionLoading, setActionLoading] = useState<'request' | 'additional' | 'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showAdditionalInvoice, setShowAdditionalInvoice] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [downloadingRequestId, setDownloadingRequestId] = useState<number | null>(null);

  const refreshBilling = async () => {
    if (!job.id) return;
    try {
      const data = await jobAPI.getBilling(job.id);
      onBillingUpdate(data);
    } catch { /* silent */ }
  };

  const handleRequest = async () => {
    if (!job.id) return;
    setActionLoading('request');
    try {
      await jobAPI.requestInvoice(job.id);
      await refreshBilling();
      toast.success('Invoice request sent to admins');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to send invoice request'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!job.id) return;
    setActionLoading('approve');
    try {
      await jobAPI.approveInvoice(job.id);
      await refreshBilling();
      toast.success('Invoice approved');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to approve'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdditionalRequest = async () => {
    if (!job.id) return;
    const percentage = completionPercentage === '' ? undefined : Number(completionPercentage);
    if (percentage !== undefined && (!Number.isInteger(percentage) || percentage < 0 || percentage > 100)) {
      toast.error('Completion percentage must be a whole number from 0 to 100');
      return;
    }
    setActionLoading('additional');
    try {
      await jobAPI.requestAdditionalInvoice(job.id, {
        completion_percentage: percentage,
        notes: invoiceNotes.trim() || undefined,
      });
      await refreshBilling();
      setCompletionPercentage('');
      setInvoiceNotes('');
      setShowAdditionalInvoice(false);
      toast.success('Additional invoice request submitted');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to submit invoice request'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!job.id) return;
    setActionLoading('reject');
    try {
      await jobAPI.rejectInvoice(job.id, rejectReason);
      await refreshBilling();
      setShowRejectInput(false);
      setRejectReason('');
      toast.success('Invoice request rejected');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to reject'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadInvoice = async (invoiceRequestId: number) => {
    if (!job.id) return;
    setDownloadingRequestId(invoiceRequestId);
    try {
      await jobAPI.downloadInvoice(job.id, job.name, invoiceRequestId);
      toast.success('Bill downloaded');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to download bill'));
    } finally {
      setDownloadingRequestId(null);
    }
  };

  const req: InvoiceRequest | null = billingData?.invoice_request ?? null;

  return (
    <div className="mt-6 border-t pt-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={16} className="text-blue-500" />
        <h4 className="font-semibold text-foreground">Billing</h4>
      </div>

      {billingLoading ? (
        <div className="text-center py-6 text-muted-foreground">
          <Loader2 className="animate-spin mx-auto mb-2" size={20} />
          Loading billing data...
        </div>
      ) : billingError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{billingError}</AlertDescription>
        </Alert>
      ) : !billingData ? null : req === null ? (
        /* No request yet — show request button */
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
          <Receipt size={28} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium text-gray-700 mb-1">No invoice requested yet</p>
          <p className="text-xs text-gray-500 mb-4">
            Send a request to the assigned admin and superadmin for approval.
          </p>
          <Button
            size="sm"
            onClick={handleRequest}
            disabled={actionLoading === 'request'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {actionLoading === 'request' ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Receipt className="mr-2 h-4 w-4" />}
            Request Invoice
          </Button>
        </div>
      ) : req.status === 'pending' ? (
        /* Pending — show approve / reject */
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Loader2 size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Invoice request pending approval</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Requested by {req.requested_by || 'admin'} on{' '}
                  {new Date(req.requested_at).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {showRejectInput ? (
            <div className="space-y-2">
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (optional)"
                className="min-h-[72px] text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={actionLoading === 'reject'}
                >
                  {actionLoading === 'reject' ? <Loader2 className="animate-spin mr-1 h-3 w-3" /> : null}
                  Confirm Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={!!actionLoading}
              >
                {actionLoading === 'approve' ? <Loader2 className="animate-spin mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                Approve Invoice
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowRejectInput(true)}
                disabled={!!actionLoading}
              >
                <XCircle className="mr-1 h-3 w-3" /> Reject
              </Button>
            </div>
          )}
        </div>
      ) : req.status === 'rejected' ? (
        /* Rejected — allow re-request */
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Invoice request rejected</p>
                {req.rejection_reason && (
                  <p className="text-xs text-red-700 mt-0.5">Reason: {req.rejection_reason}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Approved — show full invoice */
        <div className="space-y-3">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600 shrink-0" />
            <div className="text-xs text-green-800">
              <span className="font-semibold">Approved</span>
              {req.approved_by && ` by ${req.approved_by}`}
              {req.approved_at && ` on ${new Date(req.approved_at).toLocaleDateString('en-IN')}`}
            </div>
          </div>
          <BillingInvoice
            billingData={billingData}
            jobName={job.name || `Job #${job.id}`}
            onDownload={() => handleDownloadInvoice(req.id)}
            downloading={downloadingRequestId === req.id}
          />
        </div>
      )}

      {req && (req.completion_percentage != null || req.notes) && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
          {req.completion_percentage != null && <p><span className="text-muted-foreground">Completion:</span> {req.completion_percentage}%</p>}
          {req.notes && <p className="mt-1 whitespace-pre-wrap"><span className="text-muted-foreground">Notes:</span> {req.notes}</p>}
        </div>
      )}

      {req && req.status !== 'pending' && (
        <div className="mt-4 border-t pt-4">
          {!showAdditionalInvoice ? (
            <Button size="sm" variant="outline" onClick={() => setShowAdditionalInvoice(true)}>
              {req.status === 'rejected' ? 'Request again' : 'Request another invoice'}
            </Button>
          ) : (
            <div className="space-y-3">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={completionPercentage}
                onChange={(event) => setCompletionPercentage(event.target.value)}
                placeholder="Completion percentage (optional)"
              />
              <Textarea
                value={invoiceNotes}
                onChange={(event) => setInvoiceNotes(event.target.value)}
                maxLength={1000}
                placeholder="Notes (optional)"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdditionalRequest} disabled={actionLoading === 'additional'}>
                  {actionLoading === 'additional' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit request
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdditionalInvoice(false)} disabled={actionLoading === 'additional'}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {(billingData?.invoice_requests || []).some(invoice => invoice.status === 'approved' && invoice.id !== req?.id) && (
        <div className="mt-4 rounded-lg border p-4">
          <p className="mb-3 text-sm font-semibold">Previous approved invoices</p>
          <div className="flex flex-wrap gap-2">
            {(billingData?.invoice_requests || [])
              .filter(invoice => invoice.status === 'approved' && invoice.id !== req?.id)
              .map(invoice => (
                <Button
                  key={invoice.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downloadingRequestId === invoice.id}
                  onClick={() => handleDownloadInvoice(invoice.id)}
                >
                  {downloadingRequestId === invoice.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                  {invoice.invoice_number || `Invoice ${invoice.id}`}
                </Button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BILL_TO = {
  name: 'Ayena Innovation Pvt. Ltd.',
  address: 'JSW Steel Township Dolvi',
  state: 'Maharashtra',
  pan: '27AAUCA9622P1ZP',
};

const BillingInvoice: React.FC<{
  billingData: BillingData;
  jobName: string;
  onDownload: () => void;
  downloading: boolean;
}> = ({ billingData, jobName, onDownload, downloading }) => {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const invoiceNo = `INV-${billingData.job_id}-${new Date().getFullYear()}`;
  const rate = billingData.rate ? parseFloat(billingData.rate) : 0;
  const qty = billingData.size ?? 0;
  const totalAmount = rate && qty ? rate * qty : rate || 0;

  const amountToWords = (n: number): string => {
    if (n === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (num: number): string => {
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
      if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
      if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
      return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
    };
    const [intPart, decPart] = n.toFixed(2).split('.');
    const words = convert(parseInt(intPart));
    return words + ' Rupees' + (parseInt(decPart) > 0 ? ' and ' + convert(parseInt(decPart)) + ' Paise' : ' Only');
  };

  return (
    <div className="border rounded-lg overflow-hidden text-sm bg-white print:shadow-none" id="billing-invoice">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-gray-600 space-y-0.5">
          <div>Date: {today}</div>
          {billingData.ip.city && <div>Add: {billingData.ip.city}</div>}
          <div>Mob.: {billingData.ip.phone}</div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold tracking-wide text-gray-800">INVOICE</h2>
        </div>
      </div>

      {/* Invoice meta + Bill to */}
      <div className="grid grid-cols-1 gap-0 border-b sm:grid-cols-2">
        <div className="space-y-1 border-b px-4 py-3 sm:border-b-0 sm:border-r">
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Project ID:</span>
            <span className="font-medium">{billingData.job_id}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Invoice No.:</span>
            <span className="font-medium">{invoiceNo}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">Invoice Date:</span>
            <span className="font-medium">{today}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">State:</span>
            <span className="font-medium">{billingData.state || '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-28 shrink-0">PAN No.:</span>
            <span className="font-medium">{billingData.ip.pan_number || '—'}</span>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1">
          <div className="font-semibold text-gray-700 mb-1">Bill to Party</div>
          <div className="font-medium">{BILL_TO.name}</div>
          <div className="text-gray-600">{BILL_TO.address}</div>
          <div className="text-gray-600">State: {BILL_TO.state}</div>
          <div className="text-gray-600">PAN No.: {BILL_TO.pan}</div>
        </div>
      </div>

      {/* Project name */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <span className="font-semibold text-gray-700">Project Name: </span>
        <span>{jobName}</span>
      </div>

      {/* Line items table */}
      <div className="overflow-x-auto border-b">
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className="bg-gray-100 text-gray-600">
            <th className="border-r px-2 py-2 text-left w-8">Sr.</th>
            <th className="border-r px-2 py-2 text-left">Description</th>
            <th className="border-r px-2 py-2 text-center w-16">UOM</th>
            <th className="border-r px-2 py-2 text-center w-14">Qty</th>
            <th className="border-r px-2 py-2 text-center w-16">Rate (₹)</th>
            <th className="px-2 py-2 text-right w-20">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-r px-2 py-2 text-center">1</td>
            <td className="border-r px-2 py-2">
              {billingData.job_type
                ? billingData.job_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                : 'B2B/B2C Installation'}
            </td>
            <td className="border-r px-2 py-2 text-center">{qty ? 'Sq. Ft.' : 'NO.'}</td>
            <td className="border-r px-2 py-2 text-center">{qty || '—'}</td>
            <td className="border-r px-2 py-2 text-center">{rate ? `₹${rate.toLocaleString('en-IN')}` : '—'}</td>
            <td className="px-2 py-2 text-right font-medium">
              {totalAmount ? `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={5} className="border-r border-t px-2 py-2 text-right text-gray-700">Total Amount</td>
            <td className="border-t px-2 py-2 text-right">
              {totalAmount ? `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>

      {/* Amounts in words */}
      <div className="px-4 py-2 border-b text-xs text-gray-700">
        <span className="font-medium">Amounts in words: </span>
        {totalAmount ? amountToWords(totalAmount) : '—'}
      </div>

      {/* Declaration */}
      <div className="px-4 py-2 border-b text-xs text-gray-500">
        Declaration: Certified that the particulars given above are true and correct.
      </div>

      {/* Bank Details */}
      <div className="px-4 py-3 text-xs space-y-1">
        <div className="font-semibold text-gray-700 mb-1">Bank Details</div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          <div><span className="text-gray-500">Account Holder: </span>{billingData.ip.account_holder_name || '—'}</div>
          <div><span className="text-gray-500">Account No.: </span>{billingData.ip.account_number || '—'}</div>
          <div><span className="text-gray-500">IFSC Code: </span>{billingData.ip.ifsc_code || '—'}</div>
        </div>
      </div>

      {/* Print button */}
      <div className="flex justify-end border-t bg-gray-50 px-4 py-3">
        <button
          onClick={onDownload}
          disabled={downloading}
          className="w-full rounded bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 sm:w-auto sm:py-1.5"
        >
          {downloading ? 'Downloading...' : 'Download Bill XLSX'}
        </button>
      </div>
    </div>
  );
};

export default JobActionsModal;
