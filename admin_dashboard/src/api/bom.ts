
import axios from './axios';

const encodePathSegment = (value: string) => encodeURIComponent(value.trim());

export interface BOMItem {
    id: number;
    product_name_en: string; // Odoo field name
    product_uom_qty: number;
    product_uom: Array<unknown>;
}

export interface BOMTreeNode {
    product_name: string;
    cabinet_position?: string;
    depth: number;
    children: BOMTreeNode[];
}

export interface BucketItem {
    product_name: string;
    quantity: number;
    issue_description?: string;
    responsible_department?: string;
    component_status?: string;
}

export interface SOLookupDetails {
    sales_order?: string;
    customer_name?: string;
    project_name?: string;
    client_order_ref?: string;
    order_state?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    pincode?: string;
}

export interface RequisiteSubmitPayload {
    sales_order: string;
    cabinet_position: string;
    sr_poc?: string;
    repair_reference?: string;
    expected_delivery?: string;
    do_number?: string;
    items: BucketItem[];
}

export interface SiteRequisiteItem {
    id: number;
    product_name: string;
    quantity: number;
    issue_description?: string;
    responsible_department?: string;
    component_status?: string;
}

export interface SODetail {
    id: number;
    sales_order: string;
    created_date: string;
    closed_date?: string;
    status: 'pending' | 'completed';
    sr_poc?: string;
    cabinet_position?: string;
    customer_name?: string;
    project_name?: string;
    delivery_address?: string;
    so_poc?: string;
    so_status?: string;
    repair_reference?: string;
    expected_delivery?: string;
    do_number?: string;
    site_requisites: SiteRequisiteItem[];
}

export const bomAPI = {
    // Get all history
    getHistory: async (limit = 50, offset = 0) => {
        const response = await axios.get<SODetail[]>('/bom/history', {
            params: { limit, offset }
        });
        return response.data;
    },

    // Get all requisites for a specific sales order (may return multiple)
    getHistoryBySalesOrder: async (salesOrder: string): Promise<SODetail[]> => {
        const response = await axios.get<SODetail[]>(`/bom/history/by-sales-order/${encodePathSegment(salesOrder)}`);
        return response.data;
    },

    // Update status
    updateStatus: async (soId: number, status: 'pending' | 'completed') => {
        const response = await axios.patch(`/bom/history/${soId}/status`, null, {
            params: { status }
        });
        return response.data;
    },

    // Download Repair Order xlsx by requisite ID
    downloadRepairOrder: async (soId: number, salesOrder?: string) => {
        const response = await axios.get(`/bom/history/${soId}/download`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `repair_order_${salesOrder ?? soId}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    // Get BOM Tree
    getBOMItems: async (salesOrder: string, cabinetPosition: string): Promise<BOMTreeNode[]> => {
        const response = await axios.get(`/bom/${encodePathSegment(salesOrder)}/${encodePathSegment(cabinetPosition)}`, {
            timeout: 120000,
        });
        return response.data;
    },

    // Lookup SO details from Odoo
    lookupSO: async (salesOrder: string): Promise<SOLookupDetails> => {
        const response = await axios.get(`/bom/so-lookup/${encodePathSegment(salesOrder)}`);
        return response.data;
    },

    // Submit site requisite
    submitRequisite: async (data: RequisiteSubmitPayload): Promise<SODetail> => {
        const response = await axios.post('/bom/submit', data);
        return response.data;
    },
};
