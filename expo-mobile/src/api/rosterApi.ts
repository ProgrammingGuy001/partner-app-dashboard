import {
  getMyRosterDashboardRosterGet,
  type GetMyRosterDashboardRosterGetData,
} from './generatedClient';

export type RosterSlot = {
  slot_number: 1 | 2;
  start_time: string;
  end_time: string;
};

export type RosterEntry = {
  id: number;
  work_date: string;
  slot_number: 1 | 2;
  slot_start: string;
  slot_end: string;
  status: string;
  job?: {
    id: number;
    name?: string;
    customer_city?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
};

export type RosterResponse = {
  date_from: string;
  date_to: string;
  slots: RosterSlot[];
  entries: RosterEntry[];
};

export const getRoster = async (
  query: NonNullable<GetMyRosterDashboardRosterGetData['query']>,
) => {
  const response = await getMyRosterDashboardRosterGet({ query, throwOnError: true });
  return response.data as RosterResponse;
};
