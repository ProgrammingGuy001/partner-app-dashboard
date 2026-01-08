import React, { useState, useEffect } from 'react';
import { analyticsAPI, jobAPI, type Job } from '../api/services';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  DollarSign, TrendingUp, Users, Calendar, Award, Briefcase, 
  Download, RefreshCw, ChevronDown, Activity, Target
} from 'lucide-react';

interface PayoutSummary {
  period: string;
  start_date: string;
  end_date: string;
  total_jobs: number;
  total_payout: number;
  total_additional_expense: number;
  job_stages: Array<{
    status: string;
    count: number;
    total_payout: number;
    total_additional_expense: number;
  }>;
  payout_by_project?: Array<{
    project_id: number;
    project_name: string;
    job_count: number;
    total_payout: number;
    total_additional_expense: number;
  }>;
}

interface JobTypeData {
  type: string;
  count: number;
  total_payout: number;
  total_additional_expense: number;
  total_cost: number;
  total_size: number;
  avg_rate_per_unit: number;
}

const ProjectAnalytics: React.FC = () => {
  const [payoutData, setPayoutData] = useState<PayoutSummary | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const params: any = { period: selectedPeriod };
        
        if (selectedPeriod === 'month') {
          params.year = selectedYear;
          params.month = selectedMonth;
        } else if (selectedPeriod === 'quarter') {
          params.year = selectedYear;
          params.quarter = selectedQuarter;
        } else if (selectedPeriod === 'year') {
          params.year = selectedYear;
        }

        console.log('Fetching analytics with params:', params);
        const [payoutDataResult, jobsDataResult] = await Promise.all([
          analyticsAPI.getPayoutReport(params),
          jobAPI.getAll({ limit: 1000 })
        ]);
        
        console.log('Analytics data:', payoutDataResult);
        console.log('Jobs data:', jobsDataResult);
        
        if (payoutDataResult) {
          setPayoutData(payoutDataResult);
        } else {
          console.warn('No data received from analytics API');
          setPayoutData(null);
        }

        if (jobsDataResult) {
          setJobs(Array.isArray(jobsDataResult) ? jobsDataResult : []);
        }
      } catch (error: any) {
        console.error('Error fetching analytics:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        setPayoutData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedPeriod, selectedYear, selectedMonth, selectedQuarter]);

  const TYPE_COLORS: Record<string, string> = {
    'Type A': '#3B82F6',
    'Type B': '#10B981',
    'Type C': '#F59E0B',
    'Type D': '#EF4444',
    'Type E': '#8B5CF6',
    'Other': '#6B7280'
  };

  const totalRevenue = payoutData 
    ? payoutData.total_payout + payoutData.total_additional_expense 
    : 0;

  // Group jobs by type
  const jobsByType: Record<string, Job[]> = jobs.reduce((acc, job) => {
    const type = job.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  // Calculate metrics by job type
  const jobTypeData: JobTypeData[] = Object.entries(jobsByType).map(([type, typeJobs]) => {
    const total_payout = typeJobs.reduce((sum, job) => {
      const rate = Number(job.rate) || 0;
      const size = Number(job.size) || 0;
      return sum + (rate * size);
    }, 0);

    const total_additional_expense = typeJobs.reduce((sum, job) => 
      sum + (Number(job.additional_expense) || 0), 0
    );

    const total_size = typeJobs.reduce((sum, job) => 
      sum + (Number(job.size) || 0), 0
    );

    const total_cost = total_payout + total_additional_expense;
    const avg_rate_per_unit = total_size > 0 ? total_cost / total_size : 0;

    return {
      type,
      count: typeJobs.length,
      total_payout,
      total_additional_expense,
      total_cost,
      total_size,
      avg_rate_per_unit
    };
  }).sort((a, b) => b.total_cost - a.total_cost);

  // Find largest project by cost
  const largestProjectByCost = jobs.length > 0 ? jobs.reduce((max, job) => {
    const rate = Number(job.rate) || 0;
    const size = Number(job.size) || 0;
    const expense = Number(job.additional_expense) || 0;
    const totalCost = rate * size + expense;
    
    const maxRate = Number(max.rate) || 0;
    const maxSize = Number(max.size) || 0;
    const maxExpense = Number(max.additional_expense) || 0;
    const maxTotalCost = maxRate * maxSize + maxExpense;
    
    return totalCost > maxTotalCost ? job : max;
  }) : null;

  // Find largest project by per unit cost
  const largestProjectByPerUnit = jobs.length > 0 ? jobs.reduce((max, job) => {
    const rate = Number(job.rate) || 0;
    const size = Number(job.size) || 0;
    const expense = Number(job.additional_expense) || 0;
    const totalCost = rate * size + expense;
    const perUnit = size > 0 ? totalCost / size : 0;
    
    const maxRate = Number(max.rate) || 0;
    const maxSize = Number(max.size) || 0;
    const maxExpense = Number(max.additional_expense) || 0;
    const maxTotalCost = maxRate * maxSize + maxExpense;
    const maxPerUnit = maxSize > 0 ? maxTotalCost / maxSize : 0;
    
    return perUnit > maxPerUnit ? job : max;
  }) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive performance and payout insights</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          disabled={loading}
          className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">Select Period</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="week">This Week</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </div>

          {/* Year Selector */}
          {(selectedPeriod === 'month' || selectedPeriod === 'quarter' || selectedPeriod === 'year') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}

          {/* Month Selector */}
          {selectedPeriod === 'month' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quarter Selector */}
          {selectedPeriod === 'quarter' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={1}>Q1 (Jan-Mar)</option>
                <option value={2}>Q2 (Apr-Jun)</option>
                <option value={3}>Q3 (Jul-Sep)</option>
                <option value={4}>Q4 (Oct-Dec)</option>
              </select>
            </div>
          )}
        </div>

        {payoutData && (
          <div className="mt-4 text-sm text-gray-600">
            Period: {new Date(payoutData.start_date).toLocaleDateString()} - {new Date(payoutData.end_date).toLocaleDateString()}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      ) : payoutData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <Briefcase size={24} className="opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded">Total</span>
              </div>
              <p className="text-3xl font-bold mb-1">{jobs.length}</p>
              <p className="text-blue-100 text-sm">Total Projects</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign size={24} className="opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded">Revenue</span>
              </div>
              <p className="text-3xl font-bold mb-1">₹{totalRevenue.toLocaleString()}</p>
              <p className="text-green-100 text-sm">Total payout</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <Award size={24} className="opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded">Highest</span>
              </div>
              <p className="text-2xl font-bold mb-1">
                ₹{largestProjectByCost ? (
                  (Number(largestProjectByCost.rate) * Number(largestProjectByCost.size) + 
                   Number(largestProjectByCost.additional_expense || 0)).toLocaleString()
                ) : '0'}
              </p>
              <p className="text-purple-100 text-sm truncate">
                {largestProjectByCost?.name || 'No projects'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <Target size={24} className="opacity-80" />
                <span className="text-xs bg-white/20 px-2 py-1 rounded">Per Unit</span>
              </div>
              <p className="text-2xl font-bold mb-1">
                ₹{largestProjectByPerUnit && Number(largestProjectByPerUnit.size) > 0 ? (
                  ((Number(largestProjectByPerUnit.rate) * Number(largestProjectByPerUnit.size) + 
                    Number(largestProjectByPerUnit.additional_expense || 0)) / Number(largestProjectByPerUnit.size)).toLocaleString(undefined, {maximumFractionDigits: 2})
                ) : '0'}
              </p>
              <p className="text-orange-100 text-sm truncate">
                {largestProjectByPerUnit?.name || 'No projects'}
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Job Type Distribution */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Projects by Job Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={jobTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, count }) => `${type}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {jobTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type] || '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Cost by Job Type */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Job Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={jobTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `₹${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Bar dataKey="total_payout" name="Base Payout" fill="#3B82F6" />
                  <Bar dataKey="total_additional_expense" name="Additional" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Job Type Details Table */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Briefcase className="text-blue-600" />
                Job Type Performance
              </h3>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                <Download size={16} />
                Export
              </button>
            </div>
            
            {jobTypeData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Job Type</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Projects</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Area</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Base Payout</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Additional</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Cost</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Avg per Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {jobTypeData.map((typeData, index) => (
                      <tr key={typeData.type} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: TYPE_COLORS[typeData.type] || '#6B7280' }}
                            ></div>
                            <span className="font-medium text-gray-900">{typeData.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{typeData.count}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{typeData.total_size.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right text-gray-700">₹{typeData.total_payout.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-orange-600">₹{typeData.total_additional_expense.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">
                          ₹{typeData.total_cost.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600 font-medium">
                          ₹{typeData.avg_rate_per_unit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Briefcase size={48} className="mx-auto mb-2 opacity-30" />
                <p>No job type data available</p>
              </div>
            )}
          </div>

          {/* Job Type Breakdown */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Type Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobTypeData.map((typeData) => (
                <div 
                  key={typeData.type}
                  className="border-2 rounded-lg p-4"
                  style={{ borderColor: TYPE_COLORS[typeData.type] || '#6B7280' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      {typeData.type}
                    </span>
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[typeData.type] || '#6B7280' }}
                    ></div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{typeData.count}</p>
                  <p className="text-sm text-gray-500 mb-1">
                    Total: ₹{typeData.total_cost.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-600 font-medium">
                    Per Unit: ₹{typeData.avg_rate_per_unit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Activity size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg font-medium mb-2">No data available</p>
          <p className="text-gray-400 text-sm">There are no completed jobs in the selected period.</p>
          <p className="text-gray-400 text-sm mt-1">Try selecting a different time period or check if jobs have been marked as completed.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectAnalytics;
