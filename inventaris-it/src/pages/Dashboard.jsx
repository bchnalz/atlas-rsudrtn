import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Layout from '../components/Layout';
import { AnimatedChartLine } from '../components/ui/animated-icons';
import { useCountUp } from '../hooks/useCountUp';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '../components/ui/carousel';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { BoltIcon, CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const toast = useToast();
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

  // Barcode scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Device detail dialog state
  const [viewingDetail, setViewingDetail] = useState(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [detailTab, setDetailTab] = useState('detail');
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [mutasiHistory, setMutasiHistory] = useState([]);
  const [loadingMutasiHistory, setLoadingMutasiHistory] = useState(false);

  // Swipe support for detail tabs
  const detailTabs = ['detail', 'history', 'mutasi'];
  const touchStartRef = useRef({ x: 0, y: 0 });
  const swipeContentRef = useRef(null);

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

  // --- Barcode Scanner ---
  const startScanner = async () => {
    setShowScanner(true);
    // Wait for DOM to render the scanner container
    await new Promise((r) => setTimeout(r, 100));

    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('dashboard-barcode-reader');
    html5QrCodeRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanner();
          handleBarcodeScanned(decodedText);
        },
        () => {} // ignore scan failures (no match yet)
      );
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Gagal mengakses kamera');
      setShowScanner(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current?.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      html5QrCodeRef.current?.clear();
    } catch {
      // ignore cleanup errors
    }
    html5QrCodeRef.current = null;
    setShowScanner(false);
  };

  const handleBarcodeScanned = async (idPerangkat) => {
    const trimmed = idPerangkat.trim();
    if (!trimmed) return;

    setScanLoading(true);
    try {
      const { data, error } = await supabase
        .from('perangkat')
        .select(`
          id,
          id_perangkat,
          nama_perangkat,
          jenis_perangkat_kode,
          jenis_barang_id,
          lokasi_kode,
          serial_number,
          merk,
          id_remoteaccess,
          spesifikasi_processor,
          kapasitas_ram,
          mac_ethernet,
          mac_wireless,
          ip_ethernet,
          ip_wireless,
          serial_number_monitor,
          tanggal_entry,
          status_perangkat,
          petugas_id,
          jenis_perangkat:ms_jenis_perangkat!perangkat_jenis_perangkat_kode_fkey(kode, nama),
          jenis_barang:ms_jenis_barang!perangkat_jenis_barang_id_fkey(id, nama),
          lokasi:ms_lokasi!perangkat_lokasi_kode_fkey(kode, nama),
          petugas:profiles!perangkat_petugas_id_fkey(id, full_name),
          perangkat_storage(id, jenis_storage, kapasitas)
        `)
        .eq('id_perangkat', trimmed)
        .single();

      if (error || !data) {
        toast.error('Perangkat tidak ditemukan: ' + trimmed);
        return;
      }

      handleViewDetail(data);
    } catch (err) {
      console.error('Error searching device:', err);
      toast.error('Gagal mencari perangkat');
    } finally {
      setScanLoading(false);
    }
  };

  // --- Device Detail ---
  const handleViewDetail = async (item) => {
    setIsDetailClosing(false);
    setViewingDetail(item);
    setDetailTab('detail');
    setHistoryData([]);
    setMutasiHistory([]);
    await fetchRepairHistory(item.id);
    await fetchMutasiHistory(item.id);
  };

  const handleCloseDetail = () => {
    setIsDetailClosing(true);
    setTimeout(() => {
      setViewingDetail(null);
      setHistoryData([]);
      setMutasiHistory([]);
      setDetailTab('detail');
      setIsDetailClosing(false);
    }, 150);
  };

  const fetchRepairHistory = async (perangkatId) => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('device_repair_history')
        .select('*')
        .eq('perangkat_id', perangkatId)
        .order('task_created_at', { ascending: false });
      if (error) throw error;
      setHistoryData(data || []);
    } catch (error) {
      console.error('Error fetching repair history:', error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchMutasiHistory = async (perangkatId) => {
    try {
      setLoadingMutasiHistory(true);
      const { data, error } = await supabase
        .rpc('get_mutasi_history', { p_perangkat_id: perangkatId });
      if (error) throw error;
      setMutasiHistory(data || []);
    } catch (error) {
      console.error('Error fetching mutasi history:', error);
      setMutasiHistory([]);
    } finally {
      setLoadingMutasiHistory(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const copyToClipboard = async (text, label) => {
    const value = String(text ?? '').trim();
    if (!value) { toast.error(`${label} kosong`); return; }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied!`);
    } catch {
      toast.error(`Gagal copy ${label}`);
    }
  };

  const getTaskStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      paused: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
      on_hold: 'bg-orange-100 text-orange-800',
    };
    const labels = {
      pending: 'Menunggu', acknowledged: 'Dikonfirmasi',
      in_progress: 'Dikerjakan', paused: 'Tertunda',
      completed: 'Selesai', cancelled: 'Dibatalkan', on_hold: 'On Hold',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handleDetailTabSwipe = useCallback((direction) => {
    const idx = detailTabs.indexOf(detailTab);
    if (direction === 'left' && idx < detailTabs.length - 1) setDetailTab(detailTabs[idx + 1]);
    else if (direction === 'right' && idx > 0) setDetailTab(detailTabs[idx - 1]);
  }, [detailTab]);

  const handleDetailTouchStart = useCallback((e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleDetailTouchEnd = useCallback((e) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      handleDetailTabSwipe(dx < 0 ? 'left' : 'right');
    }
  }, [handleDetailTabSwipe]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

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
                          <div className="relative px-1 py-1 overflow-visible">
                            <div className="relative h-1.5 w-full overflow-visible">
                              <div className="absolute inset-0 rounded-full bg-zinc-900" />
                              <div
                                className="absolute left-0 top-0 z-[1] h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out"
                                style={{ width: animated ? `${skp.percentage}%` : '0%' }}
                              >
                                <div
                                  className={`h-full w-full rounded-full bg-[#ffb700]${
                                    animated && skp.percentage > 0 ? ' skp-progress-bar-fill-pulse' : ''
                                  }`}
                                />
                                {animated && skp.percentage > 0 ? (
                                  <div
                                    className="skp-progress-bar-glow-overlay pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white via-white/25 to-transparent"
                                    aria-hidden
                                  />
                                ) : null}
                              </div>
                              <div
                                className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
                                style={{ left: animated ? `${skp.percentage}%` : '0%' }}
                                aria-hidden
                              >
                                {animated && skp.percentage > 0 ? (
                                  <BoltIcon
                                  className="h-4 w-4 text-white"
                                  style={{
                                    filter:
                                      'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 1px 0 #000) drop-shadow(-1px 1px 0 #000) drop-shadow(1px -1px 0 #000) drop-shadow(-1px -1px 0 #000)',
                                  }}
                                />
                                ) : null}
                              </div>
                            </div>
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

            {/* Scan Barcode Button - mobile only */}
            <div className="flex justify-center mt-3 md:hidden">
              <button
                onClick={startScanner}
                disabled={scanLoading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-100 bg-zinc-900 border border-zinc-700 rounded-sm hover:bg-zinc-800 active:bg-zinc-700 transition disabled:opacity-50"
              >
                {scanLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-500 border-t-zinc-100" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="7" y1="8" x2="9" y2="8" /><line x1="7" y1="16" x2="9" y2="16" />
                    <line x1="11" y1="8" x2="17" y2="8" /><line x1="11" y1="16" x2="17" y2="16" />
                  </svg>
                )}
                Scan Barcode
              </button>
            </div>
          </Carousel>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-80 modal-backdrop-enter"
          onClick={(e) => { if (e.target === e.currentTarget) stopScanner(); }}
        >
          <div className="w-full max-w-sm bg-black rounded-sm border border-gray-800 overflow-hidden modal-content-enter">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-medium text-zinc-100">Scan Barcode Perangkat</h3>
              <button
                onClick={stopScanner}
                className="text-zinc-500 hover:text-zinc-300 transition text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div id="dashboard-barcode-reader" ref={scannerRef} className="w-full" />
            <p className="text-center text-[10px] text-zinc-500 py-2">Arahkan kamera ke barcode ID Perangkat</p>
          </div>
        </div>
      )}

      {/* Scan Loading Overlay */}
      {scanLoading && !showScanner && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-500 border-t-zinc-100" />
            <span className="text-xs text-zinc-400">Mencari perangkat...</span>
          </div>
        </div>
      )}

      {/* Device Detail Dialog */}
      {viewingDetail && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto ${
            isDetailClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
          }`}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseDetail(); }}
        >
          <div
            className={`bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full h-[60vh] md:w-[504px] md:h-[350px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden ${
              isDetailClosing ? 'modal-content-exit' : 'modal-content-enter'
            }`}
          >
            {/* Fixed Header */}
            <div className="flex-shrink-0 flex justify-between items-start px-4 pt-3 pb-1 bg-black">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm truncate">{viewingDetail.nama_perangkat}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(viewingDetail.nama_perangkat, 'Nama Perangkat')}
                    className="text-gray-400 hover:text-white transition flex-shrink-0"
                    title="Copy Nama Perangkat"
                  >
                    <ClipboardDocumentIcon className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white font-bold text-xs">{viewingDetail.id_perangkat}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(viewingDetail.id_perangkat, 'ID Perangkat')}
                    className="text-gray-400 hover:text-white transition flex-shrink-0"
                    title="Copy ID Perangkat"
                  >
                    <ClipboardDocumentIcon className="w-3 h-3" />
                  </button>
                  <span className="text-gray-600">&bull;</span>
                  {viewingDetail.status_perangkat === 'layak' ? (
                    <CheckBadgeIcon className="w-4 h-4 text-blue-400" />
                  ) : (
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="flex-shrink-0 text-gray-400 hover:text-white transition text-2xl font-bold leading-none ml-2"
                title="Tutup"
              >
                &times;
              </button>
            </div>

            {/* Fixed Tabs */}
            <div className="flex-shrink-0 flex justify-center py-1">
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="bg-transparent border border-zinc-800 rounded-sm h-auto p-0.5 gap-1">
                  <TabsTrigger value="detail" className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm">
                    Detail
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm">
                    History Perbaikan
                  </TabsTrigger>
                  <TabsTrigger value="mutasi" className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm">
                    History Mutasi
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Scrollable Content Area - swipeable */}
            <div
              ref={swipeContentRef}
              className="flex-1 overflow-y-auto modern-scrollbar p-4"
              onTouchStart={handleDetailTouchStart}
              onTouchEnd={handleDetailTouchEnd}
            >
              {/* DETAIL TAB */}
              {detailTab === 'detail' && (
                <div key="tab-detail" className="animate-tab-slide grid grid-cols-2 gap-x-6 gap-y-2.5 text-gray-100 text-xs">
                  {viewingDetail.serial_number && viewingDetail.serial_number !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Serial Number</p>
                      <p className="text-xs">{viewingDetail.serial_number}</p>
                    </div>
                  )}
                  {viewingDetail.lokasi && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Lokasi</p>
                      <p className="text-xs">{viewingDetail.lokasi.kode} - {viewingDetail.lokasi.nama}</p>
                    </div>
                  )}
                  {viewingDetail.id_remoteaccess && viewingDetail.id_remoteaccess !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">ID Remote Access</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs">{viewingDetail.id_remoteaccess}</p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(viewingDetail.id_remoteaccess, 'ID Remote Access')}
                          className="text-gray-500 hover:text-white transition flex-shrink-0"
                          title="Copy ID Remote Access"
                        >
                          <ClipboardDocumentIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  {viewingDetail.jenis_perangkat && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Jenis Perangkat</p>
                      <p className="text-xs">{viewingDetail.jenis_perangkat.kode} - {viewingDetail.jenis_perangkat.nama}</p>
                    </div>
                  )}
                  {viewingDetail.spesifikasi_processor && viewingDetail.spesifikasi_processor !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Processor</p>
                      <p className="text-xs">{viewingDetail.spesifikasi_processor}</p>
                    </div>
                  )}
                  {viewingDetail.jenis_barang && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Jenis Barang</p>
                      <p className="text-xs">{viewingDetail.jenis_barang.nama}</p>
                    </div>
                  )}
                  {viewingDetail.kapasitas_ram && viewingDetail.kapasitas_ram !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">RAM</p>
                      <p className="text-xs">{viewingDetail.kapasitas_ram}</p>
                    </div>
                  )}
                  {viewingDetail.merk && viewingDetail.merk !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Merk</p>
                      <p className="text-xs">{viewingDetail.merk}</p>
                    </div>
                  )}
                  {viewingDetail.perangkat_storage && viewingDetail.perangkat_storage.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Storage</p>
                      <div className="space-y-0.5">
                        {viewingDetail.perangkat_storage.map((storage, index) => (
                          <div key={storage.id || index} className="flex items-center gap-1.5 text-xs">
                            <span className="bg-blue-900 text-blue-200 px-1 py-0.5 rounded text-[10px] font-medium">
                              {storage.jenis_storage}
                            </span>
                            <span>{storage.kapasitas} GB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewingDetail.petugas && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Petugas Entry</p>
                      <p className="text-xs">{viewingDetail.petugas.full_name}</p>
                    </div>
                  )}
                  {viewingDetail.mac_ethernet && viewingDetail.mac_ethernet !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">MAC Ethernet</p>
                      <p className="text-xs">{viewingDetail.mac_ethernet}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Tanggal Entry</p>
                    <p className="text-xs">{formatDate(viewingDetail.tanggal_entry)}</p>
                  </div>
                  {viewingDetail.mac_wireless && viewingDetail.mac_wireless !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">MAC Wireless</p>
                      <p className="text-xs">{viewingDetail.mac_wireless}</p>
                    </div>
                  )}
                  {viewingDetail.serial_number_monitor && viewingDetail.serial_number_monitor !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">SN Monitor</p>
                      <p className="text-xs">{viewingDetail.serial_number_monitor}</p>
                    </div>
                  )}
                  {viewingDetail.ip_ethernet && viewingDetail.ip_ethernet !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">IP Ethernet</p>
                      <p className="text-xs">{viewingDetail.ip_ethernet}</p>
                    </div>
                  )}
                  {viewingDetail.ip_wireless && viewingDetail.ip_wireless !== '-' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">IP Wireless</p>
                      <p className="text-xs">{viewingDetail.ip_wireless}</p>
                    </div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {detailTab === 'history' && (
                <div key="tab-history" className="animate-tab-slide">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
                    </div>
                  ) : historyData.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-gray-400">Belum ada riwayat perbaikan</p>
                      <p className="text-xs text-gray-500 mt-1">Perangkat ini belum pernah diperbaiki</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-cyan-900/20 border border-cyan-700 rounded-lg p-2.5 mb-3">
                        <p className="text-xs text-cyan-300">
                          Total: <span className="text-base font-bold text-cyan-400">{historyData.length}</span> kali diperbaiki
                        </p>
                      </div>
                      {historyData.map((history, index) => (
                        <div key={history.task_id} className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 hover:border-cyan-600 transition">
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-cyan-500">#{index + 1}</span>
                              <p className="text-xs font-mono font-bold text-yellow-300">{history.task_number}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {getTaskStatusBadge(history.task_status)}
                              <p className="text-xs text-gray-400">{formatDate(history.task_created_at).split(' ')[0]}</p>
                            </div>
                          </div>
                          <h3 className="text-xs font-semibold text-white mb-1">{history.task_title}</h3>
                          {history.task_description && (
                            <p className="text-xs text-gray-300 mb-2 line-clamp-2">{history.task_description}</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-gray-500">Petugas:</p>
                              <p className="text-white font-medium">{history.assigned_users || '-'}</p>
                              {history.user_count > 1 && (
                                <p className="text-xs text-cyan-400">({history.user_count} orang)</p>
                              )}
                            </div>
                            {history.completed_at && (
                              <div>
                                <p className="text-gray-500">Selesai:</p>
                                <p className="text-green-400 text-xs">{formatDate(history.completed_at)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* HISTORY MUTASI TAB */}
              {detailTab === 'mutasi' && (
                <div key="tab-mutasi" className="animate-tab-slide">
                  {loadingMutasiHistory ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" />
                    </div>
                  ) : mutasiHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-gray-400">Belum ada riwayat mutasi</p>
                      <p className="text-xs text-gray-500 mt-1">Perangkat ini belum pernah dimutasi</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mutasiHistory.map((mutasi, index) => (
                        <div
                          key={mutasi.id}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-green-500 transition"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🔄</span>
                              <div>
                                <p className="text-xs text-gray-500">
                                  {new Date(mutasi.tanggal_mutasi).toLocaleDateString('id-ID', {
                                    day: 'numeric', month: 'long', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">Oleh: {mutasi.created_by_name}</p>
                              </div>
                            </div>
                            <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">
                              #{mutasiHistory.length - index}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">Dari:</span>
                              <span className="text-red-400 font-medium">{mutasi.lokasi_lama_nama} ({mutasi.lokasi_lama_kode})</span>
                              <span className="text-gray-600">&bull;</span>
                              <span className="text-gray-400">{mutasi.nama_perangkat_lama}</span>
                            </div>
                            <div className="text-center text-gray-600 text-xs">&darr;</div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">Ke:</span>
                              <span className="text-green-400 font-medium">{mutasi.lokasi_baru_nama} ({mutasi.lokasi_baru_kode})</span>
                              <span className="text-gray-600">&bull;</span>
                              <span className="text-gray-400">{mutasi.nama_perangkat_baru}</span>
                            </div>
                            {mutasi.keterangan && (
                              <div className="mt-3 pt-3 border-t border-gray-700">
                                <p className="text-xs text-gray-500 mb-1">Keterangan:</p>
                                <p className="text-xs text-gray-300">{mutasi.keterangan}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
