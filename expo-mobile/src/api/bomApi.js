import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  downloadRepairOrder,
  getBomItems,
  getRequisiteHistory,
  getRequisitesBySalesOrder,
  lookupSalesOrder,
  retryRequisiteSync,
  submitSiteRequisite,
  updateRequisiteStatus,
} from './bomGeneratedApi';

const assertNonEmpty = (value, label) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
};

const assertPositiveId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Invalid ${label}`);
  return id;
};

export const bomAPI = {
  fetchBOM: (salesOrder, cabinetPosition, search) => getBomItems(
    assertNonEmpty(salesOrder, 'Sales order'),
    assertNonEmpty(cabinetPosition, 'Cabinet position'),
    search,
  ),
  submitRequisite: submitSiteRequisite,

  getHistory: async (limit = 50, offset = 0) => {
    const history = [];
    while (history.length < limit) {
      const pageLimit = Math.min(50, limit - history.length);
      const page = await getRequisiteHistory(pageLimit, offset + history.length);
      history.push(...page);
      if (page.length < pageLimit) break;
    }
    return history;
  },

  getHistoryBySalesOrder: (salesOrder) => getRequisitesBySalesOrder(assertNonEmpty(salesOrder, 'Sales order')),
  updateStatus: (soId, status) => updateRequisiteStatus(assertPositiveId(soId, 'SO id'), status),
  retrySync: (soId) => retryRequisiteSync(assertPositiveId(soId, 'SO id')),
  lookupSO: (salesOrder) => lookupSalesOrder(assertNonEmpty(salesOrder, 'Sales order')),

  downloadRepairOrder: async (soId, salesOrder) => {
    const id = assertPositiveId(soId, 'SO id');
    const so = assertNonEmpty(salesOrder, 'Sales order');
    const file = new File(Paths.cache, `repair_order_${so}.xlsx`);
    file.create({ overwrite: true, intermediates: true });
    file.write(new Uint8Array(await downloadRepairOrder(id)));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Repair Order - ${so}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
  },
};
