import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
} from '../components/ui/drawer';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '../components/ui/carousel';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useCountUp, formatNumber } from '../hooks/useCountUp';
import { 
  ArrowRightIcon,
  ComputerDesktopIcon,
  MapPinIcon,
  CubeIcon,
} from '@heroicons/react/24/solid';
import { AnimatedSendHorizontal } from '../components/ui/animated-icons';
import { Loader2 } from 'lucide-react';

// Stat display with count-up animation (no card)
const StatCard = ({ value, label, icon: Icon, delay = 0 }) => {
  const { count, ref } = useCountUp(value, 2000 + delay);
  
  return (
    <div ref={ref} className="flex flex-col items-center p-6">
      {Icon && <Icon className="h-8 w-8 text-zinc-500 mb-3" />}
      <span className="text-4xl font-bold text-zinc-100 tabular-nums">
        {formatNumber(count)}
      </span>
      <span className="text-sm text-zinc-500 mt-1">{label}</span>
    </div>
  );
};

// Small stat card for kategori items
const KategoriCard = ({ name, count: targetCount, index }) => {
  const { count, ref } = useCountUp(targetCount, 1500 + index * 100);
  
  return (
    <div 
      ref={ref}
      className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated border border-border hover:border-zinc-500/30 transition-all"
    >
      <span className="text-sm text-foreground">{name}</span>
      <span className="text-lg font-semibold text-zinc-300 tabular-nums">
        {formatNumber(count)}
      </span>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Public stats state
  const [stats, setStats] = useState({
    totalPerangkat: 0,
    totalLokasi: 0,
    jenisPerangkat: [],
    jenisBarang: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Carousel state
  const [api, setApi] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const tabs = ['overview', 'kategori', 'about'];

  // Fetch public stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch basic counts first
        const [perangkatRes, lokasiRes] = await Promise.all([
          supabase.from('perangkat').select('id', { count: 'exact', head: true }),
          supabase.from('ms_lokasi').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);

        // Fetch master data
        const [jenisPerangkatRes, jenisBarangRes] = await Promise.all([
          supabase.from('ms_jenis_perangkat').select('kode, nama').eq('is_active', true).order('nama'),
          supabase.from('ms_jenis_barang').select('id, kode, nama').eq('is_active', true).order('nama'),
        ]);

        // Fetch all perangkat to count by category (more reliable than individual queries)
        const { data: allPerangkat } = await supabase
          .from('perangkat')
          .select('jenis_perangkat_kode, jenis_barang_id');

        // Count per jenis perangkat
        const jenisPerangkatCounts = {};
        const jenisBarangCounts = {};
        
        (allPerangkat || []).forEach((p) => {
          if (p.jenis_perangkat_kode) {
            jenisPerangkatCounts[p.jenis_perangkat_kode] = (jenisPerangkatCounts[p.jenis_perangkat_kode] || 0) + 1;
          }
          if (p.jenis_barang_id) {
            jenisBarangCounts[p.jenis_barang_id] = (jenisBarangCounts[p.jenis_barang_id] || 0) + 1;
          }
        });

        // Merge counts with master data
        const jenisPerangkatWithCounts = (jenisPerangkatRes.data || []).map((jp) => ({
          ...jp,
          count: jenisPerangkatCounts[jp.kode] || 0,
        }));

        const jenisBarangWithCounts = (jenisBarangRes.data || []).map((jb) => ({
          ...jb,
          count: jenisBarangCounts[jb.id] || 0,
        }));

        setStats({
          totalPerangkat: perangkatRes.count || 0,
          totalLokasi: lokasiRes.count || 0,
          jenisPerangkat: jenisPerangkatWithCounts.filter(jp => jp.count > 0),
          jenisBarang: jenisBarangWithCounts.filter(jb => jb.count > 0),
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Sync carousel with tabs and auto-slide
  useEffect(() => {
    if (!api) return;

    api.on('select', () => {
      setCurrentSlide(api.selectedScrollSnap());
    });

    // Auto-slide every 10 seconds
    const autoSlide = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0); // Loop back to first slide
      }
    }, 10000);

    return () => clearInterval(autoSlide);
  }, [api]);

  const handleTabChange = useCallback((value) => {
    const index = tabs.indexOf(value);
    if (index !== -1 && api) {
      api.scrollTo(index);
    }
  }, [api, tabs]);

  // Redirect if already logged in
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      
      setEmail('');
      setPassword('');
      setDrawerOpen(false);
      setLoading(false);
    } catch (error) {
      console.error('[Login] Login error:', error);
      setError(error.message || 'Login gagal. Periksa email dan password Anda.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header - Desktop only */}
      <header className="hidden sm:block sticky top-0 z-50 w-full border-b border-zinc-900 bg-black">
        <div className="container mx-auto px-4 h-14 flex items-center justify-center">
          {/* Tabs Navigation */}
          <Tabs value={tabs[currentSlide]} onValueChange={handleTabChange}>
            <TabsList className="bg-transparent border-0">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="kategori"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
              >
                Kategori
              </TabsTrigger>
              <TabsTrigger 
                value="about"
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500"
              >
                About
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="sm:hidden sticky top-0 z-50 border-b border-zinc-900 bg-black px-4 py-3">
        <Tabs value={tabs[currentSlide]} onValueChange={handleTabChange}>
          <TabsList className="w-full bg-transparent border-0 h-auto p-0 gap-1">
            <TabsTrigger value="overview" className="flex-1 text-xs py-2 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500">Overview</TabsTrigger>
            <TabsTrigger value="kategori" className="flex-1 text-xs py-2 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500">Kategori</TabsTrigger>
            <TabsTrigger value="about" className="flex-1 text-xs py-2 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500">About</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content - Carousel */}
      <main className="flex-1 flex flex-col">
        <Carousel 
          setApi={setApi} 
          opts={{ loop: false, align: 'start' }}
          className="flex-1"
        >
          <CarouselContent className="h-full">
            {/* Slide 1: Overview */}
            <CarouselItem className="h-full">
              <div className="h-full flex flex-col items-center justify-center px-4 py-12">
                <div className="text-center mb-12">
                  <img
                    src="/atlas-logo.png"
                    alt="ATLAS"
                    className="mx-auto mb-6"
                    style={{ height: 40 }}
                  />
                  <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                    Asset Tracking, Logging & Assignment System
                  </h1>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Track and manage all IT devices across your organization with comprehensive inventory monitoring.
                  </p>
                </div>

                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto">
                    <StatCard 
                      value={stats.totalPerangkat} 
                      label="Total Devices" 
                      icon={ComputerDesktopIcon}
                    />
                    <StatCard 
                      value={stats.totalLokasi} 
                      label="Locations" 
                      icon={MapPinIcon}
                      delay={200}
                    />
                    <StatCard 
                      value={stats.jenisPerangkat.length} 
                      label="Device Types" 
                      icon={CubeIcon}
                      delay={400}
                    />
                  </div>
                )}

                {/* Quick stats row */}
                {!statsLoading && stats.jenisPerangkat.length > 0 && (
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    {stats.jenisPerangkat.slice(0, 5).map((jp, idx) => (
                      <div 
                        key={jp.kode}
                        className="px-4 py-2 rounded-full bg-surface border border-border text-sm"
                      >
                        <span className="text-muted-foreground">{jp.nama}:</span>
                        <span className="ml-2 font-semibold text-foreground">{jp.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CarouselItem>

            {/* Slide 2: Kategori */}
            <CarouselItem className="h-full">
              <div className="h-full flex flex-col items-center px-4 py-12 overflow-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    Device Categories
                  </h2>
                  <p className="text-muted-foreground">
                    Breakdown by device type and item category
                  </p>
                </div>

                {statsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
                  </div>
                ) : (
                  <div className="w-full max-w-4xl">
                    {/* Jenis Perangkat Section */}
                    {stats.jenisPerangkat.length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                          Per Jenis Perangkat
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {stats.jenisPerangkat.map((jp, idx) => (
                            <KategoriCard key={jp.kode} name={jp.nama} count={jp.count} index={idx} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Jenis Barang Section */}
                    {stats.jenisBarang.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                          Per Jenis Barang
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {stats.jenisBarang.map((jb, idx) => (
                            <KategoriCard key={jb.kode} name={jb.nama} count={jb.count} index={idx} />
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.jenisPerangkat.length === 0 && stats.jenisBarang.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        No category data available
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CarouselItem>

            {/* Slide 3: About */}
            <CarouselItem className="h-full">
              <div className="h-full flex flex-col items-center justify-center px-4 py-12">
                <Card className="max-w-2xl w-full p-8 bg-surface border-border">
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    About IT Inventory System
                  </h2>
                  <div className="space-y-4 text-muted-foreground">
                    <p>
                      This system provides comprehensive IT asset management and monitoring capabilities for your organization.
                    </p>
                    <p>
                      Fully developed by IT Support RSUD RTN SDA
                    </p>
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm">
                        Contact IT Support for access or assistance.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </CarouselItem>
          </CarouselContent>
        </Carousel>

        {/* Carousel Dots */}
        <div className="flex justify-center gap-2 pb-8">
          {tabs.map((_, index) => (
            <button
              key={index}
              onClick={() => api?.scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentSlide === index 
                  ? 'bg-zinc-400' 
                  : 'bg-zinc-700 hover:bg-zinc-600'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </main>

      {/* Bottom Bar with Sign In */}
      <div 
        className="sticky bottom-0 z-50 w-full border-t border-zinc-900 bg-black py-4 px-4"
        style={{ boxShadow: '0 -20px 40px 10px rgba(0, 0, 0, 0.8)' }}
      >
        <div className="container mx-auto flex items-center justify-center">
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 px-8">
                Sign In
              </Button>
            </DrawerTrigger>
            
            <DrawerContent 
              className="border-0 h-[50vh] rounded-none"
              style={{ 
                backgroundImage: 'url(/drawer-bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: 'rgb(9 9 11)',
              }}
            >
              <div className="mx-auto w-full max-w-sm px-6 py-8 pb-12 relative z-10">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-zinc-100">Welcome back</h2>
                  <p className="text-sm text-zinc-500 mt-1">Enter your credentials to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full bg-zinc-900 border-zinc-800 focus:border-zinc-600 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 placeholder:text-zinc-600"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="flex-1 bg-zinc-900 border-zinc-800 focus:border-zinc-600 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 placeholder:text-zinc-600"
                      />
                      <Button
                        type="submit"
                        disabled={loading}
                        size="icon"
                        className="flex-shrink-0 h-10 w-10 rounded-md bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <AnimatedSendHorizontal size={20} loop />
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  );
};

export default Login;
