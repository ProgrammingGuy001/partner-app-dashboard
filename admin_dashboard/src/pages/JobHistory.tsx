import React from 'react';
import { useParams, Link } from 'react-router-dom';
import type { JobStatusLog } from '@/api/services';
import { useJobHistory } from '@/hooks/useJobs';
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
   const jobIdNum = jobId ? parseInt(jobId) : undefined;
   const { data: history = [], isLoading, refetch } = useJobHistory(jobIdNum);

   const getStatusClass = (status?: string) => {
      switch (status) {
         case 'in_progress': return 'bg-blue-100 text-blue-800 hover:bg-blue-100/80';
         case 'paused': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80';
         case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100/80';
         default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100/80';
      }
   }

   return (
      <div className="flex flex-col gap-5 sm:gap-6">
         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
               <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Job History</h1>
               <p className="text-sm text-muted-foreground sm:text-base">View the status change history for a job</p>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
               <Link to="/dashboard/jobs">
                  <Button variant="outline" className="w-full gap-2 sm:w-auto">
                     <ArrowLeft size={16} /> Back to Jobs
                  </Button>
               </Link>
               <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </Button>
            </div>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>History Log</CardTitle>
            </CardHeader>
            <CardContent>
               {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                     Loading job history...
                  </div>
               ) : (
                  <>
                  <div className="divide-y md:hidden">
                     {history.map((log, index) => (
                        <HistoryMobileCard
                           key={log.id}
                           log={log}
                           index={index}
                           history={history}
                           getStatusClass={getStatusClass}
                        />
                     ))}
                     {history.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">No history found for this job.</div>
                     )}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
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
                  </div>
                  </>
               )}
            </CardContent>
         </Card>
      </div>
   );
};

const HistoryMobileCard: React.FC<{
   log: JobStatusLog;
   index: number;
   history: JobStatusLog[];
   getStatusClass: (status?: string) => string;
}> = ({ log, index, history, getStatusClass }) => {
   const currentTs = log.timestamp || log.created_at;
   const prevTs = history[index - 1]?.timestamp || history[index - 1]?.created_at;
   let duration: number | null = null;
   if (index === 0 && currentTs) {
      if (log.status === 'in_progress' || log.status === 'paused') {
         duration = new Date().getTime() - new Date(currentTs).getTime();
      }
   } else if (currentTs && prevTs) {
      duration = new Date(prevTs).getTime() - new Date(currentTs).getTime();
   }

   return (
      <article className="p-4">
         <div className="flex items-start justify-between gap-3">
            <Badge variant="outline" className={getStatusClass(log.status)}>
               {log.status?.replace('_', ' ').toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
         </div>
         <div className="mt-3 space-y-2 text-sm">
            <div>
               <p className="text-xs uppercase tracking-wide text-muted-foreground">Timestamp</p>
               <p className="mt-1">{currentTs ? formatDateTimeIST(currentTs) : '-'}</p>
            </div>
            <div>
               <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
               <p className="mt-1 text-muted-foreground">{duration ? formatDuration(duration) : '-'}</p>
            </div>
            <div>
               <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
               <p className="mt-1 break-words">{log.notes || <span className="italic text-muted-foreground">No notes</span>}</p>
            </div>
         </div>
      </article>
   );
};

export default JobHistory;
