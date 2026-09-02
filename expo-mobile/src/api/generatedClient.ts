import { API_BASE_URL } from '../util/constants';

import apiClient from './axiosConfig';
import { client } from './generated/client.gen';

// ponytail: generated sdk paths already include /api/v1, API_BASE_URL ends with it
const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

client.setConfig({ axios: apiClient, baseURL: SERVER_ORIGIN, throwOnError: true });

export * from './generated';
export { client };
