import React, { useEffect, useState, useRef } from 'react';
import { listMyVerifications, respondVerification } from '@/api/verifications.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import Badge from '@/components/ui/Badge.jsx';
import LoadingSpinner from '@/components/ui/LoadingSpinner.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import Modal from '@/components/ui/Modal.jsx';
import { CheckSquare, Check, X, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const VerificationPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ verifications: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedId = useRef(null);
  const [responseData, setResponseData] = useState({ wasCollected: '', notes: '' });

  if (!user || user.role !== 'resident') {
    return <EmptyState title="Access Denied" message="Only residents can view this page." icon={CheckSquare} />;
  }

  const fetchVerifications = async (page = 1) => {
    try {
      setLoading(true);
      const result = await listMyVerifications(page);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const openModal = (verification) => {
    selectedId.current = verification._id;
    setResponseData({ wasCollected: '', notes: '' });
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setResponseData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        wasCollected: responseData.wasCollected === 'true',
        notes: responseData.notes || undefined,
      };
      await respondVerification(selectedId.current, payload);
      toast.success('Response submitted successfully');
      setShowModal(false);
      fetchVerifications(data.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { 
      header: 'Property', 
      accessor: 'apartment',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.apartment?.name || 'Unknown'}</p>
          <p className="text-xs text-gray-500">{row.apartment?.address}</p>
        </div>
      )
    },
    { 
      header: 'Created On', 
      accessor: 'createdAt',
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-400">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (row) => (
        <Badge variant={row.status === 'pending' ? 'warning' : 'default'} className="capitalize">
          {row.status}
        </Badge>
      )
    },
    { 
      header: 'Actions', 
      accessor: 'actions',
      render: (row) => (
        <button
          onClick={() => openModal(row)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-lg transition-colors text-sm font-medium"
        >
          <MessageSquare className="w-4 h-4" />
          Respond
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Verifications</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Verify whether waste was collected at your property</p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm">
        {loading && !data.verifications.length ? (
          <div className="py-12"><LoadingSpinner /></div>
        ) : error ? (
          <EmptyState title="Error" message={error} icon={CheckSquare} />
        ) : (
          <DataTable 
            columns={columns} 
            data={data.verifications} 
            keyField="_id"
            emptyMessage="No pending verification requests."
          />
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Verification Response"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {selectedId.current && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Sensor Data Analysis</h3>
              {(() => {
                const col = data.verifications.find(v => v._id === selectedId.current);
                if (!col || col.fillDeltaPercent == null) {
                  return <p className="text-sm text-gray-500">Awaiting sensor data</p>;
                }
                const delta = col.fillDeltaPercent;
                let color = 'text-green-600 dark:text-green-400';
                let bg = 'bg-green-100 dark:bg-green-500/20';
                if (delta < 30) {
                  color = 'text-red-600 dark:text-red-400';
                  bg = 'bg-red-100 dark:bg-red-500/20';
                } else if (delta < 60) {
                  color = 'text-amber-600 dark:text-amber-400';
                  bg = 'bg-amber-100 dark:bg-amber-500/20';
                }
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className={`px-4 py-2 rounded-lg font-bold ${bg} ${color}`}>
                      ↓ {Math.round(delta)}% drop detected
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      <p>Pre: {col.preSensorReadingId ? 'Recorded' : 'N/A'}</p>
                      <p>Post: {col.postSensorReadingId ? 'Recorded' : 'N/A'}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Was the collection completed as scheduled?
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`
                relative flex cursor-pointer rounded-xl border p-4 focus:outline-none transition-all
                ${responseData.wasCollected === 'true' 
                  ? 'bg-brand-50 border-brand-500 dark:bg-brand-500/10 dark:border-brand-400' 
                  : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800'
                }
              `}>
                <input 
                  type="radio" 
                  name="wasCollected" 
                  value="true" 
                  checked={responseData.wasCollected === 'true'} 
                  onChange={handleChange} 
                  className="sr-only" 
                  required
                />
                <div className="flex w-full items-center justify-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${responseData.wasCollected === 'true' ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                    <Check className="h-4 w-4" />
                  </div>
                  <span className={`font-medium ${responseData.wasCollected === 'true' ? 'text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-white'}`}>
                    Yes, it was
                  </span>
                </div>
              </label>

              <label className={`
                relative flex cursor-pointer rounded-xl border p-4 focus:outline-none transition-all
                ${responseData.wasCollected === 'false' 
                  ? 'bg-red-50 border-red-500 dark:bg-red-500/10 dark:border-red-400' 
                  : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800'
                }
              `}>
                <input 
                  type="radio" 
                  name="wasCollected" 
                  value="false" 
                  checked={responseData.wasCollected === 'false'} 
                  onChange={handleChange} 
                  className="sr-only" 
                  required
                />
                <div className="flex w-full items-center justify-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${responseData.wasCollected === 'false' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                    <X className="h-4 w-4" />
                  </div>
                  <span className={`font-medium ${responseData.wasCollected === 'false' ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-white'}`}>
                    No, it wasn't
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea 
              name="notes" 
              value={responseData.notes} 
              onChange={handleChange} 
              rows={3} 
              className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-4 py-2 dark:bg-slate-800/50 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="e.g. They came late, or left a mess..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl border border-gray-300 dark:border-slate-600 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !responseData.wasCollected} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-70">
              {isSubmitting ? <LoadingSpinner size="sm" /> : 'Submit Response'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default VerificationPage;
