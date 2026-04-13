import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, AlertCircle, Loader2, Building2, FolderOpen, MapPin, UserCircle2, BadgeCheck } from 'lucide-react';
import { bomAPI } from '@/api/bom';
import { useRequisite } from '@/context/RequisiteContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const SiteRequisiteSubmit: React.FC = () => {
    const navigate = useNavigate();
    const { state, clear, setSODetails } = useRequisite();
    const { bucket, salesOrder, cabinetPosition, soDetails } = state;

    const [srPoc, setSrPoc] = useState('');
    const [repairReference, setRepairReference] = useState('');
    const [expectedDelivery, setExpectedDelivery] = useState('');
    const [doNumber, setDoNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const formatOrderState = (value?: string) => {
        const normalized = (value || '').trim().toLowerCase();
        if (!normalized) return '';
        const labels: Record<string, string> = {
            draft: 'Quotation',
            sent: 'Quotation Sent',
            sale: 'Confirmed',
            done: 'Locked',
            cancel: 'Cancelled',
        };
        return labels[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const fetchSODetails = useCallback(async () => {
        if (!salesOrder) return null;

        setDetailsLoading(true);
        setDetailsError('');

        try {
            const details = await bomAPI.lookupSO(salesOrder);
            setSODetails(details);
            return details;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch sales order details from Odoo.';
            setDetailsError(msg);
            return null;
        } finally {
            setDetailsLoading(false);
        }
    }, [salesOrder, setSODetails]);

    useEffect(() => {
        if (salesOrder && !soDetails) {
            void fetchSODetails();
        } else if (soDetails) {
            setDetailsError('');
        }
    }, [fetchSODetails, salesOrder, soDetails]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (bucket.length === 0) {
            setError('Bucket is empty. Please add items before submitting.');
            return;
        }

        if (!salesOrder || !cabinetPosition) {
            setError('Sales order and cabinet position are required. Go back and search for a BOM first.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const resolvedDetails = await fetchSODetails();
            if (!resolvedDetails) {
                setError('Sales order details must be fetched from Odoo before submitting the site requisite.');
                return;
            }

            await bomAPI.submitRequisite({
                sales_order: salesOrder,
                cabinet_position: cabinetPosition,
                sr_poc: srPoc || undefined,
                repair_reference: repairReference || undefined,
                expected_delivery: expectedDelivery || undefined,
                do_number: doNumber || undefined,
                items: bucket,
            });

            setSuccess(true);
            toast.success('Requisite submitted successfully');

            setTimeout(() => {
                clear();
                navigate('/dashboard/bom');
            }, 2000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to submit requisite. Please try again.';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center p-6 min-h-[60vh]">
                <Card className="shadow-md p-2 max-w-md w-full text-center">
                    <CardContent className="pt-8 pb-4 px-6 flex flex-col items-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-3">Requisite Submitted!</h2>
                        <p className="text-muted-foreground mb-8">
                            The site requisite has been created successfully. Redirecting to BOM history...
                        </p>
                        <Button onClick={() => { clear(); navigate('/dashboard/bom'); }} size="lg" className="w-full">
                            View BOM History
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="flex items-center gap-4 mb-8 border-b pb-6">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/dashboard/site-requisite/bucket')}
                    className="h-10 w-10 shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight text-primary">Submit Site Requisite</h1>
            </div>

            {error && (
                <div className="mb-6 flex items-start gap-3 bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold mb-1">Submission Error</p>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-xl font-semibold mb-6">Requisite Details</h2>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Sales-order details from Odoo</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                These values are fetched before submission and will be used to enrich the site requisite record.
                                            </p>
                                        </div>
                                        {detailsLoading ? (
                                            <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Fetching...
                                            </div>
                                        ) : soDetails ? (
                                            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                Synced
                                            </div>
                                        ) : (
                                            <Button type="button" variant="outline" size="sm" onClick={() => void fetchSODetails()}>
                                                Refresh details
                                            </Button>
                                        )}
                                    </div>

                                    {detailsError ? (
                                        <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div>
                                                <p className="font-semibold">SO details not available yet</p>
                                                <p className="mt-1">{detailsError}</p>
                                            </div>
                                        </div>
                                    ) : soDetails ? (
                                        <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                                            <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3">
                                                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                                                    <p className="font-medium text-foreground">{soDetails.customer_name || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3">
                                                <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                                                    <p className="font-medium text-foreground">{soDetails.project_name || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3">
                                                <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">SO POC</p>
                                                    <p className="font-medium text-foreground">{soDetails.client_order_ref || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3">
                                                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Status</p>
                                                    <p className="font-medium text-foreground">{formatOrderState(soDetails.order_state) || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3 md:col-span-2">
                                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery Address</p>
                                                    <p className="font-medium text-foreground">
                                                        {[soDetails.address_line_1, soDetails.address_line_2, soDetails.city, soDetails.state, soDetails.pincode]
                                                            .filter(Boolean)
                                                            .join(', ') || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label>Sales Order <span className="text-destructive">*</span></Label>
                                    <Input value={salesOrder} disabled className="bg-muted opacity-70" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Cabinet Position <span className="text-destructive">*</span></Label>
                                    <Input value={cabinetPosition} disabled className="bg-muted opacity-70" />
                                </div>

                                <div className="space-y-2">
                                    <Label>SR POC (Point of Contact)</Label>
                                    <Input
                                        type="text"
                                        value={srPoc}
                                        onChange={(e) => setSrPoc(e.target.value)}
                                        placeholder="Enter POC name or email"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Repair Reference</Label>
                                        <Input
                                            type="text"
                                            value={repairReference}
                                            onChange={(e) => setRepairReference(e.target.value)}
                                            placeholder="Enter repair reference"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Expected Delivery</Label>
                                        <Input
                                            type="date"
                                            value={expectedDelivery}
                                            onChange={(e) => setExpectedDelivery(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>DO Number</Label>
                                        <Input
                                            type="text"
                                            value={doNumber}
                                            onChange={(e) => setDoNumber(e.target.value)}
                                            placeholder="Enter delivery order number"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => navigate('/dashboard/site-requisite/bucket')}
                                        size="lg"
                                        className="flex-1"
                                    >
                                        Back to Bucket
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading || detailsLoading || bucket.length === 0 || !soDetails}
                                        size="lg"
                                        className="flex-1"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                Submit Request
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <Card className="sticky top-6">
                        <CardContent className="p-6">
                            <h2 className="text-xl font-semibold mb-5">Summary</h2>
                            <div className="space-y-3 mb-6 bg-secondary/30 p-4 rounded-md border">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Total Items</span>
                                    <span className="font-semibold text-lg">{bucket.length}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2 border-t">
                                    <span className="text-muted-foreground">Sales Order</span>
                                    <span className="font-medium">{salesOrder || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2 border-t">
                                    <span className="text-muted-foreground">Cabinet</span>
                                    <span className="font-medium">{cabinetPosition || 'N/A'}</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
                                    Items to Submit
                                    <span className="text-xs font-normal text-muted-foreground">{bucket.length} items</span>
                                </h3>
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                                    {bucket.map((item, index) => (
                                        <div key={item.product_name} className="text-xs bg-muted/40 p-3 rounded-md border">
                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                <span className="font-medium break-words leading-tight">
                                                    {index + 1}. {item.product_name}
                                                </span>
                                                <div className="bg-background border px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                                                    x{item.quantity}
                                                </div>
                                            </div>
                                            {item.component_status && (
                                                <div className="text-[11px] text-muted-foreground">
                                                    Status: <span className="text-foreground">{item.component_status}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SiteRequisiteSubmit;
