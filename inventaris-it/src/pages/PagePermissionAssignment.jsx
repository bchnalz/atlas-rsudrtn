import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useToast } from '../contexts/ToastContext';

/**
 * List of all available pages in the system
 * 
 * TO ADD A NEW PAGE:
 * 1. Add a new object to this array with:
 *    - route: The exact route path (e.g., '/new-page')
 *    - label: Display name (e.g., 'New Page')
 *    - description: Brief description (e.g., 'Description of new page')
 * 
 * Example:
 * { 
 *   route: '/new-page', 
 *   label: 'New Page', 
 *   description: 'Description here'
 * },
 * 
 * 2. The page will automatically appear in the permission assignment UI
 * 3. Make sure the route matches exactly with your App.jsx route definition
 */
const AVAILABLE_PAGES = [
  { route: '/', label: 'Dashboard', description: 'Halaman utama dashboard' },
  { route: '/dashboard-executive', label: 'Executive Dashboard', description: 'Dashboard eksekutif dengan statistik lengkap' },
  { route: '/master-jenis-perangkat', label: 'Master Jenis Perangkat', description: 'Kelola jenis perangkat' },
  { route: '/master-jenis-barang', label: 'Master Jenis Barang', description: 'Kelola jenis barang' },
  { route: '/master-lokasi', label: 'Master Lokasi', description: 'Kelola lokasi' },
  { route: '/stok-opnam', label: 'Stok Opnam', description: 'Kelola stok opnam' },
  { route: '/import-data', label: 'Import Data', description: 'Import data perangkat' },
  { route: '/log-penugasan', label: 'Log Penugasan', description: 'Log penugasan perangkat' },
  { route: '/log-penugasan/penugasan', label: 'Penugasan', description: 'Buat dan kelola tugas' },
  { route: '/log-penugasan/daftar-tugas', label: 'Daftar Tugas', description: 'Daftar tugas yang ditugaskan' },
];

