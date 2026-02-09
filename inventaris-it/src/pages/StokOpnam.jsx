import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import IPAddressInput from '../components/IPAddressInput';
import MACAddressInput from '../components/MACAddressInput';
import StorageInput from '../components/StorageInput';
import { useToast } from '../contexts/ToastContext';
import { MagnifyingGlassPlusIcon, MagnifyingGlassIcon, PencilSquareIcon, ArrowsRightLeftIcon, TrashIcon, ClipboardDocumentIcon, FunnelIcon, XMarkIcon, ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Hammer } from '../components/animate-ui/icons/hammer';
import { CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

const StokOpnam = () => {
  const { profile } = useAuth();
  const toast = useToast();
  const [perangkat, setPerangkat] = useState([]);
  const [jenisPerangkatList, setJenisPerangkatList] = useState([]);
  const [jenisBarangList, setJenisBarangList] = useState([]);
  const [lokasiList, setLokasiList] = useState([]);
  const [userCategory, setUserCategory] = useState(null);
  // Don't block initial render; load data after first paint
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({
    nama_perangkat: '',
    tanggal_entry: '',
    petugas: '',
    jenis_perangkat: '',
    jenis_barang: '',
    status: '',
  });
  const [openHeaderMenu, setOpenHeaderMenu] = useState(null); // column key or null
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAddFormClosing, setIsAddFormClosing] = useState(false); // Animation state
  const [addStep, setAddStep] = useState(1); // Step 1 or 2
  const [newPerangkatId, setNewPerangkatId] = useState(null); // ID yang baru dibuat
  const [generatedIdPerangkat, setGeneratedIdPerangkat] = useState(''); // ID Perangkat string
  const [generatedNamaPerangkat, setGeneratedNamaPerangkat] = useState(''); // Nama Perangkat auto-generated
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sorting state - default to id_perangkat (sequence number) descending
  const [sortColumn, setSortColumn] = useState('id_perangkat');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc' - desc shows highest first
  
  // Detail view state
  const [viewingDetail, setViewingDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('detail'); // 'detail', 'history', or 'mutasi'
  const [isDetailClosing, setIsDetailClosing] = useState(false); // Animation state

  // Swipe support for detail tabs
  const detailTabs = ['detail', 'history', 'mutasi'];
  const touchStartRef = useRef({ x: 0, y: 0 });
  const swipeContentRef = useRef(null);

  const handleTabSwipe = useCallback((direction) => {
    const currentIndex = detailTabs.indexOf(detailTab);
    if (direction === 'left' && currentIndex < detailTabs.length - 1) {
      setDetailTab(detailTabs[currentIndex + 1]);
    } else if (direction === 'right' && currentIndex > 0) {
      setDetailTab(detailTabs[currentIndex - 1]);
    }
  }, [detailTab]);

  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    // Only trigger swipe if horizontal movement is dominant and significant
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      handleTabSwipe(deltaX < 0 ? 'left' : 'right');
    }
  }, [handleTabSwipe]);
  
  // History state
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Mutasi state
  const [showMutasiModal, setShowMutasiModal] = useState(false);
  const [mutasiPerangkat, setMutasiPerangkat] = useState(null);
  const [mutasiForm, setMutasiForm] = useState({
    lokasi_baru_kode: '',
    keterangan: ''
  });
  const [loadingMutasi, setLoadingMutasi] = useState(false);
  const [mutasiHistory, setMutasiHistory] = useState([]);
  const [loadingMutasiHistory, setLoadingMutasiHistory] = useState(false);
  
  // Step 1 form (minimal)
  const [step1Form, setStep1Form] = useState({
    jenis_perangkat_kode: '',
    serial_number: '',
    lokasi_kode: '',
  });
  
  // Step 2 form (detail)
  const [step2Form, setStep2Form] = useState({
    jenis_barang_id: '',
    merk: '',
    id_remoteaccess: '',
    spesifikasi_processor: '',
    kapasitas_ram: '',
    storages: [], // Array of { jenis_storage, kapasitas }
    mac_ethernet: '',
    mac_wireless: '',
    ip_ethernet: '',
    ip_wireless: '',
    serial_number_monitor: '',
    status_perangkat: true, // true = layak, false = tidak layak (rusak)
  });

  const copyToClipboard = async (text, label) => {
    const value = String(text ?? '').trim();
    if (!value) {
      toast.error(`❌ ${label} kosong`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`✅ ${label} copied!`);
    } catch {
      toast.error(`❌ Gagal copy ${label}`);
    }
  };

  useEffect(() => {
    // Defer network queries until after first paint so search/button render instantly.
    // This improves perceived speed without changing the underlying query performance.
    const runAfterPaint = (fn) => {
      if (typeof window === 'undefined') {
        fn();
        return () => {};
      }
      if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(fn, { timeout: 1000 });
        return () => window.cancelIdleCallback?.(id);
      }
      const id = window.setTimeout(fn, 0);
      return () => window.clearTimeout(id);
    };

    const cancel = runAfterPaint(() => {
      fetchMasterData();
      fetchPerangkat();
    });

    return cancel;
  }, []);

  useEffect(() => {
    // Fetch user category to check for Koordinator IT Support
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

    if (profile?.id) {
      fetchUserCategory();
    }
  }, [profile?.id]);

  const fetchMasterData = async () => {
    try {
      console.log('🔍 Fetching master data...');
      
      // Fetch all master tables
      const [jenisPerangkat, jenisBarang, lokasi] = await Promise.all([
        supabase.from('ms_jenis_perangkat').select('*').eq('is_active', true).order('kode'),
        supabase.from('ms_jenis_barang').select('*, jenis_perangkat_kode').eq('is_active', true).order('nama'),
        supabase.from('ms_lokasi').select('*').eq('is_active', true).order('kode'),
      ]);

      console.log('📦 Jenis Perangkat Response:', jenisPerangkat);
      console.log('📦 Jenis Barang Response:', jenisBarang);
      console.log('📦 Lokasi Response:', lokasi);

      if (jenisPerangkat.error) {
        console.error('❌ Error Jenis Perangkat:', jenisPerangkat.error);
        throw jenisPerangkat.error;
      }
      if (jenisBarang.error) {
        console.error('❌ Error Jenis Barang:', jenisBarang.error);
        throw jenisBarang.error;
      }
      if (lokasi.error) {
        console.error('❌ Error Lokasi:', lokasi.error);
        throw lokasi.error;
      }

      console.log('✅ Jenis Perangkat Data:', jenisPerangkat.data?.length, 'rows');
      console.log('✅ Jenis Barang Data:', jenisBarang.data?.length, 'rows');
      console.log('✅ Lokasi Data:', lokasi.data?.length, 'rows');

      setJenisPerangkatList(jenisPerangkat.data || []);
      setJenisBarangList(jenisBarang.data || []);
      setLokasiList(lokasi.data || []);

      console.log('✅ State updated successfully!');
    } catch (error) {
      console.error('❌ Error fetching master data:', error);
      toast.error('❌ Error loading master data: ' + error.message);
    }
  };

  const fetchPerangkat = async () => {
    try {
      setLoading(true);
      console.log('[StokOpnam] Starting fetchPerangkat...');
      const startTime = performance.now();
      
      // Use single optimized query - Supabase handles joins efficiently
      // This is faster than multiple queries because:
      // 1. Single round-trip to database
      // 2. Database optimizes the join internally
      // 3. Less RLS policy checks (one query vs many)
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
        .limit(1000); // Reasonable limit to prevent slow queries
        // Note: Sorting is done in frontend by sequence number (last 4 digits of id_perangkat)

      if (error) throw error;

      const endTime = performance.now();
      console.log(`[StokOpnam] ✅ fetchPerangkat completed in ${(endTime - startTime).toFixed(2)}ms, ${data?.length || 0} records`);
      
      setPerangkat(data || []);
    } catch (error) {
      console.error('[StokOpnam] Error fetching perangkat:', error.message);
      toast.error('❌ Gagal memuat data perangkat: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    // Re-fetch table data without reloading the whole page
    await fetchPerangkat();
  };

  // Filter jenis barang based on selected jenis perangkat
  const getFilteredJenisBarang = (jenisPerangkatKode) => {
    if (!jenisPerangkatKode) return jenisBarangList;
    
    const filtered = jenisBarangList.filter(jb => jb.jenis_perangkat_kode === jenisPerangkatKode);
    
    console.log('🔍 Filtering Jenis Barang:');
    console.log('  Selected Jenis Perangkat Kode:', jenisPerangkatKode);
    console.log('  All Jenis Barang:', jenisBarangList);
    console.log('  Filtered Jenis Barang:', filtered);
    
    return filtered;
  };

  const generateIdPerangkat = async (kode) => {
    try {
      const { data, error } = await supabase.rpc('generate_id_perangkat', {
        p_kode: kode,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating ID:', error.message);
      throw error;
    }
  };

  // Step 1: Generate ID & Save minimal data
  const [isSubmittingStep1, setIsSubmittingStep1] = useState(false);
  
  const handleGenerateAndSave = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmittingStep1) {
      toast.warning('⏳ Sedang memproses, harap tunggu...');
      return;
    }

    // Validate serial number is not "-"
    if (!step1Form.serial_number || step1Form.serial_number.trim() === '' || step1Form.serial_number.trim() === '-') {
      toast.error('❌ Serial number tidak boleh kosong atau "-". Silakan masukkan serial number yang valid.');
      return;
    }

    setIsSubmittingStep1(true);

    try {
      // Optional: Pre-check for duplicate (better UX, but database constraint will catch it anyway)
      const { data: existingData, error: checkError } = await supabase
        .from('perangkat')
        .select('id, id_perangkat, serial_number')
        .eq('serial_number', step1Form.serial_number.trim())
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw checkError;
      }

      if (existingData) {
        toast.error(`❌ Serial number "${step1Form.serial_number}" sudah terdaftar dengan ID Perangkat: ${existingData.id_perangkat}. Silakan gunakan serial number yang berbeda.`);
        setIsSubmittingStep1(false);
        return;
      }

      // Insert minimal data; DB trigger will generate id_perangkat + nama_perangkat atomically
      const dataToInsert = {
        petugas_id: profile.id,
        jenis_perangkat_kode: step1Form.jenis_perangkat_kode,
        serial_number: step1Form.serial_number.trim(), // Trim whitespace
        lokasi_kode: step1Form.lokasi_kode,
        status_perangkat: 'layak', // Default layak
        // Fill optional fields with "-"
        merk: '-',
        jenis_barang_id: null,
        id_remoteaccess: '-',
        spesifikasi_processor: '-',
        kapasitas_ram: '-',
        mac_ethernet: '-',
        mac_wireless: '-',
        ip_ethernet: '-',
        ip_wireless: '-',
        serial_number_monitor: '-',
      };

      const { data, error } = await supabase
        .from('perangkat')
        .insert([dataToInsert])
        .select()
        .single();

      if (error) throw error;

      // Use the generated values from DB (source of truth)
      setGeneratedIdPerangkat(data.id_perangkat);
      setGeneratedNamaPerangkat(data.nama_perangkat);

      // Save the new ID and move to step 2
      setNewPerangkatId(data.id);
      setAddStep(2);
      toast.success(`✅ ID Perangkat berhasil dibuat: ${data.id_perangkat}`);
    } catch (error) {
      // Check for duplicate serial number error
      if (error.code === '23505' || error.message?.includes('Duplicate serial number') || error.message?.includes('already exists')) {
        toast.error(`❌ Serial number "${step1Form.serial_number}" sudah terdaftar di database. Silakan gunakan serial number yang berbeda.`);
      } else {
        toast.error('❌ Gagal generate ID: ' + error.message);
      }
    } finally {
      setIsSubmittingStep1(false);
    }
  };

  // Step 2: Update detail data
  const handleSaveDetail = async (e) => {
    e.preventDefault();

    try {
      // Prepare update data
      const dataToUpdate = {
        jenis_barang_id: step2Form.jenis_barang_id || null,
        merk: step2Form.merk || '-',
        id_remoteaccess: step2Form.id_remoteaccess || '-',
        spesifikasi_processor: step2Form.spesifikasi_processor || '-',
        kapasitas_ram: step2Form.kapasitas_ram || '-',
        mac_ethernet: step2Form.mac_ethernet || null,
        mac_wireless: step2Form.mac_wireless || null,
        ip_ethernet: step2Form.ip_ethernet || null,
        ip_wireless: step2Form.ip_wireless || null,
        serial_number_monitor: step2Form.serial_number_monitor || '-',
        status_perangkat: step2Form.status_perangkat ? 'layak' : 'rusak',
      };

      const { error: updateError } = await supabase
        .from('perangkat')
        .update(dataToUpdate)
        .eq('id', newPerangkatId);

      if (updateError) throw updateError;

      // Insert storage entries if any
      if (step2Form.storages && step2Form.storages.length > 0) {
        const storageEntries = step2Form.storages.map(storage => ({
          perangkat_id: newPerangkatId,
          jenis_storage: storage.jenis_storage,
          kapasitas: storage.kapasitas || '0',
        }));

        const { error: storageError } = await supabase
          .from('perangkat_storage')
          .insert(storageEntries);

        if (storageError) throw storageError;
      }

      toast.success(`✅ Perangkat berhasil ditambahkan! ID: ${generatedIdPerangkat}`);
      
      // Reset forms
      setShowAddForm(false);
      setAddStep(1);
      setNewPerangkatId(null);
      setGeneratedIdPerangkat('');
      setGeneratedNamaPerangkat('');
      setIsSubmittingStep1(false);
      setStep1Form({
        jenis_perangkat_kode: '',
        serial_number: '',
        lokasi_kode: '',
      });
      setStep2Form({
        jenis_barang_id: '',
        merk: '',
        id_remoteaccess: '',
        spesifikasi_processor: '',
        kapasitas_ram: '',
        storages: [],
        mac_ethernet: '',
        mac_wireless: '',
        ip_ethernet: '',
        ip_wireless: '',
        serial_number_monitor: '',
        status_perangkat: true,
      });
      
      fetchPerangkat();
    } catch (error) {
      toast.error('❌ Gagal menyimpan detail: ' + error.message);
    }
  };

  const [originalLokasiKode, setOriginalLokasiKode] = useState(null);

  const generateNamaPerangkat = (lokasiKode, idPerangkat) => {
    if (!lokasiKode || !idPerangkat) return '';
    const last4 = idPerangkat.slice(-4);
    return `${lokasiKode}-${last4}`;
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setOriginalLokasiKode(item.lokasi_kode);
    // Only copy actual database columns, not expanded relations
    setEditForm({
      id_perangkat: item.id_perangkat,
      nama_perangkat: item.nama_perangkat,
      jenis_perangkat_kode: item.jenis_perangkat_kode,
      lokasi_kode: item.lokasi_kode,
      serial_number: item.serial_number,
      jenis_barang_id: item.jenis_barang_id,
      merk: item.merk,
      id_remoteaccess: item.id_remoteaccess,
      spesifikasi_processor: item.spesifikasi_processor,
      kapasitas_ram: item.kapasitas_ram,
      storages: item.perangkat_storage || [], // Get storages from joined data
      mac_ethernet: item.mac_ethernet,
      mac_wireless: item.mac_wireless,
      ip_ethernet: item.ip_ethernet,
      ip_wireless: item.ip_wireless,
      serial_number_monitor: item.serial_number_monitor,
      tanggal_entry: item.tanggal_entry,
      status_perangkat: item.status_perangkat,
      petugas_id: item.petugas_id,
    });
  };

  const handleSaveEdit = async () => {
    try {
      // Check if lokasi has changed and confirm
      if (originalLokasiKode && editForm.lokasi_kode !== originalLokasiKode) {
        const confirmed = window.confirm(
          `Lokasi akan diubah dari "${originalLokasiKode}" ke "${editForm.lokasi_kode}".\n` +
          `Nama perangkat akan otomatis berubah menjadi "${editForm.nama_perangkat}".\n\n` +
          `Apakah Anda yakin ingin melanjutkan?`
        );
        if (!confirmed) {
          return;
        }
      }

      // Extract only database columns (exclude expanded relations)
      const updateData = {
        id_perangkat: editForm.id_perangkat,
        nama_perangkat: editForm.nama_perangkat,
        jenis_perangkat_kode: editForm.jenis_perangkat_kode,
        lokasi_kode: editForm.lokasi_kode,
        serial_number: editForm.serial_number,
        jenis_barang_id: editForm.jenis_barang_id,
        merk: editForm.merk,
        id_remoteaccess: editForm.id_remoteaccess,
        spesifikasi_processor: editForm.spesifikasi_processor,
        kapasitas_ram: editForm.kapasitas_ram,
        mac_ethernet: editForm.mac_ethernet || null,
        mac_wireless: editForm.mac_wireless || null,
        ip_ethernet: editForm.ip_ethernet || null,
        ip_wireless: editForm.ip_wireless || null,
        serial_number_monitor: editForm.serial_number_monitor,
        tanggal_entry: editForm.tanggal_entry,
        status_perangkat: editForm.status_perangkat,
        petugas_id: editForm.petugas_id,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('perangkat')
        .update(updateData)
        .eq('id', editingId);

      if (updateError) throw updateError;

      // Delete old storage entries
      const { error: deleteError } = await supabase
        .from('perangkat_storage')
        .delete()
        .eq('perangkat_id', editingId);

      if (deleteError) throw deleteError;

      // Insert new storage entries if any
      if (editForm.storages && editForm.storages.length > 0) {
        const storageEntries = editForm.storages.map(storage => ({
          perangkat_id: editingId,
          jenis_storage: storage.jenis_storage,
          kapasitas: storage.kapasitas || '0',
        }));

        const { error: storageError } = await supabase
          .from('perangkat_storage')
          .insert(storageEntries);

        if (storageError) throw storageError;
      }

      toast.success('✅ Data berhasil diupdate!');
      setEditingId(null);
      setEditForm({});
      setOriginalLokasiKode(null);
      fetchPerangkat();
    } catch (error) {
      toast.error('❌ Gagal update data: ' + error.message);
    }
  };

  const getColumnValueForFilter = (item, column) => {
    switch (column) {
      case 'nama_perangkat':
        return item.nama_perangkat || '';
      case 'tanggal_entry':
        return formatDate(item.tanggal_entry) || '';
      case 'petugas':
        return item.petugas?.full_name || '';
      case 'jenis_perangkat':
        return item.jenis_perangkat?.nama || '';
      case 'jenis_barang':
        return item.jenis_barang?.nama || '';
      case 'status':
        return item.status_perangkat === 'layak'
          ? 'Layak'
          : item.status_perangkat === 'rusak'
            ? 'Rusak'
            : (item.status_perangkat || '');
      default:
        return '';
    }
  };

  const filteredPerangkat = perangkat.filter((item) => {
    const search = searchTerm.toLowerCase();

    // General search term (global)
    const matchesGeneralSearch = !search || (
      item.id_perangkat?.toLowerCase().includes(search) ||
      item.nama_perangkat?.toLowerCase().includes(search) ||
      item.jenis_perangkat?.nama?.toLowerCase().includes(search) ||
      item.jenis_barang?.nama?.toLowerCase().includes(search) ||
      item.merk?.toLowerCase().includes(search) ||
      item.lokasi?.nama?.toLowerCase().includes(search) ||
      item.serial_number?.toLowerCase().includes(search) ||
      item.ip_ethernet?.toLowerCase().includes(search) ||
      item.ip_wireless?.toLowerCase().includes(search) ||
      item.petugas?.full_name?.toLowerCase().includes(search)
    );

    if (!matchesGeneralSearch) return false;

    // Column filters (AND)
    for (const [column, value] of Object.entries(columnFilters)) {
      const v = (value || '').toLowerCase().trim();
      if (!v) continue;
      const colValue = (getColumnValueForFilter(item, column) || '').toLowerCase();
      if (!colValue.includes(v)) return false;
    }

    return true;
  });

  // Sorting logic
  const sortedPerangkat = [...filteredPerangkat].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue, bValue;

    switch (sortColumn) {
      case 'id_perangkat':
        // Extract sequence number (last 4 digits) from id_perangkat
        // Format: XXX.YYYY.M.ZZZZ where ZZZZ is the sequence
        const aSeq = a.id_perangkat ? parseInt(a.id_perangkat.split('.').pop() || '0', 10) : 0;
        const bSeq = b.id_perangkat ? parseInt(b.id_perangkat.split('.').pop() || '0', 10) : 0;
        aValue = aSeq;
        bValue = bSeq;
        break;
      case 'nama_perangkat':
        aValue = a.nama_perangkat || '';
        bValue = b.nama_perangkat || '';
        break;
      case 'tanggal_entry':
        aValue = new Date(a.tanggal_entry || 0);
        bValue = new Date(b.tanggal_entry || 0);
        break;
      case 'petugas':
        aValue = a.petugas?.full_name || '';
        bValue = b.petugas?.full_name || '';
        break;
      case 'jenis_perangkat':
        aValue = a.jenis_perangkat?.nama || '';
        bValue = b.jenis_perangkat?.nama || '';
        break;
      case 'jenis_barang':
        aValue = a.jenis_barang?.nama || '';
        bValue = b.jenis_barang?.nama || '';
        break;
      default:
        return 0;
    }

    // Compare values
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const isShowingAll = itemsPerPage === 'all';
  const totalPages = isShowingAll ? 1 : Math.ceil(sortedPerangkat.length / itemsPerPage);
  const startIndex = isShowingAll ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = isShowingAll ? sortedPerangkat.length : startIndex + itemsPerPage;
  const paginatedPerangkat = sortedPerangkat.slice(startIndex, endIndex);

  // Reset to page 1 when search or itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Close header dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openHeaderMenu && !event.target.closest('.header-menu-container')) {
        setOpenHeaderMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openHeaderMenu]);

  // ESC key handler for modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showAddForm) {
          if (addStep === 1) {
            setShowAddForm(false);
            setAddStep(1);
            setNewPerangkatId(null);
            setGeneratedIdPerangkat('');
            setStep1Form({ jenis_perangkat_kode: '', serial_number: '', lokasi_kode: '' });
          } else if (addStep === 2 && confirm('Data Step 1 sudah tersimpan. Yakin batal? Data minimal tetap tersimpan.')) {
            setShowAddForm(false);
            setAddStep(1);
            setNewPerangkatId(null);
            setGeneratedIdPerangkat('');
            setStep1Form({ jenis_perangkat_kode: '', serial_number: '', lokasi_kode: '' });
            setStep2Form({
              jenis_barang_id: '',
              merk: '',
              id_remoteaccess: '',
              spesifikasi_processor: '',
              kapasitas_ram: '',
              storages: [],
              mac_ethernet: '',
              mac_wireless: '',
              ip_ethernet: '',
              ip_wireless: '',
              serial_number_monitor: '',
              status_perangkat: true,
            });
            fetchPerangkat();
          }
        } else if (viewingDetail && !isDetailClosing) {
          handleCloseDetail();
        } else if (showMutasiModal) {
          setShowMutasiModal(false);
          setMutasiPerangkat(null);
          setMutasiForm({ lokasi_baru_kode: '', keterangan: '' });
        } else if (editingId) {
          setEditingId(null);
          setEditForm({});
          setOriginalLokasiKode(null);
        }
      }
    };

    if (showAddForm || viewingDetail || showMutasiModal || editingId) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [showAddForm, viewingDetail, showMutasiModal, editingId, addStep, isDetailClosing]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value === 'all' ? 'all' : parseInt(value));
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with asc as default
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to page 1 when sorting
  };

  const handleSortWithDirection = (column, direction) => {
    setSortColumn(column);
    setSortDirection(direction);
    setCurrentPage(1);
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const HeaderMenu = ({ column, label, placeholder = 'Filter...' }) => {
    const isOpen = openHeaderMenu === column;
    const filterValue = columnFilters[column] || '';
    const hasFilter = !!filterValue.trim();
    const isSorted = sortColumn === column;

    return (
      <th className="px-3 py-2 text-center text-xs font-medium text-white uppercase relative">
        <div className="flex items-center justify-center gap-1">
          <div className="flex items-center gap-1 px-1 py-0.5 rounded">
            <span>{label}</span>
            {/* Sort indicator only (not clickable) */}
            {isSorted ? (
              sortDirection === 'asc' ? (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )
            ) : null}
          </div>

          <div className="relative header-menu-container">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenHeaderMenu(isOpen ? null : column);
              }}
              className={`p-0.5 rounded hover:bg-gray-800 transition relative ${hasFilter ? 'text-white' : 'text-gray-400'}`}
              title={`Sort/Filter ${label}`}
            >
              <FunnelIcon className="w-3 h-3" />
              {hasFilter && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full"></span>
              )}
            </button>

            {isOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-300">{label}</label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenHeaderMenu(null);
                    }}
                    className="text-gray-400 hover:text-white transition"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortWithDirection(column, 'asc');
                    }}
                    className={`px-2 py-1.5 rounded-md text-xs border transition ${
                      sortColumn === column && sortDirection === 'asc'
                        ? 'bg-gray-600 border-gray-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                    }`}
                    title="Sort ASC"
                  >
                    Sort ASC
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortWithDirection(column, 'desc');
                    }}
                    className={`px-2 py-1.5 rounded-md text-xs border transition ${
                      sortColumn === column && sortDirection === 'desc'
                        ? 'bg-gray-600 border-gray-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                    }`}
                    title="Sort DESC"
                  >
                    Sort DESC
                  </button>
                </div>

                <input
                  type="text"
                  placeholder={placeholder}
                  value={filterValue}
                  onChange={(e) =>
                    setColumnFilters((prev) => ({ ...prev, [column]: e.target.value }))
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 text-gray-100 rounded focus:ring-2 focus:ring-gray-500 focus:border-transparent placeholder-gray-500"
                  autoFocus
                />

                {hasFilter && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setColumnFilters((prev) => ({ ...prev, [column]: '' }));
                    }}
                    className="mt-2 text-xs text-gray-300 hover:text-white transition"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fetch repair history for a device
  const fetchRepairHistory = async (perangkatId) => {
    try {
      setLoadingHistory(true);
      
      // Get repair history from view
      const { data, error } = await supabase
        .from('device_repair_history')
        .select('*')
        .eq('perangkat_id', perangkatId)
        .order('task_created_at', { ascending: false });

      if (error) throw error;
      
      setHistoryData(data || []);
    } catch (error) {
      console.error('Error fetching repair history:', error.message);
      toast.error('❌ Gagal load history: ' + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewDetail = async (item) => {
    setIsDetailClosing(false); // Reset closing state
    setViewingDetail(item);
    setDetailTab('detail');
    setHistoryData([]);
    setMutasiHistory([]);
    // Fetch history immediately
    await fetchRepairHistory(item.id);
    await fetchMutasiHistory(item.id);
  };

  const handleCloseDetail = () => {
    setIsDetailClosing(true);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setViewingDetail(null);
      setHistoryData([]);
      setMutasiHistory([]);
      setDetailTab('detail');
      setIsDetailClosing(false);
    }, 150); // Match the exit animation duration
  };

  const handleCloseAddForm = (skipConfirm = false) => {
    // If on step 2, ask for confirmation
    if (addStep === 2 && !skipConfirm) {
      if (!confirm('Data Step 1 sudah tersimpan. Yakin batal? Data minimal tetap tersimpan.')) {
        return;
      }
    }
    setIsAddFormClosing(true);
    setTimeout(() => {
      setShowAddForm(false);
      setAddStep(1);
      setNewPerangkatId(null);
      setGeneratedIdPerangkat('');
      setGeneratedNamaPerangkat('');
      setIsSubmittingStep1(false);
      setStep1Form({ jenis_perangkat_kode: '', serial_number: '', lokasi_kode: '' });
      setStep2Form({
        jenis_barang_id: '',
        merk: '',
        id_remoteaccess: '',
        spesifikasi_processor: '',
        kapasitas_ram: '',
        storages: [],
        mac_ethernet: '',
        mac_wireless: '',
        ip_ethernet: '',
        ip_wireless: '',
        serial_number_monitor: '',
        status_perangkat: true,
      });
      setIsAddFormClosing(false);
      fetchPerangkat();
    }, 150);
  };

  // Handle Mutasi Perangkat
  const handleOpenMutasi = (item) => {
    setMutasiPerangkat(item);
    setMutasiForm({
      lokasi_baru_kode: '',
      keterangan: ''
    });
    setShowMutasiModal(true);
  };

  const handleCloseMutasi = () => {
    setShowMutasiModal(false);
    setMutasiPerangkat(null);
    setMutasiForm({
      lokasi_baru_kode: '',
      keterangan: ''
    });
  };

  const handleSubmitMutasi = async (e) => {
    e.preventDefault();
    
    if (!mutasiPerangkat) return;
    
    // Validasi: lokasi baru tidak boleh sama dengan lokasi lama
    if (mutasiForm.lokasi_baru_kode === mutasiPerangkat.lokasi_kode) {
      toast.error('❌ Lokasi baru sama dengan lokasi lama!');
      return;
    }

    try {
      setLoadingMutasi(true);
      
      // Call RPC function
      const { data, error } = await supabase
        .rpc('mutasi_perangkat_process', {
          p_perangkat_id: mutasiPerangkat.id,
          p_lokasi_baru_kode: mutasiForm.lokasi_baru_kode,
          p_keterangan: mutasiForm.keterangan || null
        });

      if (error) throw error;

      // Check response
      if (data && data.success) {
        toast.success('✅ Mutasi perangkat berhasil!');
        handleCloseMutasi();
        fetchPerangkat(); // Refresh data
      } else {
        throw new Error(data?.message || 'Mutasi gagal');
      }
    } catch (error) {
      console.error('Error mutasi:', error);
      toast.error('❌ Gagal mutasi perangkat: ' + error.message);
    } finally {
      setLoadingMutasi(false);
    }
  };

  // Fetch Mutasi History
  const fetchMutasiHistory = async (perangkatId) => {
    try {
      setLoadingMutasiHistory(true);
      
      const { data, error } = await supabase
        .rpc('get_mutasi_history', {
          p_perangkat_id: perangkatId
        });

      if (error) throw error;
      
      setMutasiHistory(data || []);
    } catch (error) {
      console.error('Error fetching mutasi history:', error);
      setMutasiHistory([]);
    } finally {
      setLoadingMutasiHistory(false);
    }
  };

  // Get preview nama perangkat baru
  const getPreviewNamaPerangkat = () => {
    if (!mutasiPerangkat || !mutasiForm.lokasi_baru_kode) return '';
    
    // Extract urutan dari id_perangkat (4 digit terakhir)
    const urutan = mutasiPerangkat.id_perangkat.split('.').pop();
    
    // Generate preview: KODE_LOKASI_BARU-URUTAN
    return `${mutasiForm.lokasi_baru_kode}-${urutan}`;
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
      pending: 'Menunggu',
      acknowledged: 'Dikonfirmasi',
      in_progress: 'Dikerjakan',
      paused: 'Tertunda',
      completed: 'Selesai',
      cancelled: 'Dibatalkan',
      on_hold: 'On Hold',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Check if user can edit (IT Support role/category, Administrator, or Koordinator IT Support)
  const canEdit = 
    profile?.role === 'it_support' || 
    profile?.role === 'administrator' || 
    userCategory === 'IT Support' ||
    userCategory === 'Koordinator IT Support';
  
  // Check if user can perform mutasi (Administrator or Koordinator IT Support only)
  const canMutasi = 
    profile?.role === 'administrator' || 
    userCategory === 'Koordinator IT Support';

  // Check if user can delete (Administrator or Koordinator IT Support)
  const canDelete =
    profile?.role === 'administrator' ||
    userCategory === 'Koordinator IT Support';

  const handleDeletePerangkat = async (item) => {
    if (!canDelete) return;
    if (!confirm(`Hapus perangkat "${item.nama_perangkat || item.id_perangkat}"?`)) return;

    try {
      const { error } = await supabase
        .from('perangkat')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      toast.success('✅ Perangkat berhasil dihapus!');
      fetchPerangkat();
    } catch (error) {
      toast.error('❌ Gagal menghapus perangkat: ' + error.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-3 text-[11px]">
        {/* Search Bar and Add Button - sticky on mobile */}
        <div className="sticky top-0 z-10 lg:static bg-black/30 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none py-3 lg:py-0 shadow-none flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 border border-[#1a1a1a] rounded-md px-2 py-0.5">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search data perangkat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 bg-transparent border-none text-white focus:outline-none placeholder-gray-500 origin-left"
              style={{ fontFamily: "'Open Sans', sans-serif", fontSize: '12px', transform: 'scale(0.7)' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-gray-500 hover:text-white transition"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Desktop add button */}
          {canEdit && (
            <button
              onClick={() => {
                setShowAddForm(true);
                setAddStep(1);
              }}
              className="hidden lg:flex group items-center justify-center h-5 px-2 hover:px-3 bg-white hover:bg-gray-200 text-black rounded-md transition-all duration-300 ease-out overflow-hidden"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              <Hammer size={12} animateOnHover className="transition-all duration-300 group-hover:mr-1" />
              <span className="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 text-[10px] whitespace-nowrap transition-all duration-300 ease-out">
                Tambah Perangkat
              </span>
            </button>
          )}
        </div>


        {/* 2-STEP ADD FORM MODAL */}
        {showAddForm && (
          <div 
            className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto ${
              isAddFormClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseAddForm();
            }}
          >
            <div 
              className={`bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full max-h-[90vh] md:w-[480px] md:max-h-[90vh] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden ${
                isAddFormClosing ? 'modal-content-exit' : 'modal-content-enter'
              }`}
            >
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <div className="min-w-0">
                  <span className="font-bold text-white text-sm">Tambah Perangkat</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-yellow-300 text-xs">Step {addStep} of 2</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-xs text-gray-400">
                      {addStep === 1 ? 'Data Minimal' : 'Detail Perangkat'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCloseAddForm()}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                  title="Tutup"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto modern-scrollbar p-4">
                {/* STEP 1: Generate ID */}
                {addStep === 1 && (
                  <form id="step1Form" onSubmit={handleGenerateAndSave} className="space-y-4">
                    {/* 1. Jenis Perangkat */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Jenis Perangkat <span className="text-yellow-300">*</span>
                      </label>
                      <Select
                        value={step1Form.jenis_perangkat_kode}
                        onValueChange={(value) =>
                          setStep1Form({ ...step1Form, jenis_perangkat_kode: value })
                        }
                      >
                        <SelectTrigger className="w-full h-9 px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600">
                          <SelectValue placeholder="-- Pilih Jenis Perangkat --" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-950 border border-gray-800 text-white">
                          {jenisPerangkatList.map((jenis) => (
                            <SelectItem 
                              key={jenis.id} 
                              value={jenis.kode}
                              className="text-xs text-white focus:bg-gray-800 focus:text-white"
                            >
                              {jenis.kode} - {jenis.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 2. Serial Number */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Serial Number <span className="text-yellow-300">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={step1Form.serial_number}
                        onChange={(e) =>
                          setStep1Form({ ...step1Form, serial_number: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                        placeholder="Masukkan Serial Number"
                      />
                    </div>

                    {/* 3. Lokasi */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Lokasi <span className="text-yellow-300">*</span>
                      </label>
                      <Select
                        value={step1Form.lokasi_kode}
                        onValueChange={(value) =>
                          setStep1Form({ ...step1Form, lokasi_kode: value })
                        }
                      >
                        <SelectTrigger className="w-full h-9 px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600">
                          <SelectValue placeholder="-- Pilih Lokasi --" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-950 border border-gray-800 text-white">
                          {lokasiList.map((lok) => (
                            <SelectItem 
                              key={lok.id} 
                              value={lok.kode}
                              className="text-xs text-white focus:bg-gray-800 focus:text-white"
                            >
                              {lok.kode} - {lok.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </form>
                )}

                {/* STEP 2: Detail Form */}
                {addStep === 2 && (
                  <>
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 space-y-2">
                      <div>
                        <p className="text-xs text-gray-400 font-medium">ID Perangkat</p>
                        <p className="text-sm font-bold text-white">{generatedIdPerangkat}</p>
                      </div>
                      <div className="border-t border-gray-800 pt-2">
                        <p className="text-xs text-gray-400 font-medium">Nama Perangkat</p>
                        <p className="text-xs text-gray-300">{generatedNamaPerangkat}</p>
                      </div>
                    </div>
                    
                    <form id="step2Form" onSubmit={handleSaveDetail} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* 1. Jenis Barang */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Jenis Barang
                          </label>
                          <Select
                            value={step2Form.jenis_barang_id}
                            onValueChange={(value) =>
                              setStep2Form({ ...step2Form, jenis_barang_id: value })
                            }
                          >
                            <SelectTrigger className="w-full h-9 px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600">
                              <SelectValue placeholder="-- Pilih --" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-950 border border-gray-800 text-white">
                              {getFilteredJenisBarang(step1Form.jenis_perangkat_kode).map((jenis) => (
                                <SelectItem 
                                  key={jenis.id} 
                                  value={String(jenis.id)}
                                  className="text-xs text-white focus:bg-gray-800 focus:text-white"
                                >
                                  {jenis.nama}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 2. Merk */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Merk
                          </label>
                          <input
                            type="text"
                            value={step2Form.merk}
                            onChange={(e) => setStep2Form({ ...step2Form, merk: e.target.value })}
                            className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                            placeholder="Dell, HP, Lenovo, ..."
                          />
                        </div>

                        {/* 3. ID Remote Access */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            ID Remote Access
                          </label>
                          <input
                            type="text"
                            value={step2Form.id_remoteaccess}
                            onChange={(e) =>
                              setStep2Form({ ...step2Form, id_remoteaccess: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                            placeholder="AnyDesk / TeamViewer ID"
                          />
                        </div>

                        {/* 4. Spesifikasi Processor */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Processor
                          </label>
                          <input
                            type="text"
                            value={step2Form.spesifikasi_processor}
                            onChange={(e) =>
                              setStep2Form({ ...step2Form, spesifikasi_processor: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                            placeholder="Intel Core i5 Gen 10, ..."
                          />
                        </div>

                        {/* 5. Kapasitas RAM */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            RAM
                          </label>
                          <input
                            type="text"
                            value={step2Form.kapasitas_ram}
                            onChange={(e) =>
                              setStep2Form({ ...step2Form, kapasitas_ram: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                            placeholder="8GB, 16GB, ..."
                          />
                        </div>
                      </div>

                      {/* 6. Storage (Full Width) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">
                          Storage
                        </label>
                        <StorageInput
                          value={step2Form.storages}
                          onChange={(storages) =>
                            setStep2Form({ ...step2Form, storages })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* 8. MAC Ethernet */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            MAC Ethernet
                          </label>
                          <MACAddressInput
                            value={step2Form.mac_ethernet}
                            onChange={(value) =>
                              setStep2Form({ ...step2Form, mac_ethernet: value })
                            }
                            placeholder="00:00:00:00:00:00"
                          />
                        </div>

                        {/* 9. MAC Wireless */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            MAC Wireless
                          </label>
                          <MACAddressInput
                            value={step2Form.mac_wireless}
                            onChange={(value) =>
                              setStep2Form({ ...step2Form, mac_wireless: value })
                            }
                            placeholder="00:00:00:00:00:00"
                          />
                        </div>

                        {/* 10. IP Ethernet */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            IP Ethernet
                          </label>
                          <IPAddressInput
                            value={step2Form.ip_ethernet}
                            onChange={(value) =>
                              setStep2Form({ ...step2Form, ip_ethernet: value })
                            }
                            placeholder="192.168.1.100"
                          />
                        </div>

                        {/* 11. IP Wireless */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            IP Wireless
                          </label>
                          <IPAddressInput
                            value={step2Form.ip_wireless}
                            onChange={(value) =>
                              setStep2Form({ ...step2Form, ip_wireless: value })
                            }
                            placeholder="192.168.1.101"
                          />
                        </div>

                        {/* 12. SN Monitor */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            SN Monitor
                          </label>
                          <input
                            type="text"
                            value={step2Form.serial_number_monitor}
                            onChange={(e) =>
                              setStep2Form({ ...step2Form, serial_number_monitor: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                            placeholder="Serial Number Monitor"
                          />
                        </div>

                        {/* 13. Status Perangkat (Toggle) */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Status Perangkat
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setStep2Form({ ...step2Form, status_perangkat: true })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                step2Form.status_perangkat
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              Layak
                            </button>
                            <button
                              type="button"
                              onClick={() => setStep2Form({ ...step2Form, status_perangkat: false })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                !step2Form.status_perangkat
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              Rusak
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>

              {/* Fixed Footer - Action Buttons */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                <button
                  type="button"
                  onClick={() => handleCloseAddForm()}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Batal
                </button>
                {addStep === 1 ? (
                  <button
                    type="submit"
                    form="step1Form"
                    disabled={isSubmittingStep1}
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSubmittingStep1 ? (
                      <>
                        <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      'Generate ID'
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="step2Form"
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
                  >
                    Simpan
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DETAIL VIEW MODAL WITH TABS */}
        {viewingDetail && (
          <div 
            className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto ${
              isDetailClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
            }`}
            onClick={(e) => {
              // Close when clicking backdrop
              if (e.target === e.currentTarget) handleCloseDetail();
            }}
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
                      aria-label="Copy Nama Perangkat"
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
                      aria-label="Copy ID Perangkat"
                    >
                      <ClipboardDocumentIcon className="w-3 h-3" />
                    </button>
                    <span className="text-gray-600">•</span>
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
                  ×
                </button>
              </div>

              {/* Fixed Tabs - dashboard style */}
              <div className="flex-shrink-0 flex justify-center py-1">
                <Tabs value={detailTab} onValueChange={setDetailTab}>
                  <TabsList className="bg-transparent border border-zinc-800 rounded-sm h-auto p-0.5 gap-1">
                    <TabsTrigger
                      value="detail"
                      className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm"
                    >
                      Detail
                    </TabsTrigger>
                    <TabsTrigger
                      value="history"
                      className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm"
                    >
                      History Perbaikan
                    </TabsTrigger>
                    <TabsTrigger
                      value="mutasi"
                      className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm"
                    >
                      History Mutasi
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Scrollable Content Area - swipeable */}
              <div
                ref={swipeContentRef}
                className="flex-1 overflow-y-auto modern-scrollbar p-4"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
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
                            aria-label="Copy ID Remote Access"
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

                    {/* Tanggal Entry - always show */}
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
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
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
                            📊 Total: <span className="text-base font-bold text-cyan-400">{historyData.length}</span> kali diperbaiki
                          </p>
                        </div>

                        {historyData.map((history, index) => (
                          <div key={history.task_id} className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 hover:border-cyan-600 transition">
                            <div className="flex items-start justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-cyan-500">#{index + 1}</span>
                                <div>
                                  <p className="text-xs font-mono font-bold text-yellow-300">{history.task_number}</p>
                                </div>
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
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
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
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    Oleh: {mutasi.created_by_name}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">
                                #{mutasiHistory.length - index}
                              </span>
                            </div>

                            {/* Mutasi Info */}
                            <div className="mt-3 space-y-2">
                              {/* From */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Dari:</span>
                                <span className="text-red-400 font-medium">
                                  {mutasi.lokasi_lama_nama} ({mutasi.lokasi_lama_kode})
                                </span>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-400">
                                  {mutasi.nama_perangkat_lama}
                                </span>
                              </div>

                              {/* Arrow */}
                              <div className="text-center text-gray-600 text-xs">
                                ↓
                              </div>

                              {/* To */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">Ke:</span>
                                <span className="text-green-400 font-medium">
                                  {mutasi.lokasi_baru_nama} ({mutasi.lokasi_baru_kode})
                                </span>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-400">
                                  {mutasi.nama_perangkat_baru}
                                </span>
                              </div>

                              {/* Keterangan */}
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

              {/* Fixed Footer - Action Buttons */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black shadow-[0_-8px_20px_rgba(0,0,0,0.6)]">
                {canEdit && (
                  <button
                    onClick={() => {
                      handleEdit(viewingDetail);
                      handleCloseDetail();
                    }}
                    className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition flex items-center gap-1.5"
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                {canMutasi && (
                  <button
                    onClick={() => {
                      handleOpenMutasi(viewingDetail);
                      handleCloseDetail();
                    }}
                    className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition flex items-center gap-1.5"
                  >
                    <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                    Mutasi
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      handleDeletePerangkat(viewingDetail);
                      handleCloseDetail();
                    }}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition flex items-center gap-1.5"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* EDIT FORM MODAL */}
        {editingId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto modal-backdrop-enter">
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full max-h-[90vh] md:w-[480px] md:max-h-[90vh] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <div className="min-w-0">
                  <span className="font-bold text-white text-sm">Edit Perangkat</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{editForm.id_perangkat}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditForm({});
                    setOriginalLokasiKode(null);
                  }}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                  title="Tutup"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto modern-scrollbar p-4 compact-inputs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEdit();
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Nama Perangkat */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Nama Perangkat <span className="text-yellow-300">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled
                      value={editForm.nama_perangkat || ''}
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 opacity-50 cursor-not-allowed"
                      title="Nama perangkat otomatis diubah saat lokasi diubah"
                    />
                  </div>

                  {/* Serial Number */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Serial Number <span className="text-yellow-300">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.serial_number || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, serial_number: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    />
                  </div>

                  {/* Jenis Perangkat */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Jenis Perangkat <span className="text-yellow-300">*</span>
                    </label>
                    <select
                      required
                      disabled
                      value={editForm.jenis_perangkat_kode || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, jenis_perangkat_kode: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 opacity-50 cursor-not-allowed"
                      title="Jenis Perangkat tidak dapat diubah"
                    >
                      <option value="">-- Pilih Jenis Perangkat --</option>
                      {jenisPerangkatList.map((jenis) => (
                        <option key={jenis.kode} value={jenis.kode}>
                          {jenis.kode} - {jenis.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lokasi */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Lokasi <span className="text-yellow-300">*</span>
                    </label>
                    <select
                      required
                      value={editForm.lokasi_kode || ''}
                      onChange={(e) => {
                        const newLokasiKode = e.target.value;
                        const newNamaPerangkat = generateNamaPerangkat(newLokasiKode, editForm.id_perangkat);
                        setEditForm({ 
                          ...editForm, 
                          lokasi_kode: newLokasiKode,
                          nama_perangkat: newNamaPerangkat
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    >
                      <option value="">-- Pilih Lokasi --</option>
                      {lokasiList.map((lokasi) => (
                        <option key={lokasi.kode} value={lokasi.kode}>
                          {lokasi.kode} - {lokasi.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Jenis Barang */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Jenis Barang
                    </label>
                    <select
                      value={editForm.jenis_barang_id || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, jenis_barang_id: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    >
                      <option value="">-- Pilih Jenis Barang --</option>
                      {getFilteredJenisBarang(editForm.jenis_perangkat_kode).map((jenis) => (
                        <option key={jenis.id} value={jenis.id}>
                          {jenis.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Merk */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Merk
                    </label>
                    <input
                      type="text"
                      value={editForm.merk || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, merk: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    />
                  </div>

                  {/* ID Remote Access */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      ID Remote Access
                    </label>
                    <input
                      type="text"
                      value={editForm.id_remoteaccess || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, id_remoteaccess: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    />
                  </div>

                  {/* Processor */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Spesifikasi Processor
                    </label>
                    <input
                      type="text"
                      value={editForm.spesifikasi_processor || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, spesifikasi_processor: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    />
                  </div>

                  {/* RAM */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Kapasitas RAM
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 8GB"
                      value={editForm.kapasitas_ram || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, kapasitas_ram: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    />
                  </div>

                </div>

                {/* Storage (Full Width) */}
                <div className="col-span-full">
                  <label className="block text-[10px] font-medium text-gray-400 mb-1">
                    Storage (Opsional)
                  </label>
                  <StorageInput
                    value={editForm.storages || []}
                    onChange={(storages) =>
                      setEditForm({ ...editForm, storages })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  {/* MAC Ethernet */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      MAC Ethernet
                    </label>
                    <MACAddressInput
                      value={editForm.mac_ethernet || ''}
                      onChange={(value) =>
                        setEditForm({ ...editForm, mac_ethernet: value })
                      }
                      placeholder="00:00:00:00:00:00"
                    />
                  </div>

                  {/* MAC Wireless */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      MAC Wireless
                    </label>
                    <MACAddressInput
                      value={editForm.mac_wireless || ''}
                      onChange={(value) =>
                        setEditForm({ ...editForm, mac_wireless: value })
                      }
                      placeholder="00:00:00:00:00:00"
                    />
                  </div>

                  {/* IP Ethernet */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      IP Ethernet
                    </label>
                    <IPAddressInput
                      value={editForm.ip_ethernet || ''}
                      onChange={(value) =>
                        setEditForm({ ...editForm, ip_ethernet: value })
                      }
                      placeholder="192.168.1.100"
                    />
                  </div>

                  {/* IP Wireless */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      IP Wireless
                    </label>
                    <IPAddressInput
                      value={editForm.ip_wireless || ''}
                      onChange={(value) =>
                        setEditForm({ ...editForm, ip_wireless: value })
                      }
                      placeholder="192.168.1.100"
                    />
                  </div>

                  {/* Serial Number Monitor */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Serial Number Monitor
                    </label>
                    <input
                      type="text"
                      value={editForm.serial_number_monitor || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, serial_number_monitor: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    />
                  </div>

                  {/* Status Perangkat */}
                  <div>
                    <label className="block text-[10px] font-medium text-gray-400 mb-1">
                      Status Perangkat
                    </label>
                    <select
                      value={editForm.status_perangkat || 'layak'}
                      onChange={(e) =>
                        setEditForm({ ...editForm, status_perangkat: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    >
                      <option value="layak">Layak</option>
                      <option value="rusak">Tidak Layak (Rusak)</option>
                    </select>
                  </div>
                </div>
              </form>
              </div>

              {/* Fixed Footer - Action Buttons */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-end items-center gap-2 bg-black shadow-[0_-8px_20px_rgba(0,0,0,0.6)]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditForm({});
                    setOriginalLokasiKode(null);
                  }}
                  className="px-4 py-1.5 text-xs border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-500 transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MUTASI FORM MODAL */}
        {showMutasiModal && mutasiPerangkat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    🔄 Mutasi Perangkat
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Pindahkan perangkat ke lokasi lain
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseMutasi}
                  className="text-gray-400 hover:text-gray-600 transition text-2xl font-bold leading-none"
                  title="Tutup"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmitMutasi} className="space-y-5">
                {/* Current Info */}
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <p className="text-xs text-gray-500 mb-2">Perangkat Saat Ini</p>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {mutasiPerangkat.id_perangkat}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Nama:</span> {mutasiPerangkat.nama_perangkat}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Lokasi:</span>{' '}
                      {mutasiPerangkat.lokasi?.nama || mutasiPerangkat.lokasi_kode}
                    </p>
                  </div>
                </div>

                {/* Lokasi Baru */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lokasi Tujuan <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={mutasiForm.lokasi_baru_kode}
                    onChange={(e) => setMutasiForm({ ...mutasiForm, lokasi_baru_kode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">-- Pilih Lokasi Tujuan --</option>
                    {lokasiList
                      .filter((lok) => lok.kode !== mutasiPerangkat.lokasi_kode)
                      .map((lokasi) => (
                        <option key={lokasi.kode} value={lokasi.kode}>
                          {lokasi.kode} - {lokasi.nama}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Preview Nama Baru */}
                {mutasiForm.lokasi_baru_kode && (
                  <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                    <p className="text-xs text-green-700 mb-2">Preview Setelah Mutasi</p>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">ID Perangkat:</span>{' '}
                        <span className="text-blue-600">{mutasiPerangkat.id_perangkat}</span>
                        {' '}(tetap)
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Nama Baru:</span>{' '}
                        <span className="text-green-600 font-semibold">{getPreviewNamaPerangkat()}</span>
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Lokasi Baru:</span>{' '}
                        {lokasiList.find((l) => l.kode === mutasiForm.lokasi_baru_kode)?.nama}
                      </p>
                    </div>
                  </div>
                )}

                {/* Keterangan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keterangan (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    value={mutasiForm.keterangan}
                    onChange={(e) => setMutasiForm({ ...mutasiForm, keterangan: e.target.value })}
                    placeholder="Alasan mutasi perangkat..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleCloseMutasi}
                    disabled={loadingMutasi}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loadingMutasi || !mutasiForm.lokasi_baru_kode}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingMutasi ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        <span>Mutasi Perangkat</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* Table - Desktop View */}
        <div className="bg-transparent rounded-md overflow-hidden">
          {loading ? (
            <>
              {/* Desktop Skeleton */}
              <div className="hidden lg:block">
                <table className="min-w-full" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  <thead className="bg-transparent">
                    <tr>
                      {['ID Perangkat','Nama Perangkat','ID Remote','Tanggal Entry','Petugas','Jenis Perangkat','Jenis Barang','Status'].map((h) => (
                        <th key={h} className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-3 py-3">
                            <div className="h-4 bg-[#1a1a1a] rounded animate-pulse" style={{ width: j === 1 ? '120px' : j === 7 ? '24px' : '80px', margin: '0 auto' }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Skeleton */}
              <div className="lg:hidden divide-y divide-[#1a1a1a]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-36 bg-[#1a1a1a] rounded animate-pulse" />
                      <div className="h-3.5 w-20 bg-[#1a1a1a] rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-24 bg-[#1a1a1a] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
          <div className="hidden lg:flex lg:justify-center overflow-x-auto">
            <table className="w-auto" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              <thead className="bg-transparent">
                <tr>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    ID Perangkat
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Nama Perangkat
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    ID Remote
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Tanggal Entry
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Petugas
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Jenis Perangkat
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Jenis Barang
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-[#1a1a1a]">
                {paginatedPerangkat.map((item) => (
                  <tr key={item.id} className="group hover:bg-[#262626] transition-colors">
                    <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetail(item)}
                        className="text-white font-bold hover:text-gray-300 transition-colors cursor-pointer"
                        title="Lihat detail & history"
                      >
                        {item.id_perangkat}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-white whitespace-nowrap">{item.nama_perangkat}</td>
                    <td className="px-3 py-2 text-center text-xs text-white whitespace-nowrap">
                      {item.id_remoteaccess || '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-white whitespace-nowrap">
                      {formatDate(item.tanggal_entry)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-white whitespace-nowrap">
                      {item.petugas?.full_name || '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-white whitespace-nowrap">
                      {item.jenis_perangkat?.nama || '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-white whitespace-nowrap">
                      {item.jenis_barang?.nama || '-'}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {item.status_perangkat === 'layak' ? (
                        <CheckBadgeIcon className="w-5 h-5 text-blue-400 mx-auto" />
                      ) : item.status_perangkat === 'rusak' ? (
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mx-auto" />
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View - Card */}
          <div className="lg:hidden divide-y divide-[#1a1a1a]" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            {paginatedPerangkat.map((item) => (
              <div 
                key={item.id} 
                className="px-3 py-1.5 hover:bg-[#262626] transition-colors cursor-pointer"
                onClick={() => handleViewDetail(item)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-xs">{item.nama_perangkat}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500">{formatDate(item.tanggal_entry)}</span>
                    {item.status_perangkat === 'layak' ? (
                      <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-400" />
                    ) : item.status_perangkat === 'rusak' ? (
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500" />
                    ) : null}
                  </div>
                </div>
                <div className="text-gray-500">
                  {item.jenis_barang?.nama || '-'}
                </div>
              </div>
            ))}
          </div>
            </>
          )}


          {!loading && filteredPerangkat.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">Tidak ada data ditemukan</p>
            </div>
          )}
        </div>

        {/* Pagination Controls - fixed bottom bar on mobile, static on desktop */}
        {filteredPerangkat.length > 0 && (
          <div className="fixed bottom-14 left-0 right-0 z-10 lg:static bg-black/40 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none border-t border-white/5 lg:border-none py-2 lg:py-0 px-4 lg:px-0 flex items-center justify-center gap-3 lg:gap-6">
            {/* Items per page dropdown */}
            <Select value={String(itemsPerPage)} onValueChange={(val) => handleItemsPerPageChange(val)}>
              <SelectTrigger className="w-auto h-auto px-2 py-0.5 text-xs bg-transparent border border-[#1a1a1a] text-gray-400 rounded-md gap-1 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-950 border border-gray-800 text-white min-w-0">
                {['10', '25', '50', '100', 'all'].map((val) => (
                  <SelectItem key={val} value={val} className="text-xs text-white focus:bg-gray-800 focus:text-white">
                    {val === 'all' ? 'All' : val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Page Numbers - only when paginated */}
            {!isShowingAll && totalPages > 1 && (
              <div className="flex items-center space-x-0.5">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-1 py-0.5 transition ${
                    currentPage === 1
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center space-x-0.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-1.5 py-0.5 text-xs transition ${
                            currentPage === page
                              ? 'text-white'
                              : 'text-gray-500 hover:text-white'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return (
                        <span key={page} className="text-gray-600 px-0.5 text-xs">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                className={`px-1 py-0.5 transition ${
                  currentPage === totalPages
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile FAB - Floating Add Button above bottom bar */}
        {canEdit && (
          <button
            onClick={() => {
              setShowAddForm(true);
              setAddStep(1);
            }}
            className="lg:hidden fixed right-5 bottom-[7.5rem] z-50 flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 shadow-lg shadow-black/20 active:scale-95 transition-transform"
            aria-label="Tambah Perangkat"
          >
            <span className="text-xs font-semibold text-white/80 leading-tight">New Data</span>
            <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}
      </div>
    </Layout>
  );
};

export default StokOpnam;
