import React, { useState, useEffect } from 'react';
import { type Job, jobAPI, checklistAPI } from '../api/services';
import { X, Play, Pause, CheckCircle, ListChecks, FileText, CheckSquare, Square } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'actions' | 'checklists'>(initialTab);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checklists, setChecklists] = useState<ChecklistWithStatus[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);

  useEffect(() => {
    if (activeTab === 'checklists') {
      fetchChecklists();
    }
  }, [activeTab]);

  const fetchChecklists = async () => {
    if (!job.id) return;
    setLoadingChecklists(true);
    try {
      const response = await checklistAPI.getJobChecklistsStatus(job.id);
      setChecklists(response.data);
    } catch (err) {
      console.error('Error fetching checklists:', err);
    } finally {
      setLoadingChecklists(false);
    }
  };

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
      // Refresh checklists to show updated status
      fetchChecklists();
    } catch (err) {
      console.error('Error updating approval status:', err);
      alert('Failed to update status');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Job Management</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b shrink-0">
          <button
            className={`flex-1 py-3 px-4 font-medium text-sm flex items-center justify-center gap-2 ${
              activeTab === 'actions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('actions')}
          >
            <Play size={16} /> Actions
          </button>
          <button
            className={`flex-1 py-3 px-4 font-medium text-sm flex items-center justify-center gap-2 ${
              activeTab === 'checklists'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('checklists')}
          >
            <ListChecks size={16} /> Checklists & Status
          </button>
        </div>

        <div className="p-6 overflow-y-auto grow">
          <div className="bg-gray-50 rounded-lg p-4 mb-6 shrink-0">
            <h3 className="font-semibold text-gray-800 mb-2">{job.name}</h3>
            <p className="text-sm text-gray-600">Customer: {job.customer_name}</p>
            <p className="text-sm text-gray-600">Status: <span className="font-medium">{job.status}</span></p>
          </div>

          {activeTab === 'actions' ? (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  placeholder="Add notes for this action..."
                />
              </div>

              <div className="space-y-2">
                {(job.status === 'created' || job.status === 'paused') && (
                  <button
                    onClick={() => handleAction('start')}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Play size={20} />
                    {job.status === 'paused' ? 'Resume Job' : 'Start Job'}
                  </button>
                )}

                {job.status === 'in_progress' && (
                  <>
                    <button
                      onClick={() => handleAction('pause')}
                      disabled={loading}
                      className="w-full bg-yellow-600 text-white py-3 rounded-lg font-medium hover:bg-yellow-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Pause size={20} />
                      Pause Job
                    </button>
                    <button
                      onClick={() => handleAction('finish')}
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={20} />
                      Complete Job
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
               {loadingChecklists ? (
                 <div className="text-center py-8 text-gray-500">Loading checklists...</div>
               ) : checklists.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">No checklists assigned to this job.</div>
               ) : (
                 checklists.map((checklist) => (
                   <div key={checklist.id} className="border border-gray-200 rounded-lg overflow-hidden">
                     <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                       <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                         <FileText size={18} className="text-blue-500" />
                         {checklist.name}
                       </h4>
                       {checklist.description && (
                         <p className="text-sm text-gray-600 mt-1 ml-6">{checklist.description}</p>
                       )}
                     </div>
                     <div className="divide-y divide-gray-100">
                       {checklist.items.map((item) => (
                         <div key={item.id} className="px-4 py-3 flex flex-col gap-2 hover:bg-gray-50 transition">
                           <div className="flex items-start gap-3">
                             <div className="mt-0.5 text-gray-400 shrink-0">
                               {item.status?.checked ? (
                                 <CheckSquare size={20} className="text-green-500" />
                               ) : (
                                 <Square size={20} />
                               )}
                             </div>
                             <div className="flex-1">
                               <p className={`text-sm ${item.status?.checked ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                 {item.text}
                               </p>
                               {item.status?.comment && (
                                 <div className="mt-1 text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-100">
                                   <span className="font-semibold">Worker Note:</span> {item.status.comment}
                                 </div>
                               )}
                               {item.status?.document_link && (
                                 <div className="mt-1">
                                    <a 
                                      href={item.status.document_link} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <FileText size={12} /> View Attached Document
                                    </a>
                                 </div>
                               )}
                             </div>
                             
                             <div className="flex items-center gap-2 shrink-0">
                                {item.status?.is_approved ? (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                                    <CheckCircle size={12} /> Approved
                                  </span>
                                ) : (
                                  item.status?.checked && (
                                    <button
                                      onClick={() => handleApprove(item.id, true)}
                                      className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-100 font-medium transition"
                                    >
                                      Approve
                                    </button>
                                  )
                                )}
                             </div>
                           </div>
                           
                           {item.status?.admin_comment && (
                             <div className="ml-8 text-xs text-gray-500 bg-gray-100 p-2 rounded">
                               <span className="font-semibold">Admin Note:</span> {item.status.admin_comment}
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 ))
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobActionsModal;
