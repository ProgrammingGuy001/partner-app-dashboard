import React, { useState, useEffect, useCallback } from 'react';
import { jobAPI, adminAPI, type Job } from '../api/services';
import { Plus, Edit2, Trash2, Play, Search, Filter, RefreshCw, History, User, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import JobFormModal from '../components/JobFormModal';
import JobActionsModal from '../components/JobActionsModal';

interface IPUser {
  id: number;
  first_name: string;
  last_name: string;
  is_assigned: boolean;
}

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<IPUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [actionJob, setActionJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params: { limit: number; status?: string; type?: string, search?: string } = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (searchTerm) params.search = searchTerm;
      const [jobsResponse, workersResponse] = await Promise.all([
        jobAPI.getAll(params),
        adminAPI.getIPUsers()
      ]);
      setJobs(jobsResponse.data);
      setWorkers(workersResponse.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, searchTerm]);

  const getWorkerName = (ipId?: number) => {
    if (!ipId) return null;
    const worker = workers.find(w => w.id === ipId);
    return worker ? `${worker.first_name} ${worker.last_name}` : 'Unknown';
  };

  const isWorkerAssigned = (ipId?: number) => {
    if (!ipId) return false;
    const worker = workers.find(w => w.id === ipId);
    return worker?.is_assigned || false;
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    try {
      await jobAPI.delete(id);
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-800">Jobs Management</h1>
          <p className="text-gray-600 mt-1">Manage all jobs and assignments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Create Job
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">All Jobs</h2>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Refresh Jobs"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : 'text-gray-600'} />
          </button>
        </div>
        
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-3 text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option value="">All Status</option>
              <option value="created">Created</option>
              <option value="in_progress">In Progress</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-3 text-gray-400" size={20} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option value="">All Types</option>
              <option value="site_readiness">Site Readiness</option>
              <option value="site_validation">Site Validation</option>
              <option value="installation">Installation</option>
              <option value="measurement">Measurement</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading jobs...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Job Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Location</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Assigned Personnel</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Rate</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{job.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{job.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{job.city}</td>
                    <td className="px-6 py-4">
                      {job.assigned_ip_id ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
                            isWorkerAssigned(job.assigned_ip_id) ? 'bg-orange-500' : 'bg-green-500'
                          }`}>
                            {getWorkerName(job.assigned_ip_id)?.split(' ').map(n => n[0]).join('') || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{getWorkerName(job.assigned_ip_id)}</p>
                            <span className={`text-xs ${isWorkerAssigned(job.assigned_ip_id) ? 'text-orange-600' : 'text-green-600'}`}>
                              {isWorkerAssigned(job.assigned_ip_id) ? '● Assigned' : '● Unassigned'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <User size={14} />
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{job.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">₹{job.rate}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActionJob(job)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Actions"
                        >
                          <Play size={18} />
                        </button>
                        <button
                          onClick={() => setEditingJob(job)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id!)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                        <Link
                          to={`/dashboard/jobs/${job.id}/history`}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                          title="History"
                        >
                          <History size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No jobs found. Create your first job!
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <JobFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchJobs();
          }}
        />
      )}

      {editingJob && (
        <JobFormModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSuccess={() => {
            setEditingJob(null);
            fetchJobs();
          }}
        />
      )}

      {actionJob && (
        <JobActionsModal
          job={actionJob}
          onClose={() => setActionJob(null)}
          onSuccess={() => {
            setActionJob(null);
            fetchJobs();
          }}
        />
      )}
    </div>
  );
};

export default Jobs;
