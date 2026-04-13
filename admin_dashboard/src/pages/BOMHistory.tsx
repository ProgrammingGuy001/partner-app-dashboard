
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
        onError: (error: any) => {
            toast.error(error.message || "Failed to update status");
        }
    });

    const handleStatusUpdate = (status: 'pending' | 'completed') => {
        if (selectedSO) {
            updateStatusMutation.mutate({ id: selectedSO.id, status });
        }
    };

    const getStatusVariant = (status: string) => {
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
        <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1600px] mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">BOM Requisites</h1>
                    <p className="text-muted-foreground">Manage site requisitions and material requests</p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
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
                    <div className="rounded-md border">
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
                                                <Badge variant={getStatusVariant(item.status) as any}>
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
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
                                    <Badge className="ml-2" variant={getStatusVariant(selectedSO.status) as any}>
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

                            <div className="border rounded-md">
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

                            <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg">
                                <span className="font-medium text-sm">Update Status:</span>
                                <Select
                                    defaultValue={selectedSO.status}
                                    onValueChange={(val) => handleStatusUpdate(val as 'pending' | 'completed')}
                                    disabled={updateStatusMutation.isPending}
                                >
                                    <SelectTrigger className="w-[180px]">
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

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
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
                        <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BOMHistory;
