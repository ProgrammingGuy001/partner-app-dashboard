import React, { useState, useEffect, useCallback } from 'react';
import { type Job, jobAPI, checklistAPI } from '@/api/services';
import { useJobAction } from '@/hooks/useJobs';
import { Play, Pause, CheckCircle, AlertCircle, ListChecks, FileText, CheckSquare, Square, Phone, Key, Loader2 } from 'lucide-react';
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

const JobActionsModal: React.FC<JobActionsModalProps> = ({ job, onClose, onSuccess, initialTab = 'actions' }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [checklists, setChecklists] = useState<ChecklistWithStatus[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);

  // OTP flow state
  const [otpFlow, setOtpFlow] = useState<OTPFlow>('none');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const fetchChecklists = useCallback(async () => {
    if (!job.id) return;
    setLoadingChecklists(true);
    try {
      const data = await checklistAPI.getJobChecklistsStatus(job.id);
      setChecklists(data as unknown as ChecklistWithStatus[]);
    } catch (err) {
      console.error('Error fetching checklists:', err);
    } finally {
      setLoadingChecklists(false);
    }
  }, [job.id]);

  useEffect(() => {
    if (activeTab === 'checklists') {
      fetchChecklists();
    }
  }, [activeTab, fetchChecklists]);

  const { mutateAsync: performAction, isPending: isActionLoading } = useJobAction();

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
        toast.success('OTP sent to customer phone');
      } else {
        setError(result.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to send OTP');
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
        toast.success('OTP sent to customer phone');
      } else {
        setError(result.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to send OTP');
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
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Invalid or expired OTP');
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

  const handleApprove = async (itemId: number, isApproved: boolean) => {
    if (!job.id) return;
    try {
      await checklistAPI.updateJobChecklistItemStatus(job.id, itemId, { is_approved: isApproved });
      fetchChecklists();
    } catch (err) {
      console.error('Error updating approval status:', err);
    }
  };

  const requiresOTP = !!job.customer_phone;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 border-b shrink-0">
          <DialogTitle className="flex justify-between items-center">
            <span>Job Management</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="bg-gray-50 p-4 border-b shrink-0">
            <h3 className="font-semibold text-gray-800 mb-1">{job.name}</h3>
            <p className="text-sm text-gray-600">Customer: {job.customer_name}</p>
            {job.customer_phone && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <Phone size={12} /> {job.customer_phone}
              </p>
            )}
            <div className="mt-2 flex gap-2">
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
            <div className="px-6 pt-4 shrink-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="actions" className="flex items-center gap-2">
                  <Play size={16} /> Actions
                </TabsTrigger>
                <TabsTrigger value="checklists" className="flex items-center gap-2">
                  <ListChecks size={16} /> Checklists & Status
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="actions" className="flex-1 p-6 space-y-4 overflow-y-auto min-h-0">
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
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="flex-1"
                      maxLength={6}
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
                  <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                  <Textarea
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
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
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
                          {checklist.items.map((item) => (
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
                                  <div className="flex justify-between items-start">
                                    <p className={`text-sm ${item.status?.checked ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                      {item.text}
                                    </p>

                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                      {item.status?.is_approved ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
                                          <CheckCircle size={10} /> Approved
                                        </Badge>
                                      ) : (
                                        item.status?.checked && (
                                          <Button
                                            onClick={() => handleApprove(item.id, true)}
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                          >
                                            Approve
                                          </Button>
                                        )
                                      )}
                                    </div>
                                  </div>

                                  {item.status?.comment && (
                                    <div className="text-xs text-gray-600 bg-yellow-50/50 p-2 rounded border border-yellow-100/50">
                                      <span className="font-medium text-yellow-700">Worker Note:</span> {item.status.comment}
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
                                  {item.status?.admin_comment && (
                                    <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
                                      <span className="font-semibold">Admin Note:</span> {item.status.admin_comment}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobActionsModal;
