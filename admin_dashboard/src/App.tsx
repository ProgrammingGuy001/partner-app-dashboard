import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import Jobs from './pages/Jobs';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import JobHistory from './pages/JobHistory';
import Workers from './pages/Workers';
import ProjectAnalytics from './pages/ProjectAnalytics';
import { jobAPI, adminAPI, type Job } from './api/services';
import { Briefcase, TrendingUp, Shield, ArrowRight, Activity, Users, DollarSign } from 'lucide-react';
import './index.css';

const queryClient = new QueryClient();

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalIPs: 0,
    verifiedIPs: 0,
    pendingIPs: 0,
    availableIPs: 0
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // Fetch actual data from APIs
        const [jobsResponse, ipsResponse] = await Promise.all([
          jobAPI.getAll({ limit: 1000 }),
          adminAPI.getIPUsers()
        ]);

        console.log('Jobs Response:', jobsResponse);
        console.log('IPs Response:', ipsResponse);

        const jobs = Array.isArray(jobsResponse.data) ? jobsResponse.data : [];
        const ips = Array.isArray(ipsResponse.data) ? ipsResponse.data : [];

        console.log('Jobs count:', jobs.length);
        console.log('IPs count:', ips.length);
        console.log('Sample job:', jobs[0]);

        // Calculate stats directly from jobs
        const activeCount = jobs.filter((job: Job) => 
          job.status === 'in_progress' || job.status === 'created'
        ).length;
        
        const completedCount = jobs.filter((job: Job) => 
          job.status === 'completed'
        ).length;

        console.log('Active jobs:', activeCount);
        console.log('Completed jobs:', completedCount);

        setStats({
          totalJobs: jobs.length,
          activeJobs: activeCount,
          completedJobs: completedCount,
          totalIPs: ips.length,
          verifiedIPs: ips.filter((ip: any) => ip.is_id_verified).length,
          pendingIPs: ips.filter((ip: any) => !ip.is_id_verified).length,
          availableIPs: ips.filter((ip: any) => !ip.is_assigned).length
        });
        
        // Set recent jobs - sort by created date or ID (most recent first)
        const sortedJobs = [...jobs].sort((a, b) => {
          // If there's an id field, use that for sorting (higher ID = more recent)
          if (a.id && b.id) {
            return b.id - a.id;
          }
          // Otherwise sort by delivery date
          return new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime();
        });
        setRecentJobs(sortedJobs.slice(0, 5));

      } catch (error) {
        console.error('Error fetching stats:', error);
        console.error('Error details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '...' : stats.totalJobs}
              </p>
              <p className="text-xs text-gray-400 mt-1">All time</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Briefcase className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Jobs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '...' : stats.activeJobs}
              </p>
              <p className="text-xs text-gray-400 mt-1">In progress</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <Activity className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '...' : stats.completedJobs}
              </p>
              <p className="text-xs text-gray-400 mt-1">Finished jobs</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Personnel</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '...' : stats.totalIPs}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {loading ? '...' : `${stats.availableIPs} unassigned`}
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/dashboard/jobs" className="group">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition">
                  <Briefcase className="text-blue-600" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Jobs Management</h3>
                  <p className="text-sm text-gray-500 mt-1">Create, update, and track all jobs</p>
                </div>
                <ArrowRight className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" size={20} />
              </div>
            </div>
          </Link>

          <Link to="/dashboard/analytics" className="group">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-green-300 transition">
              <div className="flex items-center gap-4">
                <div className="bg-green-50 p-3 rounded-lg group-hover:bg-green-100 transition">
                  <TrendingUp className="text-green-600" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
                  <p className="text-sm text-gray-500 mt-1">Monitor performance and insights</p>
                </div>
                <ArrowRight className="text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" size={20} />
              </div>
            </div>
          </Link>

          <Link to="/dashboard/admin" className="group">
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 transition">
              <div className="flex items-center gap-4">
                <div className="bg-purple-50 p-3 rounded-lg group-hover:bg-purple-100 transition">
                  <Shield className="text-purple-600" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Admin Controls</h3>
                  <p className="text-sm text-gray-500 mt-1">Verify IPs and manage workers</p>
                </div>
                <ArrowRight className="text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" size={20} />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
            <Link to="/dashboard/jobs" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p>Loading...</p>
            ) : recentJobs.length > 0 ? (
              recentJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{job.name || 'Untitled Job'}</p>
                    <p className="text-sm text-gray-500">
                      {job.customer_name || 'Unknown Customer'} • {job.city || 'No city'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Delivery: {new Date(job.delivery_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                    job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    job.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    job.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {job.status?.replace('_', ' ') || 'created'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Briefcase size={48} className="mx-auto mb-2 opacity-50" />
                <p>No recent jobs</p>
                <p className="text-sm mt-1">Create your first job to get started</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
            <Link to="/dashboard/admin" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {stats.pendingIPs > 0 ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-medium text-orange-900">
                  {stats.pendingIPs} worker(s) pending verification
                </p>
                <Link to="/dashboard/admin" className="text-sm text-orange-700 hover:text-orange-800 font-medium mt-1 inline-block">
                  Review now →
                </Link>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Shield size={48} className="mx-auto mb-2 opacity-50" />
                <p>No pending approvals</p>
                <p className="text-sm mt-1">All workers are verified</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="project-analytics" element={<ProjectAnalytics />} />
            <Route path="advanced-analytics" element={<ProjectAnalytics />} />
            <Route path="workers" element={<Workers />} />
            <Route path="jobs/:jobId/history" element={<JobHistory />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App
