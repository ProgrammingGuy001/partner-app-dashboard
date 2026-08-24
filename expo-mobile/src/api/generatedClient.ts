import { API_BASE_URL } from '../util/constants';

import apiClient from './axiosConfig';
import { client } from './generated/client.gen';

client.setConfig({ axios: apiClient, baseURL: API_BASE_URL, throwOnError: true });

export * from './generated';
export { client };
