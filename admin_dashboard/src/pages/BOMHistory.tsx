
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bomAPI, type SODetail } from '@/api/bom';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, RefreshCw, Box, Eye } from 'lucide-react';
import { toast } from "sonner";

const BOMHistory: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedSO, setSelectedSO] = useState<SODetail | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    const handleDownload = async (soId: number, salesOrder: string) => {
        setDownloadingId(soId);
        try {
            await bomAPI.downloadRepairOrder(soId, salesOrder);
        } catch {
            toast.error('Failed to download repair order');
        } finally {
            setDownloadingId(null);
        }
    };

    const { data: history, isLoading, refetch } = useQuery({
        queryKey: ['bom-history'],
        queryFn: () => bomAPI.getHistory(100, 0),
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: 'pending' | 'completed' }) =>
            bomAPI.updateStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bom-history'] });
            toast.success("Status updated successfully");
            setIsDetailsOpen(false);
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : "Failed to update status");
        }
    });

    const handleStatusUpdate = (status: 'pending' | 'completed') => {
        if (selectedSO) {
            updateStatusMutation.mutate({ id: selectedSO.id, status });
        }
    };

    const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
        switch (status) {
            case 'pending': return 'secondary';
            case 'completed': return 'default'; // standard for completed
            default: return 'outline';
        }
    };

    const formatDateOnly = (dateString?: string) => {
        if (!dateString) return 'N/A';

        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [year, month, day] = dateString.split('-').map(Number);
            return new Date(year, month - 1, day).toLocaleDateString();
        }

        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 sm:gap-6 lg:gap-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">BOM Requisites</h1>
                    <p className="text-sm text-muted-foreground sm:text-base">Manage site requisitions and material requests</p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    className="self-start sm:self-auto"
                    onClick={() => refetch()}
                    disabled={isLoading}
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Requisition History</CardTitle>
                    <CardDescription>
                        List of all BOM submissions from partners
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border md:hidden">
                        {isLoading ? (
                            <div className="flex h-24 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : history?.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No requisitions found.</div>
                        ) : (
                            <div className="divide-y">
                                {history?.map((item) => (
                                    <BOMMobileCard
                                        key={item.id}
                                        item={item}
                                        downloadingId={downloadingId}
                                        getStatusVariant={getStatusVariant}
                                        onDownload={handleDownload}
                                        onDetails={() => {
                                            setSelectedSO(item);
                                            setIsDetailsOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="hidden rounded-md border md:block md:overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sales Order</TableHead>
                                    <TableHead>Partner POC</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Cabinet Position</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24">
                                            <div className="flex justify-center items-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : history?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                            No requisitions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history?.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.sales_order}</TableCell>
                                            <TableCell>{item.sr_poc || '-'}</TableCell>
                                            <TableCell>{new Date(item.created_date).toLocaleDateString()}</TableCell>
                                            <TableCell>{item.cabinet_position || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="gap-1">
                                                    <Box className="h-3 w-3" />
                                                    {item.site_requisites.length}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(item.status)}>
                                                    {item.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={downloadingId === item.id}
                                                        onClick={() => handleDownload(item.id, item.sales_order)}
                                                    >
                                                        {downloadingId === item.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Download className="h-4 w-4 mr-2" />
                                                        )}
                                                        Repair Order
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedSO(item);
                                                            setIsDetailsOpen(true);
                                                        }}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        Details
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Details Modal */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="flex max-h-[calc(100svh-1rem)] flex-col p-0 sm:max-w-3xl">
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Requisition Details - {selectedSO?.sales_order}</DialogTitle>
                        <DialogDescription>
                            Review items and update status
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSO && (
                        <div className="flex flex-col gap-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Cabinet Position:</span>
                                    <p className="font-medium">{selectedSO.cabinet_position || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">POC:</span>
                                    <p className="font-medium">{selectedSO.sr_poc}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Created:</span>
                                    <p>{new Date(selectedSO.created_date).toLocaleString()}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Current Status:</span>
                                    <Badge className="ml-2" variant={getStatusVariant(selectedSO.status)}>
                                        {selectedSO.status.toUpperCase()}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Customer:</span>
                                    <p className="font-medium">{selectedSO.customer_name || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Project Name:</span>
                                    <p className="font-medium">{selectedSO.project_name || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">SO POC:</span>
                                    <p className="font-medium">{selectedSO.so_poc || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Sale Order Status:</span>
                                    <p className="font-medium">{selectedSO.so_status || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Repair Reference:</span>
                                    <p className="font-medium">{selectedSO.repair_reference || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Expected Delivery:</span>
                                    <p className="font-medium">{formatDateOnly(selectedSO.expected_delivery)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">DO Number:</span>
                                    <p className="font-medium">{selectedSO.do_number || 'N/A'}</p>
                                </div>
                                <div className="md:col-span-2 xl:col-span-3">
                                    <span className="text-muted-foreground">Delivery Address:</span>
                                    <p className="font-medium">{selectedSO.delivery_address || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="rounded-md border md:hidden">
                                <div className="divide-y">
                                    {selectedSO.site_requisites.map((req) => (
                                        <article key={req.id} className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <h4 className="min-w-0 break-words text-sm font-semibold">{req.product_name}</h4>
                                                <Badge variant="outline" className="shrink-0">Qty {req.quantity}</Badge>
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Component Status</p>
                                                    <p>{req.component_status || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Department</p>
                                                    {req.responsible_department ? (
                                                        <Badge variant="outline" className="capitalize">{req.responsible_department}</Badge>
                                                    ) : (
                                                        <p>-</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Issue</p>
                                                    <p className="break-words text-muted-foreground">{req.issue_description || '-'}</p>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>

                            <div className="hidden rounded-md border md:block md:overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Component Status</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Issue</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedSO.site_requisites.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell className="font-medium">{req.product_name}</TableCell>
                                                <TableCell>{req.quantity}</TableCell>
                                                <TableCell>{req.component_status || '-'}</TableCell>
                                                <TableCell>
                                                    {req.responsible_department ? (
                                                        <Badge variant="outline" className="capitalize">
                                                            {req.responsible_department}
                                                        </Badge>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {req.issue_description || '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-muted/50 p-4 rounded-lg">
                                <span className="font-medium text-sm">Update Status:</span>
                                <Select
                                    defaultValue={selectedSO.status}
                                    onValueChange={(val) => handleStatusUpdate(val as 'pending' | 'completed')}
                                    disabled={updateStatusMutation.isPending}
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">PENDING</SelectItem>
                                        <SelectItem value="completed">COMPLETED</SelectItem>
                                    </SelectContent>
                                </Select>
                                {updateStatusMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>
                        </div>
                    )}

                    </div>
                    <DialogFooter className="gap-2 border-t p-4 sm:p-6">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={downloadingId === selectedSO?.id}
                            onClick={() => selectedSO && handleDownload(selectedSO.id, selectedSO.sales_order)}
                        >
                            {downloadingId === selectedSO?.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Download Repair Order
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDetailsOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const BOMMobileCard: React.FC<{
    item: SODetail;
    downloadingId: number | null;
    getStatusVariant: (status: string) => 'default' | 'secondary' | 'outline';
    onDownload: (soId: number, salesOrder: string) => void;
    onDetails: () => void;
}> = ({ item, downloadingId, getStatusVariant, onDownload, onDetails }) => (
    <article className="p-4">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{item.sales_order}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.created_date).toLocaleDateString()} · {item.sr_poc || 'No POC'}
                </p>
            </div>
            <Badge variant={getStatusVariant(item.status)} className="shrink-0">
                {item.status.toUpperCase()}
            </Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
                <p className="text-muted-foreground">Cabinet</p>
                <p className="mt-0.5 font-medium">{item.cabinet_position || '-'}</p>
            </div>
            <div>
                <p className="text-muted-foreground">Items</p>
                <p className="mt-0.5 font-medium">{item.site_requisites.length}</p>
            </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={downloadingId === item.id}
                onClick={() => onDownload(item.id, item.sales_order)}
            >
                {downloadingId === item.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                Order
            </Button>
            <Button variant="ghost" size="sm" onClick={onDetails}>
                <Eye className="mr-2 h-4 w-4" />
                Details
            </Button>
        </div>
    </article>
);

export default BOMHistory;
