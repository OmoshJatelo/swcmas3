import React, { useEffect, useState, useRef, useCallback } from 'react';
import { listApartments, deleteApartment, createApartment, updateApartment } from '@/api/apartments.api.js';
import { listUsers } from '@/api/users.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import Badge from '@/components/ui/Badge.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import Modal from '@/components/ui/Modal.jsx';
import { Building2, Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const inputCls =
  'w-full border border-gray-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800/50 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all duration-150';

const ApartmentsPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ apartments: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [apartmentToDelete, setApartmentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const selectedId = useRef(null);
  const emptyForm = {
    name: '',
    address: '',
    city: '',
    county: '',
    unitCount: 1,
    location: { lat: '', lng: '' },
    landlord: '',
    wasteCollector: '',
    collectionSchedule: { frequency: 'daily', time: '' },
  };
  const [formData, setFormData] = useState(emptyForm);

  if (!user || user.role !== 'county_admin') {
    return <EmptyState title="Access Denied" message="You do not have permission to view this page." icon={Building2} />;
  }

  const fetchApartments = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listApartments(page);
      setData(result);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load apartments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApartments();
  }, [fetchApartments]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const result = await listUsers(1, 200);
        setUsers(result.users);
      } catch (e) { /* ignore */ }
    };
    fetchUsers();
  }, []);

  const handleDeleteClick = (apt) => {
    setApartmentToDelete(apt);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!apartmentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteApartment(apartmentToDelete._id);
      toast.success('Property deleted successfully');
      setIsDeleteModalOpen(false);
      setApartmentToDelete(null);
      fetchApartments(data.page);
    } catch (e) {
      toast.error('Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateModal = () => {
    setIsEdit(false);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (apt) => {
    setIsEdit(true);
    selectedId.current = apt._id;
    setFormData({
      name: apt.name || '',
      address: apt.address || '',
      city: apt.city || '',
      county: apt.county || '',
      unitCount: apt.unitCount || 1,
      location: {
        lat: apt.location?.coordinates?.[1] ?? '',
        lng: apt.location?.coordinates?.[0] ?? '',
      },
      landlord: apt.landlord?._id || '',
      wasteCollector: apt.wasteCollector?._id || '',
      collectionSchedule: {
        frequency: apt.collectionSchedule?.frequency || 'daily',
        time: apt.collectionSchedule?.time || '',
      },
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (section, field) => (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        county: formData.county,
        unitCount: Number(formData.unitCount),
        location: {
          type: 'Point',
          coordinates: [Number(formData.location.lng), Number(formData.location.lat)],
        },
        landlord: formData.landlord,
        wasteCollector: formData.wasteCollector || undefined,
        collectionSchedule: {
          frequency: formData.collectionSchedule.frequency,
          time: formData.collectionSchedule.time,
        },
      };
      if (isEdit) {
        await updateApartment(selectedId.current, payload);
        toast.success('Property updated successfully');
      } else {
        await createApartment(payload);
        toast.success('Property created successfully');
      }
      setShowModal(false);
      fetchApartments(data.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save property');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    { 
      header: 'Property Details', 
      accessor: 'name',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
          <div className="flex items-center text-xs text-gray-500 mt-1">
            <MapPin className="w-3 h-3 mr-1 shrink-0" />
            {row.address}, {row.city}
          </div>
        </div>
      )
    },
    { 
      header: 'Units', 
      accessor: 'unitCount',
      render: (row) => <Badge variant="info">{row.unitCount} Units</Badge>
    },
    { 
      header: 'Landlord', 
      accessor: 'landlord',
      render: (row) => row.landlord ? `${row.landlord.firstName} ${row.landlord.lastName}` : 'Unassigned'
    },
    { 
      header: 'Collector', 
      accessor: 'wasteCollector',
      render: (row) => row.wasteCollector ? `${row.wasteCollector.firstName} ${row.wasteCollector.lastName}` : 'Unassigned'
    },
    { 
      header: 'Schedule', 
      accessor: 'schedule',
      render: (row) => (
        <span className="capitalize text-gray-600 dark:text-gray-400">
          {row.collectionSchedule?.frequency.replace('_', ' ')} @ {row.collectionSchedule?.time}
        </span>
      )
    },
    { 
      header: 'Actions', 
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(row); }}
            className="btn p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors focus-ring"
            title="Edit Property"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="btn p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus-ring"
            title="Delete Property"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Properties</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage apartments and collection schedules</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm focus-ring"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {error ? (
          <div className="p-6">
            <EmptyState
              title="Error Loading Properties"
              message={error}
              icon={Building2}
              onRetry={() => fetchApartments()}
            />
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={data.apartments} 
            keyField="_id"
            isLoading={loading}
            emptyMessage="No properties found."
            aria-label="Properties table"
          />
        )}
      </div>

      {apartmentToDelete && (
        <ConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={() => { if (!isDeleting) { setIsDeleteModalOpen(false); setApartmentToDelete(null); } }}
          onConfirm={handleConfirmDelete}
          isConfirming={isDeleting}
          title="Delete Property"
          message={`Are you sure you want to delete ${apartmentToDelete.name}? This will also delete related collections.`}
          confirmText="Delete Property"
          isDestructive={true}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => !isSubmitting && setShowModal(false)}
        title={isEdit ? 'Edit Property' : 'Add New Property'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property Name <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputCls} placeholder="e.g. Sunset Apartments" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address <span className="text-red-500">*</span></label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} required className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City <span className="text-red-500">*</span></label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">County <span className="text-red-500">*</span></label>
                <input type="text" name="county" value={formData.county} onChange={handleChange} required className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Count</label>
                <input type="number" name="unitCount" value={formData.unitCount} onChange={handleChange} min="1" required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
                <input type="number" step="any" value={formData.location.lat} onChange={handleNestedChange('location', 'lat')} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
                <input type="number" step="any" value={formData.location.lng} onChange={handleNestedChange('location', 'lng')} required className={inputCls} />
              </div>
            </div>
            
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Assignments</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Landlord <span className="text-red-500">*</span></label>
                  <select name="landlord" value={formData.landlord} onChange={handleChange} required className={inputCls}>
                    <option value="">Select landlord</option>
                    {users.filter(u => u.role === 'landlord').map(u => (
                      <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Waste Collector</label>
                  <select name="wasteCollector" value={formData.wasteCollector} onChange={handleChange} className={inputCls}>
                    <option value="">Select collector (optional)</option>
                    {users.filter(u => u.role === 'waste_collector').map(u => (
                      <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Collection Schedule</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency <span className="text-red-500">*</span></label>
                  <select value={formData.collectionSchedule.frequency} onChange={handleNestedChange('collectionSchedule', 'frequency')} required className={inputCls}>
                    <option value="daily">Daily</option>
                    <option value="every_other_day">Every Other Day</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time <span className="text-red-500">*</span></label>
                  <input type="time" value={formData.collectionSchedule.time} onChange={handleNestedChange('collectionSchedule', 'time')} required className={inputCls} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => !isSubmitting && setShowModal(false)}
              disabled={isSubmitting}
              className="btn px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl border border-gray-300 dark:border-slate-600 transition-colors focus-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn px-4 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors focus-ring disabled:opacity-70 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Saving…
                </>
              ) : isEdit ? 'Save Changes' : 'Create Property'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ApartmentsPage;
