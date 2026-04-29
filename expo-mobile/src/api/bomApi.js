import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiClient from './axiosConfig';
import { STORAGE_KEYS } from '../util/constants';
import * as SecureStore from '../util/secureStore';

const encodePathSegment = (value) => encodeURIComponent(String(value ?? '').trim());
const assertNonEmpty = (value, label) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
};
const assertPositiveId = (value, label) => {
  const numericId = Number(value);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return numericId;
};
const BOM_FETCH_TIMEOUT_MS = 120000;

export const bomAPI = {
  fetchBOM: async (salesOrder, cabinetPosition) => {
    const so = assertNonEmpty(salesOrder, 'Sales order');
    const position = assertNonEmpty(cabinetPosition, 'Cabinet position');
    const response = await apiClient.get(
      `/dashboard/bom/${encodePathSegment(so)}/${encodePathSegment(position)}`,
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
    const so = assertNonEmpty(salesOrder, 'Sales order');
    const response = await apiClient.get(`/dashboard/bom/history/by-sales-order/${encodePathSegment(so)}`);
    return response.data;
  },

  updateStatus: async (soId, status) => {
    const id = assertPositiveId(soId, 'SO id');
    const response = await apiClient.patch(`/dashboard/bom/status/${id}`, null, {
      params: { status },
    });
    return response.data;
  },

  lookupSO: async (salesOrder) => {
    const so = assertNonEmpty(salesOrder, 'Sales order');
    const response = await apiClient.get(`/dashboard/bom/so-lookup/${encodePathSegment(so)}`);
    return response.data;
  },

  downloadRepairOrder: async (soId, salesOrder) => {
    const id = assertPositiveId(soId, 'SO id');
    const so = assertNonEmpty(salesOrder, 'Sales order');
    const baseURL = apiClient.defaults.baseURL || '';
    const url = `${baseURL}/dashboard/bom/history/${encodeURIComponent(String(id))}/download`;

    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      throw new Error('You need to log in again before downloading the repair order.');
    }

    const file = new File(Paths.cache, `repair_order_${so}.xlsx`);
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
        dialogTitle: `Repair Order - ${so}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
  },
};
