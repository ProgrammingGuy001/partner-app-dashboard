import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiClient from './axiosConfig';
import { STORAGE_KEYS } from '../util/constants';
import * as SecureStore from '../util/secureStore';

const encodePathSegment = (value) => encodeURIComponent(String(value ?? '').trim());
const BOM_FETCH_TIMEOUT_MS = 120000;

export const bomAPI = {
  fetchBOM: async (salesOrder, cabinetPosition) => {
    const response = await apiClient.get(
      `/dashboard/bom/${encodePathSegment(salesOrder)}/${encodePathSegment(cabinetPosition)}`,
      { timeout: BOM_FETCH_TIMEOUT_MS }
    );
    return response.data;
  },

  submitRequisite: async (data) => {
    const response = await apiClient.post('/dashboard/bom/submit', data);
    return response.data;
  },

  getHistory: async (limit = 50, offset = 0) => {
    const response = await apiClient.get('/dashboard/bom/history', {
      params: { limit, offset },
    });
    return response.data;
  },

  getHistoryBySalesOrder: async (salesOrder) => {
    const response = await apiClient.get(`/dashboard/bom/history/by-sales-order/${encodePathSegment(salesOrder)}`);
    return response.data;
  },

  updateStatus: async (soId, status) => {
    const response = await apiClient.patch(`/dashboard/bom/status/${soId}`, null, {
      params: { status },
    });
    return response.data;
  },

  lookupSO: async (salesOrder) => {
    const response = await apiClient.get(`/dashboard/bom/so-lookup/${encodePathSegment(salesOrder)}`);
    return response.data;
  },

  downloadRepairOrder: async (soId, salesOrder) => {
    const baseURL = apiClient.defaults.baseURL || '';
    const url = `${baseURL}/dashboard/bom/history/${encodeURIComponent(String(soId))}/download`;

    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      throw new Error('You need to log in again before downloading the repair order.');
    }

    const file = new File(Paths.cache, `repair_order_${salesOrder}.xlsx`);
    const response = await expoFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).trim();
      } catch {
        detail = '';
      }
      throw new Error(detail || `Download failed with status ${response.status}`);
    }

    file.create({ overwrite: true, intermediates: true });
    file.write(await response.bytes());

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Repair Order - ${salesOrder}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
  },
};
