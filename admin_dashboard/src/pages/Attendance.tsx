import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authAPI } from '@/api/services';
import {
  useAttendance,
  useMyAdminAttendance,
  useAllAdminAttendance,
  useMarkAdminAttendance,
} from '@/hooks/useAttendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  IconCalendarCheck,
  IconCamera,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import type {
  AdminAttendanceCompletion,
  AdminAttendanceRecord,
  AttendanceCompletion,
  DailyAttendance,
  IPAttendanceCompletion,
} from '@/api/services';
import { toast } from 'sonner';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCoordinates(record: Pick<AdminAttendanceRecord | DailyAttendance, 'latitude' | 'longitude'>) {
  if (record.latitude == null || record.longitude == null) return null;
  return `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`;
}

function googleMapsUrl(record: Pick<AdminAttendanceRecord | DailyAttendance, 'latitude' | 'longitude'>) {
  if (record.latitude == null || record.longitude == null) return null;
  return `https://www.google.com/maps?q=${record.latitude},${record.longitude}`;
}

function CoordinateLink({
  record,
}: {
  record: Pick<AdminAttendanceRecord | DailyAttendance, 'latitude' | 'longitude'>;
}) {
  const coordinates = formatCoordinates(record);
  const url = googleMapsUrl(record);
  if (!coordinates || !url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-primary underline-offset-2 hover:underline"
    >
      {coordinates}
    </a>
  );
}

function CompletionCard({
  title,
  subtitle,
  completion,
}: {
  title: string;
  subtitle?: string;
  completion?: AttendanceCompletion;
}) {
  if (!completion) return null;
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="break-words text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className="text-3xl font-bold mt-1">
          {completion.completed_days}/{completion.total_days}
        </div>
        <div className="text-xs text-muted-foreground">
          {subtitle || `${completion.missing_days} missing days`}
        </div>
        <Badge variant="secondary" className="mt-3">
          {completion.completion_percentage}% complete
        </Badge>
      </CardContent>
    </Card>
  );
}

function AdminCompletionGrid({ summaries }: { summaries: AdminAttendanceCompletion[] }) {
  if (summaries.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {summaries.map(summary => (
        <CompletionCard
          key={summary.admin_id}
          title={summary.admin_email}
          subtitle={`${summary.missing_days} missing days since registration`}
          completion={summary}
        />
      ))}
    </div>
  );
}

function IPCompletionGrid({ summaries }: { summaries: IPAttendanceCompletion[] }) {
  if (summaries.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {summaries.map(summary => (
        <CompletionCard
          key={summary.ip_id}
          title={summary.name}
          subtitle={`${summary.phone} · ${summary.missing_days} missing days`}
          completion={summary}
        />
      ))}
    </div>
  );
}

