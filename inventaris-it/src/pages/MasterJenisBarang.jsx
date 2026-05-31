import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useToast } from '../contexts/ToastContext';

const MasterJenisBarang = () => {
  const toast = useToast();
  const [jenisBarang, setJenisBarang] = useState([]);
  const [jenisPerangkatList, setJenisPerangkatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nama: '',
    jenis_perangkat_kode: '',
    is_active: true,
  });

  useEffect(() => {
    fetchJenisBarang();
    fetchJenisPerangkat();
  }, []);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showAddForm) {
        setShowAddForm(false);
        setEditingId(null);
        setForm({ nama: '', jenis_perangkat_kode: '', is_active: true });
      }
    };
    if (showAddForm) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [showAddForm]);

  const fetchJenisBarang = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('ms_jenis_barang')
        .select('*')
        .order('jenis_perangkat_kode', { ascending: true, nullsFirst: false })
        .order('nama');
      const { data, error } = await query;
      if (error) {
        toast.error('Gagal memuat data: ' + error.message);
        setJenisBarang([]);
        return;
      }
      if (data && data.length > 0) {
        const jenisPerangkatKodes = [...new Set(data.map(item => item.jenis_perangkat_kode).filter(Boolean))];
        if (jenisPerangkatKodes.length > 0) {
          const { data: jenisPerangkatData } = await supabase
            .from('ms_jenis_perangkat')
            .select('kode, nama')
            .in('kode', jenisPerangkatKodes);
          const jenisPerangkatMap = {};
          if (jenisPerangkatData) jenisPerangkatData.forEach(jp => { jenisPerangkatMap[jp.kode] = jp; });
          setJenisBarang(data.map(item => ({
            ...item,
            jenis_perangkat: item.jenis_perangkat_kode ? jenisPerangkatMap[item.jenis_perangkat_kode] : null
          })));
        } else { setJenisBarang(data); }
      } else { setJenisBarang(data || []); }
    } catch (error) {
      toast.error('Gagal memuat data: ' + error.message);
      setJenisBarang([]);
    } finally { setLoading(false); }
  };

  const fetchJenisPerangkat = async () => {
    const { data } = await supabase
      .from('ms_jenis_perangkat')
      .select('*')
      .eq('is_active', true)
      .order('kode');
    setJenisPerangkatList(data || []);
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm({ nama: '', jenis_perangkat_kode: '', is_active: true });
    setShowAddForm(true);
    fetchJenisPerangkat();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ nama: item.nama, jenis_perangkat_kode: item.jenis_perangkat_kode || '', is_active: item.is_active });
    setShowAddForm(true);
    fetchJenisPerangkat();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const trimmedNama = form.nama.trim();
      if (!trimmedNama) { toast.error('Nama jenis barang tidak boleh kosong!'); return; }
      const submitData = { ...form, nama: trimmedNama, jenis_perangkat_kode: form.jenis_perangkat_kode || null };
      if (editingId) {
        const { data: dup } = await supabase.from('ms_jenis_barang').select('id').ilike('nama', trimmedNama).neq('id', editingId).maybeSingle();
        if (dup) { toast.error(`Nama "${trimmedNama}" sudah digunakan!`); return; }
        const { error } = await supabase.from('ms_jenis_barang').update(submitData).eq('id', editingId);
        if (error) throw error;
        toast.success('Data berhasil diupdate!');
      } else {
        const { data: dup } = await supabase.from('ms_jenis_barang').select('id').ilike('nama', trimmedNama).maybeSingle();
        if (dup) { toast.error(`Nama "${trimmedNama}" sudah digunakan!`); return; }
        const { error } = await supabase.from('ms_jenis_barang').insert([submitData]);
        if (error) throw error;
        toast.success('Data berhasil ditambahkan!');
      }
      setShowAddForm(false);
      setForm({ nama: '', jenis_perangkat_kode: '', is_active: true });
      setEditingId(null);
      fetchJenisBarang();
    } catch (error) {
      toast.error('Gagal menyimpan data: ' + error.message);
    }
  };

  const handleDelete = async (id, nama) => {
    if (!confirm(`Hapus jenis barang "${nama}"?`)) return;
    try {
      const { error } = await supabase.from('ms_jenis_barang').delete().eq('id', id);
      if (error) throw error;
      toast.success('Data berhasil dihapus!');
      fetchJenisBarang();
    } catch (error) {
      toast.error('Gagal menghapus data: ' + error.message);
    }
  };

  const groupedData = () => {
    const groups = {};
    const ungrouped = [];
    jenisBarang.forEach((item) => {
      const key = item.jenis_perangkat_kode || 'ungrouped';
      if (key === 'ungrouped') { ungrouped.push(item); }
      else {
        if (!groups[key]) groups[key] = { jenis_perangkat: item.jenis_perangkat, items: [] };
        groups[key].items.push(item);
      }
    });
    const result = Object.keys(groups).sort().map(kode => ({ kode, jenis_perangkat: groups[kode].jenis_perangkat, items: groups[kode].items.sort((a, b) => a.nama.localeCompare(b.nama)) }));
    if (ungrouped.length > 0) result.push({ kode: null, jenis_perangkat: null, items: ungrouped.sort((a, b) => a.nama.localeCompare(b.nama)) });
    return result;
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

  const grouped = groupedData();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Master Jenis Barang</h1>
            <p className="mt-1 text-sm text-gray-400">
              Kelola jenis barang untuk kategorisasi perangkat
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition text-sm"
          >
            + Tambah Jenis Barang
          </button>
        </div>

        {/* Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-950 rounded-xl shadow-2xl shadow-black/50 border border-gray-800 max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-white mb-4">
                {editingId ? 'Edit Jenis Barang' : 'Tambah Jenis Barang'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Jenis Perangkat <span className="text-yellow-300">*</span>
                  </label>
                  <select
                    value={form.jenis_perangkat_kode}
                    onChange={(e) => setForm({ ...form, jenis_perangkat_kode: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  >
                    <option value="">-- Pilih Jenis Perangkat --</option>
                    {jenisPerangkatList.map((jenis) => (
                      <option key={jenis.id} value={jenis.kode}>
                        {jenis.kode} - {jenis.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Nama Jenis Barang <span className="text-yellow-300">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    placeholder="Ink Jet, Laser Jet, Thermal, dll"
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
                    Aktif (tampil di dropdown)
                  </label>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingId(null);
                      setForm({ nama: '', jenis_perangkat_kode: '', is_active: true });
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

        {/* Info Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">ℹ️</span>
            <div>
              <h3 className="font-semibold text-sm text-white mb-1">
                Jenis Barang &amp; Filtering
              </h3>
              <p className="text-xs text-gray-400">
                Jenis barang digunakan untuk kategorisasi perangkat. Hubungkan dengan Jenis Perangkat untuk filtering otomatis di Stok Opnam.
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
                  Jenis Perangkat / Nama Jenis Barang
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
              {grouped.map((group) => (
                <React.Fragment key={`group-${group.kode || 'ungrouped'}`}>
                  {/* Parent row - Jenis Perangkat */}
                  <tr className="bg-gray-900/50">
                    <td colSpan="3" className="px-6 py-3">
                      <div className="flex items-center">
                        <span className="text-lg font-mono font-bold text-yellow-400">
                          {group.jenis_perangkat ? group.jenis_perangkat.kode : '-'}
                        </span>
                        <span className="ml-3 text-base font-semibold text-white">
                          {group.jenis_perangkat ? group.jenis_perangkat.nama : 'Tidak Terhubung'}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({group.items.length} {group.items.length === 1 ? 'item' : 'items'})
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* Child rows - Jenis Barang */}
                  {group.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-900/50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center pl-8">
                          <span className="text-gray-500 mr-2">↪</span>
                          <span className="text-sm font-medium text-white">{item.nama}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
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
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-400 hover:text-blue-300 transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.nama)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          🗑️ Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {jenisBarang.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Belum ada data master jenis barang</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MasterJenisBarang;
