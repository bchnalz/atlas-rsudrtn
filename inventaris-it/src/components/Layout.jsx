import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerTitle,
} from './ui/drawer';
import { Cog } from '../components/animate-ui/icons/cog';

const Layout = ({ children, hideTopBar = false }) => {
  const { profile, signOut, accessiblePages, pagesLoaded, refreshAccessiblePages } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [isMasterOpen, setIsMasterOpen] = useState(false);
  const [isLogPenugasanOpen, setIsLogPenugasanOpen] = useState(false);
  
  const [userCategory, setUserCategory] = useState(null);

  // Page titles mapping
  const pageTitles = useMemo(() => ({
    '/': 'Dashboard',
    '/dashboard-executive': 'Executive Dashboard',
    '/stok-opnam': 'Perangkat',
    '/import-data': 'Import Data',
    '/master-jenis-perangkat': 'Jenis Perangkat',
    '/master-jenis-barang': 'Jenis Barang',
    '/master-lokasi': 'Lokasi',
    '/master-kategori-user': 'Kategori User',
    '/master-skp': 'Master SKP',
    '/user-category-assignment': 'Assign Kategori User',
    '/skp-category-assignment': 'Assign SKP ke Kategori',
    '/page-permission-assignment': 'Assign Page Access',
    '/log-penugasan/penugasan': 'Penugasan',
    '/log-penugasan/daftar-tugas': 'Daftar Tugas',
  }), []);

  const currentPageTitle = pageTitles[location.pathname] || 'Page';

  useEffect(() => {
    // Only run if profile is loaded and has an ID
    if (profile?.id) {
      console.log('[Layout] Profile loaded, fetching data:', { 
        id: profile.id, 
        role: profile.role, 
        user_category_id: profile.user_category_id 
      });
      
      fetchUserCategory();
      
      // Listen for page permission changes (if admin changes permissions)
      // Note: This requires Supabase Realtime to be enabled for user_category_page_permissions table
      const permissionSubscription = supabase
        .channel(`page_permissions_${profile.user_category_id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_category_page_permissions',
          filter: `user_category_id=eq.${profile.user_category_id}`
        }, (payload) => {
          console.log('[Layout] 🔄 Page permissions changed, refreshing menu...', payload);
          // Refresh accessible pages when permissions change
          if (refreshAccessiblePages) {
            refreshAccessiblePages();
          }
        })
        .subscribe();
      
      // Note: Removed automatic visibility refresh to avoid performance issues
      // Users should refresh page manually or logout/login when permissions change
      
      return () => {
        permissionSubscription.unsubscribe();
      };
    } else {
      // Reset when profile is not available
      setUserCategory(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, profile?.user_category_id, refreshAccessiblePages]);

  const fetchUserCategory = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_category:user_categories!user_category_id(name)')
        .eq('id', profile.id)
        .single();
      
      if (error) throw error;
      setUserCategory(data?.user_category?.name);
    } catch (error) {
      console.error('Error fetching user category:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const openLogoutDialog = () => {
    setShowLogoutDialog(true);
    requestAnimationFrame(() => setLogoutDialogVisible(true));
  };

  const closeLogoutDialog = () => {
    setLogoutDialogVisible(false);
    setTimeout(() => setShowLogoutDialog(false), 200);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const getRoleLabel = (role) => {
    const roleLabels = {
      administrator: 'Administrator',
      it_support: 'IT Support',
      helpdesk: 'Helpdesk',
      user: 'User',
    };
    return roleLabels[role] || role;
  };

  // Menu items
  const menuItems = [
    { 
      path: '/', 
      label: 'Dashboard', 
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      roles: ['administrator', 'it_support', 'helpdesk', 'user'] 
    },
    { 
      path: '/stok-opnam', 
      label: 'Perangkat', 
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      roles: ['administrator', 'it_support'] 
    },
  ];

  const masterMenuItems = [
    { path: '/master-jenis-perangkat', label: 'Jenis Perangkat', roles: ['administrator', 'it_support', 'helpdesk', 'user'] },
    { path: '/master-jenis-barang', label: 'Jenis Barang', roles: ['administrator', 'it_support', 'helpdesk', 'user'] },
    { path: '/master-lokasi', label: 'Lokasi', roles: ['administrator', 'it_support', 'helpdesk', 'user'] },
    { path: '/master-kategori-user', label: 'Kategori User', roles: ['administrator'] },
    { path: '/master-skp', label: 'Master SKP', roles: ['administrator'] },
    { path: '/user-category-assignment', label: 'Assign Kategori User', roles: ['administrator'] },
    { path: '/skp-category-assignment', label: 'Assign SKP ke Kategori', roles: ['administrator'] },
    { path: '/page-permission-assignment', label: 'Assign Page Access', roles: ['administrator'] },
  ];

  const logPenugasanItems = [
    { path: '/log-penugasan/penugasan', label: 'Penugasan', showFor: 'Helpdesk', roles: ['administrator', 'it_support', 'helpdesk', 'user'] },
    { path: '/log-penugasan/daftar-tugas', label: 'Daftar Tugas', showFor: 'IT Support', roles: ['administrator', 'it_support', 'helpdesk', 'user'] },
  ];

  // Check if user has access to a page
  const hasPageAccess = (pagePath) => {
    // Administrator has access to all
    if (profile?.role === 'administrator') return true;
    
    // Standard users: Check category-based permissions
    if (profile?.role === 'standard') {
      const hasAccess = accessiblePages.has('*') || accessiblePages.has(pagePath);
      if (!hasAccess) {
        console.log(`[Layout] No access to page "${pagePath}". Accessible pages:`, Array.from(accessiblePages));
      }
      return hasAccess;
    }
    
    // Legacy role check (for backward compatibility with non-standard roles)
    return false;
  };

  // Filter menu items based on role or page permissions
  // For standard users, wait for pages to load to avoid showing wrong items
  const allowedMenuItems = menuItems.filter((item) => {
    // Administrator sees all
    if (profile?.role === 'administrator') return true;
    
    // Standard users: Check category-based page permissions
    if (profile?.role === 'standard') {
      // Don't show menu items until pages are loaded (prevents glitch)
      if (!pagesLoaded) {
        return false; // Show nothing while loading
      }
      const hasAccess = hasPageAccess(item.path);
      return hasAccess;
    }
    
    // Legacy role check (for backward compatibility)
    if (item.roles && item.roles.length > 0) {
      const hasRoleAccess = item.roles.includes(profile?.role);
      // Allow IT Support and Koordinator IT Support categories for Perangkat (stok-opnam)
      if (!hasRoleAccess && item.path === '/stok-opnam') {
        return userCategory === 'IT Support' || userCategory === 'Koordinator IT Support';
      }
      return hasRoleAccess;
    }
    return false;
  });

  const allowedMasterItems = masterMenuItems.filter((item) => {
    // Administrator sees all
    if (profile?.role === 'administrator') return true;
    
    // Standard users: Check category-based page permissions (only after pages are loaded)
    if (profile?.role === 'standard') {
      if (!pagesLoaded) return false; // Don't show until loaded
      return hasPageAccess(item.path);
    }
    
    // Legacy role check
    if (item.roles && item.roles.length > 0) {
      return item.roles.includes(profile?.role);
    }
    return false;
  });

  const allowedLogPenugasanItems = logPenugasanItems.filter((item) => {
    // Administrator sees all
    if (profile?.role === 'administrator') return true;
    
    // Standard users: Check category-based page permissions (only after pages are loaded)
    if (profile?.role === 'standard') {
      if (!pagesLoaded) return false; // Don't show until loaded
      const hasAccess = hasPageAccess(item.path);
      if (!hasAccess) {
        console.log(`[Layout] Filtering out "${item.label}" (${item.path}) - no page permission`);
      }
      return hasAccess;
    }
    
    // Legacy role check (for backward compatibility with old roles)
    if (item.roles && item.roles.length > 0 && !item.roles.includes(profile?.role)) {
      return false;
    }
    // Show based on user category for others (legacy - only for non-standard roles)
    if (item.showFor && userCategory !== item.showFor) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Top Bar - Desktop only */}
      {!hideTopBar && (
        <header className={`fixed top-0 left-0 right-0 h-12 bg-black z-40 hidden lg:flex items-center px-3 transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:left-0' : 'lg:left-64'
        }`}>
          {/* Open sidebar button - Desktop only when collapsed */}
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="hidden lg:flex p-1.5 rounded hover:bg-gray-800 transition mr-3"
              title="Open sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* User Info + Page Title */}
          <div className="flex-1 flex items-center justify-center text-sm">
            <span className="text-gray-400">{profile?.full_name}</span>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-200 font-medium">{currentPageTitle}</span>
          </div>

        </header>
      )}

      {/* Sidebar - Desktop only */}
      <aside
        className={`hidden lg:flex fixed top-0 left-0 bottom-0 w-64 bg-black border-r border-neutral-800 z-30 transform transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
        } overflow-y-auto flex-col`}
        style={{ fontFamily: "'Open Sans', sans-serif" }}
      >
        {/* Close button - Desktop only */}
        <div className="hidden lg:flex justify-end p-2">
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-1.5 rounded hover:bg-gray-800 transition text-gray-400"
            title="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 pt-2 lg:pt-0">
          {profile?.role === 'standard' && !pagesLoaded && (
            <div className="text-center py-6 text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500 mx-auto mb-2"></div>
              <p>Memuat menu...</p>
            </div>
          )}
          {allowedMenuItems.length === 0 && profile?.role === 'standard' && pagesLoaded && (
            <div className="text-center py-6 text-gray-500 text-sm">
              <p>Tidak ada halaman yang dapat diakses</p>
            </div>
          )}
          {allowedMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-r-lg transition border-l-2 ${
                isActive(item.path)
                  ? 'border-l-cyan-500 text-white'
                  : 'border-l-transparent text-gray-400 hover:bg-gray-900'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}

          {/* Log Penugasan Menu (Collapsible) */}
          {allowedLogPenugasanItems.length > 0 && (
            <div>
              <button
                onClick={() => setIsLogPenugasanOpen(!isLogPenugasanOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-900 transition"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm">Log Penugasan</span>
                </div>
                <svg
                  className={`w-3 h-3 transition-transform ${isLogPenugasanOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Log Penugasan Submenu */}
              {isLogPenugasanOpen && (
                <div className="ml-6 mt-1 space-y-1">
                  {allowedLogPenugasanItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`block px-3 py-1.5 rounded-r-lg text-sm transition border-l-2 ${
                        isActive(item.path)
                          ? 'border-l-cyan-500 text-white'
                          : 'border-l-transparent text-gray-500 hover:bg-gray-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Master Menu (Collapsible) */}
          {allowedMasterItems.length > 0 && (
            <div>
              <button
                onClick={() => setIsMasterOpen(!isMasterOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-900 transition"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm">Master</span>
                </div>
                <svg
                  className={`w-3 h-3 transition-transform ${isMasterOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Master Submenu */}
              {isMasterOpen && (
                <div className="ml-6 mt-1 space-y-1">
                  {allowedMasterItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`block px-3 py-1.5 rounded-r-lg text-sm transition border-l-2 ${
                        isActive(item.path)
                          ? 'border-l-cyan-500 text-white'
                          : 'border-l-transparent text-gray-500 hover:bg-gray-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={openLogoutDialog}
            className="mt-4 w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-gray-900 rounded-lg text-sm transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      {/* Mobile Bottom Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-black border-t border-neutral-800 max-h-[85vh]">
          <DrawerTitle className="sr-only">Menu Navigasi</DrawerTitle>
          <nav
            className="p-4 space-y-1 overflow-y-auto"
            style={{ fontFamily: "'Open Sans', sans-serif" }}
          >
            {profile?.role === 'standard' && !pagesLoaded && (
              <div className="text-center py-6 text-gray-500 text-sm">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500 mx-auto mb-2"></div>
                <p>Memuat menu...</p>
              </div>
            )}
            {allowedMenuItems.length === 0 && profile?.role === 'standard' && pagesLoaded && (
              <div className="text-center py-6 text-gray-500 text-sm">
                <p>Tidak ada halaman yang dapat diakses</p>
              </div>
            )}
            {allowedMenuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg transition ${
                  isActive(item.path)
                    ? 'bg-zinc-800 text-white'
                    : 'text-gray-400 hover:bg-gray-900'
                }`}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}

            {/* Log Penugasan */}
            {allowedLogPenugasanItems.length > 0 && (
              <div>
                <button
                  onClick={() => setIsLogPenugasanOpen(!isLogPenugasanOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-900 transition"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm">Log Penugasan</span>
                  </div>
                  <svg className={`w-3 h-3 transition-transform ${isLogPenugasanOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isLogPenugasanOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    {allowedLogPenugasanItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setDrawerOpen(false)}
                        className={`block px-3 py-2 rounded-lg text-sm transition ${
                          isActive(item.path)
                            ? 'bg-zinc-800 text-white'
                            : 'text-gray-500 hover:bg-gray-900'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Master */}
            {allowedMasterItems.length > 0 && (
              <div>
                <button
                  onClick={() => setIsMasterOpen(!isMasterOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-900 transition"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm">Master</span>
                  </div>
                  <svg className={`w-3 h-3 transition-transform ${isMasterOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isMasterOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    {allowedMasterItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setDrawerOpen(false)}
                        className={`block px-3 py-2 rounded-lg text-sm transition ${
                          isActive(item.path)
                            ? 'bg-zinc-800 text-white'
                            : 'text-gray-500 hover:bg-gray-900'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={() => { setDrawerOpen(false); openLogoutDialog(); }}
              className="mt-4 w-full flex items-center space-x-2 px-3 py-2.5 text-red-400 hover:bg-gray-900 rounded-lg text-sm transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </nav>
        </DrawerContent>
      </Drawer>

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-black border-t border-neutral-800 shadow-[0_-8px_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-stretch h-14">
          {allowedMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
                isActive(item.path) ? 'text-white' : 'text-zinc-500'
              }`}
            >
              {item.icon}
              <span className="text-[10px] leading-none">{item.label}</span>
            </Link>
          ))}
          {allowedLogPenugasanItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
                isActive(item.path) ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {item.path === '/log-penugasan/penugasan'
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                }
              </svg>
              <span className="text-[10px] leading-none">{item.label}</span>
            </Link>
          ))}
          {(allowedMasterItems.length > 0 || profile?.role === 'administrator') ? (
            <button
              onClick={() => setDrawerOpen(true)}
              className={`flex flex-col items-center justify-center flex-1 gap-1 transition-colors ${
                drawerOpen || allowedMasterItems.some(i => isActive(i.path)) || isActive('/user-management')
                  ? 'text-white'
                  : 'text-zinc-500'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              <span className="text-[10px] leading-none">Lainnya</span>
            </button>
          ) : (
            <button
              onClick={openLogoutDialog}
              className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors text-zinc-500"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-[10px] leading-none">Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
              logoutDialogVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeLogoutDialog}
          />
          <div className={`relative bg-neutral-900 border border-neutral-800 rounded-xl p-6 mx-4 w-full max-w-sm shadow-2xl transition-all duration-200 ${
            logoutDialogVisible
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-95 translate-y-4'
          }`}>
            <h3 className="text-base font-semibold text-white mb-2">Konfirmasi Logout</h3>
            <p className="text-sm text-zinc-400 mb-6">Apakah Anda yakin ingin keluar dari akun ini?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeLogoutDialog}
                className="px-4 py-2 text-sm rounded-lg bg-neutral-800 text-zinc-300 hover:bg-neutral-700 transition"
              >
                Batal
              </button>
              <button
                onClick={() => { closeLogoutDialog(); handleSignOut(); }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`pt-0 ${hideTopBar ? 'lg:pt-0' : 'lg:pt-12'} pb-16 lg:pb-0 min-h-screen transition-all duration-300 ${
        isSidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'
      }`}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
