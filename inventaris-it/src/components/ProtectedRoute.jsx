import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, profile, loading, accessiblePages, pagesLoaded, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userCategory, setUserCategory] = useState(null);

  useEffect(() => {
    // Fetch user category to check for Koordinator IT Support
    const fetchUserCategory = async () => {
      if (!profile?.id) {
        setUserCategory(null);
        return;
      }
      
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
        setUserCategory(null);
      }
    };

    if (profile?.id) {
      fetchUserCategory();
    }
  }, [profile?.id]);

  useEffect(() => {
    // Reset access state when dependencies change to prevent stale state
    setHasAccess(null);
    setCheckingAccess(true);
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, loading, location.pathname, accessiblePages, pagesLoaded, userCategory]);

  const checkAccess = async () => {
    // Always start with checking state
    setCheckingAccess(true);

    if (loading) {
      return;
    }

    if (!user) {
      setHasAccess(false);
      setCheckingAccess(false);
      return;
    }

    // Wait for profile to load before checking permissions
    if (!profile) {
      // Profile still loading, keep checking state
      return;
    }

    // Administrator always has access
    if (profile.role === 'administrator') {
      setHasAccess(true);
      setCheckingAccess(false);
      return;
    }

    // Standard users: Check category-based page permissions (skip legacy role check)
    if (profile.role === 'standard') {
      if (!profile.user_category_id) {
        // User without category: Show welcome greeting
        console.log('[ProtectedRoute] Standard user without category - showing greeting');
        setHasAccess('greeting');
        setCheckingAccess(false);
        return;
      }

      // Wait for pages to load before checking
      if (!pagesLoaded) {
        // Still loading accessible pages, keep checking state
        return;
      }

      // Use cached accessible pages instead of making a database query
      const normalizedRoute = location.pathname === '/' ? '/' : location.pathname;
      const hasPageAccess = accessiblePages.has('*') || accessiblePages.has(normalizedRoute);
      
      console.log(`[ProtectedRoute] Using cached permissions: route=${normalizedRoute}, hasAccess=${hasPageAccess}`);
      setHasAccess(hasPageAccess);
      setCheckingAccess(false);
      return;
    }

    // Legacy role-based check (for backward compatibility - only for non-standard roles)
    // This handles any old roles that haven't been migrated yet
    // Also check for IT Support and Koordinator IT Support categories
    const isITSupportCategory = userCategory === 'IT Support';
    const isKoordinatorITSupport = userCategory === 'Koordinator IT Support';
    const hasRoleAccess = allowedRoles.length === 0 || allowedRoles.includes(profile.role);
    
    // For routes that allow it_support role, also allow IT Support category
    const allowsITSupport = allowedRoles.includes('it_support');
    const hasCategoryAccess = allowsITSupport && (isITSupportCategory || isKoordinatorITSupport);
    
    if (allowedRoles.length > 0 && !hasRoleAccess && !hasCategoryAccess) {
      console.log(`[ProtectedRoute] Legacy role check failed: role=${profile.role}, category=${userCategory}, allowedRoles=${allowedRoles.join(',')}`);
      setHasAccess(false);
      setCheckingAccess(false);
      return;
    }

    // Default: No access (only if profile exists and role doesn't match any case)
    console.log(`[ProtectedRoute] No access rule matched for role=${profile.role}`);
    setHasAccess(false);
    setCheckingAccess(false);
  };

  if (loading || checkingAccess || (profile?.role === 'standard' && !pagesLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <svg
          className="h-6 w-6 animate-spin text-zinc-500"
          xmlns="http://www.w3.org/2000/svg"
          width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show welcome greeting for users without category
  if (hasAccess === 'greeting') {
    const handleLogout = async () => {
      await signOut();
      navigate('/login', { replace: true });
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-lg max-w-md w-full text-center">
          <div className="text-blue-500 text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">
            Selamat Datang!
          </h2>
          <p className="text-zinc-400 mb-6">
            Akun Anda belum memiliki kategori pengguna. Silakan hubungi administrator untuk mendapatkan akses.
          </p>
          <div className="flex gap-3 justify-center">
            {location.pathname !== '/' && (
              <button
                onClick={() => navigate('/', { replace: true })}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
              >
                Ke Dashboard
              </button>
            )}
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only show access denied if explicitly false (not null/undefined)
  if (hasAccess === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-lg max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">
            Akses Ditolak
          </h2>
          <p className="text-zinc-400 mb-6">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/', { replace: true })}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Ke Dashboard
            </button>
            <button
              onClick={async () => {
                await signOut();
                navigate('/login', { replace: true });
              }}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
