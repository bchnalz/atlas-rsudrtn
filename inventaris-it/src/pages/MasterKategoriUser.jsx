import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useToast } from '../contexts/ToastContext';
import { InformationCircleIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const MasterKategoriUser = () => {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // ESC key handler for modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showAddForm) {
        setShowAddForm(false);
        setEditingId(null);
        setForm({ name: '', description: '', is_active: true });
      }
    };

    if (showAddForm) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [showAddForm]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm({ name: '', description: '', is_active: true });
    setShowAddForm(true);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ 
      name: item.name, 
      description: item.description || '', 
      is_active: item.is_active 
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const trimmedName = form.name.trim();

      if (!trimmedName) {
        toast.error('❌ Nama kategori tidak boleh kosong!');
        return;
      }

      const submitData = {
        ...form,
        name: trimmedName,
        description: form.description?.trim() || '',
      };

      // Check for duplicates before save
      if (editingId) {
        // Update: Check if name already exists (excluding current record, case-insensitive)
        const { data: duplicate } = await supabase
          .from('user_categories')
          .select('id, name')
          .ilike('name', trimmedName)
          .neq('id', editingId)
          .maybeSingle();

        if (duplicate) {
          toast.error(`❌ Nama kategori "${trimmedName}" sudah digunakan!`);
          return;
        }

        const { error } = await supabase
          .from('user_categories')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('✅ Kategori berhasil diupdate!');
      } else {
        // Insert: Check if name already exists (case-insensitive)
        const { data: duplicate } = await supabase
          .from('user_categories')
          .select('id, name')
          .ilike('name', trimmedName)
          .maybeSingle();

        if (duplicate) {
          toast.error(`❌ Nama kategori "${trimmedName}" sudah digunakan!`);
          return;
        }

        const { error } = await supabase
          .from('user_categories')
          .insert([submitData]);

        if (error) throw error;
        toast.success('✅ Kategori berhasil ditambahkan!');
      }

      setShowAddForm(false);
      setForm({ name: '', description: '', is_active: true });
      setEditingId(null);
      fetchCategories();
    } catch (error) {
      toast.error('❌ Gagal menyimpan data: ' + error.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus kategori "${name}"?\n\nPeringatan: Ini akan mempengaruhi user yang sudah di-assign ke kategori ini.`)) return;

    try {
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('✅ Kategori berhasil dihapus!');
      fetchCategories();
    } catch (error) {
      toast.error('❌ Gagal menghapus data: ' + error.message);
    }
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
            <h1 className="text-3xl font-bold text-gray-900">Master Kategori User</h1>
            <p className="mt-1 text-sm text-gray-500">
              Kelola kategori pengguna sistem (IT Support, Helpdesk, dll)
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            + Tambah Kategori
          </button>
        </div>

        {/* Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingId ? 'Edit Kategori' : 'Tambah Kategori'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Kategori *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="IT Support"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Petugas teknis yang mengerjakan tugas..."
                    rows="3"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                    Aktif
                  </label>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(null);
                      setForm({ name: '', description: '', is_active: true });
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingId ? 'Update' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <InformationCircleIcon className="size-6 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                Kategori User untuk Sistem Penugasan
              </h3>
              <p className="text-sm text-blue-800">
                Kategori user menentukan akses menu dan fitur. Contoh: Helpdesk dapat membuat tugas, IT Support menerima tugas.
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((item) => (
                <tr key={item.id} className="group hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-gray-900">
                      {item.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        item.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {item.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <PencilSquareIcon className="size-3.5 inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="size-3.5 inline mr-1" /> Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {categories.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Belum ada data kategori user</p>
              <p className="text-sm mt-2">Klik tombol "Tambah Kategori" untuk memulai</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MasterKategoriUser;
