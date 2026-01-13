import React, { useState, useMemo } from 'react';
import { useJobs } from '@/hooks/useJobs';
import { usePayoutReport } from '@/hooks/useAnalytics';
import { type Job } from '@/api/services';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Download, RefreshCw, Activity, Calendar, Briefcase
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  // Construct params for payout report
  const reportParams = useMemo(() => {
    const params: { period: string; year?: number; month?: number; quarter?: number } = {
      period: selectedPeriod
    };
    if (selectedPeriod === 'month') {
      params.year = selectedYear;
      params.month = selectedMonth;
    } else if (selectedPeriod === 'quarter') {
      params.year = selectedYear;
      params.quarter = selectedQuarter;
    } else if (selectedPeriod === 'year') {
      params.year = selectedYear;
    }
    return params;
  }, [selectedPeriod, selectedYear, selectedMonth, selectedQuarter]);

  // Fetch data using hooks
  const { data: payoutData, isLoading: payoutLoading, refetch: refetchPayout } = usePayoutReport(reportParams);
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useJobs({ limit: 1000 });

  const loading = payoutLoading || jobsLoading;
  
  const jobs = useMemo(() => (jobsData as Job[]) || [], [jobsData]);

  const handleRefresh = () => {
    refetchPayout();
    refetchJobs();
  };

  // Neutral Color Palette for Charts
  const TYPE_COLORS: Record<string, string> = {
    'Type A': '#18181b', // zinc-950
    'Type B': '#52525b', // zinc-600
    'Type C': '#a1a1aa', // zinc-400
    'Type D': '#d4d4d8', // zinc-300
    'Type E': '#e4e4e7', // zinc-200
    'Other': '#f4f4f5'   // zinc-100
  };

  const totalRevenue = useMemo(() => 
    payoutData ? payoutData.total_payout + payoutData.total_additional_expense : 0
  , [payoutData]);

  // Group jobs by type
  const jobsByType: Record<string, Job[]> = useMemo(() => 
    jobs.reduce((acc, job) => {
      const type = job.type || 'Other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(job);
      return acc;
    }, {} as Record<string, Job[]>)
  , [jobs]);

  // Calculate metrics by job type
  const jobTypeData: JobTypeData[] = useMemo(() => 
    Object.entries(jobsByType).map(([type, typeJobs]) => {
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
    }).sort((a, b) => b.total_cost - a.total_cost)
  , [jobsByType]);

  // Find largest project by cost
  const largestProjectByCost = useMemo(() => 
    jobs.length > 0 ? jobs.reduce((max, job) => {
      const rate = Number(job.rate) || 0;
      const size = Number(job.size) || 0;
      const expense = Number(job.additional_expense) || 0;
      const totalCost = rate * size + expense;
      
      const maxRate = Number(max.rate) || 0;
      const maxSize = Number(max.size) || 0;
      const maxExpense = Number(max.additional_expense) || 0;
      const maxTotalCost = maxRate * maxSize + maxExpense;
      
      return totalCost > maxTotalCost ? job : max;
    }) : null
  , [jobs]);

  // Find largest project by per unit cost
  const largestProjectByPerUnit = useMemo(() => 
    jobs.length > 0 ? jobs.reduce((max, job) => {
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
    }) : null
  , [jobs]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Reports</h1>
          <p className="text-muted-foreground">Comprehensive performance and payout insights</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4 text-muted-foreground">
            <Calendar size={20} />
            <h2 className="text-lg font-semibold text-foreground">Select Period</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Period Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                 <SelectTrigger>
                    <SelectValue placeholder="Select Period" />
                 </SelectTrigger>
                 <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                 </SelectContent>
              </Select>
            </div>

            {/* Year Selector */}
            {(selectedPeriod === 'month' || selectedPeriod === 'quarter' || selectedPeriod === 'year') && (
               <div className="space-y-2">
                 <label className="text-sm font-medium">Year</label>
                 <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                    <SelectTrigger>
                       <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                       {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
               </div>
            )}

            {/* Month Selector */}
            {selectedPeriod === 'month' && (
              <div className="space-y-2">
                 <label className="text-sm font-medium">Month</label>
                 <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                    <SelectTrigger>
                       <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                       {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <SelectItem key={month} value={month.toString()}>
                             {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                          </SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>
            )}

            {/* Quarter Selector */}
            {selectedPeriod === 'quarter' && (
               <div className="space-y-2">
                  <label className="text-sm font-medium">Quarter</label>
                  <Select value={selectedQuarter.toString()} onValueChange={(val) => setSelectedQuarter(parseInt(val))}>
                     <SelectTrigger>
                        <SelectValue placeholder="Select Quarter" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                        <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                        <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                        <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            )}
          </div>

          {payoutData && (
            <div className="mt-4 text-sm text-muted-foreground">
              Period: {new Date(payoutData.start_date).toLocaleDateString()} - {new Date(payoutData.end_date).toLocaleDateString()}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && !payoutData ? (
        <div className="p-12 text-center">
          <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      ) : payoutData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="@container/card">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="text-2xl font-bold tabular-nums @[200px]/card:text-3xl @[300px]/card:text-4xl transition-all duration-300">{jobs.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total Projects</p>
               </CardContent>
            </Card>

            <Card className="@container/card">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="text-2xl font-bold tabular-nums @[200px]/card:text-3xl @[300px]/card:text-4xl transition-all duration-300">₹{totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total payout</p>
               </CardContent>
            </Card>

            <Card className="@container/card">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Highest</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="text-2xl font-bold tabular-nums @[200px]/card:text-3xl @[300px]/card:text-4xl transition-all duration-300">
                     ₹{largestProjectByCost ? (
                        (Number(largestProjectByCost.rate) * Number(largestProjectByCost.size) + 
                        Number(largestProjectByCost.additional_expense || 0)).toLocaleString()
                     ) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                     {largestProjectByCost?.name || 'No projects'}
                  </p>
               </CardContent>
            </Card>

            <Card className="@container/card">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Per Unit</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="text-2xl font-bold tabular-nums @[200px]/card:text-3xl @[300px]/card:text-4xl transition-all duration-300">
                     ₹{largestProjectByPerUnit && Number(largestProjectByPerUnit.size) > 0 ? (
                        ((Number(largestProjectByPerUnit.rate) * Number(largestProjectByPerUnit.size) + 
                          Number(largestProjectByPerUnit.additional_expense || 0)) / Number(largestProjectByPerUnit.size)).toLocaleString(undefined, {maximumFractionDigits: 2})
                     ) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                     {largestProjectByPerUnit?.name || 'No projects'}
                  </p>
               </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Job Type Distribution */}
            <Card>
               <CardHeader>
                  <CardTitle>Projects by Job Type</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
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
                                 <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type] || '#71717a'} />
                              ))}
                           </Pie>
                           <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }} />
                           <Legend />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
               </CardContent>
            </Card>

            {/* Cost by Job Type */}
            <Card>
               <CardHeader>
                  <CardTitle>Cost by Job Type</CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={jobTypeData}>
                           <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                           <XAxis dataKey="type" stroke="var(--muted-foreground)" />
                           <YAxis stroke="var(--muted-foreground)" />
                           <Tooltip 
                              formatter={(value: number) => `₹${value.toLocaleString()}`}
                              contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                              cursor={{fill: 'var(--muted)'}}
                           />
                           <Legend />
                           <Bar dataKey="total_payout" name="Base Payout" fill="#18181b" radius={[4, 4, 0, 0]} />
                           <Bar dataKey="total_additional_expense" name="Additional" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </CardContent>
            </Card>
          </div>

          {/* Job Type Details Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
               <CardTitle className="flex items-center gap-2">
                  <Briefcase className="text-muted-foreground" />
                  Job Type Performance
               </CardTitle>
               <Button variant="ghost">
                  <Download size={16} className="mr-2" />
                  Export
               </Button>
            </CardHeader>
            <CardContent>
              {jobTypeData.length > 0 ? (
                <Table>
                   <TableHeader>
                      <TableRow>
                         <TableHead>Rank</TableHead>
                         <TableHead>Job Type</TableHead>
                         <TableHead className="text-right">Projects</TableHead>
                         <TableHead className="text-right">Total Area</TableHead>
                         <TableHead className="text-right">Base Payout</TableHead>
                         <TableHead className="text-right">Additional</TableHead>
                         <TableHead className="text-right">Total Cost</TableHead>
                         <TableHead className="text-right">Avg per Unit</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {jobTypeData.map((typeData, index) => (
                         <TableRow key={typeData.type}>
                            <TableCell>
                               <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                                  {index + 1}
                               </span>
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-2">
                                  <div 
                                     className="w-3 h-3 rounded-full"
                                     style={{ backgroundColor: TYPE_COLORS[typeData.type] || '#71717a' }}
                                  ></div>
                                  <span className="font-medium">{typeData.type}</span>
                               </div>
                            </TableCell>
                            <TableCell className="text-right">{typeData.count}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{typeData.total_size.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                            <TableCell className="text-right text-muted-foreground">₹{typeData.total_payout.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-muted-foreground">₹{typeData.total_additional_expense.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-medium">
                               ₹{typeData.total_cost.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                               ₹{typeData.avg_rate_per_unit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                            </TableCell>
                         </TableRow>
                      ))}
                   </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                   <Briefcase size={48} className="mx-auto mb-2 opacity-30" />
                   <p>No job type data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job Type Breakdown */}
          <Card>
             <CardHeader>
                <CardTitle>Job Type Breakdown</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {jobTypeData.map((typeData) => (
                      <div 
                         key={typeData.type}
                         className="border rounded-lg p-4"
                         style={{ borderLeftColor: TYPE_COLORS[typeData.type] || '#71717a', borderLeftWidth: '4px' }}
                      >
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">
                               {typeData.type}
                            </span>
                         </div>
                         <p className="text-2xl font-bold mb-1">{typeData.count}</p>
                         <p className="text-sm text-muted-foreground mb-1">
                            Total: ₹{typeData.total_cost.toLocaleString()}
                         </p>
                         <p className="text-xs text-muted-foreground font-medium">
                            Per Unit: ₹{typeData.avg_rate_per_unit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                         </p>
                      </div>
                   ))}
                </div>
             </CardContent>
          </Card>
        </>
      ) : (
        <Card className="p-12 text-center">
          <Activity size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No data available</p>
          <p className="text-muted-foreground text-sm">There are no completed jobs in the selected period.</p>
        </Card>
      )}
    </div>
  );
};

export default ProjectAnalytics;
