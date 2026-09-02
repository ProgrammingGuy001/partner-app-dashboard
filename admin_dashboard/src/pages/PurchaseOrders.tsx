import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Search, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import {
  authAPI,
  purchaseOrderAPI,
  type PurchaseVendor,
} from '@/api/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage, sanitizeErrorText } from '@/lib/apiError';

const errorDetail = getApiErrorMessage;

export default function PurchaseOrders() {
  const queryClient = useQueryClient();
  const [vendorSearch, setVendorSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [vendor, setVendor] = useState<PurchaseVendor | null>(null);
  const [salesOrder, setSalesOrder] = useState('');
  const [pocName, setPocName] = useState('');
  const [serviceType, setServiceType] = useState<'b2b' | 'b2c'>('b2b');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
  });
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['purchase-order-requests'],
    queryFn: () => purchaseOrderAPI.list(),
  });
  const { data: vendors = [], isFetching: isSearching } = useQuery({
    queryKey: ['purchase-vendors', submittedSearch],
    queryFn: () => purchaseOrderAPI.searchVendors(submittedSearch),
    enabled: submittedSearch.length >= 2,
  });

  const createRequest = useMutation({
    mutationFn: () => purchaseOrderAPI.create({
      vendor_id: vendor!.id,
      sales_order: salesOrder.trim(),
      poc_name: pocName.trim(),
      service_type: serviceType,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-requests'] });
      setVendor(null);
      setVendorSearch('');
      setSubmittedSearch('');
      setSalesOrder('');
      setPocName('');
      setQuantity('');
      setUnitPrice('');
      toast.success('RFQ request sent for superadmin approval');
    },
    onError: (error) => toast.error(errorDetail(error, 'Failed to create RFQ request')),
  });

  const approveRequest = useMutation({
    mutationFn: (id: number) => purchaseOrderAPI.approve(id),
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-requests'] });
      toast.success(`Draft RFQ ${request.odoo_purchase_order_name} created in Odoo`);
    },
    onError: (error) => toast.error(errorDetail(error, 'Odoo RFQ creation failed')),
  });

  const requestBill = useMutation({
    mutationFn: (id: number) => purchaseOrderAPI.requestBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-requests'] });
      toast.success('Vendor bill request sent for superadmin approval');
    },
    onError: (error) => toast.error(errorDetail(error, 'Failed to request vendor bill')),
  });

  const approveBill = useMutation({
    mutationFn: (id: number) => purchaseOrderAPI.approveBill(id),
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-requests'] });
      toast.success(`Draft vendor bill ${request.odoo_vendor_bill_name} created in Odoo`);
    },
    onError: (error) => toast.error(errorDetail(error, 'Odoo vendor bill creation failed')),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!vendor) return toast.error('Select an Odoo vendor');
    if (!salesOrder.trim() || !pocName.trim()) return toast.error('Enter the SO and POC name');
    if (!(Number(quantity) > 0) || !(Number(unitPrice) > 0)) {
      return toast.error('Quantity and price must be greater than zero');
    }
    createRequest.mutate();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Installation Service RFQs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admins submit RFQ and vendor-bill requests; each Odoo write requires superadmin approval.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Create RFQ request</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vendor-search">Odoo vendor</Label>
              <div className="flex gap-2">
                <Input
                  id="vendor-search"
                  value={vendorSearch}
                  onChange={(event) => {
                    setVendorSearch(event.target.value);
                    setVendor(null);
                  }}
                  placeholder="Search vendor name"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={vendorSearch.trim().length < 2 || isSearching}
                  onClick={() => setSubmittedSearch(vendorSearch.trim())}
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="sr-only">Search vendors</span>
                </Button>
              </div>
              {submittedSearch && !vendor && (
                <div className="max-h-44 overflow-y-auto rounded-md border">
                  {vendors.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/90"
                      onClick={() => {
                        setVendor(item);
                        setVendorSearch(item.name);
                      }}
                    >
                      {item.name}
                    </button>
                  ))}
                  {!isSearching && vendors.length === 0 && <p className="p-3 text-sm text-muted-foreground">No active Odoo vendors found.</p>}
                </div>
              )}
              {vendor && <p className="text-sm text-success">Selected: {vendor.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sales-order">SO</Label>
              <Input id="sales-order" value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)} placeholder="Sales order number" maxLength={100} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poc-name">POC name</Label>
              <Input id="poc-name" value={pocName} onChange={(e) => setPocName(e.target.value)} placeholder="Point of contact" maxLength={255} required />
            </div>
            <div className="space-y-2">
              <Label>Installation service</Label>
              <Select value={serviceType} onValueChange={(value) => setServiceType(value as 'b2b' | 'b2c')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b">B2B Installation Service</SelectItem>
                  <SelectItem value="b2c">B2C Installation Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (ft²)</Label>
              <Input id="quantity" type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-price">Price per ft²</Label>
              <Input id="unit-price" type="number" min="0.01" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm text-muted-foreground">Total: ₹{((Number(quantity) || 0) * (Number(unitPrice) || 0)).toFixed(2)}</p>
              <Button type="submit" disabled={createRequest.isPending}>
                {createRequest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                Send for approval
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{currentUser?.is_superadmin ? 'All RFQ requests' : 'My RFQ requests'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No RFQ requests yet.</p>
          ) : requests.map((request) => (
            <article key={request.id} className="flex flex-col gap-3 rounded-md border p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{request.product_name}</p>
                  <Badge variant={request.status === 'approved' ? 'default' : 'secondary'}>{request.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">PO: {request.po_number || '-'} · SO: {request.sales_order || '-'} · POC: {request.poc_name || '-'}</p>
                <p className="text-sm text-muted-foreground">{request.vendor_name} · {request.quantity} ft² × ₹{request.unit_price} = ₹{(request.quantity * request.unit_price).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Requested by {request.requested_by_email || 'admin'} on {new Date(request.requested_at).toLocaleString()}</p>
                {request.odoo_purchase_order_name && (
                  <p className="mt-1 text-sm text-success">
                    Odoo RFQ: {request.odoo_purchase_order_name}
                    {request.odoo_purchase_order_state ? ` · ${request.odoo_purchase_order_state}` : ''}
                    {request.odoo_invoice_status ? ` · ${request.odoo_invoice_status.replaceAll('_', ' ')}` : ''}
                  </p>
                )}
                {request.bill_status !== 'not_requested' && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bill request: {request.bill_status}
                    {request.bill_requested_by_email ? ` by ${request.bill_requested_by_email}` : ''}
                  </p>
                )}
                {request.odoo_vendor_bill_name && (
                  <p className="mt-1 text-sm text-success">
                    Odoo vendor bill: {request.odoo_vendor_bill_name}
                    {request.odoo_vendor_bill_state ? ` · ${request.odoo_vendor_bill_state}` : ''}
                  </p>
                )}
                {request.odoo_sync_error && <p className="mt-1 text-sm text-destructive">Last Odoo error: {sanitizeErrorText(request.odoo_sync_error)}</p>}
                {request.bill_sync_error && <p className="mt-1 text-sm text-destructive">Last bill error: {sanitizeErrorText(request.bill_sync_error)}</p>}
                {request.odoo_status_error && <p className="mt-1 text-sm text-destructive">Odoo billing status unavailable: {sanitizeErrorText(request.odoo_status_error)}</p>}
              </div>
              <div className="flex flex-col items-start gap-2 lg:items-end">
                {currentUser?.is_superadmin && request.status === 'pending' && (
                  <Button onClick={() => approveRequest.mutate(request.id)} disabled={approveRequest.isPending}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve and push to Odoo
                  </Button>
                )}
                {request.status === 'approved'
                  && request.bill_status === 'not_requested'
                  && !request.odoo_vendor_bill_id
                  && ['purchase', 'done'].includes(request.odoo_purchase_order_state || '')
                  && request.odoo_invoice_status === 'to invoice' && (
                    <Button variant="outline" onClick={() => requestBill.mutate(request.id)} disabled={requestBill.isPending}>
                      Request vendor bill
                    </Button>
                  )}
                {request.bill_status === 'pending' && currentUser?.is_superadmin && (
                  <Button onClick={() => approveBill.mutate(request.id)} disabled={approveBill.isPending}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve and create draft bill
                  </Button>
                )}
                {request.bill_status === 'pending' && !currentUser?.is_superadmin && (
                  <p className="text-xs text-muted-foreground">Awaiting superadmin bill approval</p>
                )}
                {request.status === 'approved'
                  && request.bill_status === 'not_requested'
                  && request.odoo_purchase_order_state === 'draft' && (
                    <p className="max-w-56 text-right text-xs text-muted-foreground">Confirm this RFQ in Odoo before requesting its bill.</p>
                  )}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
