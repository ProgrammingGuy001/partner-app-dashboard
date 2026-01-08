import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../api/services';
import { 
  Users, CheckCircle, XCircle, Search, MapPin, Phone, Calendar, 
  CreditCard, Building2, Award, Briefcase, RefreshCw, Eye, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Worker {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  city: string;
  pincode: string;
  is_assigned: boolean;
  is_verified: boolean;
  is_pan_verified: boolean;
  is_bank_details_verified: boolean;
  is_id_verified: boolean;
  pan_number?: string;
  pan_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  registered_at: string;
  verified_at?: string;
}

const Workers: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending' | 'unassigned'>('all');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getIPUsers();
      setWorkers(data);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleVerify = async (phoneNumber: string) => {
    if (!confirm('Verify this worker? This will approve all verifications.')) return;
    try {
      await adminAPI.verifyIPUser(phoneNumber);
      fetchWorkers();
    } catch (error) {
      console.error('Error verifying worker:', error);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = 
      worker.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.phone_number.includes(searchTerm) ||
      worker.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'verified' && worker.is_id_verified) ||
      (filterStatus === 'pending' && !worker.is_id_verified) ||
      (filterStatus === 'unassigned' && !worker.is_assigned);
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: workers.length,
    verified: workers.filter(w => w.is_id_verified).length,
    pending: workers.filter(w => !w.is_id_verified).length,
    unassigned: workers.filter(w => !w.is_assigned).length,
  };

  const getVerificationScore = (worker: Worker) => {
    let score = 0;
    if (worker.is_id_verified) score++;
    if (worker.is_pan_verified) score++;
    if (worker.is_bank_details_verified) score++;
    if (worker.is_verified) score++;
    return score;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Personnel Management</h1>
          <p className="text-gray-600 mt-1">Manage personnel, verifications, and assignments</p>
        </div>
        <button
          onClick={fetchWorkers}
          disabled={loading}
          className="px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Personnel</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <Users size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Verified</p>
              <p className="text-3xl font-bold mt-1">{stats.verified}</p>
            </div>
            <CheckCircle size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold mt-1">{stats.pending}</p>
            </div>
            <AlertCircle size={40} className="opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Unassigned</p>
              <p className="text-3xl font-bold mt-1">{stats.unassigned}</p>
            </div>
            <Briefcase size={40} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, phone, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'verified', 'pending', 'unassigned'].map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterStatus(filter as any)}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  filterStatus === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Personnel</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Verification</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    Loading personnel...
                  </td>
                </tr>
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Users size={48} className="mx-auto mb-2 opacity-30" />
                    No personnel found
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                          worker.is_assigned ? 'bg-orange-500' : 'bg-green-500'
                        }`}>
                          {worker.first_name[0]}{worker.last_name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {worker.first_name} {worker.last_name}
                          </p>
                          <p className="text-sm text-gray-500">ID: {worker.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone size={16} className="text-gray-400" />
                        <span className="text-sm">{worker.phone_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="text-sm">{worker.city}, {worker.pincode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                        worker.is_assigned
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          worker.is_assigned ? 'bg-orange-500' : 'bg-green-500'
                        }`}></div>
                        {worker.is_assigned ? 'Assigned' : 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${(getVerificationScore(worker) / 4) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{getVerificationScore(worker)}/4</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {worker.is_id_verified && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">ID</span>
                        )}
                        {worker.is_pan_verified && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">PAN</span>
                        )}
                        {worker.is_bank_details_verified && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Bank</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedWorker(worker);
                            setShowDetails(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        {!worker.is_id_verified && (
                          <button
                            onClick={() => handleVerify(worker.phone_number)}
                            className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Worker Details Modal */}
      {showDetails && selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Personnel Details</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Personal Info */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                    {selectedWorker.first_name[0]}{selectedWorker.last_name[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedWorker.first_name} {selectedWorker.last_name}
                    </h3>
                    <p className="text-gray-600">Personnel ID: {selectedWorker.id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Phone className="text-blue-600" size={20} />
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="font-semibold">{selectedWorker.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="text-blue-600" size={20} />
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="font-semibold">{selectedWorker.city}, {selectedWorker.pincode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="text-blue-600" size={20} />
                    <div>
                      <p className="text-xs text-gray-500">Registered</p>
                      <p className="font-semibold">{new Date(selectedWorker.registered_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="text-blue-600" size={20} />
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className={`font-semibold ${selectedWorker.is_assigned ? 'text-orange-600' : 'text-green-600'}`}>
                        {selectedWorker.is_assigned ? 'Assigned' : 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="text-blue-600" />
                  Verification Status
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'ID Verified', value: selectedWorker.is_id_verified },
                    { label: 'Account Verified', value: selectedWorker.is_verified },
                    { label: 'PAN Verified', value: selectedWorker.is_pan_verified },
                    { label: 'Bank Verified', value: selectedWorker.is_bank_details_verified },
                  ].map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-2 ${
                      item.value ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{item.label}</span>
                        {item.value ? (
                          <CheckCircle className="text-green-600" size={20} />
                        ) : (
                          <XCircle className="text-gray-400" size={20} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PAN Details */}
              {selectedWorker.pan_number && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="text-blue-600" />
                    PAN Details
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">PAN Number:</span>
                      <span className="font-semibold">{selectedWorker.pan_number}</span>
                    </div>
                    {selectedWorker.pan_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Name on PAN:</span>
                        <span className="font-semibold">{selectedWorker.pan_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bank Details */}
              {selectedWorker.account_number && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="text-blue-600" />
                    Bank Details
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Number:</span>
                      <span className="font-mono font-semibold">{selectedWorker.account_number}</span>
                    </div>
                    {selectedWorker.ifsc_code && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">IFSC Code:</span>
                        <span className="font-mono font-semibold">{selectedWorker.ifsc_code}</span>
                      </div>
                    )}
                    {selectedWorker.account_holder_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Account Holder:</span>
                        <span className="font-semibold">{selectedWorker.account_holder_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                {!selectedWorker.is_id_verified && (
                  <button
                    onClick={() => {
                      handleVerify(selectedWorker.phone_number);
                      setShowDetails(false);
                    }}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                  >
                    Verify Personnel
                  </button>
                )}
                <button
                  onClick={() => setShowDetails(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workers;
