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
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>('');
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
      setSelectedChecklistId(job.checklist_id?.toString() || '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: JobUpdate = {
        name: formData.name,
        customer_name: formData.customer_name,
        address: formData.address,
        city: formData.city,
        pincode: parseInt(formData.pincode),
        type: formData.type,
        rate: parseFloat(formData.rate),
        size: parseInt(formData.size),
        assigned_ip_id: parseInt(formData.assigned_ip_id),
        delivery_date: formData.delivery_date,
        google_map_link: formData.google_map_link,
      };

      if (formData.checklist_link) payload.checklist_link = formData.checklist_link;
      if (selectedChecklistId) payload.checklist_id = parseInt(selectedChecklistId);

      if (job?.id) {
        await jobAPI.update(job.id, payload);
      } else {
        await jobAPI.create(payload as Job);
      }
      onSuccess();
    } catch (err: unknown) {
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
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Size *</label>
              <input
                type="number"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned IP *</label>
              <select
                value={formData.assigned_ip_id}
                onChange={(e) => setFormData({ ...formData, assigned_ip_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                <option value="">Select an IP User</option>
                {ipUsers.map((ipUser) => (
                  <option key={ipUser.id} value={ipUser.id} disabled={ipUser.is_assigned}>
                    {ipUser.first_name} {ipUser.last_name} {ipUser.is_assigned ? '(Assigned)' : ''}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attach Checklist</label>
              <select
                value={selectedChecklistId}
                onChange={(e) => setSelectedChecklistId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select a checklist (optional)</option>
                {checklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.name} {checklist.description ? `- ${checklist.description}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Link</label>
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
