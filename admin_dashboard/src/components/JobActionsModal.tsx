import React, { useEffect, useState } from 'react';
import { type Job, type BillingData, type InvoiceRequest, jobAPI, checklistAPI } from '@/api/services';
import { useJobAction } from '@/hooks/useJobs';
import { useJobChecklists } from '@/hooks/useChecklists';
import { Play, Pause, CheckCircle, AlertCircle, ListChecks, FileText, CheckSquare, Square, Phone, Key, Loader2, XCircle, Receipt, Upload, Trash2 } from 'lucide-react';
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

interface JobActionsModalProps {
  job: Job;
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: 'actions' | 'checklists';
}

interface ChecklistItemStatus {
  id: number;
  checked: boolean;
  comment?: string;
  document_link?: string;
  is_approved?: boolean;
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
  items: ChecklistItem[];
}

type OTPFlow = 'none' | 'start' | 'finish';

type ApiErrorLike = {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiErrorLike;
  return apiError.response?.data?.detail || apiError.message || fallback;
};

const JobActionsModal: React.FC<JobActionsModalProps> = ({ job, onClose, onSuccess, initialTab = 'actions' }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // OTP flow state
  const [otpFlow, setOtpFlow] = useState<OTPFlow>('none');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [adminComments, setAdminComments] = useState<Record<number, string>>({});
  const [itemActionLoading, setItemActionLoading] = useState<Record<number, 'approve' | 'reject'>>({});
  const [itemUploadLoading, setItemUploadLoading] = useState<Record<number, boolean>>({});
  const [itemDocuments, setItemDocuments] = useState<Record<number, string>>({});;

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
  const handleAction = async (action: 'start' | 'pause' | 'finish') => {
    setError('');
    try {
      await performAction({ id: job.id!, action, notes });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Check if error is asking for OTP flow
        if (err.message.includes('OTP verification')) {
          if (action === 'start') {
            handleRequestStartOTP();
          } else if (action === 'finish') {
            handleRequestEndOTP();
          }
        } else {
          setError(err.message);
        }
      } else {
        setError('Action failed');
      }
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
        await jobAPI.verifyEndOTP(job.id, otp.trim(), notes);
        toast.success('Job completed successfully');
      }
      onSuccess();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Invalid or expired OTP'));
    } finally {
      setOtpLoading(false);
    }
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
        admin_comment: adminComment || null,
      });
      await refetchChecklists();
      toast.success(action === 'approve' ? 'Checklist item approved' : 'Checklist item rejected');
    } catch (err: unknown) {
      console.error('Error updating approval status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update checklist item'));
    } finally {
      setItemActionLoading((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, item: ChecklistItem) => {
    if (!job.id || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setItemUploadLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      const response = await jobAPI.uploadFile(formData);
      const documentUrl = response?.url || response;

      // Update checklist item status with document link
      await checklistAPI.updateJobChecklistItemStatus(job.id, item.id, {
        document_link: documentUrl,
      });

      // Update local state
      setItemDocuments((prev) => ({ ...prev, [item.id]: documentUrl }));
      await refetchChecklists();
      toast.success('Document uploaded successfully');
    } catch (err: unknown) {
      console.error('Error uploading document:', err);
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
      console.error('Error removing document:', err);
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
    if (item.status?.is_approved) {
      return {
        label: 'Approved',
        variant: 'secondary' as const,
        className: 'bg-green-100 text-green-800 hover:bg-green-100 gap-1',
        icon: <CheckCircle size={10} />,
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

    if (item.status?.admin_comment) {
      return {
        label: 'Rejected',
        variant: 'destructive' as const,
        className: 'gap-1',
        icon: <XCircle size={10} />,
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
          <div className="shrink-0 border-b bg-gray-50 p-4 dark:bg-muted/30">
            <h3 className="font-semibold text-gray-800 mb-1">{job.name}</h3>
            <p className="text-sm text-gray-600">Customer: {job.customer_name}</p>
            {job.customer_phone && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
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
                      disabled={otpLoading || otp.length < 4}
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
                  {(job.status === 'created' || job.status === 'paused') && (
                    <Button
                      onClick={() => requiresOTP ? handleRequestStartOTP() : handleAction('start')}
                      disabled={isActionLoading || otpLoading}
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
                        disabled={isActionLoading || otpLoading}
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
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="checklists" className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingChecklists ? (
                  <div className="text-center py-8 text-gray-500">Loading checklists...</div>
                ) : checklists.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No checklists assigned to this job.</div>
                ) : (
                  <div className="space-y-6 pb-6">
                    {checklists.map((checklist) => (
                      <div key={checklist.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="bg-gray-50 px-4 py-3 border-b flex flex-col">
                          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                            <FileText size={16} className="text-blue-500" />
                            {checklist.name}
                          </h4>
                          {checklist.description && (
                            <p className="text-xs text-gray-500 mt-1 pl-6">{checklist.description}</p>
                          )}
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
                            <div key={item.id} className="px-4 py-3 hover:bg-gray-50/50 transition">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 text-gray-400 shrink-0">
                                  {item.status?.checked ? (
                                    <CheckSquare size={18} className="text-green-500" />
                                  ) : (
                                    <Square size={18} />
                                  )}
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <p className={`text-sm ${item.status?.checked ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
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
                                    <div className="text-xs text-gray-600 bg-yellow-50/50 p-2 rounded border border-yellow-100/50">
                                      <span className="font-medium text-yellow-700">IP Note:</span> {item.status.comment}
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
                                  <div className="rounded-md border border-dashed border-gray-300 bg-gray-50/50 p-3 space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
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
                                    <div className="space-y-3 rounded-md border border-dashed border-gray-200 bg-gray-50 p-3">
                                      <div className="space-y-1">
                                        <label
                                          htmlFor={`admin-comment-${item.id}`}
                                          className="text-xs font-semibold uppercase tracking-wide text-gray-500"
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
                                          className="min-h-[84px] bg-white"
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
  const [actionLoading, setActionLoading] = useState<'request' | 'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

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

  const handleDownloadInvoice = async () => {
    if (!job.id) return;
    setActionLoading('approve');
    try {
      await jobAPI.downloadInvoice(job.id, job.name);
      toast.success('Bill downloaded');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to download bill'));
    } finally {
      setActionLoading(null);
    }
  };

  const req: InvoiceRequest | null = billingData?.invoice_request ?? null;

  return (
    <div className="mt-6 border-t pt-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={16} className="text-blue-500" />
        <h4 className="font-semibold text-gray-800">Billing</h4>
      </div>

      {billingLoading ? (
        <div className="text-center py-6 text-gray-500">
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
          <Button
            size="sm"
            variant="outline"
            onClick={handleRequest}
            disabled={actionLoading === 'request'}
          >
            {actionLoading === 'request' ? <Loader2 className="animate-spin mr-1 h-3 w-3" /> : <Receipt className="mr-1 h-3 w-3" />}
            Re-request Invoice
          </Button>
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
            jobName={job.name}
            onDownload={handleDownloadInvoice}
            downloading={actionLoading === 'approve'}
          />
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