function AttendanceTable({
  records,
  showAdmin,
}: {
  records: AdminAttendanceRecord[];
  showAdmin: boolean;
}) {
  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">No attendance records found.</div>
    );
  }
  return (
    <>
      <div className="divide-y md:hidden">
        {records.map((r, idx) => (
          <AdminAttendanceCard key={r.id} record={r} index={idx} showAdmin={showAdmin} />
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              {showAdmin && <TableHead>Admin</TableHead>}
              <TableHead>Date & Time</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r, idx) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                {showAdmin && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <IconUser className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{r.admin_email}</span>
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <div className="text-sm font-medium">{formatDateOnly(r.marked_at)}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(r.marked_at)}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.manual_location || formatCoordinates(r) ? (
                    <div className="flex items-start gap-1.5 text-foreground">
                      <IconMapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                      <div>
                        {r.manual_location && <div>{r.manual_location}</div>}
                        {formatCoordinates(r) && (
                          <CoordinateLink record={r} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="italic">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.photo_url ? (
                    <a href={r.photo_url} target="_blank" rel="noreferrer" className="inline-block">
                      <img
                        src={r.photo_url}
                        alt="Attendance"
                        className="h-12 w-16 rounded border object-cover"
                      />
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.notes || <span className="italic">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function AdminAttendanceCard({
  record,
  index,
  showAdmin,
}: {
  record: AdminAttendanceRecord;
  index: number;
  showAdmin: boolean;
}) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{formatDateOnly(record.marked_at)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(record.marked_at)}</p>
        </div>
        <Badge variant="outline">#{index + 1}</Badge>
      </div>

      {showAdmin && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            <IconUser className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="min-w-0 truncate text-sm font-medium">{record.admin_email}</span>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-sm">
        <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          {record.manual_location ? <p className="break-words">{record.manual_location}</p> : null}
          {formatCoordinates(record) ? <CoordinateLink record={record} /> : null}
          {!record.manual_location && !formatCoordinates(record) ? (
            <p className="italic text-muted-foreground">No location</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[5rem_1fr] gap-3">
        {record.photo_url ? (
          <a href={record.photo_url} target="_blank" rel="noreferrer" className="block">
            <img src={record.photo_url} alt="Attendance" className="h-16 w-20 rounded border object-cover" />
          </a>
        ) : (
          <div className="flex h-16 w-20 items-center justify-center rounded border text-xs italic text-muted-foreground">No photo</div>
        )}
        <div className="min-w-0 text-sm text-muted-foreground">
          <p className="text-xs font-medium uppercase tracking-wide">Notes</p>
          <p className="mt-1 break-words">{record.notes || <span className="italic">No notes</span>}</p>
        </div>
      </div>
    </article>
  );
}

function IPAttendanceTable({ records }: { records: DailyAttendance[] }) {
  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">No IP attendance records found.</div>
    );
  }

  return (
    <>
    <div className="divide-y md:hidden">
      {records.map((r, idx) => (
        <IPAttendanceCard key={r.id} record={r} index={idx} />
      ))}
    </div>
    <div className="hidden overflow-x-auto md:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>IP</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Date & Time</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Photo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r, idx) => (
          <TableRow key={r.id}>
            <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <IconUser className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">{r.phone}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.job_name || (r.job_id ? `Job #${r.job_id}` : 'Independent')}
            </TableCell>
            <TableCell>
              <div className="text-sm font-medium">{formatDateOnly(r.recorded_at)}</div>
              <div className="text-xs text-muted-foreground">{formatDate(r.recorded_at)}</div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.manual_location || formatCoordinates(r) ? (
                <div className="flex items-start gap-1.5 text-foreground">
                  <IconMapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                  <div>
                    {r.manual_location && <div>{r.manual_location}</div>}
                    {formatCoordinates(r) && (
                      <CoordinateLink record={r} />
                    )}
                  </div>
                </div>
              ) : (
                <span className="italic">—</span>
              )}
            </TableCell>
            <TableCell>
              {r.photo_url ? (
                <a href={r.photo_url} target="_blank" rel="noreferrer" className="inline-block">
                  <img
                    src={r.photo_url}
                    alt="IP attendance"
                    className="h-12 w-16 rounded border object-cover"
                  />
                </a>
              ) : (
                <span className="text-sm text-muted-foreground italic">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
    </>
  );
}

function IPAttendanceCard({ record, index }: { record: DailyAttendance; index: number }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{record.phone}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {record.job_name || (record.job_id ? `Job #${record.job_id}` : 'Independent')}
          </p>
        </div>
        <Badge variant="outline">#{index + 1}</Badge>
      </div>

      <div className="mt-3 text-sm">
        <p className="font-medium">{formatDateOnly(record.recorded_at)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(record.recorded_at)}</p>
      </div>

      <div className="mt-3 flex items-start gap-2 text-sm">
        <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          {record.manual_location ? <p className="break-words">{record.manual_location}</p> : null}
          {formatCoordinates(record) ? <CoordinateLink record={record} /> : null}
          {!record.manual_location && !formatCoordinates(record) ? (
            <p className="italic text-muted-foreground">No location</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        {record.photo_url ? (
          <a href={record.photo_url} target="_blank" rel="noreferrer" className="inline-block">
            <img src={record.photo_url} alt="IP attendance" className="h-16 w-20 rounded border object-cover" />
          </a>
        ) : (
          <span className="text-sm italic text-muted-foreground">No photo</span>
        )}
      </div>
    </article>
  );
}

const MarkAttendanceDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [notes, setNotes] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [locating, setLocating] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const markMutation = useMarkAdminAttendance();

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCameraStream(), []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera is not supported in this browser');
      return;
    }

    setOpeningCamera(true);
    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error('Unable to access camera. Please allow camera permission.');
    } finally {
      setOpeningCamera(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (!blob) {
      toast.error('Failed to capture photo. Please try again.');
      return;
    }

    const file = new File([blob], `admin-attendance-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setCameraOpen(false);
    stopCameraStream();
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoPreview(null);
  }

  function closeCamera() {
    setCameraOpen(false);
    stopCameraStream();
  }

  function handleClose() {
    closeCamera();
    onClose();
  }

  async function handleMark() {
    if (!photo) {
      toast.error('Photo is required for attendance');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Location is not supported in this browser');
      return;
    }

    setLocating(true);
    let latitude: number;
    let longitude: number;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
        }),
      );
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch {
      toast.error('Could not get location. Please allow location access.');
      setLocating(false);
      return;
    } finally {
      setLocating(false);
    }

    markMutation.mutate({
      latitude,
      longitude,
      notes: notes.trim() || undefined,
      manual_location: manualLocation.trim() || undefined,
      photo,
    }, {
      onSuccess: () => {
        setNotes('');
        setManualLocation('');
        setPhoto(null);
        setPhotoPreview(null);
        onClose();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="flex max-h-[calc(100svh-1rem)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground">
            Recording attendance for <strong>{new Date().toDateString()}</strong>
          </p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Camera photo</label>
            {photoPreview ? (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-lg border bg-muted">
                  <img src={photoPreview} alt="Attendance capture" className="h-56 w-full object-cover" />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 h-8 w-8"
                    onClick={removePhoto}
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={openCamera}>
                  <IconCamera className="h-4 w-4 mr-2" />
                  Retake from camera
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-28 w-full border-dashed"
                onClick={openCamera}
                disabled={openingCamera}
              >
                <IconCamera className="h-5 w-5 mr-2" />
                {openingCamera ? 'Opening camera...' : 'Open camera'}
              </Button>
            )}
            {cameraOpen && (
              <div className="mt-3 space-y-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-48 sm:h-64 w-full rounded-lg border bg-black object-cover"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" onClick={capturePhoto}>
                    Capture
                  </Button>
                  <Button type="button" variant="outline" onClick={closeCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-xs text-muted-foreground">
              Gallery upload is disabled; attendance photos must be captured from the camera.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Location (optional)</label>
            <Input
              placeholder="Office, client site, branch, or area"
              value={manualLocation}
              onChange={e => setManualLocation(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <Textarea
              placeholder="Add a note..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleMark} disabled={markMutation.isPending || locating || !photo}>
            {locating ? 'Getting location...' : markMutation.isPending ? 'Marking...' : 'Mark Attendance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AdminView: React.FC = () => {
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const { data, isLoading, refetch } = useMyAdminAttendance({ limit: 50 });
  const {
    data: ipData,
    isLoading: ipLoading,
    refetch: refetchIPAttendance,
  } = useAttendance({ limit: 200 });
  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const ipRecords = ipData?.records ?? [];
  const ipTotal = ipData?.total ?? 0;
  const ipCompletionSummary = ipData?.completion_summary ?? [];

  function refreshAll() {
    void refetch();
    void refetchIPAttendance();
  }

  const todayStr = new Date().toDateString();
  const markedToday = records.some(
    r => new Date(r.marked_at).toDateString() === todayStr
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Mark and view your attendance history</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <IconRefresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowMarkDialog(true)}>
            <IconCalendarCheck className="h-4 w-4 mr-2" />
            Mark Attendance
          </Button>
        </div>
      </div>

      {/* Today status */}
      <Card className={markedToday ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20'}>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${markedToday ? 'bg-green-500/20' : 'bg-orange-400/20'}`}>
              <IconCalendarCheck className={`h-5 w-5 ${markedToday ? 'text-green-600' : 'text-orange-500'}`} />
            </div>
            <div>
              <div className="font-semibold text-sm">
                {markedToday ? 'Attendance marked for today' : 'Not yet marked for today'}
              </div>
              <div className="text-xs text-muted-foreground">{new Date().toDateString()}</div>
            </div>
            {!markedToday && (
              <Button size="sm" className="sm:ml-auto" onClick={() => setShowMarkDialog(true)}>
                Mark Now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <CompletionCard
        title="My attendance completion"
        subtitle={`${data?.completion?.missing_days ?? 0} missing days since registration`}
        completion={data?.completion}
      />

      {/* History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Attendance History</CardTitle>
          <Badge variant="secondary">{total} records</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <AttendanceTable records={records} showAdmin={false} />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Assigned IP Attendance</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Attendance records for IPs assigned to you
          </p>
        </div>
        <IPCompletionGrid summaries={ipCompletionSummary} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Assigned IP Records</CardTitle>
            <Badge variant="secondary">{ipTotal} total</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {ipLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <IPAttendanceTable records={ipRecords} />
            )}
          </CardContent>
        </Card>
      </div>

      <MarkAttendanceDialog open={showMarkDialog} onClose={() => setShowMarkDialog(false)} />
    </div>
  );
};

const SuperAdminView: React.FC = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{
    date_from?: string;
    date_to?: string;
  }>({});

  const {
    data: adminData,
    isLoading: adminLoading,
    refetch: refetchAdminAttendance,
  } = useAllAdminAttendance({
    limit: 200,
    ...appliedFilters,
  });
  const {
    data: ipData,
    isLoading: ipLoading,
    refetch: refetchIPAttendance,
  } = useAttendance({
    limit: 200,
    ...appliedFilters,
  });

  const adminRecords = adminData?.records ?? [];
  const adminTotal = adminData?.total ?? 0;
  const adminCompletionSummary = adminData?.completion_summary ?? [];
  const ipRecords = ipData?.records ?? [];
  const ipTotal = ipData?.total ?? 0;
  const ipCompletionSummary = ipData?.completion_summary ?? [];

  function applyFilters() {
    setAppliedFilters({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  }

  function clearFilters() {
    setDateFrom('');
    setDateTo('');
    setAppliedFilters({});
  }

  function refreshAll() {
    void refetchAdminAttendance();
    void refetchIPAttendance();
  }

  const hasFilters = Object.values(appliedFilters).some(Boolean);

  // Group by admin for summary
  const adminSummary = adminRecords.reduce<Record<string, { email: string; count: number }>>((acc, r) => {
    if (!acc[r.admin_id]) acc[r.admin_id] = { email: r.admin_email, count: 0 };
    acc[r.admin_id].count += 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Admin and IP attendance records</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <IconRefresh className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Admin Attendance</div>
            <div className="text-3xl font-bold mt-1">{adminTotal}</div>
            <div className="text-xs text-muted-foreground">{hasFilters ? 'in selected period' : 'total records'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">IP Attendance</div>
            <div className="text-3xl font-bold mt-1">{ipTotal}</div>
            <div className="text-xs text-muted-foreground">{hasFilters ? 'in selected period' : 'total records'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Admin Completion</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Completed attendance days out of days since each admin registered
          </p>
        </div>
        <AdminCompletionGrid summaries={adminCompletionSummary} />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">IP Completion</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Completed attendance days out of days since each IP registered
          </p>
        </div>
        <IPCompletionGrid summaries={ipCompletionSummary} />
      </div>

      {/* Admin summary cards */}
      {Object.keys(adminSummary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(adminSummary).map(([adminId, { email, count }]) => (
            <Card key={adminId} className="p-3">
              <div className="text-xs text-muted-foreground truncate">{email}</div>
              <div className="text-2xl font-bold mt-1">{count}</div>
              <div className="text-xs text-muted-foreground">
                {hasFilters ? 'in period' : 'total'}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">From date</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full lg:w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">To date</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full lg:w-40" />
            </div>
            <Button onClick={applyFilters} size="sm" className="w-full lg:w-auto">
              <IconSearch className="h-4 w-4 mr-2" />
              Filter
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full lg:w-auto">
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin records table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Admin Records</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{adminTotal} total</Badge>
            {hasFilters && <Badge variant="outline">Filtered</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {adminLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <AttendanceTable records={adminRecords} showAdmin />
          )}
        </CardContent>
      </Card>

      {/* IP records table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">IP Records</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{ipTotal} total</Badge>
            {hasFilters && <Badge variant="outline">Filtered</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {ipLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <IPAttendanceTable records={ipRecords} />
          )}
        </CardContent>
      </Card>

    </div>
  );
};

const Attendance: React.FC = () => {
  const { data: userData, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return userData?.is_superadmin ? <SuperAdminView /> : <AdminView />;
};

export default Attendance;
