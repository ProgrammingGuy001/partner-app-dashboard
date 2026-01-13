import React, { useState, useEffect, useCallback } from 'react';
import { type Job, jobAPI, checklistAPI } from '@/api/services';
import { Play, Pause, CheckCircle, AlertCircle, ListChecks, FileText, CheckSquare, Square } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

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

const JobActionsModal: React.FC<JobActionsModalProps> = ({ job, onClose, onSuccess, initialTab = 'actions' }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checklists, setChecklists] = useState<ChecklistWithStatus[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);

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

  const handleAction = async (action: 'start' | 'pause' | 'finish') => {
    setLoading(true);
    setError('');

    try {
      if (action === 'start') {
        await jobAPI.start(job.id!, notes);
      } else if (action === 'pause') {
        await jobAPI.pause(job.id!, notes);
      } else {
        await jobAPI.finish(job.id!, notes);
      }
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Action failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (itemId: number, isApproved: boolean) => {
    if (!job.id) return;
    try {
      await checklistAPI.updateJobChecklistItemStatus(job.id, itemId, { is_approved: isApproved });
      fetchChecklists();
    } catch (err) {
      console.error('Error updating approval status:', err);
      // You might want to show a toast here
    }
  };

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
            <div className="mt-1">
               <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                  {job.status?.replace('_', ' ').toUpperCase()}
               </Badge>
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes for this action..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-3 pt-2">
                {(job.status === 'created' || job.status === 'paused') && (
                  <Button
                    onClick={() => handleAction('start')}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    <Play size={20} className="mr-2" />
                    {job.status === 'paused' ? 'Resume Job' : 'Start Job'}
                  </Button>
                )}

                {job.status === 'in_progress' && (
                  <>
                    <Button
                      onClick={() => handleAction('pause')}
                      disabled={loading}
                      variant="outline"
                      className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                      size="lg"
                    >
                      <Pause size={20} className="mr-2" />
                      Pause Job
                    </Button>
                    <Button
                      onClick={() => handleAction('finish')}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      <CheckCircle size={20} className="mr-2" />
                      Complete Job
                    </Button>
                  </>
                )}
              </div>
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
