import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';
import { listUsers, deleteUser } from '@/api/users.api.js';
import DataTable from '@/components/ui/DataTable.jsx';
import Badge from '@/components/ui/Badge.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { Users, Trash2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

const UsersPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ users: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!user || user.role !== 'county_admin') {
    return <EmptyState title="Access Denied" message="You do not have permission to view this page." icon={ShieldAlert} />;
  }

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers(page);
      setData(result);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeleteClick = (userData) => {
    setUserToDelete(userData);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await deleteUser(userToDelete._id);
      toast.success('User deleted successfully');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers(data.page);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const roleColors = {
    county_admin: 'danger',
    county_officer: 'warning',
    landlord: 'info',
    waste_collector: 'success',
    resident: 'default'
  };

  const columns = [
    { 
      header: 'User', 
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-semibold text-xs shrink-0">
            {row.firstName[0]}{row.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.firstName} {row.lastName}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      )
    },
    { 
      header: 'Role', 
      accessor: 'role',
      render: (row) => (
        <Badge variant={roleColors[row.role] || 'default'} className="capitalize">
          {row.role.replace('_', ' ')}
        </Badge>
      )
    },
    { 
      header: 'Joined', 
      accessor: 'createdAt',
      render: (row) => <span className="text-gray-600 dark:text-gray-400">{new Date(row.createdAt).toLocaleDateString()}</span>
    },
    { 
      header: 'Actions', 
      accessor: 'actions',
      render: (row) => (
        row._id !== user._id ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
            className="btn p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors focus-ring"
            title="Delete User"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : <span className="text-xs text-gray-400 italic">Current User</span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">User Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all registered users in the system</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {error ? (
          <div className="p-6">
            <EmptyState
              title="Error Loading Users"
              message={error}
              icon={Users}
              onRetry={() => fetchUsers()}
            />
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={data.users} 
            keyField="_id"
            isLoading={loading}
            emptyMessage="No users found."
            aria-label="Users table"
          />
        )}
      </div>

      {userToDelete && (
        <ConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setUserToDelete(null);
            }
          }}
          onConfirm={handleConfirmDelete}
          isConfirming={isDeleting}
          title="Delete User"
          message={`Are you sure you want to delete ${userToDelete.firstName} ${userToDelete.lastName}? This action cannot be undone.`}
          confirmText="Delete User"
          isDestructive={true}
        />
      )}
    </div>
  );
};

export default UsersPage;
