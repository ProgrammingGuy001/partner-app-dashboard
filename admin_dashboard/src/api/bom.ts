
import axios from './axios';

export interface BOMItem {
    id: number;
    product_name_en: string; // Odoo field name
    product_uom_qty: number;
    product_uom: Array<any>;
}

export interface SiteRequisiteItem {
    id: number;
    product_name: string;
    quantity: number;
    issue_description?: string;
    responsible_department?: string;
}

export interface SODetail {
    id: number;
    sales_order: string;
    created_date: string;
    closed_date?: string;
    status: 'pending' | 'completed';
    sr_poc?: string;
    cabinet_position?: string;
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

    // Get specific sales order details
    getHistoryBySalesOrder: async (salesOrder: string) => {
        const response = await axios.get<SODetail>(`/bom/history/${salesOrder}`);
        return response.data;
    },

    // Update status
    updateStatus: async (soId: number, status: 'pending' | 'completed') => {
        const response = await axios.patch(`/bom/history/${soId}/status`, null, {
            params: { status }
        });
        return response.data;
    },

    // Get BOM Tree (Optional/Admin Debug)
    getBOMItems: async (salesOrder: string, cabinetPosition: string) => {
        const response = await axios.get(`/bom/${salesOrder}/${cabinetPosition}`);
        return response.data;
    }
};
