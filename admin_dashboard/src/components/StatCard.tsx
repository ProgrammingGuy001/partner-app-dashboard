import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
    title: string;
    value: number | string;
    description?: string;
    icon?: React.ReactNode;
    loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, description, icon, loading = false }) => (
    <Card className="overflow-hidden border shadow-none hover:bg-muted/30 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            {icon && React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-4 w-4 text-muted-foreground" })}
        </CardHeader>
        <CardContent>
            {loading ? (
                <Skeleton className="h-8 w-20" />
            ) : (
                <>
                    <div className="text-2xl font-bold tabular-nums text-foreground">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </div>
                    {description && (
                        <p className="text-xs text-muted-foreground mt-1">{description}</p>
                    )}
                </>
            )}
        </CardContent>
    </Card>
);
