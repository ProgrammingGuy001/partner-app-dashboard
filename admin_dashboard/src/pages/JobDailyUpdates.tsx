import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useJobDailyUpdates } from '@/hooks/useJobs';
import type { DailyJobUpdate } from '@/api/services';
import { ArrowLeft, RefreshCw, CalendarDays, Clock, Images, StickyNote, X } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

const JobDailyUpdates: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const jobIdNum = jobId ? Number.parseInt(jobId) : undefined;

  const [dateFilter, setDateFilter] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: updates = [], isLoading, refetch } = useJobDailyUpdates(jobIdNum, {
    update_date: dateFilter || undefined,
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Daily Updates</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Progress photos and notes submitted by the assigned IP
          </p>
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

      {/* Date filter */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date-filter" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filter by date
          </Label>
          <Input
            id="date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-[180px]"
          />
        </div>
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => setDateFilter('')} className="gap-1.5 text-muted-foreground">
            <X size={14} /> Clear
          </Button>
        )}
        <Badge variant="secondary" className="ml-auto">
          {updates.length} update{updates.length === 1 ? '' : 's'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Log</CardTitle>
          <CardDescription>
            Click any photo to enlarge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading updates…</div>
          ) : updates.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/40 p-10 text-center text-sm text-muted-foreground">
              No daily updates found{dateFilter ? ` for ${dateFilter}` : ''}.
            </div>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <UpdateCard key={update.id} update={update} onPhotoClick={setLightboxUrl} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black border-0">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Update "
              className="max-h-[85vh] w-full object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const UpdateCard: React.FC<{
  update: DailyJobUpdate;
  onPhotoClick: (url: string) => void;
}> = ({ update, onPhotoClick }) => {
  const updateDate = new Date(update.update_date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <article className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays size={15} className="text-muted-foreground" />
          {updateDate}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatDateTimeIST(update.created_at)}
          </span>
          <span className="flex items-center gap-1">
            <Images size={12} />
            {update.photos.length} photo{update.photos.length === 1 ? '' : 's'}
          </span>
          <Badge variant="outline" className="text-[10px] py-0">
            {update.submitted_by_type === 'ip' ? 'IP' : 'Supervisor'}
          </Badge>
        </div>
      </div>

      {/* Notes */}
      {update.notes && (
        <div className="flex gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <StickyNote size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="leading-relaxed text-foreground">{update.notes}</p>
        </div>
      )}

      {/* Photos */}
      {update.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {update.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onPhotoClick(photo.photo_url)}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              <img
                src={photo.photo_url}
                alt="Update"
                className="h-28 w-28 object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                <Images size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      )}
    </article>
  );
};

export default JobDailyUpdates;
