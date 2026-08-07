import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_STYLE: Record<Status, string> = {
  success: 'border-success/30 bg-success/15 text-success',
  warning: 'border-warning/30 bg-warning/15 text-warning',
  danger: 'border-destructive/30 bg-destructive/15 text-destructive',
  info: 'border-info/30 bg-info/15 text-info',
  neutral: 'border-border bg-muted text-muted-foreground',
};

interface StatusBadgeProps extends React.ComponentProps<typeof Badge> {
  status: Status;
}

export function StatusBadge({ status, className, children, ...props }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLE[status], className)} {...props}>
      {children}
    </Badge>
  );
}
