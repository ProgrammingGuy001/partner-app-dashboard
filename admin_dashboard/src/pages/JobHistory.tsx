import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobAPI, type JobStatusLog } from '../api/services';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const JobHistory: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [history, setHistory] = useState<JobStatusLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      const data = await jobAPI.getHistory(parseInt(jobId));
      setHistory(data);
    } catch (error) {
      console.error('Error fetching job history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [jobId]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'created': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Job History</h1>
          <p className="text-gray-600 mt-1">View the status change history for a job</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/dashboard/jobs"
            className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back to Jobs</span>
          </Link>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading job history...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Notes</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                        {log.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{log.notes}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No history found for this job.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobHistory;
