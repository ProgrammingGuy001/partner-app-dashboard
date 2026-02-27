import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobAPI, type JobStatusLog } from '@/api/services';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { formatDateTimeIST, formatDuration } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const JobHistory: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [history, setHistory] = useState<JobStatusLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
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
  }, [jobId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);



  // Helper for custom colors since Badge variants are limited
  const getStatusClass = (status?: string) => {
     switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800 hover:bg-blue-100/80';
      case 'paused': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80';
      case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100/80';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100/80';
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job History</h1>
          <p className="text-muted-foreground">View the status change history for a job</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/jobs">
            <Button variant="outline" className="gap-2">
               <ArrowLeft size={16} /> Back to Jobs
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={fetchHistory} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
         <CardHeader>
            <CardTitle>History Log</CardTitle>
         </CardHeader>
         <CardContent>
            {loading ? (
               <div className="p-8 text-center text-muted-foreground">
                  Loading job history...
               </div>
            ) : (
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Timestamp (IST)</TableHead>
                        <TableHead>Duration</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {history.map((log, index) => {
                        const currentTs = log.timestamp || log.created_at;
                        const prevTs = history[index - 1]?.timestamp || history[index - 1]?.created_at;
                        let duration = null;
                        if (index === 0 && currentTs) {
                          if (log.status === 'in_progress' || log.status === 'paused') {
                            duration = new Date().getTime() - new Date(currentTs).getTime();
                          }
                        } else if (currentTs && prevTs) {
                          duration = new Date(prevTs).getTime() - new Date(currentTs).getTime();
                        }
                        
                        return (
                          <TableRow key={log.id}>
                             <TableCell>
                                <Badge variant="outline" className={getStatusClass(log.status)}>
                                   {log.status?.replace('_', ' ').toUpperCase()}
                                </Badge>
                             </TableCell>
                             <TableCell>{log.notes}</TableCell>
                             <TableCell>{currentTs ? formatDateTimeIST(currentTs) : '-'}</TableCell>
                             <TableCell className="text-muted-foreground">
                                {duration ? formatDuration(duration) : '-'}
                             </TableCell>
                          </TableRow>
                        );
                     })}
                     {history.length === 0 && (
                        <TableRow>
                           <TableCell colSpan={4} className="h-24 text-center">
                              No history found for this job.
                           </TableCell>
                        </TableRow>
                     )}
                  </TableBody>
               </Table>
            )}
         </CardContent>
      </Card>
    </div>
  );
};

export default JobHistory;
