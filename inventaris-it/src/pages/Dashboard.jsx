import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { AnimatedChartLine } from '../components/ui/animated-icons';
import { useCountUp } from '../hooks/useCountUp';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '../components/ui/carousel';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const [skpProgress, setSkpProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentYear] = useState(new Date().getFullYear());
  const [animated, setAnimated] = useState(false);
  const [deviceStats, setDeviceStats] = useState({ total: 0, layak: 0, rusak: 0 });
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [showKategoriDialog, setShowKategoriDialog] = useState(false);
  const [isKategoriClosing, setIsKategoriClosing] = useState(false);
  const [kategoriData, setKategoriData] = useState([]);
  const [loadingKategori, setLoadingKategori] = useState(false);
  const [carouselApi, setCarouselApi] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const tabs = ['skp', 'perangkat'];

  useEffect(() => {
    if (user?.id) {
      fetchSKPProgress();
      fetchDeviceStats();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!showKategoriDialog || isKategoriClosing) return;
    const handleEsc = (e) => { if (e.key === 'Escape') handleCloseKategori(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showKategoriDialog, isKategoriClosing]);

  // Sync carousel with tabs + auto-slide every 60 seconds
  useEffect(() => {
    if (!carouselApi) return;

    carouselApi.on('select', () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });

    const interval = setInterval(() => {
      if (carouselApi.canScrollNext()) {
        carouselApi.scrollNext();
      } else {
        carouselApi.scrollTo(0);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [carouselApi]);

  const handleTabChange = useCallback((value) => {
    const index = tabs.indexOf(value);
    if (index !== -1 && carouselApi) {
      carouselApi.scrollTo(index);
    }
  }, [carouselApi, tabs]);

  const fetchDeviceStats = async () => {
    try {
      setLoadingDevices(true);
      const [
        { count: total },
        { count: layak },
        { count: rusak },
      ] = await Promise.all([
        supabase.from('perangkat').select('*', { count: 'exact', head: true }),
        supabase.from('perangkat').select('*', { count: 'exact', head: true }).eq('status_perangkat', 'layak'),
        supabase.from('perangkat').select('*', { count: 'exact', head: true }).neq('status_perangkat', 'layak'),
      ]);
      setDeviceStats({ total: total || 0, layak: layak || 0, rusak: rusak || 0 });
    } catch (error) {
      console.error('Error fetching device stats:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleCloseKategori = () => {
    setIsKategoriClosing(true);
    setTimeout(() => {
      setShowKategoriDialog(false);
      setIsKategoriClosing(false);
    }, 150);
  };

  const fetchKategoriPerangkat = async () => {
    try {
      setLoadingKategori(true);
      setIsKategoriClosing(false);
      setShowKategoriDialog(true);

      const { data, error } = await supabase
        .from('perangkat')
        .select('jenis_perangkat_kode, jenis_perangkat:ms_jenis_perangkat!perangkat_jenis_perangkat_kode_fkey(kode, nama)');

      if (error) throw error;

      const counts = data.reduce((acc, item) => {
        const kode = item.jenis_perangkat_kode;
        const nama = item.jenis_perangkat?.nama || 'Unknown';
        if (!acc[kode]) acc[kode] = { kode, nama, count: 0 };
        acc[kode].count++;
        return acc;
      }, {});

      setKategoriData(Object.values(counts).sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Error fetching kategori perangkat:', error);
    } finally {
      setLoadingKategori(false);
    }
  };

  const fetchSKPProgress = async () => {
    try {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_category_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profileData?.user_category_id) { setSkpProgress([]); return; }

      const { data: assignedSkps, error: assignedError } = await supabase
        .from('user_category_skp')
        .select('skp_category_id, skp_categories!inner(id, name, description, code)')
        .eq('user_category_id', profileData.user_category_id);

      if (assignedError) throw assignedError;
      if (!assignedSkps?.length) { setSkpProgress([]); return; }

      const skpIds = assignedSkps.map(i => i.skp_category_id);

      const [
        { data: targets },
        { count: inventarisasiCount },
        { data: completedTasks },
        { data: directTasks },
      ] = await Promise.all([
        supabase.from('skp_targets').select('*').eq('year', currentYear).in('skp_category_id', skpIds),
        supabase.from('perangkat').select('*', { count: 'exact', head: true }).eq('petugas_id', user.id).not('petugas_id', 'is', null),
        supabase.from('task_assignment_users').select('task_assignment_id, completed_at, status, task_assignments(skp_category_id)').eq('user_id', user.id).not('completed_at', 'is', null),
        supabase.from('task_assignments').select('skp_category_id, completed_at').eq('assigned_to', user.id).eq('status', 'completed').not('completed_at', 'is', null),
      ]);

      const taskCountsBySkp = {};
      completedTasks?.forEach(task => {
        const taskData = Array.isArray(task.task_assignments) ? task.task_assignments[0] : task.task_assignments;
        const skpId = taskData?.skp_category_id;
        if (skpId && task.completed_at && new Date(task.completed_at).getFullYear() === currentYear) {
          taskCountsBySkp[skpId] = (taskCountsBySkp[skpId] || 0) + 1;
        }
      });
      directTasks?.forEach(task => {
        if (task.skp_category_id && task.completed_at && new Date(task.completed_at).getFullYear() === currentYear) {
          taskCountsBySkp[task.skp_category_id] = (taskCountsBySkp[task.skp_category_id] || 0) + 1;
        }
      });

      const progressData = assignedSkps.map(item => {
        const skp = item.skp_categories;
        const nameL = (skp.name || '').toLowerCase();
        const codeL = (skp.code || '').toLowerCase();
        const isInventarisasi = (nameL.includes('inventaris') && nameL.includes('perangkat')) ||
          (nameL.includes('inventarisasi') && nameL.includes('ti')) ||
          codeL.includes('inv') || codeL === 'skp-011';

        const target = targets?.find(t => t.skp_category_id === item.skp_category_id);
        const completedCount = isInventarisasi ? (inventarisasiCount || 0) : (taskCountsBySkp[item.skp_category_id] || 0);
        const targetCount = target?.target_count || 0;

        return {
          skp_category_id: item.skp_category_id,
          skp_name: skp.name,
          completed_count: completedCount,
          target_count: targetCount,
          percentage: targetCount ? Math.min(Math.round(completedCount * 100 / targetCount), 100) : 0,
        };
      });

      progressData.sort((a, b) => {
        const aInv = a.skp_name?.toLowerCase().includes('inventaris') ? 1 : 0;
        const bInv = b.skp_name?.toLowerCase().includes('inventaris') ? 1 : 0;
        return bInv - aInv;
      });

      setSkpProgress(progressData);
      requestAnimationFrame(() => setAnimated(true));
    } catch (error) {
      console.error('Error fetching SKP progress:', error);
      setSkpProgress([]);
    } finally {
      setLoading(false);
    }
  };

  const totalCompleted = skpProgress.reduce((s, i) => s + i.completed_count, 0);
  const doneCount = skpProgress.filter(s => s.percentage >= 100).length;

  const { count: animTotal } = useCountUp(deviceStats.total, 1200, false);
  const { count: animLayak } = useCountUp(deviceStats.layak, 1200, false);
  const { count: animRusak } = useCountUp(deviceStats.rusak, 1200, false);

  return (
    <Layout>
      <div className="-mt-2 space-y-6">
        <div className="text-center mb-2">
          <img
            src="/atlas-logo.png"
            alt="ATLAS"
            className="mx-auto mb-2"
            style={{ height: 28 }}
          />
          <h1 className="text-sm font-medium text-zinc-400 tracking-widest uppercase">Asset Tracking, Logging & Assignment System</h1>
        </div>
        <div className="max-w-lg mx-auto">
          <Carousel opts={{ loop: true }} setApi={setCarouselApi}>
            <CarouselContent>
              {/* Slide 1: Progress SKP */}
              <CarouselItem>
                <div className="rounded-sm border border-gray-900 bg-black p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AnimatedChartLine size={24} loop loopDelay={2000} className="text-zinc-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <h2 className="text-sm font-medium text-zinc-100 truncate">Progress SKP</h2>
                        <p className="text-xs text-zinc-500">{currentYear} &middot; {skpProgress.length} kategori</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-lg font-semibold text-zinc-100 leading-none">{totalCompleted}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{doneCount}/{skpProgress.length} selesai</p>
                    </div>
                  </div>

                  {loading ? (
                    <div className="space-y-3.5">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="h-4 rounded bg-zinc-800 animate-pulse" style={{ width: `${50 + i * 12}%` }} />
                            <div className="h-4 w-10 rounded bg-zinc-800 animate-pulse flex-shrink-0" />
                          </div>
                          <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full rounded-full bg-zinc-800 animate-pulse" style={{ width: `${30 + i * 15}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : skpProgress.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">Tidak ada SKP yang di-assign</p>
                  ) : (
                    <div className="space-y-2.5">
                      {skpProgress.map((skp) => (
                        <div key={skp.skp_category_id}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs text-zinc-300 truncate min-w-0">{skp.skp_name}</span>
                            <span className="text-[10px] text-zinc-500 flex-shrink-0 tabular-nums">
                              {skp.completed_count}/{skp.target_count}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: animated ? `${skp.percentage}%` : '0%',
                                backgroundColor: '#ffffff',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CarouselItem>

              {/* Slide 2: Device Stats */}
              <CarouselItem>
                <div className="flex flex-col h-full">
                  {loadingDevices ? (
                    <>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-center py-4">
                          <div className="h-9 w-16 rounded bg-zinc-800 animate-pulse mb-2" />
                          <div className="h-3.5 w-28 rounded bg-zinc-800 animate-pulse" />
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div
                        className="flex-1 flex flex-col items-center justify-center py-3 cursor-pointer hover:bg-zinc-900/50 transition-colors rounded-sm"
                        onClick={fetchKategoriPerangkat}
                      >
                        <span className="text-4xl font-bold text-zinc-300 tabular-nums">{animTotal}</span>
                        <span className="text-xs text-white">Total Perangkat</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center py-3">
                        <span className="text-4xl font-bold text-zinc-300 tabular-nums">{animLayak}</span>
                        <span className="text-xs text-white">Perangkat dengan status Layak</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center py-3">
                        <span className="text-4xl font-bold text-zinc-300 tabular-nums">{animRusak}</span>
                        <span className="text-xs text-white">Perangkat dengan status Rusak</span>
                      </div>
                    </>
                  )}
                </div>
              </CarouselItem>
            </CarouselContent>

            <div className="flex justify-center mt-3">
              <Tabs value={tabs[currentSlide]} onValueChange={handleTabChange}>
                <TabsList className="bg-transparent border border-zinc-800 rounded-sm h-auto p-0.5 gap-1">
                  <TabsTrigger
                    value="skp"
                    className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500"
                  >
                    Progress SKP
                  </TabsTrigger>
                  <TabsTrigger
                    value="perangkat"
                    className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500"
                  >
                    Perangkat
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Carousel>
        </div>
      </div>

      {/* Kategori Perangkat Dialog */}
      {showKategoriDialog && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 ${
            isKategoriClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
          }`}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseKategori(); }}
        >
          <div
            className={`w-full max-w-sm rounded-sm border border-gray-900 bg-black p-4 ${
              isKategoriClosing ? 'modal-content-exit' : 'modal-content-enter'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-zinc-100">Perangkat per Kategori</h3>
              <button
                onClick={handleCloseKategori}
                className="text-zinc-500 hover:text-zinc-300 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {loadingKategori ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="h-4 rounded bg-zinc-800 animate-pulse" style={{ width: `${40 + i * 15}%` }} />
                    <div className="h-4 w-8 rounded bg-zinc-800 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {kategoriData.map((item) => (
                  <div key={item.kode} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-zinc-300 truncate min-w-0 mr-2">{item.nama}</span>
                    <span className="text-sm font-semibold text-zinc-100 tabular-nums flex-shrink-0">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
