import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useToast } from '../contexts/ToastContext';
import { UsersIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const UserCategoryAssignment = () => {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // ESC key handler for modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showAssignModal) {
        setShowAssignModal(false);
        setSelectedUser(null);
        setSelectedCategoryId('');
      }
    };

    if (showAssignModal) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [showAssignModal]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch users with their categories
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          *,
          user_category:user_categories!user_category_id(id, name)
        `)
        .neq('role', 'administrator')
        .order('full_name');

      if (usersError) throw usersError;

      // Fetch all categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('user_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (categoriesError) throw categoriesError;

      setUsers(usersData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching data:', error.message);
      toast.error('Gagal memuat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (user) => {
    setSelectedUser(user);
    setSelectedCategoryId(user.user_category_id || '');
    setShowAssignModal(true);
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();

    if (!selectedCategoryId) {
      toast.error('Silakan pilih kategori');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_category_id: selectedCategoryId })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('Kategori user berhasil diassign!');
      setShowAssignModal(false);
      setSelectedUser(null);
      setSelectedCategoryId('');
      fetchData();
    } catch (error) {
      toast.error('Gagal assign kategori: ' + error.message);
    }
  };

  const handleRemoveCategory = async (userId, userName) => {
    if (!confirm(`Hapus kategori dari user "${userName}"?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_category_id: null })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Kategori berhasil dihapus dari user!');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus kategori: ' + error.message);
    }
  };

  const getCategoryBadgeColor = (categoryName) => {
    const colors = {
      'IT Support': 'bg-blue-950/50 text-blue-400 border border-blue-800',
      'Helpdesk': 'bg-purple-950/50 text-purple-400 border border-purple-800',
    };
    return colors[categoryName] || 'bg-gray-800 text-gray-400 border border-gray-700';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Assign Kategori User</h1>
            <p className="mt-1 text-sm text-gray-400">
              Tetapkan kategori (IT Support/Helpdesk) untuk setiap user
            </p>
          </div>
        </div>

        {/* Assignment Modal */}
        {showAssignModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-950 rounded-xl shadow-2xl shadow-black/50 border border-gray-800 max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-white mb-4">
                Assign Kategori User
              </h2>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-400">User:</p>
                <p className="text-base font-semibold text-white">{selectedUser.full_name}</p>
                <p className="text-xs text-gray-500">{selectedUser.email}</p>
              </div>

              <form onSubmit={handleSubmitAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Pilih Kategori <span className="text-yellow-300">*</span>
                  </label>
                  <select
                    required
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedUser(null);
                      setSelectedCategoryId('');
                    }}
                    className="px-5 py-2 border border-gray-700 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition"
                  >
                    Assign
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <UsersIcon className="size-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-white mb-1">
                Kategori User
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>Helpdesk: Dapat membuat dan assign tugas ke IT Support</li>
                <li>IT Support: Menerima dan mengerjakan tugas dari Helpdesk</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-950 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Users</p>
                <p className="text-3xl font-bold text-white">{users.length}</p>
              </div>
              <span className="text-3xl">👤</span>
            </div>
          </div>

          <div className="bg-gray-950 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Sudah Diassign</p>
                <p className="text-3xl font-bold text-green-400">
                  {users.filter(u => u.user_category_id).length}
                </p>
              </div>
              <span className="text-3xl">✅</span>
            </div>
          </div>

          <div className="bg-gray-950 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Belum Diassign</p>
                <p className="text-3xl font-bold text-red-400">
                  {users.filter(u => !u.user_category_id).length}
                </p>
              </div>
              <span className="text-3xl">⚠️</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-800">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Nama User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-900/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <p className="text-sm font-semibold text-white">{user.full_name}</p>
                        <p className="text-xs text-gray-400">
                          Role: <span className="font-medium">{user.role}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.user_category ? (
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getCategoryBadgeColor(user.user_category.name)}`}>
                        {user.user_category.name}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 italic">Belum diassign</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.status === 'active'
                          ? 'bg-green-950/50 text-green-400 border border-green-800'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => handleAssign(user)}
                      className="text-blue-400 hover:text-blue-300 transition"
                    >
                      <PencilSquareIcon className="size-3.5 inline mr-1" /> {user.user_category_id ? 'Ubah' : 'Assign'}
                    </button>
                    {user.user_category_id && (
                      <button
                        onClick={() => handleRemoveCategory(user.id, user.full_name)}
                        className="text-red-400 hover:text-red-300 transition"
                      >
                        <TrashIcon className="size-3.5 inline mr-1" /> Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Belum ada user terdaftar</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UserCategoryAssignment;
