import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { jobAPI, type Job } from '../api/services';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Briefcase, TrendingUp, RefreshCw, Target, Edit2, Save, X } from 'lucide-react';

const Analytics: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editExpense, setEditExpense] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch all jobs
      const response = await jobAPI.getAll({ limit: 1000 });
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to fetch analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEditExpense = (jobId: number, currentExpense: number) => {
    setEditingJobId(jobId);
    setEditExpense(currentExpense.toString());
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setEditExpense('');
  };

  const handleSaveExpense = async (jobId: number) => {
    try {
      setSaving(true);
      const expenseValue = Number(editExpense) || 0;
      
      await jobAPI.update(jobId, {
        additional_expense: expenseValue
      });

      // Update local state
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.id === jobId
            ? { ...job, additional_expense: expenseValue }
            : job
        )
      );

      setEditingJobId(null);
      setEditExpense('');
    } catch (error) {
      console.error('Error updating expense:', error);
      setError('Failed to update expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Calculate totals
  const totalJobs = jobs.length;
  
  // Total payout = sum of (rate * size) for all jobs
  const totalPayout = jobs.reduce((sum, job) => {
    const rate = Number(job.rate) || 0;
    const size = Number(job.size) || 0;
    return sum + (rate * size);
  }, 0);
  
  const totalExpenses = jobs.reduce((sum, job) => sum + (Number(job.additional_expense) || 0), 0);
  const totalSize = jobs.reduce((sum, job) => sum + (Number(job.size) || 0), 0);
  
  // Calculate total cost (rate * size + additional_expense) for all jobs
  const totalCost = totalPayout + totalExpenses;
  
  // Rate per unit = total cost / total size
  const avgRatePerUnit = totalSize > 0 ? totalCost / totalSize : 0;

  const statusColorMap: { [key: string]: string } = {
    'created': '#6B7280',
    'in_progress': '#3B82F6',
    'paused': '#F59E0B',
    'completed': '#10B981',
    'cancelled': '#EF4444'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Cost Analytics</h1>
          <p className="text-gray-500 mt-1">Track individual job costs and rates</p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <Link to="/dashboard/project-analytics" className="group">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 transition">
          <div className="flex items-center gap-4">
            <div className="bg-purple-50 p-3 rounded-lg group-hover:bg-purple-100 transition">
              <Briefcase className="text-purple-600" size={28} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Project-wise Analytics</h3>
              <p className="text-sm text-gray-500 mt-1">Analyze performance and costs by project</p>
            </div>
          </div>
        </div>
      </Link>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalJobs}</p>
              <p className="text-xs text-gray-400 mt-1">All jobs</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Briefcase className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Total Payout</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{totalPayout.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              <p className="text-xs text-gray-400 mt-1">All jobs</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Additional Expenses</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              <p className="text-xs text-gray-400 mt-1">Total misc costs</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <Target className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Avg Rate per Unit</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{avgRatePerUnit.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">Price/area</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <TrendingUp className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Job Cost Chart & Table */}
      <div className="grid grid-cols-1 gap-6">
        {/* Cost Chart by Job */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <DollarSign className="text-gray-700" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">Cost per Job</h2>
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : 'text-gray-600'} />
            </button>
          </div>
          {jobs.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={jobs.slice(0, 20).map(job => {
                  const rate = Number(job.rate) || 0;
                  const size = Number(job.size) || 0;
                  const expense = Number(job.additional_expense) || 0;
                  const totalCost = rate * size + expense;
                  const ratePerUnit = size > 0 ? totalCost / size : 0;
                  
                  return {
                    name: (job.name || 'Untitled').length > 15 ? (job.name || 'Untitled').substring(0, 15) + '...' : (job.name || 'Untitled'),
                    totalCost: totalCost,
                    expense: expense,
                    ratePerUnit: ratePerUnit
                  };
                })}
                margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(1)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => `₹${Number(value).toLocaleString(undefined, {maximumFractionDigits: 2})}`}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.96)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="totalCost" 
                  fill="#10B981" 
                  radius={[6, 6, 0, 0]}
                  name="Total Cost"
                  maxBarSize={40}
                />
                <Bar 
                  dataKey="expense" 
                  fill="#EF4444" 
                  radius={[6, 6, 0, 0]}
                  name="Additional Expense"
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-gray-400">
              <div className="text-center">
                <DollarSign size={48} className="mx-auto mb-2 opacity-50" />
                <p>No job data available</p>
              </div>
            </div>
          )}
          {jobs.length > 20 && (
            <p className="text-xs text-gray-500 mt-4 text-center">Showing first 20 jobs. See table below for all jobs.</p>
          )}
        </div>

        {/* Job Details Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Briefcase className="text-gray-700" size={22} />
              <h2 className="text-lg font-semibold text-gray-900">All Jobs Cost Details</h2>
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : 'text-gray-600'} />
            </button>
          </div>
          {jobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Job Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Area</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate/area</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Payout</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Expense</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate/Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => {
                    const rate = Number(job.rate) || 0;
                    const size = Number(job.size) || 0;
                    const expense = Number(job.additional_expense) || 0;
                    const payout = rate * size;
                    const totalCost = payout + expense;
                    const ratePerUnit = size > 0 ? totalCost / size : 0;
                    const color = statusColorMap[job.status || 'created'] || '#6B7280';
                    const isEditing = editingJobId === job.id;
                    
                    return (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-medium text-gray-900">{job.name || 'Untitled'}</p>
                          <p className="text-xs text-gray-500">{job.city || '-'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-700">{job.customer_name || '-'}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                            <span className="text-xs font-medium text-gray-600 capitalize">{(job.status || 'created').replace('_', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm text-gray-600">{size}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm text-gray-600">₹{rate.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm text-gray-600">₹{payout.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                value={editExpense}
                                onChange={(e) => setEditExpense(e.target.value)}
                                className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveExpense(job.id!)}
                                disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded transition"
                                title="Save"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={saving}
                                className="p-1 text-gray-600 hover:bg-gray-100 rounded transition"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <p className="font-medium text-red-600">₹{expense.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                              <button
                                onClick={() => handleEditExpense(job.id!, expense)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Edit expense"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="font-semibold text-blue-600">₹{totalCost.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-medium text-gray-900">₹{ratePerUnit.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="px-4 py-4 text-gray-900" colSpan={4}>Total ({totalJobs} jobs)</td>
                    <td className="px-4 py-4 text-right text-gray-600">{totalSize.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                    <td className="px-4 py-4 text-right text-gray-600">
                      ₹{totalPayout.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-4 text-right text-red-700">
                      ₹{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-4 text-right text-blue-700">
                      ₹{totalCost.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900">
                      ₹{avgRatePerUnit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="text-center">
                <Briefcase size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-gray-500 font-medium">No job data available</p>
                <p className="text-sm text-gray-400 mt-1">Create some jobs to see cost details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
