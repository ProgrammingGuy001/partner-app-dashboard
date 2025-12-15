import React, { useState } from 'react';
import { type Job, jobAPI } from '../api/services';
import { X, Play, Pause, CheckCircle } from 'lucide-react';

interface JobActionsModalProps {
  job: Job;
  onClose: () => void;
  onSuccess: () => void;
}

const JobActionsModal: React.FC<JobActionsModalProps> = ({ job, onClose, onSuccess }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Job Actions</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">{job.name}</h3>
            <p className="text-sm text-gray-600">Customer: {job.customer_name}</p>
            <p className="text-sm text-gray-600">Status: <span className="font-medium">{job.status}</span></p>
          </div>

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

          <button
            onClick={onClose}
            className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobActionsModal;
