import {
  downloadRepairOrderApiV1DashboardBomHistorySoIdDownloadGet,
  getBomItemsApiV1DashboardBomSalesOrderCabinetPositionGet,
  getRequisiteHistoryApiV1DashboardBomHistoryGet,
  getRequisitesBySalesOrderApiV1DashboardBomHistoryBySalesOrderSalesOrderGet,
  lookupSalesOrderApiV1DashboardBomSoLookupSalesOrderGet,
  retryRequisiteSyncApiV1DashboardBomHistorySoIdRetrySyncPost,
  submitSiteRequisiteApiV1DashboardBomSubmitPost,
  updateRequisiteStatusApiV1DashboardBomHistorySoIdStatusPatch,
  type SiteRequisiteSubmit,
} from './generatedClient';

export type SalesOrderLookup = {
  sales_order?: string | null; customer_name?: string | null; project_name?: string | null;
  client_order_ref?: string | null; address_line_1?: string | null; address_line_2?: string | null;
  city?: string | null; state?: string | null; pincode?: string | null; order_state?: string | null;
};

export const getBomItems = async (salesOrder: string, cabinetPosition: string, search?: string) => {
  const response = await getBomItemsApiV1DashboardBomSalesOrderCabinetPositionGet({
    path: { sales_order: salesOrder, cabinet_position: cabinetPosition },
    query: { search: search || null },
    throwOnError: true,
  });
  return response.data;
};

export const submitSiteRequisite = async (body: SiteRequisiteSubmit) => {
  const response = await submitSiteRequisiteApiV1DashboardBomSubmitPost({ body, throwOnError: true });
  return response.data;
};

export const getRequisiteHistory = async (limit: number, offset: number) => {
  const response = await getRequisiteHistoryApiV1DashboardBomHistoryGet({ query: { limit, offset }, throwOnError: true });
  return response.data;
};

export const getRequisitesBySalesOrder = async (salesOrder: string) => {
  const response = await getRequisitesBySalesOrderApiV1DashboardBomHistoryBySalesOrderSalesOrderGet({ path: { sales_order: salesOrder }, throwOnError: true });
  return response.data;
};

export const updateRequisiteStatus = async (soId: number, status: 'pending' | 'completed') => {
  const response = await updateRequisiteStatusApiV1DashboardBomHistorySoIdStatusPatch({ path: { so_id: soId }, query: { status }, throwOnError: true });
  return response.data;
};

export const retryRequisiteSync = async (soId: number) => {
  const response = await retryRequisiteSyncApiV1DashboardBomHistorySoIdRetrySyncPost({ path: { so_id: soId }, throwOnError: true });
  return response.data;
};

export const lookupSalesOrder = async (salesOrder: string) => {
  const response = await lookupSalesOrderApiV1DashboardBomSoLookupSalesOrderGet({ path: { sales_order: salesOrder }, throwOnError: true });
  return response.data as SalesOrderLookup;
};

export const downloadRepairOrder = async (soId: number) => {
  const response = await downloadRepairOrderApiV1DashboardBomHistorySoIdDownloadGet({ path: { so_id: soId }, responseType: 'arraybuffer', throwOnError: true });
  return response.data as ArrayBuffer;
};
