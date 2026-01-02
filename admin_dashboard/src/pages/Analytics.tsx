import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePayoutReport } from '../hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Briefcase, TrendingUp, RefreshCw } from 'lucide-react';

const Analytics: React.FC = () => {
  const [period, setPeriod] = useState('month');
  const { data: analyticsData, isLoading, error, refetch } = usePayoutReport({ period });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const {
    total_jobs = 0,
    total_payout = 0,
    total_additional_expense = 0,
    payout_by_ip = [],
  } = analyticsData || {};

  const totalCost = total_payout + total_additional_expense;
  
  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Cost Analytics</h1>
          <p className="text-gray-500 mt-1">Track individual job costs and rates</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
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
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{total_jobs}</p>
              <p className="text-xs text-gray-400 mt-1">All jobs in period</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{total_payout.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              <p className="text-xs text-gray-400 mt-1">Completed jobs in period</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{total_additional_expense.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              <p className="text-xs text-gray-400 mt-1">Total misc costs in period</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <TrendingUp className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-.medium text-gray-500">Total Cost</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{totalCost.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
              <p className="text-xs text-gray-400 mt-1">Total cost in period</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <DollarSign className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Payout by IP Chart */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <DollarSign className="text-gray-700" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">Payout by Installer</h2>
            </div>
          </div>
          {payout_by_ip.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={payout_by_ip}
                margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="ip_name"
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
                  dataKey="total_payout"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                  name="Total Payout"
                  maxBarSize={40}
                />
                <Bar
                  dataKey="total_additional_expense"
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
                <p>No payout data available for this period</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;