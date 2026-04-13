import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Building2, FolderOpen, MapPin } from 'lucide-react';
import { bomAPI, type BOMTreeNode as BOMTreeNodeType, type SOLookupDetails } from '@/api/bom';
import { useRequisite } from '@/context/RequisiteContext';
import BOMTreeNode from '@/components/BOMTreeNode';
import AddToBucketModal from '@/components/AddToBucketModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const SiteRequisite: React.FC = () => {
    const navigate = useNavigate();
    const { state, setSO, addItem } = useRequisite();

    const [salesOrderInput, setSalesOrderInput] = useState(state.salesOrder);
    const [cabinetInput, setCabinetInput] = useState(state.cabinetPosition);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [bomData, setBomData] = useState<BOMTreeNodeType[]>([]);
    const [soDetails, setSODetails] = useState<SOLookupDetails | null>(null);
    const [selectedItem, setSelectedItem] = useState<BOMTreeNodeType | null>(null);

    const handleFetchBOM = async (e: React.FormEvent) => {
        e.preventDefault();
        const so = salesOrderInput.trim();
        const cab = cabinetInput.trim();

        if (!so || !cab) {
            setError('Sales order and cabinet position are required.');
            return;
        }

        setLoading(true);
        setError('');
        setSODetails(null);

        try {
            const [bomResult, detailsResult] = await Promise.allSettled([
                bomAPI.getBOMItems(so, cab),
                bomAPI.lookupSO(so),
            ]);

            if (bomResult.status === 'rejected') {
                throw bomResult.reason;
            }

            setSO(so, cab);
            setBomData(bomResult.value);

            if (detailsResult.status === 'fulfilled') {
                setSODetails(detailsResult.value);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch BOM data';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Site Requisite</h1>
                    <p className="text-muted-foreground mt-1">Search BOM and build requisite requests</p>
                </div>
                <Button onClick={() => navigate('/dashboard/site-requisite/bucket')} className="relative h-10 px-5">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Bucket
                    {state.bucket.length > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                            {state.bucket.length}
                        </Badge>
                    )}
                </Button>
            </div>

            <Card className="mb-6">
                <CardContent className="pt-6">
                    <form onSubmit={handleFetchBOM} className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 w-full space-y-2">
                            <Label htmlFor="salesOrder">Sales Order</Label>
                            <Input
                                id="salesOrder"
                                placeholder="Enter Sales Order"
                                value={salesOrderInput}
                                onChange={(e) => setSalesOrderInput(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex-1 w-full space-y-2">
                            <Label htmlFor="cabinetPosition">Cabinet Position</Label>
                            <Input
                                id="cabinetPosition"
                                placeholder="Enter Cabinet Position"
                                value={cabinetInput}
                                onChange={(e) => setCabinetInput(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={loading} className="h-10 px-6 w-full sm:w-auto">
                            <Search className="w-4 h-4 mr-2" />
                            {loading ? 'Searching...' : 'Search'}
                        </Button>
                    </form>

                    {error && (
                        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive font-medium">
                            {error}
                        </div>
                    )}
                </CardContent>
            </Card>

            {soDetails && (
                <Card className="mb-5">
                    <CardHeader className="bg-muted/30 border-b py-3 px-5">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Sales Order Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 pb-4 px-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            {soDetails.customer_name && (
                                <div className="flex items-start gap-2">
                                    <Building2 className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer</p>
                                        <p className="font-medium">{soDetails.customer_name}</p>
                                    </div>
                                </div>
                            )}
                            {soDetails.project_name && (
                                <div className="flex items-start gap-2">
                                    <FolderOpen className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Project</p>
                                        <p className="font-medium">{soDetails.project_name}</p>
                                    </div>
                                </div>
                            )}
                            {(soDetails.address_line_1 || soDetails.city) && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Delivery Address</p>
                                        <p className="font-medium">
                                            {[soDetails.address_line_1, soDetails.address_line_2, soDetails.city, soDetails.state, soDetails.pincode]
                                                .filter(Boolean).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {bomData.length > 0 && (
                <Card className="mb-8">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-lg">BOM Hierarchy</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            {bomData.map((item, index) => (
                                <BOMTreeNode
                                    key={`${item.product_name}-${index}`}
                                    node={item}
                                    onAddToBucket={(node) => setSelectedItem(node)}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {selectedItem && (
                <AddToBucketModal
                    item={selectedItem}
                    onSave={(bucketItem) => {
                        addItem(bucketItem);
                        setSelectedItem(null);
                    }}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
};

export default SiteRequisite;
