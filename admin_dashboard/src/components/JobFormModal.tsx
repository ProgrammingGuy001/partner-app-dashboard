import React, { useState, useEffect } from 'react';
import { type Job, jobAPI, type JobUpdate, adminAPI, checklistAPI } from '../api/services';
import { X } from 'lucide-react';

interface IPUser {
  id: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  is_assigned: boolean;
}

interface Checklist {
  id: number;
  name: string;
  description?: string;
}

interface JobFormModalProps {
  job?: Job;
  onClose: () => void;
  onSuccess: () => void;
}

const JobFormModal: React.FC<JobFormModalProps> = ({ job, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    customer_name: '',
    address: '',
    city: '',
    pincode: '',
    google_map_link: '',
    type: '',
    rate: '',
    size: '',
    assigned_ip_id: '',
    delivery_date: '',
    checklist_link: '',
  });
  const [ipUsers, setIpUsers] = useState<IPUser[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (job) {
      setFormData({
        name: job.name,
        customer_name: job.customer_name,
        address: job.address || '',
        city: job.city,
        pincode: job.pincode.toString(),
        google_map_link: job.google_map_link || '',
        type: job.type,
        rate: job.rate.toString(),
        size: job.size?.toString() || '',
        assigned_ip_id: job.assigned_ip_id?.toString() || '',
        delivery_date: job.delivery_date || '',
        checklist_link: job.checklist_link || '',
      });
      
      // Load existing checklists
      const ids: number[] = [];
      if (job.job_checklists && Array.isArray(job.job_checklists)) {
        ids.push(...job.job_checklists.map(jc => jc.checklist_id));
      }
      setSelectedChecklistIds(ids);
    }
  }, [job]);

  useEffect(() => {
    const fetchIPUsers = async () => {
      try {
        const response = await adminAPI.getApprovedIPUsers();
        setIpUsers(response.data);
      } catch (error) {
        console.error('Error fetching IPUsers:', error);
      }
    };
    fetchIPUsers();
  }, []);

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const response = await checklistAPI.getAll();
        setChecklists(response.data);
      } catch (error) {
        console.error('Error fetching checklists:', error);
      }
    };
    fetchChecklists();
  }, []);

  const handleChecklistToggle = (id: number) => {
    setSelectedChecklistIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name: formData.name,
        customer_name: formData.customer_name,
        address: formData.address,
        city: formData.city,
        pincode: parseInt(formData.pincode),
        type: formData.type,
        rate: parseFloat(formData.rate),
        size: formData.size ? parseInt(formData.size) : 0,
        assigned_ip_id: formData.assigned_ip_id ? parseInt(formData.assigned_ip_id) : null,
        delivery_date: formData.delivery_date,
        google_map_link: formData.google_map_link,
        checklist_ids: selectedChecklistIds,
      };

      if (formData.checklist_link) payload.checklist_link = formData.checklist_link;
      
      console.log('Submitting job payload:', payload);

      if (job?.id) {
        await jobAPI.update(job.id, payload);
      } else {
        await jobAPI.create(payload);
      }
      onSuccess();
    } catch (err: unknown) {
      console.error('Error saving job:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Operation failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            {job ? 'Edit Job' : 'Create New Job'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                <option value="">Select a type</option>
                <option value="site_readiness">Site Readiness</option>
                <option value="site_validation">Site Validation</option>
                <option value="installation">Installation</option>
                <option value="measurement">Measurement</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Map Link</label>
              <input
                type="url"
                value={formData.google_map_link}
                onChange={(e) => setFormData({ ...formData,google_map_link: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
              <input
                type="number"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
              <input
                type="number"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned IP</label>
              <select
                value={formData.assigned_ip_id}
                onChange={(e) => setFormData({ ...formData, assigned_ip_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select an IP User</option>
                {ipUsers.map((ipUser) => (
                  <option key={ipUser.id} value={ipUser.id} disabled={ipUser.is_assigned && ipUser.id !== job?.assigned_ip_id}>
                    {ipUser.first_name} {ipUser.last_name} {ipUser.is_assigned && ipUser.id !== job?.assigned_ip_id ? '(Assigned)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date *</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Checklists</label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto bg-gray-50">
                {checklists.length === 0 ? (
                  <p className="text-gray-500 text-sm">No checklists available</p>
                ) : (
                  <div className="space-y-2">
                    {checklists.map((checklist) => (
                      <label
                        key={checklist.id}
                        className="flex items-start space-x-3 p-2 hover:bg-gray-100 rounded cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedChecklistIds.includes(checklist.id)}
                          onChange={() => handleChecklistToggle(checklist.id)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{checklist.name}</div>
                          {checklist.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{checklist.description}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {selectedChecklistIds.length} checklist{selectedChecklistIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Checklist Link (Optional)</label>
              <input
                type="url"
                value={formData.checklist_link}
                onChange={(e) => setFormData({ ...formData, checklist_link: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Or enter custom checklist URL"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobFormModal;