const PagePermissionAssignment = () => {
  const toast = useToast();
  const [userCategories, setUserCategories] = useState([]);
  const [permissions, setPermissions] = useState({}); // { categoryId: Set<pageRoute> }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch user categories
      const { data: ucData, error: ucError } = await supabase
        .from('user_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (ucError) throw ucError;

      // Fetch existing permissions
      const { data: permData, error: permError } = await supabase
        .from('user_category_page_permissions')
        .select('user_category_id, page_route')
        .eq('can_view', true);

      if (permError) throw permError;

      // Build permissions map as Set
      const permMap = {};
      permData.forEach((perm) => {
        if (!permMap[perm.user_category_id]) {
          permMap[perm.user_category_id] = new Set();
        }
        permMap[perm.user_category_id].add(perm.page_route);
      });

      setUserCategories(ucData || []);
      setPermissions(permMap);

      // Auto-select first category if available
      if (ucData && ucData.length > 0) {
        setSelectedCategory(ucData[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('❌ Gagal memuat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePage = async (pageRoute) => {
    if (!selectedCategory) return;

    const currentPermissions = permissions[selectedCategory] || new Set();
    const hasAccess = currentPermissions.has(pageRoute);

    try {
      setSaving(true);

      if (hasAccess) {
        // Remove access
        const { error } = await supabase
          .from('user_category_page_permissions')
          .delete()
          .eq('user_category_id', selectedCategory)
          .eq('page_route', pageRoute);

        if (error) throw error;

        // Update local state
        const newSet = new Set(currentPermissions);
        newSet.delete(pageRoute);
        setPermissions((prev) => ({
          ...prev,
          [selectedCategory]: newSet,
        }));
        
        toast.success(
          `✅ Akses ke "${pageRoute}" dihapus. Pengguna perlu refresh halaman atau logout/login untuk melihat perubahan.`
        );
      } else {
        // Grant access
        const { error } = await supabase
          .from('user_category_page_permissions')
          .insert({
            user_category_id: selectedCategory,
            page_route: pageRoute,
            can_view: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
          });

        if (error) throw error;

        // Update local state
        const newSet = new Set(currentPermissions);
        newSet.add(pageRoute);
        setPermissions((prev) => ({
          ...prev,
          [selectedCategory]: newSet,
        }));
        
        toast.success(
          `✅ Akses ke "${pageRoute}" diberikan. Pengguna perlu refresh halaman atau logout/login untuk melihat perubahan.`
        );
      }
    } catch (error) {
      console.error('Error toggling page:', error);
      toast.error('❌ Gagal mengubah akses: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = async () => {
    if (!selectedCategory) return;

    try {
      setSaving(true);

      // Get all page routes
      const allPageRoutes = AVAILABLE_PAGES.map((page) => page.route);

      // Insert all (ignore conflicts)
      const inserts = allPageRoutes.map((pageRoute) => ({
        user_category_id: selectedCategory,
        page_route: pageRoute,
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
      }));

      const { error } = await supabase
        .from('user_category_page_permissions')
        .upsert(inserts, { onConflict: 'user_category_id,page_route' });

      if (error) throw error;

      // Update local state
      setPermissions((prev) => ({
        ...prev,
        [selectedCategory]: new Set(allPageRoutes),
      }));

      toast.success('✅ Berhasil assign semua halaman!');
    } catch (error) {
      console.error('Error selecting all:', error);
      toast.error('❌ Gagal assign semua halaman: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeselectAll = async () => {
    if (!selectedCategory) return;

    try {
      setSaving(true);

      // Delete all permissions for this category
      const { error } = await supabase
        .from('user_category_page_permissions')
        .delete()
        .eq('user_category_id', selectedCategory);

      if (error) throw error;

      // Update local state
      setPermissions((prev) => ({
        ...prev,
        [selectedCategory]: new Set(),
      }));

      toast.success('✅ Berhasil hapus semua akses!');
    } catch (error) {
      console.error('Error deselecting all:', error);
      toast.error('❌ Gagal hapus akses: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getAssignedCount = (categoryId) => {
    return permissions[categoryId]?.size || 0;
  };

  const selectedCategoryData = userCategories.find(
    (cat) => cat.id === selectedCategory
  );

  const currentPermissions = permissions[selectedCategory] || new Set();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Memuat data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Assign Page Access</h1>
            <p className="mt-2 text-gray-400">
              Tentukan akses halaman untuk setiap kategori user
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - User Categories */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-xl shadow-md p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Kategori User</h2>
              <div className="space-y-2">
                {userCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${
                      selectedCategory === category.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{category.name}</p>
                        {category.description && (
                          <p className="text-xs text-gray-400 mt-1">{category.description}</p>
                        )}
                      </div>
                      <span className="text-xs bg-gray-900 px-2 py-1 rounded-full">
                        {getAssignedCount(category.id)} halaman
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {userCategories.length === 0 && (
                <p className="text-gray-400 text-center py-8 text-sm">
                  Belum ada kategori user.<br />
                  Buat kategori di Master Kategori User.
                </p>
              )}
            </div>
          </div>

          {/* Right Panel - Pages */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl shadow-md">
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Halaman untuk: {selectedCategoryData?.name || '-'}
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {currentPermissions.size} dari {AVAILABLE_PAGES.length} halaman dipilih
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      disabled={saving || !selectedCategory}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition"
                    >
                      Pilih Semua
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      disabled={saving || !selectedCategory || currentPermissions.size === 0}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition"
                    >
                      Hapus Semua
                    </button>
                  </div>
                </div>
              </div>

              {/* Pages List */}
              <div className="p-4">
                {!selectedCategory ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-lg">Pilih kategori user terlebih dahulu</p>
                  </div>
                ) : AVAILABLE_PAGES.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-lg">Belum ada halaman</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {AVAILABLE_PAGES.map((page) => {
                      const hasAccess = currentPermissions.has(page.route);
                      return (
                        <div
                          key={page.route}
                          className={`flex items-center justify-between p-4 rounded-lg border-2 transition ${
                            hasAccess
                              ? 'bg-cyan-900/20 border-cyan-600'
                              : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-white">{page.label}</p>
                            <p className="text-sm text-gray-400 mt-1">{page.description || page.route}</p>
                          </div>
                          <button
                            onClick={() => handleTogglePage(page.route)}
                            disabled={saving}
                            className={`ml-4 px-4 py-2 rounded-lg font-medium transition ${
                              hasAccess
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {hasAccess ? '✕ Hapus' : '✓ Assign'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="flex">
            <svg className="w-6 h-6 text-blue-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-100">
              <p className="font-semibold mb-1">Catatan:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-200">
                <li>Administrator selalu memiliki akses penuh ke semua halaman</li>
                <li>Klik "Assign" untuk memberikan akses kategori ke halaman yang dipilih</li>
                <li>Jika tidak di-assign, user dengan kategori tersebut tidak bisa mengakses halaman</li>
                <li>Akses di-enforce di database level melalui RLS policies</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PagePermissionAssignment;
