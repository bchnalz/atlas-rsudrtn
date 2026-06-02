import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useToast } from '../contexts/ToastContext';
import { ChartBarSquareIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const MasterSKP = () => {
  const toast = useToast();
  const [skpCategories, setSkpCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedSKP, setSelectedSKP] = useState(null);
  const [currentYear] = useState(new Date().getFullYear());

  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  const [targetForm, setTargetForm] = useState({
    year: new Date().getFullYear(),
    target_count: 0,
  });

  useEffect(() => {
    fetchSKPCategories();
  }, []);

  // ESC key handler for modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showAddForm) {
          setShowAddForm(false);
          setEditingId(null);
          setForm({ name: '', description: '', is_active: true });
        } else if (showTargetModal) {
          setShowTargetModal(false);
          setSelectedSKP(null);
          setTargetForm({ year: new Date().getFullYear(), target_count: 0 });
        }
      }
    };

    if (showAddForm || showTargetModal) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [showAddForm, showTargetModal]);

  const fetchSKPCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('skp_categories')
        .select(`
          *,
          skp_targets!left (
            id,
            year,
            target_count
          )
        `)
        .order('name');

      if (error) throw error;
      setSkpCategories(data);
    } catch (error) {
      console.error('Error fetching SKP categories:', error.message);
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
        toast.error('Nama SKP tidak boleh kosong!');
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
          .from('skp_categories')
          .select('id, name')
          .ilike('name', trimmedName)
          .neq('id', editingId)
          .maybeSingle();

        if (duplicate) {
          toast.error(`Nama SKP "${trimmedName}" sudah digunakan!`);
          return;
        }

        const { error } = await supabase
          .from('skp_categories')
          .update(submitData)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('SKP berhasil diupdate!');
      } else {
        // Insert: Check if name already exists (case-insensitive)
        const { data: duplicate } = await supabase
          .from('skp_categories')
          .select('id, name')
          .ilike('name', trimmedName)
          .maybeSingle();

        if (duplicate) {
          toast.error(`Nama SKP "${trimmedName}" sudah digunakan!`);
          return;
        }

        const { error } = await supabase
          .from('skp_categories')
          .insert([submitData]);

        if (error) throw error;
        toast.success('SKP berhasil ditambahkan!');
      }

      setShowAddForm(false);
      setForm({ name: '', description: '', is_active: true });
      setEditingId(null);
      fetchSKPCategories();
    } catch (error) {
      toast.error('Gagal menyimpan data: ' + error.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus SKP "${name}"?\n\nPeringatan: Ini akan mempengaruhi data penugasan yang sudah ada.`)) return;

    try {
      const { error } = await supabase
        .from('skp_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('SKP berhasil dihapus!');
      fetchSKPCategories();
    } catch (error) {
      toast.error('Gagal menghapus data: ' + error.message);
    }
  };

  const handleSetTarget = (skp) => {
    setSelectedSKP(skp);
    const currentYearTarget = skp.skp_targets?.find(t => t.year === currentYear);
    setTargetForm({
      year: currentYear,
      target_count: currentYearTarget?.target_count || 0,
    });
    setShowTargetModal(true);
  };

  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data: existing, error: checkError } = await supabase
        .from('skp_targets')
        .select('id')
        .eq('skp_category_id', selectedSKP.id)
        .eq('year', targetForm.year)
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (existing) {
        // Update existing target
        const { error } = await supabase
          .from('skp_targets')
          .update({ target_count: targetForm.target_count })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new target
        const { error } = await supabase
          .from('skp_targets')
          .insert([{
            skp_category_id: selectedSKP.id,
            year: targetForm.year,
            target_count: targetForm.target_count,
          }]);

        if (error) throw error;
      }

      toast.success('Target berhasil disimpan!');
      setShowTargetModal(false);
      setSelectedSKP(null);
      fetchSKPCategories();
    } catch (error) {
      toast.error('Gagal menyimpan target: ' + error.message);
    }
  };

  const getCurrentYearTarget = (skp) => {
    const target = skp.skp_targets?.find(t => t.year === currentYear);
    return target?.target_count || 0;
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
            <h1 className="text-3xl font-bold text-white">Master SKP</h1>
            <p className="mt-1 text-sm text-gray-400">
              Kelola kategori SKP (Sasaran Kerja Pegawai) dan target tahunan
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition text-sm"
          >
            + Tambah SKP
          </button>
        </div>

        {/* Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-950 rounded-xl shadow-2xl shadow-black/50 border border-gray-800 max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-white mb-4">
                {editingId ? 'Edit SKP' : 'Tambah SKP'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Nama SKP <span className="text-yellow-300">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    placeholder="Perbaikan Komputer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    placeholder="Perbaikan hardware dan software komputer..."
                    rows="3"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 bg-gray-950 border border-gray-700 rounded focus:ring-gray-600 text-blue-600"
                  />
                  <label htmlFor="is_active" className="ml-2 text-xs text-gray-400">
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
                    className="px-5 py-2 border border-gray-700 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition"
                  >
                    {editingId ? 'Update' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Target Modal */}
        {showTargetModal && selectedSKP && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-950 rounded-xl shadow-2xl shadow-black/50 border border-gray-800 max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-white mb-4">
                Set Target SKP
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-white">{selectedSKP.name}</p>
                {selectedSKP.description && (
                  <p className="text-xs text-gray-400 mt-1">{selectedSKP.description}</p>
                )}
              </div>
              <form onSubmit={handleTargetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Tahun
                  </label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2100"
                    value={targetForm.year}
                    onChange={(e) => setTargetForm({ ...targetForm, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Target Jumlah <span className="text-yellow-300">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={targetForm.target_count}
                    onChange={(e) => setTargetForm({ ...targetForm, target_count: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    placeholder="250"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Target jumlah penyelesaian SKP ini dalam setahun
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTargetModal(false);
                      setSelectedSKP(null);
                    }}
                    className="px-5 py-2 border border-gray-700 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition"
                  >
                    Simpan Target
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ChartBarSquareIcon className="size-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-white mb-1">
                Sasaran Kerja Pegawai (SKP)
              </h3>
              <p className="text-xs text-gray-400">
                SKP adalah kategori tugas yang harus dikerjakan. Setiap SKP memiliki target tahunan yang dapat diatur administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-800">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Nama SKP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Target {currentYear}
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
              {skpCategories.map((item) => (
                <tr key={item.id} className="hover:bg-gray-900/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-lg font-bold text-green-400">
                      {getCurrentYearTarget(item)}x
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        item.is_active
                          ? 'bg-green-950/50 text-green-400 border border-green-800'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {item.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => handleSetTarget(item)}
                      className="text-green-400 hover:text-green-300 transition"
                    >
                      <ChartBarSquareIcon className="size-3.5 inline mr-1" /> Target
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-400 hover:text-blue-300 transition"
                    >
                      <PencilSquareIcon className="size-3.5 inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      <TrashIcon className="size-3.5 inline mr-1" /> Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {skpCategories.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Belum ada data SKP</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MasterSKP;
