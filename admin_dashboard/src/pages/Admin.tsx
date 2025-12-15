import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../api/services';
import { Shield, CheckCircle, XCircle, Search, Filter, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface IP {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_id_verified: boolean;
}

const Admin: React.FC = () => {
  const [ips, setIps] = useState<IP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending'>('all');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchIPs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getIPUsers();
      setIps(response.data);
      setError('');
    } catch {
      setError('Failed to fetch IPs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIPs();
  }, [fetchIPs]);

  const handleApprove = async (phoneNumber: string) => {
    try {
      await adminAPI.verifyIPUser(phoneNumber);
      setSuccessMessage('IP verified successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchIPs();
    } catch {
      setError('Failed to approve IP');
      setTimeout(() => setError(''), 3000);
    }
  };

  const filteredIPs = ips.filter(ip => {
    const matchesSearch = 
      ip.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ip.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ip.phone_number.includes(searchTerm);
    
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'verified' && ip.is_id_verified) ||
      (filterStatus === 'pending' && !ip.is_id_verified);
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: ips.length,
    verified: ips.filter(ip => ip.is_id_verified).length,
    pending: ips.filter(ip => !ip.is_id_verified).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Admin Controls</h1>
          <p className="text-gray-600 mt-1">Manage IP verifications and user access</p>
        </div>
        <button
          onClick={fetchIPs}
          disabled={loading}
          className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total IPs</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <Shield size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Verified</p>
              <p className="text-3xl font-bold mt-1">{stats.verified}</p>
            </div>
            <UserCheck size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Pending</p>
              <p className="text-3xl font-bold mt-1">{stats.pending}</p>
            </div>
            <AlertCircle size={40} className="opacity-80" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="text-blue-600" size={28} />
          <h2 className="text-xl font-bold text-gray-800">IP Users</h2>
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
            <CheckCircle size={20} />
            {successMessage}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
            <XCircle size={20} />
            {error}
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-600" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'verified' | 'pending')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Users</option>
              <option value="verified">Verified Only</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading IPs...</p>
          </div>
        ) : filteredIPs.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No IPs found matching your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone Number</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredIPs.map((ip) => (
                  <tr key={ip.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-700">#{ip.id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{`${ip.first_name} ${ip.last_name}`}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{ip.phone_number}</td>
                    <td className="px-6 py-4">
                      {ip.is_id_verified ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                          <CheckCircle size={14} />
                          Verified
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1 w-fit">
                          <AlertCircle size={14} />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {!ip.is_id_verified ? (
                        <button
                          onClick={() => handleApprove(ip.phone_number)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                          <CheckCircle size={16} />
                          Approve
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500 italic">Verified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;