import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { TagIcon, UserIcon, ClockIcon, CheckCircleIcon, CalendarIcon, PlayIcon, PauseIcon, HandThumbUpIcon } from '@heroicons/react/16/solid';

const DaftarTugas = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [activeTab, setActiveTab] = useState('in_progress');
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [isCompleteClosing, setIsCompleteClosing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState({});
  const timerIntervalRef = useRef({});

  useEffect(() => {
    if (user?.id) {
      fetchTasks();
    }
    
    // Cleanup timers on unmount
    return () => {
      Object.values(timerIntervalRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [user?.id]);

  // Force refresh when component mounts or user changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        fetchTasks();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id]);

  useEffect(() => {
    // Update timers for tasks in progress or paused (use user_status)
    tasks.forEach(task => {
      if (task.user_status === 'in_progress' || task.user_status === 'paused') {
        startTimer(task.id, task.started_at, task.user_work_duration);
      }
    });
  }, [tasks]);

  // ESC key handler for modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showDetailModal && !isDetailClosing) {
          handleCloseDetail();
        } else if (showCompleteModal && !isCompleteClosing) {
          handleCloseComplete();
        }
      }
    };

    if (showDetailModal || showCompleteModal) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [showDetailModal, showCompleteModal, isDetailClosing, isCompleteClosing]);

  const fetchTasks = async () => {
    if (!user?.id) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get tasks where current user is assigned (active assignments)
      // Use .abortSignal to prevent caching
      const { data: userAssignments, error: assignError } = await supabase
        .from('task_assignment_users')
        .select('task_assignment_id, status, work_duration_minutes, completed_at, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Verify user_id matches
      const wrongUserIds = userAssignments?.filter(a => a.user_id !== user.id) || [];
      if (wrongUserIds.length > 0) {
        console.error('❌ MISMATCH: Found assignments with wrong user_id!', wrongUserIds);
      }

      if (assignError) {
        console.error('[DaftarTugas] Error fetching user assignments:', assignError);
        throw assignError;
      }

      // Also fetch scheduled tasks assigned to this user (pre-assignment visibility)
      // Query from task_schedules (more reliable relationship shape)
      const { data: scheduledRows, error: scheduledError } = await supabase
        .from('task_schedules')
        .select(`
          id,
          status,
          scheduled_for,
          task_assignment_id,
          task_schedule_users!inner(user_id)
        `)
        .eq('task_schedule_users.user_id', user.id)
        .eq('status', 'scheduled');

      if (scheduledError) {
        console.warn('[DaftarTugas] Error fetching scheduled tasks (may be RLS):', scheduledError);
      }

      const scheduledTaskIds = (scheduledRows || [])
        .map(r => r.task_assignment_id)
        .filter(Boolean);

      const activeTaskIds = (userAssignments || []).map(a => a.task_assignment_id);
      const taskIds = [...new Set([...activeTaskIds, ...scheduledTaskIds])];

      if (taskIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Get task details with related data
      // IMPORTANT: Use explicit select to avoid any caching issues
      const { data: tasksData, error: tasksError } = await supabase
        .from('task_assignments')
        .select(`
          id,
          task_number,
          title,
          description,
          priority,
          status,
          skp_category_id,
          assigned_by,
          assigned_at,
          completed_at,
          total_duration_minutes,
          created_at,
          updated_at,
          skp_category:skp_categories(code, name),
          assigned_by_user:profiles!task_assignments_assigned_by_fkey(full_name, email)
        `)
        .in('id', taskIds)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error('[DaftarTugas] Error fetching task details:', tasksError);
        throw tasksError;
      }

      // Merge user status and duration
      const tasksWithUserData = tasksData.map(task => {
        const userAssignment = userAssignments.find(a => a.task_assignment_id === task.id);
        const scheduledRow = (scheduledRows || []).find(r => r.task_assignment_id === task.id);
        const isScheduledVisible = !!scheduledRow;

        return {
          ...task,
          user_status: userAssignment?.status || (isScheduledVisible ? 'scheduled' : 'pending'),
          user_work_duration: userAssignment?.work_duration_minutes || 0,
          // If task.completed_at is not set but user assignment is completed, use user's completed_at
          completed_at: task.completed_at || userAssignment?.completed_at || null,
          scheduled_for: scheduledRow?.scheduled_for || null,
        };
      });

      setTasks(tasksWithUserData);
    } catch (error) {
      console.error('[DaftarTugas] Error fetching tasks:', error.message);
      toast({ title: 'Gagal memuat tugas: ' + error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const startTimer = (taskId, startedAt, initialMinutes = 0) => {
    // Clear existing timer if any
    if (timerIntervalRef.current[taskId]) {
      clearInterval(timerIntervalRef.current[taskId]);
    }

    if (startedAt) {
      const startTime = new Date(startedAt).getTime();
      
      timerIntervalRef.current[taskId] = setInterval(() => {
        const now = Date.now();
        const diffMs = now - startTime;
        const minutes = Math.floor(diffMs / 60000) + initialMinutes;
        
        setElapsedTime(prev => ({
          ...prev,
          [taskId]: minutes
        }));
      }, 1000);
    }
  };

  const stopTimer = (taskId) => {
    if (timerIntervalRef.current[taskId]) {
      clearInterval(timerIntervalRef.current[taskId]);
      delete timerIntervalRef.current[taskId];
    }
  };

  const handleAcknowledge = async (task) => {
    if (!confirm('Konfirmasi bahwa Anda bisa mengerjakan tugas ini?')) return;

    try {
      const now = new Date().toISOString();
      
      // Update user assignment status
      const { error: updateError } = await supabase
        .from('task_assignment_users')
        .update({
          status: 'acknowledged',
          acknowledged_at: now,
        })
        .eq('task_assignment_id', task.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Log the action
      const { error: logError } = await supabase
        .from('task_time_logs')
        .insert([{
          task_id: task.id,
          action: 'acknowledge',
          created_by: user.id,
        }]);

      if (logError) throw logError;

      toast({ title: 'Tugas berhasil dikonfirmasi!', variant: 'success' });
      fetchTasks();
    } catch (error) {
      toast({ title: 'Gagal konfirmasi tugas: ' + error.message, variant: 'destructive' });
    }
  };

  const handleStart = async (task) => {
    try {
      const now = new Date().toISOString();
      
      // Update user assignment status
      const { error: updateError } = await supabase
        .from('task_assignment_users')
        .update({
          status: 'in_progress',
          started_at: task.started_at || now, // Keep original start time if resuming
        })
        .eq('task_assignment_id', task.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Log the action
      const { error: logError } = await supabase
        .from('task_time_logs')
        .insert([{
          task_id: task.id,
          action: task.started_at ? 'resume' : 'start',
          created_by: user.id,
        }]);

      if (logError) throw logError;

      toast({ title: task.started_at ? 'Tugas dilanjutkan!' : 'Tugas dimulai!', variant: 'success' });
      fetchTasks();
    } catch (error) {
      toast({ title: 'Gagal memulai tugas: ' + error.message, variant: 'destructive' });
    }
  };

  const handlePause = async (task) => {
    try {
      // Calculate current duration
      const startTime = new Date(task.started_at).getTime();
      const now = Date.now();
      const additionalMinutes = Math.floor((now - startTime) / 60000);
      const totalMinutes = task.user_work_duration + additionalMinutes;

      // Update user assignment status
      const { error: updateError } = await supabase
        .from('task_assignment_users')
        .update({
          status: 'paused',
          work_duration_minutes: totalMinutes,
        })
        .eq('task_assignment_id', task.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Log the action
      const { error: logError } = await supabase
        .from('task_time_logs')
        .insert([{
          task_id: task.id,
          action: 'pause',
          created_by: user.id,
        }]);

      if (logError) throw logError;

      stopTimer(task.id);
      toast({ title: 'Tugas di-pause!', variant: 'info' });
      fetchTasks();
    } catch (error) {
      toast({ title: 'Gagal pause tugas: ' + error.message, variant: 'destructive' });
    }
  };

  const handleCompleteClick = (task) => {
    setSelectedTask(task);
    setCompletionNotes('');
    setShowCompleteModal(true);
  };

  const handleComplete = async () => {
    if (!selectedTask) return;

    try {
      const now = new Date().toISOString();
      
      // Calculate final duration
      let totalMinutes = selectedTask.user_work_duration;
      if (selectedTask.started_at && (selectedTask.user_status === 'in_progress' || selectedTask.user_status === 'paused')) {
        const startTime = new Date(selectedTask.started_at).getTime();
        const nowTime = Date.now();
        const additionalMinutes = Math.floor((nowTime - startTime) / 60000);
        totalMinutes += additionalMinutes;
      }

      // Update user assignment status
      const { error: updateError } = await supabase
        .from('task_assignment_users')
        .update({
          status: 'completed',
          completed_at: now,
          work_duration_minutes: totalMinutes,
          notes: completionNotes,
        })
        .eq('task_assignment_id', selectedTask.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Log the action
      const { error: logError } = await supabase
        .from('task_time_logs')
        .insert([{
          task_id: selectedTask.id,
          action: 'complete',
          notes: completionNotes,
          created_by: user.id,
        }]);

      if (logError) throw logError;

      stopTimer(selectedTask.id);
      toast({ title: 'Tugas selesai!', variant: 'success' });
      setShowCompleteModal(false);
      setSelectedTask(null);
      setCompletionNotes('');
      // Refresh to show updated status (trigger will update task_assignments.status)
      fetchTasks();
    } catch (error) {
      toast({ title: 'Gagal menyelesaikan tugas: ' + error.message, variant: 'destructive' });
    }
  };

  const handleViewDetail = async (task) => {
    try {
      // Fetch time logs and full task data with duration
      const [logsResult, taskResult] = await Promise.all([
        supabase
          .from('task_time_logs')
          .select('*')
          .eq('task_id', task.id)
          .order('timestamp', { ascending: true }),
        supabase
          .from('task_assignments')
          .select('total_duration_minutes, assigned_at, completed_at, status')
          .eq('id', task.id)
          .single()
      ]);

      if (logsResult.error) throw logsResult.error;
      if (taskResult.error) throw taskResult.error;

      // Merge the fetched task data with duration into the selected task
      setSelectedTask({ 
        ...task, 
        ...taskResult.data,
        time_logs: logsResult.data 
      });
      setShowDetailModal(true);
    } catch (error) {
      toast({ title: 'Gagal memuat detail: ' + error.message, variant: 'destructive' });
    }
  };

  const handleCloseDetail = () => {
    setIsDetailClosing(true);
    setTimeout(() => {
      setShowDetailModal(false);
      setSelectedTask(null);
      setIsDetailClosing(false);
    }, 150);
  };

  const handleCloseComplete = () => {
    setIsCompleteClosing(true);
    setTimeout(() => {
      setShowCompleteModal(false);
      setSelectedTask(null);
      setCompletionNotes('');
      setIsCompleteClosing(false);
    }, 150);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
      acknowledged: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      in_progress: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      paused: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
      completed: 'border-green-500/30 bg-green-500/10 text-green-400',
      cancelled: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
      scheduled: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    };

    const labels = {
      pending: 'Baru',
      acknowledged: 'Dikonfirmasi',
      in_progress: 'Dikerjakan',
      paused: 'Tertunda',
      completed: 'Selesai',
      cancelled: 'Dibatalkan',
      scheduled: 'Terjadwal',
    };

    return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[status] || ''}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
      normal: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      high: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
      urgent: 'border-red-500/30 bg-red-500/10 text-red-400',
    };

    const labels = {
      low: 'Rendah',
      normal: 'Normal',
      high: 'Tinggi',
      urgent: 'Mendesak',
    };

    return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[priority] || ''}`}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 menit';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} jam ${mins} menit`;
    }
    return `${mins} menit`;
  };

  const getActionLabel = (action) => {
    const labels = {
      acknowledge: 'Dikonfirmasi',
      start: 'Mulai Kerja',
      pause: 'Pause',
      resume: 'Lanjut Kerja',
      complete: 'Selesai',
    };
    return labels[action] || action;
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-3 text-[11px]" style={{ fontFamily: "'Open Sans', sans-serif" }}>
          {/* Tabs Skeleton */}
          <div className="flex justify-center py-1">
            <div className="flex gap-1 border border-zinc-800 rounded-sm p-0.5">
              <div className="h-7 w-24 bg-zinc-800 rounded-sm animate-pulse" />
              <div className="h-7 w-20 bg-[#1a1a1a] rounded-sm animate-pulse" />
              <div className="h-7 w-22 bg-[#1a1a1a] rounded-sm animate-pulse" />
            </div>
          </div>

          {/* Task Cards Skeleton */}
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-black border border-[#1a1a1a] rounded-lg px-2.5 pt-2.5 pb-2"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Task number + badges */}
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-16 bg-[#1a1a1a] rounded animate-pulse" />
                      <div className="h-4 w-12 bg-[#1a1a1a] rounded-full animate-pulse" />
                      <div className="h-4 w-16 bg-[#1a1a1a] rounded-full animate-pulse" />
                    </div>

                    {/* Title */}
                    <div className="h-3 bg-[#1a1a1a] rounded animate-pulse" style={{ width: `${65 + i * 8}%` }} />

                    {/* Metadata row */}
                    <div className="flex flex-wrap gap-2.5">
                      <div className="h-2.5 w-20 bg-[#1a1a1a] rounded animate-pulse" />
                      <div className="h-2.5 w-24 bg-[#1a1a1a] rounded animate-pulse" />
                      <div className="h-2.5 w-28 bg-[#1a1a1a] rounded animate-pulse" />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2.5">
                    <div className="h-7 w-20 bg-[#1a1a1a] rounded-lg animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-3 text-[11px]" style={{ fontFamily: "'Open Sans', sans-serif" }}>
        {/* Detail Modal */}
        {showDetailModal && selectedTask && (
          <div
            className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto ${
              isDetailClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseDetail();
            }}
          >
            <div
              className={`bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full h-[60vh] md:w-[504px] md:h-[350px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden ${
                isDetailClosing ? 'modal-content-exit' : 'modal-content-enter'
              }`}
            >
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <div className="min-w-0">
                  <span className="font-bold text-white text-sm">Detail Tugas</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white font-bold text-xs font-mono">{selectedTask.task_number}</span>
                    <span className="text-gray-600">•</span>
                    {getStatusBadge(selectedTask.status)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                  title="Tutup"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto modern-scrollbar p-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-gray-100 text-xs">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Judul</p>
                    <p className="text-xs font-semibold text-white">{selectedTask.title}</p>
                  </div>

                  {selectedTask.description && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Deskripsi</p>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{selectedTask.description}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Kategori SKP</p>
                    <p className="text-xs">{selectedTask.skp_category?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Prioritas</p>
                    <div>{getPriorityBadge(selectedTask.priority)}</div>
                  </div>

                  {selectedTask.assigned_by_user && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Dari (Penugas)</p>
                      <p className="text-xs">{selectedTask.assigned_by_user?.full_name || selectedTask.assigned_by_user?.name}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Dibuat</p>
                    <p className="text-xs">{formatDate(selectedTask.created_at)}</p>
                  </div>

                  {selectedTask.status === 'scheduled' && selectedTask.scheduled_for && (
                    <div className="col-span-2 bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                      <p className="text-xs text-gray-300">
                        ⏰ Dijadwalkan: <span className="font-mono font-semibold text-white">{formatDate(selectedTask.scheduled_for)}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Tombol konfirmasi/mulai muncul setelah waktu jadwal tiba.
                      </p>
                    </div>
                  )}

                  {selectedTask.acknowledged_at && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Waktu Tanggapan</p>
                      <p className="text-xs">{formatDate(selectedTask.acknowledged_at)}</p>
                    </div>
                  )}

                  {selectedTask.started_at && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Waktu Mulai</p>
                      <p className="text-xs">{formatDate(selectedTask.started_at)}</p>
                    </div>
                  )}

                  {selectedTask.completed_at && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Waktu Selesai</p>
                      <p className="text-xs">{formatDate(selectedTask.completed_at)}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Total Durasi</p>
                    <p className="text-xs font-bold text-green-400">
                      {(() => {
                        if (selectedTask.total_duration_minutes && selectedTask.total_duration_minutes > 0) {
                          return formatDuration(selectedTask.total_duration_minutes);
                        } else if (selectedTask.assigned_at && selectedTask.completed_at) {
                          const assignedTime = new Date(selectedTask.assigned_at);
                          const completedTime = new Date(selectedTask.completed_at);
                          const diffMs = completedTime.getTime() - assignedTime.getTime();
                          const minutes = Math.floor(diffMs / 60000);
                          return formatDuration(minutes > 0 ? minutes : 0);
                        } else if (selectedTask.assigned_at && selectedTask.user_status === 'completed') {
                          const assignedTime = new Date(selectedTask.assigned_at);
                          const now = new Date();
                          const diffMs = now.getTime() - assignedTime.getTime();
                          const minutes = Math.floor(diffMs / 60000);
                          return formatDuration(minutes > 0 ? minutes : 0);
                        }
                        return '0 menit';
                      })()}
                    </p>
                  </div>

                  {selectedTask.completion_notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Catatan Penyelesaian</p>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{selectedTask.completion_notes}</p>
                    </div>
                  )}
                </div>

                {/* Time Logs */}
                {selectedTask.time_logs && selectedTask.time_logs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-white mb-2">Riwayat Aktivitas</p>
                    <div className="space-y-1.5">
                      {selectedTask.time_logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2.5 py-1.5">
                          <div className="text-xs text-gray-500 w-4 text-center">
                            {log.action === 'acknowledge' && '✅'}
                            {log.action === 'start' && '▶️'}
                            {log.action === 'pause' && '⏸️'}
                            {log.action === 'resume' && '▶️'}
                            {log.action === 'complete' && '✔️'}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-white">{getActionLabel(log.action)}</p>
                            <p className="text-xs text-gray-500">{formatDate(log.timestamp)}</p>
                            {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                <button
                  onClick={handleCloseDetail}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Modal */}
        {showCompleteModal && selectedTask && (
          <div
            className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 ${
              isCompleteClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseComplete();
            }}
          >
            <div
              className={`bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full md:w-[420px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden ${
                isCompleteClosing ? 'modal-content-exit' : 'modal-content-enter'
              }`}
            >
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <div className="min-w-0">
                  <span className="font-bold text-white text-sm">Selesaikan Tugas</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white font-bold text-xs font-mono">{selectedTask.task_number}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseComplete}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                  title="Tutup"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto modern-scrollbar p-4 space-y-4">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-300">{selectedTask.title}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Catatan Penyelesaian (opsional)
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="w-full px-3 py-2 text-[10px] bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    placeholder="Hasil pekerjaan, catatan tambahan..."
                    rows="4"
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                <button
                  onClick={handleCloseComplete}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleComplete}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
                >
                  ✔️ Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex justify-center py-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent border border-zinc-800 rounded-sm h-auto p-0.5 gap-1">
              <TabsTrigger
                value="in_progress"
                className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm"
              >
                In Progress
                {tasks.filter(t => ['pending', 'acknowledged', 'in_progress', 'paused'].includes(t.user_status)).length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                    {tasks.filter(t => ['pending', 'acknowledged', 'in_progress', 'paused'].includes(t.user_status)).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="riwayat"
                className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm"
              >
                Riwayat
                {tasks.filter(t => t.user_status === 'completed').length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                    {tasks.filter(t => t.user_status === 'completed').length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="scheduled"
                className="text-xs py-1.5 px-3 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none text-zinc-500 rounded-sm"
              >
                Scheduled
                {tasks.filter(t => t.user_status === 'scheduled').length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                    {tasks.filter(t => t.user_status === 'scheduled').length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {tasks
            .filter((task) => {
              if (activeTab === 'in_progress') return ['pending', 'acknowledged', 'in_progress', 'paused'].includes(task.user_status);
              if (activeTab === 'riwayat') return task.user_status === 'completed';
              if (activeTab === 'scheduled') return task.user_status === 'scheduled';
              return false;
            })
            .map((task) => (
              <div
                key={task.id}
                className="bg-black border border-[#1a1a1a] rounded-lg px-2.5 pt-2.5 pb-2 hover:border-gray-800 transition font-['Open_Sans'] cursor-pointer"
                onClick={(e) => {
                  if (e.target.closest('button')) return;
                  handleViewDetail(task);
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{task.task_number}</span>
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.user_status)}
                    </div>

                    <p className="text-xs font-bold text-white truncate">{task.title}</p>

                    <div className="flex flex-wrap gap-2.5 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><TagIcon className="w-3 h-3" />{task.skp_category?.name}</span>
                      {task.assigned_by_user && (
                        <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" />{task.assigned_by_user?.full_name || task.assigned_by_user?.name}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><ClockIcon className="w-3 h-3" />{formatDate(task.created_at)}</span>
                      {task.completed_at && (
                        <span className="inline-flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" />{formatDate(task.completed_at)}</span>
                      )}
                      {task.scheduled_for && activeTab === 'scheduled' && (
                        <span className="inline-flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{formatDate(task.scheduled_for)}</span>
                      )}
                    </div>

                    {(task.user_status === 'in_progress' || task.user_status === 'paused') && (
                      <span className="text-xs font-bold text-purple-400 inline-flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />{formatDuration(elapsedTime[task.id] || task.user_work_duration)}
                      </span>
                    )}

                    {task.user_status === 'completed' && (
                      <span className="text-xs font-bold text-green-400 inline-flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />Durasi: {(() => {
                          if (task.total_duration_minutes && task.total_duration_minutes > 0) {
                            return formatDuration(task.total_duration_minutes);
                          } else if (task.assigned_at && task.completed_at) {
                            const assignedTime = new Date(task.assigned_at);
                            const completedTime = new Date(task.completed_at);
                            const diffMs = completedTime.getTime() - assignedTime.getTime();
                            const minutes = Math.floor(diffMs / 60000);
                            return formatDuration(minutes > 0 ? minutes : 0);
                          }
                          return formatDuration(task.user_work_duration || 0);
                        })()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {task.user_status === 'pending' && task.status !== 'scheduled' && (
                      <button
                        onClick={() => handleAcknowledge(task)}
                        className="px-2.5 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition inline-flex items-center gap-1"
                      >
                        <HandThumbUpIcon className="w-3 h-3" />Konfirmasi
                      </button>
                    )}

                    {(task.user_status === 'acknowledged' || task.user_status === 'paused') && task.status !== 'scheduled' && (
                      <button
                        onClick={() => handleStart(task)}
                        className="px-2.5 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition inline-flex items-center gap-1"
                      >
                        <PlayIcon className="w-3 h-3" />{task.user_status === 'paused' ? 'Lanjut' : 'Mulai'}
                      </button>
                    )}

                    {task.user_status === 'in_progress' && task.status !== 'scheduled' && (
                      <>
                        <button
                          onClick={() => handlePause(task)}
                          className="px-2.5 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition inline-flex items-center gap-1"
                        >
                          <PauseIcon className="w-3 h-3" />Pause
                        </button>
                        <button
                          onClick={() => handleCompleteClick(task)}
                          className="px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition inline-flex items-center gap-1"
                        >
                          <CheckCircleIcon className="w-3 h-3" />Selesai
                        </button>
                      </>
                    )}

                    {task.user_status === 'paused' && task.status !== 'scheduled' && (
                      <button
                        onClick={() => handleCompleteClick(task)}
                        className="px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition inline-flex items-center gap-1"
                      >
                        <CheckCircleIcon className="w-3 h-3" />Selesai
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

          {tasks.filter((task) => {
            if (activeTab === 'in_progress') return ['pending', 'acknowledged', 'in_progress', 'paused'].includes(task.user_status);
            if (activeTab === 'riwayat') return task.user_status === 'completed';
            if (activeTab === 'scheduled') return task.user_status === 'scheduled';
            return false;
          }).length === 0 && (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-xs text-gray-500">
                {activeTab === 'in_progress' && 'Tidak ada tugas yang sedang dikerjakan'}
                {activeTab === 'riwayat' && 'Belum ada riwayat tugas selesai'}
                {activeTab === 'scheduled' && 'Tidak ada tugas terjadwal'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DaftarTugas;
