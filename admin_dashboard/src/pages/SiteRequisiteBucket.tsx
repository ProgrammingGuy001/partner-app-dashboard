import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ShoppingCart, Trash2, Edit2, Send, X, Check } from 'lucide-react';
import { useRequisite } from '@/context/RequisiteContext';
import type { BucketItem } from '@/api/bom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

const DEPARTMENTS = [
    { value: '', label: 'None' },
    { value: 'design', label: 'Design' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'quality', label: 'Quality' },
    { value: 'sale', label: 'Sale' },
    { value: 'fulfillment', label: 'Fulfillment' },
    { value: 'other', label: 'Other' },
];

const SiteRequisiteBucket: React.FC = () => {
    const navigate = useNavigate();
    const { state, removeItem, updateItem } = useRequisite();
    const { bucket, salesOrder, cabinetPosition } = state;

    const [editingItem, setEditingItem] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<BucketItem>>({
        quantity: 1,
        issue_description: '',
        responsible_department: '',
        component_status: '',
    });
    const [itemToRemove, setItemToRemove] = useState<string | null>(null);

    const handleEdit = (item: BucketItem) => {
        setEditingItem(item.product_name);
        setEditForm({
            quantity: item.quantity || 1,
            issue_description: item.issue_description || '',
            responsible_department: item.responsible_department || '',
            component_status: item.component_status || '',
        });
    };

    const handleSaveEdit = (productName: string) => {
        updateItem(productName, {
            quantity: editForm.quantity,
            issue_description: editForm.issue_description || undefined,
            responsible_department: editForm.responsible_department || undefined,
            component_status: editForm.component_status?.trim() || undefined,
        });
        setEditingItem(null);
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setEditForm({ quantity: 1, issue_description: '', responsible_department: '', component_status: '' });
    };

    return (
        <>
            <div className="mx-auto w-full max-w-6xl pb-8 sm:pb-10">
                <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-5 sm:mb-8 sm:flex-row sm:items-center sm:pb-6">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/dashboard/site-requisite')}
                            className="h-10 w-10 shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="min-w-0">
                            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary sm:gap-3 sm:text-3xl">
                                <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8" />
                                Bucket List
                            </h1>
                            {salesOrder && cabinetPosition && (
                                <p className="mt-2 inline-block max-w-full truncate rounded-full border bg-secondary/50 px-3 py-1 text-sm font-medium text-muted-foreground">
                                    SO: <span className="text-foreground">{salesOrder}</span> | Cabinet: <span className="text-foreground">{cabinetPosition}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate('/dashboard/site-requisite/submit')}
                        disabled={bucket.length === 0}
                        size="lg"
                        className="w-full sm:w-auto"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        Submit Requisite
                    </Button>
                </div>

                {bucket.length === 0 ? (
                    <Card className="border-dashed border-2 bg-transparent shadow-none">
                        <CardContent className="flex flex-col items-center justify-center px-4 py-12 text-center sm:p-16">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-secondary sm:h-24 sm:w-24">
                                <ShoppingCart className="h-10 w-10 text-muted-foreground sm:h-12 sm:w-12" />
                            </div>
                            <h3 className="mb-2 text-xl font-semibold sm:text-2xl">Your bucket is empty</h3>
                            <p className="text-muted-foreground mb-8 max-w-md">
                                Add items from the BOM hierarchy to create a site requisite.
                            </p>
                            <Button onClick={() => navigate('/dashboard/site-requisite')} size="lg">
                                Browse BOM Items
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="overflow-hidden">
                        <div className="divide-y md:hidden">
                            {bucket.map((item, index) => (
                                <BucketMobileCard
                                    key={item.product_name}
                                    item={item}
                                    index={index}
                                    isEditing={editingItem === item.product_name}
                                    editForm={editForm}
                                    setEditForm={setEditForm}
                                    onEdit={() => handleEdit(item)}
                                    onSave={() => handleSaveEdit(item.product_name)}
                                    onCancel={handleCancelEdit}
                                    onRemove={() => setItemToRemove(item.product_name)}
                                />
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <Table>
                                <TableHeader className="bg-secondary/40">
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead className="min-w-[200px]">Product Name</TableHead>
                                        <TableHead className="w-[120px]">Quantity</TableHead>
                                        <TableHead className="w-[180px]">Component Status</TableHead>
                                        <TableHead className="w-[140px]">Department</TableHead>
                                        <TableHead className="min-w-[200px]">Issue Description</TableHead>
                                        <TableHead className="text-right w-[140px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bucket.map((item, index) => (
                                        <TableRow
                                            key={item.product_name}
                                            className={editingItem === item.product_name ? 'bg-primary/5' : ''}
                                        >
                                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                            <TableCell className="font-medium">{item.product_name}</TableCell>
                                            <TableCell>
                                                {editingItem === item.product_name ? (
                                                    <Input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={editForm.quantity}
                                                        onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                                                        className="w-20 h-8"
                                                    />
                                                ) : (
                                                    <span className="font-medium">{item.quantity || 1}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingItem === item.product_name ? (
                                                    <Input
                                                        type="text"
                                                        value={editForm.component_status || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, component_status: e.target.value })}
                                                        placeholder="Available, damaged..."
                                                        className="h-8"
                                                    />
                                                ) : item.component_status ? (
                                                    <span className="text-sm">{item.component_status}</span>
                                                ) : (
                                                    <span className="text-muted-foreground/50 italic text-sm">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingItem === item.product_name ? (
                                                    <div className="relative">
                                                        <select
                                                            value={editForm.responsible_department || ''}
                                                            onChange={(e) => setEditForm({ ...editForm, responsible_department: e.target.value })}
                                                            className="flex h-8 w-full appearance-none rounded-md border border-input bg-background px-2 pr-7 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        >
                                                            {DEPARTMENTS.map((d) => (
                                                                <option key={d.value} value={d.value}>{d.label}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                    </div>
                                                ) : (
                                                    item.responsible_department
                                                        ? <Badge variant="outline" className="capitalize">{item.responsible_department}</Badge>
                                                        : <span className="text-muted-foreground/50 italic text-sm">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingItem === item.product_name ? (
                                                    <textarea
                                                        value={editForm.issue_description || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, issue_description: e.target.value })}
                                                        rows={1}
                                                        className="flex min-h-[32px] w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        placeholder="Describe..."
                                                    />
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        {item.issue_description || (
                                                            <span className="text-muted-foreground/50 italic">Not specified</span>
                                                        )}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {editingItem === item.product_name ? (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleSaveEdit(item.product_name)}
                                                                className="h-8 w-8 text-green-600 hover:text-green-600 hover:bg-green-50"
                                                                title="Save"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={handleCancelEdit}
                                                                className="h-8 w-8"
                                                                title="Cancel"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(item)}
                                                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setItemToRemove(item.product_name)}
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                title="Remove"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="border-t bg-secondary/30 px-4 py-4 sm:px-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-muted-foreground font-medium">
                                    Total Items: <span className="font-bold text-foreground ml-1">{bucket.length}</span>
                                </div>
                                <Button
                                    onClick={() => navigate('/dashboard/site-requisite/submit')}
                                    size="lg"
                                    className="w-full px-8 sm:w-auto"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Proceed to Submit
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            <Dialog open={itemToRemove !== null} onOpenChange={(open) => !open && setItemToRemove(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Remove Item</DialogTitle>
                        <DialogDescription>
                            Remove <span className="font-medium">"{itemToRemove}"</span> from the bucket?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setItemToRemove(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (itemToRemove) {
                                    removeItem(itemToRemove);
                                    setItemToRemove(null);
                                }
                            }}
                        >
                            Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

const BucketMobileCard: React.FC<{
    item: BucketItem;
    index: number;
    isEditing: boolean;
    editForm: Partial<BucketItem>;
    setEditForm: React.Dispatch<React.SetStateAction<Partial<BucketItem>>>;
    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    onRemove: () => void;
}> = ({
    item,
    index,
    isEditing,
    editForm,
    setEditForm,
    onEdit,
    onSave,
    onCancel,
    onRemove,
}) => (
    <article className={`p-4 ${isEditing ? 'bg-primary/5' : ''}`}>
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Item {index + 1}</p>
                <h3 className="mt-1 break-words text-sm font-semibold">{item.product_name}</h3>
            </div>
            <div className="flex shrink-0 gap-1">
                {isEditing ? (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onSave}
                            className="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-600"
                            title="Save"
                        >
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8" title="Cancel">
                            <X className="h-4 w-4" />
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEdit}
                            className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                            title="Edit"
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onRemove}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Remove"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </>
                )}
            </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Quantity</p>
                {isEditing ? (
                    <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                        className="mt-1 h-9"
                    />
                ) : (
                    <p className="mt-1 font-medium">{item.quantity || 1}</p>
                )}
            </div>

            <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Component Status</p>
                {isEditing ? (
                    <Input
                        value={editForm.component_status || ''}
                        onChange={(e) => setEditForm({ ...editForm, component_status: e.target.value })}
                        placeholder="Available, damaged..."
                        className="mt-1 h-9"
                    />
                ) : item.component_status ? (
                    <p className="mt-1">{item.component_status}</p>
                ) : (
                    <p className="mt-1 italic text-muted-foreground/60">Not specified</p>
                )}
            </div>

            <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Department</p>
                {isEditing ? (
                    <div className="relative mt-1">
                        <select
                            value={editForm.responsible_department || ''}
                            onChange={(e) => setEditForm({ ...editForm, responsible_department: e.target.value })}
                            className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            {DEPARTMENTS.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                ) : item.responsible_department ? (
                    <Badge variant="outline" className="mt-1 capitalize">{item.responsible_department}</Badge>
                ) : (
                    <p className="mt-1 italic text-muted-foreground/60">None</p>
                )}
            </div>

            <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Issue Description</p>
                {isEditing ? (
                    <textarea
                        value={editForm.issue_description || ''}
                        onChange={(e) => setEditForm({ ...editForm, issue_description: e.target.value })}
                        rows={3}
                        className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Describe..."
                    />
                ) : (
                    <p className="mt-1 break-words text-muted-foreground">
                        {item.issue_description || <span className="italic text-muted-foreground/60">Not specified</span>}
                    </p>
                )}
            </div>
        </div>
    </article>
);

export default SiteRequisiteBucket;
