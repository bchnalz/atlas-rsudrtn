import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';
import { TagIcon, UserIcon, ClockIcon, CheckCircleIcon, CalendarIcon } from '@heroicons/react/16/solid';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getPagePermissions } from '../lib/pagePermissions';
import { Badge } from '../components/ui/badge';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';

const Penugasan = () => {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [permissions, setPermissions] = useState({
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false
  });
  const [tasks, setTasks] = useState([]);
  const [heldTasks, setHeldTasks] = useState([]);
  const [availableITSupport, setAvailableITSupport] = useState([]);
  const [allITSupport, setAllITSupport] = useState([]); // All IT Support with active tasks info
  const [skpCategories, setSkpCategories] = useState([]);
  const [filteredSkpCategories, setFilteredSkpCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCategory, setUserCategory] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedHeldTask, setSelectedHeldTask] = useState(null);
  const [waitingTime, setWaitingTime] = useState({});
  const timerIntervalRef = useRef({});
  
  // NEW: Detail & Delete modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
    skp_category_id: '',
    relate_perangkat: true,
    assigned_perangkat: [],
  });
  
  // NEW: Deletion history modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [deletionHistory, setDeletionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Export modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('month'); // 'month' or 'daterange'
  const [exportMonth, setExportMonth] = useState('');
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  
  // Prevent double submission
  const [submitting, setSubmitting] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
    skp_category_id: '',
    assigned_users: [], // Changed from assigned_to to array
    relate_perangkat: true, // Allow tasks without perangkat relation
    assigned_perangkat: [], // Array of selected devices (optional)
  });

  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
    skp_category_id: '',
    assigned_users: [],
    scheduled_date: '',
    scheduled_hour: '',
    scheduled_minute: '',
    relate_perangkat: true,
    assigned_perangkat: [],
  });

  // NEW: State for device search
  const [perangkatList, setPerangkatList] = useState([]);
  const [perangkatSearch, setPerangkatSearch] = useState('');

  useEffect(() => {
    // Fetch user category first, then fetch tasks and other data
    // This ensures userCategory is set before fetchTasks() runs
    const initializeData = async () => {
      if (!profile?.id) return;
      
      // First, fetch user category and wait for it to complete
      const categoryName = await fetchUserCategory();
      
      // Then fetch all other data (pass categoryName directly to avoid state timing issues)
      checkPermissions();
      fetchTasks(categoryName);
      fetchHeldTasks(categoryName);
      fetchAvailableITSupport();
      fetchSKPCategories();
      fetchPerangkat();
    };
    
    initializeData();
    
    // Cleanup timers on unmount
    return () => {
      Object.values(timerIntervalRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [profile?.id]); // Run when profile.id changes

  const fetchUserCategory = async () => {
    if (!profile?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_category:user_categories!user_category_id(name)')
        .eq('id', profile.id)
        .single();
      
      if (error) throw error;
      const categoryName = data?.user_category?.name;
      setUserCategory(categoryName);
      return categoryName;
    } catch (error) {
      console.error('Error fetching user category:', error);
      return null;
    }
  };

  const checkPermissions = async () => {
    if (profile?.role === 'administrator') {
      // Administrator has all permissions
      setPermissions({
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true
      });
    } else if (profile?.user_category_id) {
      // Check category permissions
      const perms = await getPagePermissions(
        profile.user_category_id,
        '/log-penugasan/penugasan'
      );
      setPermissions(perms);
    } else {
      // No category = no permissions
      setPermissions({
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false
      });
    }
  };

  useEffect(() => {
    // Start timers for held tasks
    heldTasks.forEach(task => {
      startWaitingTimer(task.id, task.created_at);
    });
  }, [heldTasks]);

  // ESC key handler for modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showAddForm) {
          setShowAddForm(false);
          setForm({
            title: '',
            description: '',
            priority: 'normal',
            skp_category_id: '',
            assigned_users: [],
            relate_perangkat: true,
            assigned_perangkat: [],
          });
        } else if (showScheduleModal) {
          setShowScheduleModal(false);
          setScheduleForm({
            title: '',
            description: '',
            priority: 'normal',
            skp_category_id: '',
            assigned_users: [],
            scheduled_date: '',
            scheduled_hour: '',
            scheduled_minute: '',
            relate_perangkat: true,
            assigned_perangkat: [],
          });
        } else if (showAssignModal) {
          setShowAssignModal(false);
          setSelectedHeldTask(null);
        } else if (showDetailModal) {
          setShowDetailModal(false);
          setSelectedTask(null);
        } else if (showDeleteModal) {
          setShowDeleteModal(false);
          setSelectedTask(null);
          setDeletionReason('');
        } else if (showEditModal) {
          setShowEditModal(false);
          setEditForm({
            title: '',
            description: '',
            priority: 'normal',
            skp_category_id: '',
            relate_perangkat: true,
            assigned_perangkat: [],
          });
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
        } else if (showExportModal) {
          setShowExportModal(false);
        }
      }
    };

    if (showAddForm || showScheduleModal || showAssignModal || showDetailModal || 
        showDeleteModal || showEditModal || showHistoryModal || showExportModal) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [showAddForm, showScheduleModal, showAssignModal, showDetailModal, 
      showDeleteModal, showEditModal, showHistoryModal, showExportModal]);

  useEffect(() => {
    // Filter SKP categories when IT Support is selected
    // Use first selected user for filtering
    // Add debounce to prevent constant refreshing
    const timeoutId = setTimeout(() => {
      if (form.assigned_users && form.assigned_users.length > 0) {
        fetchFilteredSKPCategories(form.assigned_users[0]);
      } else {
        setFilteredSkpCategories([]);
      }
    }, 300); // Wait 300ms after user stops selecting
    
    return () => clearTimeout(timeoutId);
  }, [form.assigned_users]);

  const fetchTasks = async (categoryName = null) => {
    try {
      setLoading(true);
      
      // Fetch tasks with assigned users and devices
      // Administrators, Helpdesk, and Koordinator IT Support can see all tasks, other roles see only tasks they created
      // Note: profiles join is optional - if RLS blocks it, we'll fetch separately
      let query = supabase
        .from('task_assignments')
        .select(`
          *,
          total_duration_minutes,
          assigned_at,
          completed_at,
          skp_category:skp_categories(code, name)
        `)
        .neq('status', 'on_hold')
        .order('created_at', { ascending: false });
      
      // Only filter by assigned_by if user is not administrator, helpdesk, or koordinator it support
      // Helpdesk and Koordinator IT Support are identified by user_category, not role
      // Use provided categoryName or fall back to state value
      const currentUserCategory = categoryName !== null ? categoryName : userCategory;
      const isAdministrator = profile?.role === 'administrator';
      const isHelpdesk = currentUserCategory === 'Helpdesk';
      const isKoordinatorITSupport = currentUserCategory === 'Koordinator IT Support';
      
      
      if (!isAdministrator && !isHelpdesk && !isKoordinatorITSupport) {
        query = query.eq('assigned_by', user.id);
      }
      
      const { data: tasksData, error: tasksError } = await query;


      if (tasksError) {
        console.error('[Penugasan] Error fetching tasks:', {
          message: tasksError.message,
          details: tasksError.details,
          hint: tasksError.hint,
          code: tasksError.code
        });
        toast.error('❌ Gagal memuat tugas: ' + tasksError.message);
        setTasks([]);
        return;
      }

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Fetch assigned_by_user profiles separately (in case join fails due to RLS)
      if (tasksData && tasksData.length > 0) {
        const assignedByIds = [...new Set(tasksData.map(t => t.assigned_by).filter(Boolean))];
        let assignedByMap = {};
        
        if (assignedByIds.length > 0) {
          const { data: assignedByProfiles, error: assignedByError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', assignedByIds);
          
          if (!assignedByError && assignedByProfiles) {
            assignedByMap = assignedByProfiles.reduce((acc, p) => {
              acc[p.id] = p.full_name;
              return acc;
            }, {});
          }
        }
        
        // Add assigned_by_user to each task
        tasksData.forEach(task => {
          task.assigned_by_user = assignedByMap[task.assigned_by] || null;
        });
      }

      // Fetch assigned users for each task
      const tasksWithUsers = await Promise.all(
        tasksData.map(async (task) => {
          // Fetch assigned users with profiles joined
          const { data: assignedUsersData, error: usersError } = await supabase
            .from('task_assignment_users')
            .select(`
              user_id,
              status,
              work_duration_minutes,
              acknowledged_at,
              started_at,
              completed_at,
              profiles(id, full_name, email)
            `)
            .eq('task_assignment_id', task.id);

          if (usersError) {
            console.error(`[Penugasan] Error fetching assigned users for task ${task.id}:`, usersError);
            throw usersError;
          }
          
          // Transform the data to match expected structure
          const assignedUsersWithProfiles = (assignedUsersData || []).map(au => {
            // Handle profile data from join
            let profileData = null;
            if (au.profiles) {
              // Supabase returns joined data as array or object
              if (Array.isArray(au.profiles) && au.profiles.length > 0) {
                profileData = {
                  full_name: au.profiles[0].full_name,
                  email: au.profiles[0].email
                };
              } else if (au.profiles && typeof au.profiles === 'object' && au.profiles.full_name) {
                profileData = {
                  full_name: au.profiles.full_name,
                  email: au.profiles.email
                };
              }
            }
            
            // If join didn't return profile, try fetching separately as fallback
            if (!profileData) {
              // This will be handled by a separate query if needed
              // For now, return null and we'll fetch in batch below
            }
            
            return {
              ...au,
              profiles: profileData
            };
          });

          // If task is scheduled, fetch planned assignees (so they can see it before activation)
          let plannedAssignees = [];
          let scheduledFor = null;
          if (task.status === 'scheduled') {
            const { data: scheduleRow, error: scheduleError } = await supabase
              .from('task_schedules')
              .select('id, scheduled_for, status')
              .eq('task_assignment_id', task.id)
              .maybeSingle();

            if (!scheduleError && scheduleRow && scheduleRow.status === 'scheduled') {
              scheduledFor = scheduleRow.scheduled_for;

              const { data: plannedUsers, error: plannedUsersError } = await supabase
                .from('task_schedule_users')
                .select('user_id, profiles(id, full_name, email)')
                .eq('task_schedule_id', scheduleRow.id);

              if (!plannedUsersError) {
                plannedAssignees = (plannedUsers || []).map(pu => {
                  const p = Array.isArray(pu.profiles) ? pu.profiles[0] : pu.profiles;
                  return {
                    user_id: pu.user_id,
                    status: 'scheduled',
                    work_duration_minutes: 0,
                    acknowledged_at: null,
                    started_at: null,
                    completed_at: null,
                    profiles: p ? { full_name: p.full_name, email: p.email } : null
                  };
                });
              }
            }
          }
          
          // If any profiles are missing, fetch them separately
          const missingUserIds = assignedUsersWithProfiles
            .filter(au => !au.profiles)
            .map(au => au.user_id);
          
          if (missingUserIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', missingUserIds);
            
            if (!profilesError && profilesData) {
              const profilesMap = profilesData.reduce((acc, profile) => {
                acc[profile.id] = {
                  full_name: profile.full_name,
                  email: profile.email
                };
                return acc;
              }, {});
              
              // Update assigned users with fetched profiles
              assignedUsersWithProfiles.forEach(au => {
                if (!au.profiles && profilesMap[au.user_id]) {
                  au.profiles = profilesMap[au.user_id];
                }
              });
            } else if (profilesError) {
              console.warn(`[Penugasan] Could not fetch some profiles (RLS may be blocking):`, {
                message: profilesError.message,
                code: profilesError.code,
                hint: 'Run FIX_PROFILES_SELECT_POLICY_FOR_TASKS_WITH_IT_SUPPORT.sql to fix RLS policy'
              });
            }
          }
          
          // (removed debug logging)
          
          const { data: devicesData } = await supabase
            .from('task_assignment_perangkat')
            .select(`
              perangkat_id,
              perangkat!task_assignment_perangkat_perangkat_id_fkey(id_perangkat, nama_perangkat)
            `)
            .eq('task_assignment_id', task.id);

          const finalTask = {
            ...task,
            assigned_users: task.status === 'scheduled' ? (plannedAssignees || []) : (assignedUsersWithProfiles || []),
            assigned_devices: devicesData || [],
            scheduled_for: scheduledFor,
          };
          return finalTask;
        })
      );
      
      setTasks(tasksWithUsers);
    } catch (error) {
      console.error('Error fetching tasks:', error.message);
      toast.error('❌ Gagal memuat tugas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeldTasks = async (categoryName = null) => {
    try {
      // Administrators, Helpdesk, and Koordinator IT Support can see all held tasks, other roles see only tasks they created
      let query = supabase
        .from('held_tasks_with_duration')
        .select('*');
      
      // Only filter by assigned_by if user is not administrator, helpdesk, or koordinator it support
      // Helpdesk and Koordinator IT Support are identified by user_category, not role
      // Use provided categoryName or fall back to state value
      const currentUserCategory = categoryName !== null ? categoryName : userCategory;
      const isAdministrator = profile?.role === 'administrator';
      const isHelpdesk = currentUserCategory === 'Helpdesk';
      const isKoordinatorITSupport = currentUserCategory === 'Koordinator IT Support';
      
      if (!isAdministrator && !isHelpdesk && !isKoordinatorITSupport) {
        query = query.eq('assigned_by', user.id);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      setHeldTasks(data || []);
    } catch (error) {
      console.error('Error fetching held tasks:', error.message);
    }
  };

  const fetchAvailableITSupport = async () => {
    try {
      const { data, error } = await supabase
        .from('available_it_support')
        .select('*');

      if (error) {
        console.error('Error fetching IT Support:', error.message);
        toast.error('❌ Gagal memuat daftar IT Support: ' + error.message);
        return;
      }
      setAvailableITSupport(data || []);
    } catch (error) {
      console.error('Error fetching IT Support:', error.message);
      toast.error('❌ Gagal memuat daftar IT Support: ' + error.message);
    }
  };

  const fetchAllITSupport = async () => {
    try {
      // Fetch all IT Support and Koordinator IT Support users by checking user_categories
      const { data: userCategoriesData, error: categoriesError } = await supabase
        .from('user_categories')
        .select('id, name')
        .in('name', ['IT Support', 'Koordinator IT Support']);

      if (categoriesError) throw categoriesError;

      if (!userCategoriesData || userCategoriesData.length === 0) {
        setAllITSupport([]);
        return;
      }

      const categoryIds = userCategoriesData.map(cat => cat.id);

      // Fetch all profiles with IT Support or Koordinator IT Support category
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_category_id')
        .in('user_category_id', categoryIds)
        .order('full_name');

      if (profilesError) throw profilesError;

      if (!profilesData || profilesData.length === 0) {
        setAllITSupport([]);
        return;
      }

      // Fetch active tasks for each IT Support user
      const itSupportWithTasks = await Promise.all(
        profilesData.map(async (profile) => {
          // Get active tasks for this user (tasks assigned to them that are not completed/cancelled)
          const { data: activeTasksData, error: tasksError } = await supabase
            .from('task_assignment_users')
            .select(`
              task_assignment_id,
              status,
              task_assignments!inner(
                task_number,
                title,
                status
              )
            `)
            .eq('user_id', profile.id)
            .in('status', ['pending', 'acknowledged', 'in_progress', 'paused']);

          if (tasksError) {
            console.error(`Error fetching tasks for ${profile.id}:`, tasksError);
          }


          const activeTasks = (activeTasksData || []).map(t => {
            // Handle different response formats from Supabase
            let taskData = null;
            if (t.task_assignments) {
              taskData = Array.isArray(t.task_assignments) 
                ? t.task_assignments[0] 
                : t.task_assignments;
            }
            
            return {
              task_number: taskData?.task_number || null,
              title: taskData?.title || null,
              status: taskData?.status || t.status
            };
          }).filter(t => t.task_number); // Filter out nulls

          // (removed debug logging)

          return {
            id: profile.id,
            name: profile.full_name,
            email: profile.email,
            activeTasks: activeTasks,
            isAvailable: activeTasks.length === 0
          };
        })
      );

      setAllITSupport(itSupportWithTasks);
    } catch (error) {
      console.error('Error fetching all IT Support:', error.message);
      toast.error('❌ Gagal memuat daftar IT Support: ' + error.message);
    }
  };

  const fetchSKPCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('skp_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Filter out "Inventarisasi Perangkat TI" SKP (dihitung otomatis dari stok opnam)
      const filtered = (data || []).filter(skp => {
        const nameL = (skp.name || '').toLowerCase();
        const codeL = (skp.code || '').toLowerCase();
        return !(
          nameL.includes('inventaris') && nameL.includes('perangkat') ||
          nameL.includes('inventarisasi') && nameL.includes('ti') ||
          codeL.includes('inv') ||
          codeL === 'skp-011'
        );
      });
      
      setSkpCategories(filtered);
    } catch (error) {
      console.error('Error fetching SKP categories:', error.message);
    }
  };

  // NEW: Fetch perangkat list
  const fetchPerangkat = async () => {
    try {
      const { data, error } = await supabase
        .from('perangkat')
        .select('id, id_perangkat, nama_perangkat, status_perangkat')
        .order('id_perangkat');

      if (error) throw error;
      setPerangkatList(data || []);
    } catch (error) {
      console.error('Error fetching perangkat:', error.message);
    }
  };

  const fetchFilteredSKPCategories = async (userId) => {
    try {
      // Get user's category
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_category_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      if (!userData?.user_category_id) {
        // If user has no category, show no SKPs
        setFilteredSkpCategories([]);
        return;
      }

      // Get SKP categories assigned to this user category
      const { data: skpData, error: skpError } = await supabase
        .from('user_category_skp')
        .select(`
          skp_category_id,
          skp_categories!inner(*)
        `)
        .eq('user_category_id', userData.user_category_id)
        .eq('skp_categories.is_active', true);

      if (skpError) throw skpError;

      // Extract SKP categories from the nested data
      let skps = skpData?.map(item => item.skp_categories) || [];
      
      // Filter out "Inventarisasi Perangkat TI" SKP (dihitung otomatis dari stok opnam)
      skps = skps.filter(skp => {
        const nameL = (skp.name || '').toLowerCase();
        const codeL = (skp.code || '').toLowerCase();
        // Exclude inventarisasi perangkat variations
        return !(
          nameL.includes('inventaris') && nameL.includes('perangkat') ||
          nameL.includes('inventarisasi') && nameL.includes('ti') ||
          codeL.includes('inv') ||
          codeL === 'skp-011'
        );
      });
      
      setFilteredSkpCategories(skps);
    } catch (error) {
      console.error('Error fetching filtered SKP categories:', error.message);
      setFilteredSkpCategories([]);
    }
  };

  const handleAdd = () => {
    setForm({
      title: '',
      description: '',
      priority: 'normal',
      skp_category_id: '',
      assigned_users: [],
      relate_perangkat: true,
      assigned_perangkat: [],
    });
    setPerangkatSearch('');
    setShowAddForm(true);
    // Refresh data when opening form
    fetchAllITSupport(); // Fetch all IT Support with active tasks
    fetchPerangkat();
  };

  const handleOpenSchedule = () => {
    setPerangkatSearch('');
    setShowScheduleModal(true);
    fetchAllITSupport();
    fetchPerangkat();
  };

  const handleSubmitSchedule = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (scheduleForm.assigned_users.length === 0) {
      toast.warning('Silakan pilih minimal 1 IT Support');
      return;
    }
    if (!scheduleForm.skp_category_id) {
      toast.warning('Silakan pilih kategori SKP');
      return;
    }
    if (!scheduleForm.scheduled_date || scheduleForm.scheduled_hour === '' || scheduleForm.scheduled_minute === '') {
      toast.warning('Silakan pilih tanggal & jam jadwal');
      return;
    }
    if (scheduleForm.relate_perangkat && scheduleForm.assigned_perangkat.length === 0) {
      toast.warning('Silakan pilih minimal 1 perangkat');
      return;
    }

    const hh = String(scheduleForm.scheduled_hour).padStart(2, '0');
    const mm = String(scheduleForm.scheduled_minute).padStart(2, '0');
    const scheduledForIso = new Date(`${scheduleForm.scheduled_date}T${hh}:${mm}:00`).toISOString();

    setSubmitting(true);
    try {
      // 1) Create the task itself, as scheduled
      const { data: taskData, error: taskError } = await supabase
        .from('task_assignments')
        .insert([{
          title: scheduleForm.title,
          description: scheduleForm.description,
          priority: scheduleForm.priority,
          skp_category_id: scheduleForm.skp_category_id,
          assigned_by: user.id,
          status: 'scheduled',
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // 2) Create schedule row
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('task_schedules')
        .insert([{
          task_assignment_id: taskData.id,
          scheduled_by: user.id,
          scheduled_for: scheduledForIso,
          status: 'scheduled',
        }])
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // 3) Planned assignees
      const plannedUserInserts = scheduleForm.assigned_users.map(userId => ({
        task_schedule_id: scheduleData.id,
        user_id: userId,
      }));

      const { error: plannedUsersError } = await supabase
        .from('task_schedule_users')
        .insert(plannedUserInserts);

      if (plannedUsersError) throw plannedUsersError;

      // 4) Devices (optional, same as normal)
      if (scheduleForm.relate_perangkat && scheduleForm.assigned_perangkat.length > 0) {
        const deviceInserts = scheduleForm.assigned_perangkat.map(perangkatId => ({
          task_assignment_id: taskData.id,
          perangkat_id: perangkatId,
        }));

        const { error: devicesError } = await supabase
          .from('task_assignment_perangkat')
          .insert(deviceInserts);

        if (devicesError) throw devicesError;
      }

      toast.success('⏰ Tugas berhasil dijadwalkan!');
      setShowScheduleModal(false);
      setScheduleForm({
        title: '',
        description: '',
        priority: 'normal',
        skp_category_id: '',
        assigned_users: [],
        scheduled_date: '',
        scheduled_hour: '',
        scheduled_minute: '',
        relate_perangkat: true,
        assigned_perangkat: [],
      });
      setPerangkatSearch('');
      fetchTasks();
    } catch (error) {
      toast.error('❌ Gagal menjadwalkan tugas: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (submitting) {
      return;
    }
    
    if (form.assigned_users.length === 0) {
      toast.warning('Silakan pilih minimal 1 IT Support');
      return;
    }

    if (!form.skp_category_id) {
      toast.warning('Silakan pilih kategori SKP');
      return;
    }

    if (form.relate_perangkat && form.assigned_perangkat.length === 0) {
      toast.warning('Silakan pilih minimal 1 perangkat');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create task assignment
      const { data: taskData, error: taskError } = await supabase
        .from('task_assignments')
        .insert([{
          title: form.title,
          description: form.description,
          priority: form.priority,
          skp_category_id: form.skp_category_id,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
          status: 'pending',
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // 2. Insert assigned users
      const userInserts = form.assigned_users.map(userId => ({
        task_assignment_id: taskData.id,
        user_id: userId,
        status: 'pending',
      }));

      const { error: usersError } = await supabase
        .from('task_assignment_users')
        .insert(userInserts);

      if (usersError) throw usersError;

      // 3. Insert assigned devices (optional)
      if (form.relate_perangkat && form.assigned_perangkat.length > 0) {
        const deviceInserts = form.assigned_perangkat.map(perangkatId => ({
          task_assignment_id: taskData.id,
          perangkat_id: perangkatId,
        }));

        const { error: devicesError } = await supabase
          .from('task_assignment_perangkat')
          .insert(deviceInserts);

        if (devicesError) throw devicesError;
      }

      toast.success(`✅ Tugas berhasil dibuat! (${form.assigned_users.length} petugas, ${form.relate_perangkat ? form.assigned_perangkat.length : 0} perangkat)`);
      setShowAddForm(false);
      setForm({
        title: '',
        description: '',
        priority: 'normal',
        skp_category_id: '',
        assigned_users: [],
        relate_perangkat: true,
        assigned_perangkat: [],
      });
      setPerangkatSearch('');
      fetchTasks();
      fetchAvailableITSupport();
    } catch (error) {
      toast.error('❌ Gagal membuat tugas: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHoldTask = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (submitting) {
      return;
    }
    
    if (!form.skp_category_id) {
      toast.warning('Silakan pilih kategori SKP');
      return;
    }

    if (!confirm('Hold tugas ini? Tugas akan tersimpan dan bisa di-assign nanti ketika ada IT Support yang available.')) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('task_assignments')
        .insert([{
          title: form.title,
          description: form.description,
          priority: form.priority,
          skp_category_id: form.skp_category_id,
          assigned_by: user.id,
          assigned_to: null,
          status: 'on_hold',
        }]);

      if (error) throw error;

      toast.success('⏳ Tugas berhasil di-hold! Anda bisa assign nanti ketika ada IT Support available.');
      setShowAddForm(false);
      setForm({
        title: '',
        description: '',
        priority: 'normal',
        skp_category_id: '',
        assigned_users: [],
        assigned_perangkat: [],
      });
      setPerangkatSearch('');
      fetchHeldTasks();
    } catch (error) {
      toast.error('❌ Gagal hold tugas: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignHeldTask = (task) => {
    setSelectedHeldTask(task);
    setShowAssignModal(true);
    fetchAllITSupport(); // Fetch all IT Support with active tasks
  };

  const handleSubmitAssignment = async (itSupportId) => {
    if (!itSupportId || !selectedHeldTask) return;

    try {
      const now = new Date().toISOString();
      const createdAt = new Date(selectedHeldTask.created_at);
      const waitingMinutes = Math.floor((Date.now() - createdAt.getTime()) / 60000);

      // 1. Update task assignment status
      const { error: taskError } = await supabase
        .from('task_assignments')
        .update({
          assigned_to: itSupportId,
          assigned_at: now,
          waiting_duration_minutes: waitingMinutes,
          status: 'pending',
        })
        .eq('id', selectedHeldTask.id);

      if (taskError) throw taskError;

      // 2. Create task_assignment_users row (SKP is already set on the task, no need to select)
      const { error: userError } = await supabase
        .from('task_assignment_users')
        .insert([{
          task_assignment_id: selectedHeldTask.id,
          user_id: itSupportId,
          status: 'pending',
        }]);

      if (userError) throw userError;

      toast.success('✅ Tugas berhasil di-assign!');
      setShowAssignModal(false);
      setSelectedHeldTask(null);
      fetchHeldTasks();
      fetchTasks();
    } catch (error) {
      toast.error('❌ Gagal assign tugas: ' + error.message);
    }
  };

  const startWaitingTimer = (taskId, createdAt) => {
    // Clear existing timer if any
    if (timerIntervalRef.current[taskId]) {
      clearInterval(timerIntervalRef.current[taskId]);
    }

    const startTime = new Date(createdAt).getTime();
    
    timerIntervalRef.current[taskId] = setInterval(() => {
      const now = Date.now();
      const diffMs = now - startTime;
      const minutes = Math.floor(diffMs / 60000);
      
      setWaitingTime(prev => ({
        ...prev,
        [taskId]: minutes
      }));
    }, 1000);
  };

  const stopWaitingTimer = (taskId) => {
    if (timerIntervalRef.current[taskId]) {
      clearInterval(timerIntervalRef.current[taskId]);
      delete timerIntervalRef.current[taskId];
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      scheduled: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
      on_hold: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
      pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
      acknowledged: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      in_progress: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      paused: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
      completed: 'border-green-500/30 bg-green-500/10 text-green-400',
      cancelled: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
    };

    const labels = {
      scheduled: 'Dijadwalkan',
      on_hold: 'On Hold',
      pending: 'Menunggu',
      acknowledged: 'Dikonfirmasi',
      in_progress: 'Dikerjakan',
      paused: 'Tertunda',
      completed: 'Selesai',
      cancelled: 'Dibatalkan',
    };

    return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[status] || ''}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatWaitingDuration = (minutes) => {
    if (!minutes || minutes < 0) return '0 menit';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const secs = Math.floor((minutes % 1) * 60);
    
    if (hours > 0) {
      return `${hours} jam ${mins} menit`;
    }
    return `${mins} menit ${secs} detik`;
  };

  const formatDuration = (minutes) => {
    if (!minutes || minutes < 0) return '0 menit';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours} jam ${mins} menit`;
    }
    return `${mins} menit`;
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

  // Calculate duration in minutes from timestamps
  const calculateDuration = (startTime, endTime = null) => {
    if (!startTime) return null;
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(); // Use current time if endTime not provided
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000); // Convert to minutes
    return minutes > 0 ? minutes : null;
  };

  // NEW: Handle view task detail
  const handleViewDetail = (task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const canEditAnyTask = profile?.role === 'administrator' || userCategory === 'Helpdesk';
  const hDesk = userCategory === 'Helpdesk';

  const hdBtn =
    'text-xs py-1.5 px-3 rounded-sm bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 transition duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';
  const hdBtnPrimary =
    'text-xs py-1.5 px-3 rounded-sm bg-zinc-700 hover:bg-zinc-600 text-white transition duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

  const handleOpenEdit = (task) => {
    if (!task) return;
    setSelectedTask(task);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'normal',
      skp_category_id: task.skp_category_id || '',
      relate_perangkat: (task.assigned_devices?.length || 0) > 0,
      assigned_perangkat: (task.assigned_devices || []).map(d => d.perangkat_id).filter(Boolean),
    });
    setPerangkatSearch('');
    fetchPerangkat();
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTask) return;

    if (!editForm.title.trim()) {
      toast.warning('Judul tugas wajib diisi');
      return;
    }
    if (!editForm.skp_category_id) {
      toast.warning('Silakan pilih kategori SKP');
      return;
    }
    if (editForm.relate_perangkat && editForm.assigned_perangkat.length === 0) {
      toast.warning('Silakan pilih minimal 1 perangkat atau matikan relasi perangkat');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('task_assignments')
        .update({
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          skp_category_id: editForm.skp_category_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTask.id);
      if (updateError) throw updateError;

      // Sync perangkat relation
      const { error: deleteDevicesError } = await supabase
        .from('task_assignment_perangkat')
        .delete()
        .eq('task_assignment_id', selectedTask.id);
      if (deleteDevicesError) throw deleteDevicesError;

      if (editForm.relate_perangkat && editForm.assigned_perangkat.length > 0) {
        const inserts = editForm.assigned_perangkat.map((pid) => ({
          task_assignment_id: selectedTask.id,
          perangkat_id: pid,
        }));
        const { error: insertDevicesError } = await supabase
          .from('task_assignment_perangkat')
          .insert(inserts);
        if (insertDevicesError) throw insertDevicesError;
      }

      toast.success('✅ Penugasan berhasil diperbarui');
      setShowEditModal(false);
      fetchTasks();
    } catch (error) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('row-level security') || msg.includes('permission') || error?.code === '42501') {
        toast.error('❌ Gagal update (RLS). Jalankan script `FIX_TASK_EDIT_RLS.sql` di Supabase SQL Editor.');
      } else {
        toast.error('❌ Gagal update penugasan: ' + (error?.message || 'Unknown error'));
      }
    }
  };

  // NEW: Handle delete task
  const handleDeleteClick = (task) => {
    setSelectedTask(task);
    setDeletionReason('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTask) return;

    if (!deletionReason.trim()) {
      toast.warning('Alasan penghapusan wajib diisi');
      return;
    }

    try {
      // 1. Log deletion to history
      const { error: logError } = await supabase.rpc('log_task_deletion', {
        p_task_id: selectedTask.id,
        p_deletion_reason: deletionReason
      });

      if (logError) throw logError;

      // 2. Delete task (cascade will delete task_assignment_users & task_assignment_perangkat)
      const { error: deleteError } = await supabase
        .from('task_assignments')
        .delete()
        .eq('id', selectedTask.id);

      if (deleteError) throw deleteError;

      toast.success('🗑️ Tugas berhasil dihapus dan diarsipkan');
      setShowDeleteModal(false);
      setSelectedTask(null);
      setDeletionReason('');
      fetchTasks();
      fetchHeldTasks();
    } catch (error) {
      toast.error('❌ Gagal menghapus tugas: ' + error.message);
    }
  };

  // NEW: Fetch deletion history
  const fetchDeletionHistory = async () => {
    try {
      setLoadingHistory(true);
      
      const { data, error } = await supabase
        .from('task_deletion_history_view')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      
      setDeletionHistory(data || []);
    } catch (error) {
      console.error('Error fetching deletion history:', error.message);
      toast.error('❌ Gagal memuat history: ' + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    setShowHistoryModal(true);
    fetchDeletionHistory();
  };

  const handleOpenExport = () => {
    const now = new Date();
    setExportMonth((now.getMonth() + 1).toString().padStart(2, '0'));
    setExportYear(now.getFullYear().toString());
    setExportStartDate('');
    setExportEndDate('');
    setExportType('month');
    setShowExportModal(true);
  };

  const handleExport = async () => {
    if (exportType === 'month') {
      if (!exportMonth || !exportYear) {
        toast.warning('Silakan pilih bulan dan tahun');
        return;
      }
    } else {
      if (!exportStartDate || !exportEndDate) {
        toast.warning('Silakan pilih tanggal mulai dan tanggal akhir');
        return;
      }
      if (new Date(exportStartDate) > new Date(exportEndDate)) {
        toast.warning('Tanggal mulai harus lebih kecil dari tanggal akhir');
        return;
      }
    }

    setExporting(true);
    try {
      let query = supabase
        .from('task_assignments')
        .select(`
          *,
          skp_category:skp_categories(code, name),
          assigned_by_profile:profiles!task_assignments_assigned_by_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      // Apply date filter
      if (exportType === 'month') {
        const startOfMonth = new Date(parseInt(exportYear), parseInt(exportMonth) - 1, 1);
        const endOfMonth = new Date(parseInt(exportYear), parseInt(exportMonth), 0, 23, 59, 59, 999);
        query = query
          .gte('created_at', startOfMonth.toISOString())
          .lte('created_at', endOfMonth.toISOString());
      } else {
        const startDate = new Date(exportStartDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(exportEndDate);
        endDate.setHours(23, 59, 59, 999);
        query = query
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
      }

      // Only filter by assigned_by if user is not administrator, helpdesk, or koordinator it support
      const isAdministrator = profile?.role === 'administrator';
      const isHelpdesk = userCategory === 'Helpdesk';
      const isKoordinatorITSupport = userCategory === 'Koordinator IT Support';
      
      if (!isAdministrator && !isHelpdesk && !isKoordinatorITSupport) {
        query = query.eq('assigned_by', user.id);
      }

      const { data: tasksData, error: tasksError } = await query;

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        toast.warning('Tidak ada data untuk diekspor');
        setExporting(false);
        return;
      }

      // Fetch assigned users and devices for each task
      const tasksWithDetails = await Promise.all(
        tasksData.map(async (task) => {
          // Fetch assigned users
          const { data: assignedUsersData } = await supabase
            .from('task_assignment_users')
            .select(`
              user_id,
              status,
              work_duration_minutes,
              acknowledged_at,
              started_at,
              completed_at,
              profiles!task_assignment_users_user_id_fkey(full_name, email)
            `)
            .eq('task_assignment_id', task.id);

          const assignedUsers = (assignedUsersData || []).map(au => ({
            name: au.profiles?.full_name || 'Unknown',
            email: au.profiles?.email || '',
            status: au.status,
            duration: au.work_duration_minutes || 0,
            acknowledged_at: au.acknowledged_at,
            started_at: au.started_at,
            completed_at: au.completed_at
          }));

          // Fetch assigned devices
          const { data: devicesData } = await supabase
            .from('task_assignment_perangkat')
            .select(`
              perangkat_id,
              perangkat!task_assignment_perangkat_perangkat_id_fkey(id_perangkat, nama_perangkat)
            `)
            .eq('task_assignment_id', task.id);

          const assignedDevices = (devicesData || []).map(ad => ({
            id_perangkat: ad.perangkat?.id_perangkat || '-',
            nama_perangkat: ad.perangkat?.nama_perangkat || '-'
          }));

          return {
            ...task,
            assigned_users: assignedUsers,
            assigned_devices: assignedDevices
          };
        })
      );

      // Generate CSV
      const csvRows = [];
      
      // Header
      csvRows.push([
        'No. Tugas',
        'Judul',
        'Deskripsi',
        'Status',
        'Prioritas',
        'Kategori SKP',
        'Dibuat oleh',
        'Tanggal Dibuat',
        'Tanggal Ditugaskan',
        'Tanggal Direspon',
        'Tanggal Dimulai',
        'Tanggal Selesai',
        'Durasi (menit)',
        'Petugas IT Support',
        'Perangkat Ditugaskan'
      ].join(','));

      // Data rows
      tasksWithDetails.forEach(task => {
        const assignedUsersStr = task.assigned_users
          .map(u => `${u.name} (${u.email})`)
          .join('; ');
        const assignedDevicesStr = task.assigned_devices
          .map(d => `${d.id_perangkat} - ${d.nama_perangkat}`)
          .join('; ');

        const formatDateForCSV = (dateStr) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          return date.toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        };

        // Get earliest acknowledged_at and started_at from assigned users if task-level is empty
        const earliestAcknowledgedAt = task.acknowledged_at || 
          (task.assigned_users.length > 0 
            ? task.assigned_users
                .map(u => u.acknowledged_at)
                .filter(Boolean)
                .sort()[0]
            : null);
        
        const earliestStartedAt = task.started_at || 
          (task.assigned_users.length > 0
            ? task.assigned_users
                .map(u => u.started_at)
                .filter(Boolean)
                .sort()[0]
            : null);
        
        // Get latest completed_at from assigned users if task-level is empty
        const latestCompletedAt = task.completed_at ||
          (task.assigned_users.length > 0
            ? task.assigned_users
                .map(u => u.completed_at)
                .filter(Boolean)
                .sort()
                .reverse()[0]
            : null);

        csvRows.push([
          `"${task.task_number || ''}"`,
          `"${(task.title || '').replace(/"/g, '""')}"`,
          `"${(task.description || '').replace(/"/g, '""')}"`,
          `"${task.status || ''}"`,
          `"${task.priority || ''}"`,
          `"${task.skp_category?.name || ''}"`,
          `"${task.assigned_by_profile?.full_name || ''}"`,
          `"${formatDateForCSV(task.created_at)}"`,
          `"${formatDateForCSV(task.assigned_at)}"`,
          `"${formatDateForCSV(earliestAcknowledgedAt)}"`,
          `"${formatDateForCSV(earliestStartedAt)}"`,
          `"${formatDateForCSV(latestCompletedAt)}"`,
          task.total_duration_minutes || 0,
          `"${assignedUsersStr}"`,
          `"${assignedDevicesStr}"`
        ].join(','));
      });

      // Create and download CSV
      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = exportType === 'month' 
        ? `penugasan_${exportMonth}_${exportYear}.csv`
        : `penugasan_${exportStartDate}_${exportEndDate}.csv`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`✅ Data berhasil diekspor! (${tasksWithDetails.length} tugas)`);
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('❌ Gagal mengekspor data: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    if (hDesk) {
      return (
        <Layout hideTopBar>
          <div className="space-y-3 text-[11px]" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            <div className="flex justify-end py-1">
              <div className="flex gap-1 border border-zinc-800 rounded-sm p-0.5">
                <div className="h-7 w-20 bg-zinc-800 rounded-sm animate-pulse" />
                <div className="h-7 w-24 bg-[#1a1a1a] rounded-sm animate-pulse" />
                <div className="h-7 w-28 bg-[#1a1a1a] rounded-sm animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-black border border-[#1a1a1a] rounded-lg px-2.5 py-2.5">
                  <div className="h-2.5 w-16 bg-[#1a1a1a] rounded animate-pulse mb-2" />
                  <div className="h-6 w-12 bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-black border border-[#1a1a1a] rounded-lg px-2.5 pt-2.5 pb-2"
                >
                  <div className="flex flex-col lg:flex-row gap-2.5 justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <div className="h-3 w-20 bg-[#1a1a1a] rounded animate-pulse" />
                        <div className="h-4 w-14 bg-[#1a1a1a] rounded-full animate-pulse" />
                      </div>
                      <div className="h-3 bg-[#1a1a1a] rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                      <div className="h-2.5 w-40 bg-[#1a1a1a] rounded animate-pulse" />
                    </div>
                    <div className="h-7 w-24 bg-[#1a1a1a] rounded-lg animate-pulse self-start" />
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
          {/* Header Skeleton */}
          <div className="flex justify-end">
            <div className="h-8 w-64 bg-[#1a1a1a] rounded-sm animate-pulse" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-black border border-[#1a1a1a] rounded-lg p-3">
                <div className="h-3 w-16 bg-[#1a1a1a] rounded animate-pulse mb-2" />
                <div className="h-6 w-10 bg-[#1a1a1a] rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="bg-black border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="h-9 bg-zinc-900/50 border-b border-[#1a1a1a]" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3 border-b border-[#1a1a1a]">
                <div className="h-3 w-20 bg-[#1a1a1a] rounded animate-pulse" />
                <div className="h-3 bg-[#1a1a1a] rounded animate-pulse flex-1" style={{ maxWidth: `${50 + i * 8}%` }} />
                <div className="h-3 w-16 bg-[#1a1a1a] rounded animate-pulse" />
                <div className="h-4 w-14 bg-[#1a1a1a] rounded-full animate-pulse" />
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
        {/* Header */}
        <div className="flex justify-end">
          <div className="inline-flex rounded-sm border border-zinc-800 overflow-hidden">
            <button
              onClick={() => fetchTasks()}
              className="bg-zinc-900 hover:bg-zinc-800 border-r border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs font-medium transition"
              title="Refresh table"
            >
              Refresh
            </button>
            <button
              onClick={handleOpenExport}
              className="bg-zinc-900 hover:bg-zinc-800 border-r border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs font-medium transition"
              title="Export data penugasan"
            >
              Export
            </button>
            {permissions.canDelete && (
              <button
                onClick={handleOpenHistory}
                className="bg-zinc-900 hover:bg-zinc-800 border-r border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs font-medium transition"
                title="Lihat history tugas yang dihapus"
              >
                History
              </button>
            )}
            {permissions.canCreate && (
              <>
                <button
                  onClick={handleOpenSchedule}
                  className="bg-zinc-900 hover:bg-zinc-800 border-r border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs font-medium transition"
                >
                  Jadwalkan
                </button>
                <button
                  onClick={handleAdd}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 text-xs font-medium transition"
                >
                  + Buat Tugas
                </button>
              </>
            )}
          </div>
        </div>

        {/* DETAIL MODAL */}
        {showDetailModal && selectedTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto modal-backdrop-enter"
            onClick={(e) => {
              if (e.target === e.currentTarget) { setShowDetailModal(false); setSelectedTask(null); }
            }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full h-[70vh] md:w-[540px] md:h-[420px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <div className="min-w-0">
                  <span className="font-bold text-white text-sm">Detail Penugasan</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white font-bold text-xs font-mono">{selectedTask.task_number}</span>
                    <span className="text-gray-600">•</span>
                    {getStatusBadge(selectedTask.status)}
                    {getPriorityBadge(selectedTask.priority)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowDetailModal(false); setSelectedTask(null); }}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                  title="Tutup"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1">
              <div className="p-4">
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

                  {/* Scheduled time */}
                  {selectedTask.status === 'scheduled' && selectedTask.scheduled_for && (
                    <div className="col-span-2 bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                      <p className="text-xs text-gray-300">
                        Dijadwalkan: <span className="font-mono font-semibold text-white">{formatDate(selectedTask.scheduled_for)}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Aksi muncul setelah waktu jadwal tiba.
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Kategori SKP</p>
                    <p className="text-xs">{selectedTask.skp_category?.name || '-'}</p>
                  </div>

                  {selectedTask.assigned_by_user && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Dari (Penugas)</p>
                      <p className="text-xs">{selectedTask.assigned_by_user?.full_name || selectedTask.assigned_by_user}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Dibuat</p>
                    <p className="text-xs">{formatDate(selectedTask.created_at)}</p>
                  </div>

                  {selectedTask.assigned_at && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Ditugaskan</p>
                      <p className="text-xs">{formatDate(selectedTask.assigned_at)}</p>
                    </div>
                  )}

                  {selectedTask.completed_at && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Selesai</p>
                      <p className="text-xs">{formatDate(selectedTask.completed_at)}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Total Durasi</p>
                    <p className="text-xs font-bold text-green-400">
                      {(() => {
                        let totalDuration = null;
                        if (selectedTask.total_duration_minutes && selectedTask.total_duration_minutes > 0) {
                          totalDuration = selectedTask.total_duration_minutes;
                        } else if (selectedTask.assigned_at) {
                          totalDuration = calculateDuration(selectedTask.assigned_at, selectedTask.completed_at || null);
                        }
                        return totalDuration && totalDuration > 0
                          ? `${formatDuration(totalDuration)}${!selectedTask.completed_at ? ' (berjalan)' : ''}`
                          : '0 menit';
                      })()}
                    </p>
                  </div>
                </div>

                {/* Assigned Users */}
                {selectedTask.assigned_users && selectedTask.assigned_users.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-white mb-2">Petugas IT Support ({selectedTask.assigned_users.length})</p>
                    <div className="space-y-1.5">
                      {selectedTask.assigned_users.map((au, idx) => {
                        const userName = au.profiles?.full_name || 
                                       (au.profiles && typeof au.profiles === 'object' && au.profiles.full_name) ||
                                       'Unknown';
                        const userEmail = au.profiles?.email || 
                                        (au.profiles && typeof au.profiles === 'object' && au.profiles.email) ||
                                        '';
                        return (
                          <div key={idx} className="bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <UserIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{userName}</p>
                                {userEmail && <p className="text-[10px] text-gray-500 truncate">{userEmail}</p>}
                              </div>
                              {getStatusBadge(au.status)}
                            </div>
                            <div className="pt-1.5 border-t border-gray-800 space-y-0.5 text-[10px]">
                              {au.acknowledged_at && (
                                <div className="flex items-center gap-1.5 text-gray-400">
                                  <span>Direspon:</span>
                                  <span className="font-mono">{formatDate(au.acknowledged_at)}</span>
                                </div>
                              )}
                              {au.started_at && (
                                <div className="flex items-center gap-1.5 text-gray-400">
                                  <span>Dimulai:</span>
                                  <span className="font-mono">{formatDate(au.started_at)}</span>
                                </div>
                              )}
                              {au.completed_at && (
                                <div className="flex items-center gap-1.5 text-green-400">
                                  <span>Selesai:</span>
                                  <span className="font-mono">{formatDate(au.completed_at)}</span>
                                </div>
                              )}
                              {(() => {
                                let duration = null;
                                if (au.work_duration_minutes && au.work_duration_minutes > 0) {
                                  duration = au.work_duration_minutes;
                                } else {
                                  const startTime = selectedTask.assigned_at || selectedTask.created_at;
                                  if (startTime) {
                                    duration = calculateDuration(startTime, au.completed_at || null);
                                  }
                                }
                                return duration && duration > 0 ? (
                                  <div className="flex items-center gap-1.5 text-gray-400">
                                    <span>Durasi:</span>
                                    <span className="font-semibold">
                                      {formatDuration(duration)}
                                      {!au.completed_at && ' (berjalan)'}
                                    </span>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Assigned Devices */}
                {selectedTask.assigned_devices && selectedTask.assigned_devices.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-white mb-2">Perangkat ({selectedTask.assigned_devices.length})</p>
                    <div className="space-y-1">
                      {selectedTask.assigned_devices.map((ad, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-950 border border-gray-800 p-2 rounded-lg text-xs">
                          <span className="font-mono font-bold text-yellow-400">{ad.perangkat?.id_perangkat}</span>
                          <span className="text-gray-600">-</span>
                          <span className="text-gray-300">{ad.perangkat?.nama_perangkat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </ScrollArea>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                {canEditAnyTask && (
                  <button
                    onClick={() => handleOpenEdit(selectedTask)}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                  >
                    Edit
                  </button>
                )}
                {selectedTask.status === 'pending' && permissions.canDelete && (
                  <button
                    onClick={() => { setShowDetailModal(false); handleDeleteClick(selectedTask); }}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
                  >
                    Hapus
                  </button>
                )}
                <button
                  onClick={() => { setShowDetailModal(false); setSelectedTask(null); }}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODAL (Admin & Helpdesk) */}
        {showEditModal && selectedTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto modal-backdrop-enter"
            onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full md:w-[540px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter max-h-[85vh]">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <span className="font-bold text-white text-sm">Edit Penugasan</span>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Judul *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Deskripsi</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Prioritas</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    >
                      <option value="low">Rendah</option>
                      <option value="normal">Normal</option>
                      <option value="high">Tinggi</option>
                      <option value="urgent">Mendesak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Kategori SKP *</label>
                    <select
                      value={editForm.skp_category_id}
                      onChange={(e) => setEditForm({ ...editForm, skp_category_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent"
                    >
                      <option value="">-- Pilih SKP --</option>
                      {skpCategories.map((skp) => (
                        <option key={skp.id} value={skp.id}>{skp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-400 font-medium mb-1">Petugas IT Support (tidak diubah)</p>
                  <div className="text-xs text-gray-300">
                    {(selectedTask.assigned_users || []).length > 0
                      ? selectedTask.assigned_users.map((u, idx) => (
                          <div key={idx}>- {u.profiles?.full_name || 'Unknown'} {u.profiles?.email ? `(${u.profiles.email})` : ''}</div>
                        ))
                      : '-'}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                    <input
                      type="checkbox"
                      checked={!!editForm.relate_perangkat}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditForm({ ...editForm, relate_perangkat: checked, assigned_perangkat: checked ? editForm.assigned_perangkat : [] });
                      }}
                      className="w-3.5 h-3.5 text-zinc-500 bg-gray-950 border-gray-700 rounded focus:ring-gray-600"
                    />
                    Relasi ke Perangkat? (opsional)
                  </label>

                  {editForm.relate_perangkat ? (
                    <>
                      <input
                        type="text"
                        placeholder="Cari ID Perangkat..."
                        value={perangkatSearch}
                        onChange={(e) => setPerangkatSearch(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent mb-2"
                      />
                      <ScrollArea className="max-h-36 bg-gray-950 border border-gray-800 rounded-lg">
                        <div className="space-y-1 p-2.5">
                        {perangkatList
                          .filter(p =>
                            p.id_perangkat.toLowerCase().includes(perangkatSearch.toLowerCase()) ||
                            (p.nama_perangkat && p.nama_perangkat.toLowerCase().includes(perangkatSearch.toLowerCase()))
                          )
                          .map((perangkat) => (
                            <label key={perangkat.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-900 p-1.5 rounded text-xs">
                              <input
                                type="checkbox"
                                checked={editForm.assigned_perangkat.includes(perangkat.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditForm({ ...editForm, assigned_perangkat: [...editForm.assigned_perangkat, perangkat.id] });
                                  } else {
                                    setEditForm({ ...editForm, assigned_perangkat: editForm.assigned_perangkat.filter(id => id !== perangkat.id) });
                                  }
                                }}
                                className="w-3.5 h-3.5 text-zinc-500 bg-gray-900 border-gray-700 rounded focus:ring-gray-600"
                              />
                              <span className="flex-1 text-gray-300">
                                <span className="font-mono font-semibold text-yellow-400">{perangkat.id_perangkat}</span>
                                {perangkat.nama_perangkat && ` - ${perangkat.nama_perangkat}`}
                              </span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                      {editForm.assigned_perangkat.length > 0 && (
                        <p className="text-[10px] text-green-400 mt-1">{editForm.assigned_perangkat.length} perangkat dipilih</p>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-500">
                      Perangkat tidak diperlukan untuk tugas ini.
                    </div>
                  )}
                </div>
              </div>
              </ScrollArea>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETION HISTORY MODAL */}
        {showHistoryModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto modal-backdrop-enter"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowHistoryModal(false); setDeletionHistory([]); } }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full h-[75vh] md:w-[600px] md:h-[450px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <div className="min-w-0">
                  <span className="font-bold text-white text-sm">History Penghapusan</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">Audit trail tugas yang dihapus</p>
                </div>
                <button
                  onClick={() => { setShowHistoryModal(false); setDeletionHistory([]); }}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1">
              <div className="p-4">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-500 border-t-zinc-100" />
                  </div>
                ) : deletionHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-xs text-gray-500">Belum ada tugas yang dihapus</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-2.5 mb-3">
                      <p className="text-xs text-gray-300">
                        Total: <span className="text-sm font-bold text-white">{deletionHistory.length}</span> tugas dihapus
                      </p>
                    </div>

                    {deletionHistory.map((item, index) => (
                      <div key={item.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-600">#{index + 1}</span>
                            <span className="text-xs font-mono font-bold text-red-400">{item.task_number}</span>
                            {item.status === 'pending' && getStatusBadge('pending')}
                            {item.priority && getPriorityBadge(item.priority)}
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-red-400">{formatDate(item.deleted_at)}</p>
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-white mb-1">{item.task_title}</p>
                        {item.task_description && (
                          <p className="text-[10px] text-gray-400 line-clamp-2 mb-2">{item.task_description}</p>
                        )}

                        <div className="grid grid-cols-3 gap-2 mb-2 text-[10px]">
                          {item.skp_category_name && (
                            <div>
                              <p className="text-gray-600">SKP</p>
                              <p className="text-gray-300">{item.skp_category_name}</p>
                            </div>
                          )}
                          {item.assigned_by_name && (
                            <div>
                              <p className="text-gray-600">Dibuat oleh</p>
                              <p className="text-gray-300">{item.assigned_by_name}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-gray-600">Dihapus oleh</p>
                            <p className="text-red-400 font-semibold">{item.deleted_by_name || 'Unknown'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {item.user_count > 0 && (
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
                              <p className="text-[10px] text-blue-400 font-semibold mb-1">IT Support ({item.user_count})</p>
                              <div className="space-y-0.5">
                                {item.assigned_users && (typeof item.assigned_users === 'string' ? JSON.parse(item.assigned_users) : item.assigned_users).map((u, idx) => (
                                  <p key={idx} className="text-[10px] text-gray-400">• {u.name}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.device_count > 0 && (
                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2">
                              <p className="text-[10px] text-purple-400 font-semibold mb-1">Perangkat ({item.device_count})</p>
                              <div className="space-y-0.5">
                                {item.assigned_devices && (typeof item.assigned_devices === 'string' ? JSON.parse(item.assigned_devices) : item.assigned_devices).map((d, idx) => (
                                  <p key={idx} className="text-[10px] text-gray-400 font-mono">• {d.id_perangkat}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                          <p className="text-[10px] text-red-400 font-semibold mb-0.5">Alasan:</p>
                          <p className="text-[10px] text-gray-400 italic">"{item.deletion_reason || 'Tidak ada alasan'}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </ScrollArea>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center bg-black">
                <button
                  onClick={() => { setShowHistoryModal(false); setDeletionHistory([]); }}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EXPORT MODAL */}
        {showExportModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 modal-backdrop-enter"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowExportModal(false); setExportMonth(''); setExportYear(new Date().getFullYear().toString()); setExportStartDate(''); setExportEndDate(''); } }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full md:w-[420px] font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <span className="font-bold text-white text-sm">Export Data Penugasan</span>
                <button
                  onClick={() => { setShowExportModal(false); setExportMonth(''); setExportYear(new Date().getFullYear().toString()); setExportStartDate(''); setExportEndDate(''); }}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                >
                  ×
                </button>
              </div>
              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Metode export:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="exportType" value="month" checked={exportType === 'month'} onChange={(e) => setExportType(e.target.value)} className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-xs text-gray-300">By Month</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="exportType" value="daterange" checked={exportType === 'daterange'} onChange={(e) => setExportType(e.target.value)} className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-xs text-gray-300">By Date Range</span>
                    </label>
                  </div>
                </div>

                {exportType === 'month' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Bulan *</label>
                      <select value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                        <option value="">Pilih Bulan</option>
                        <option value="01">Januari</option>
                        <option value="02">Februari</option>
                        <option value="03">Maret</option>
                        <option value="04">April</option>
                        <option value="05">Mei</option>
                        <option value="06">Juni</option>
                        <option value="07">Juli</option>
                        <option value="08">Agustus</option>
                        <option value="09">September</option>
                        <option value="10">Oktober</option>
                        <option value="11">November</option>
                        <option value="12">Desember</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Tahun *</label>
                      <input type="number" value={exportYear} onChange={(e) => setExportYear(e.target.value)} min="2020" max={new Date().getFullYear() + 1} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent" placeholder="2024" />
                    </div>
                  </div>
                )}

                {exportType === 'daterange' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Tanggal Mulai *</label>
                      <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Tanggal Akhir *</label>
                      <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent" />
                    </div>
                  </div>
                )}

                <div className="bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">
                    Data akan diekspor dalam format CSV termasuk petugas IT Support dan perangkat yang ditugaskan.
                  </p>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                <button
                  onClick={() => { setShowExportModal(false); setExportMonth(''); setExportYear(new Date().getFullYear().toString()); setExportStartDate(''); setExportEndDate(''); }}
                  disabled={exporting}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting || (exportType === 'month' && (!exportMonth || !exportYear)) || (exportType === 'daterange' && (!exportStartDate || !exportEndDate))}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-500 border-t-zinc-100" />
                      Mengekspor...
                    </>
                  ) : (
                    'Export'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {showDeleteModal && selectedTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 modal-backdrop-enter"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setSelectedTask(null); setDeletionReason(''); } }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full md:w-[420px] font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <span className="font-bold text-white text-sm">Hapus Tugas</span>
                <button
                  onClick={() => { setShowDeleteModal(false); setSelectedTask(null); setDeletionReason(''); }}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                >
                  ×
                </button>
              </div>
              {/* Content */}
              <div className="p-4 space-y-3">
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs font-mono font-bold text-red-400 mb-0.5">{selectedTask.task_number}</p>
                  <p className="text-xs text-gray-300">{selectedTask.title}</p>
                </div>

                {selectedTask.assigned_devices && selectedTask.assigned_devices.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1.5">Perangkat ditugaskan</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTask.assigned_devices.map((ad, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-gray-950 border border-gray-800 text-yellow-400 rounded text-[10px] font-mono font-semibold" title={ad.perangkat?.nama_perangkat || ''}>
                          {ad.perangkat?.id_perangkat || '-'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Alasan Penghapusan *</label>
                  <textarea
                    required
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    className="w-full px-3 py-2 text-[10px] bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500"
                    placeholder="Mengapa tugas ini dihapus? (wajib untuk audit)"
                    rows="3"
                  />
                </div>

                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-yellow-400/80">
                    Tugas akan dihapus dan diarsipkan ke history untuk audit.
                  </p>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                <button
                  onClick={() => { setShowDeleteModal(false); setSelectedTask(null); setDeletionReason(''); }}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={!deletionReason.trim()}
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Task Modal */}
        {showScheduleModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto modal-backdrop-enter"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowScheduleModal(false); setScheduleForm({ title: '', description: '', priority: 'normal', skp_category_id: '', assigned_users: [], scheduled_date: '', scheduled_hour: '', scheduled_minute: '', relate_perangkat: true, assigned_perangkat: [] }); } }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full md:w-[540px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter max-h-[85vh]">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <span className="font-bold text-white text-sm">Jadwalkan Penugasan</span>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    setScheduleForm({ title: '', description: '', priority: 'normal', skp_category_id: '', assigned_users: [], scheduled_date: '', scheduled_hour: '', scheduled_minute: '', relate_perangkat: true, assigned_perangkat: [] });
                  }}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                >
                  ×
                </button>
              </div>
              {/* Scrollable Content */}
              <ScrollArea className="flex-1">
              <form onSubmit={handleSubmitSchedule} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Tanggal Jadwal *</label>
                    <input type="date" required value={scheduleForm.scheduled_date} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Jam (24h) *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select required value={scheduleForm.scheduled_hour} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_hour: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                        <option value="">HH</option>
                        {Array.from({ length: 24 }).map((_, h) => (<option key={h} value={String(h)}>{String(h).padStart(2, '0')}</option>))}
                      </select>
                      <select required value={scheduleForm.scheduled_minute} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_minute: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                        <option value="">MM</option>
                        {Array.from({ length: 60 }).map((_, m) => (<option key={m} value={String(m)}>{String(m).padStart(2, '0')}</option>))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Prioritas</label>
                  <select value={scheduleForm.priority} onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                    <option value="low">Rendah</option>
                    <option value="normal">Normal</option>
                    <option value="high">Tinggi</option>
                    <option value="urgent">Mendesak</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Judul Tugas *</label>
                  <input type="text" required value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500" placeholder="Perbaikan komputer ruang meeting" autoComplete="off" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Deskripsi</label>
                  <textarea value={scheduleForm.description} onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500 resize-none" placeholder="Detail tugas..." rows="3" autoComplete="off" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Assign ke IT Support *</label>
                  <ScrollArea className="max-h-36 bg-gray-950 border border-gray-800 rounded-lg">
                    <div className="space-y-1 p-2.5">
                    {allITSupport.length === 0 ? (
                      <p className="text-xs text-gray-500">Tidak ada data IT Support.</p>
                    ) : (
                      allITSupport.map((its) => (
                        <label key={its.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-900 p-1.5 rounded text-xs">
                          <input type="checkbox" checked={scheduleForm.assigned_users.includes(its.id)} onChange={(e) => { if (e.target.checked) { setScheduleForm({ ...scheduleForm, assigned_users: [...scheduleForm.assigned_users, its.id] }); } else { setScheduleForm({ ...scheduleForm, assigned_users: scheduleForm.assigned_users.filter(id => id !== its.id) }); } }} className="w-3.5 h-3.5 text-zinc-500 bg-gray-900 border-gray-700 rounded focus:ring-gray-600" />
                          <span className="text-gray-300">{its.name} <span className="text-gray-500">({its.email})</span></span>
                        </label>
                      ))
                    )}
                    </div>
                  </ScrollArea>
                  <p className="text-[10px] text-gray-600 mt-1">Tugas dijadwalkan muncul setelah waktu jadwal tiba.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Kategori SKP *</label>
                  <select value={scheduleForm.skp_category_id} onChange={(e) => setScheduleForm({ ...scheduleForm, skp_category_id: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent" required>
                    <option value="">-- Pilih Kategori SKP --</option>
                    {(skpCategories || []).map((cat) => (<option key={cat.id} value={cat.id}>{cat.code} - {cat.name}</option>))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={scheduleForm.relate_perangkat} onChange={(e) => setScheduleForm({ ...scheduleForm, relate_perangkat: e.target.checked, assigned_perangkat: e.target.checked ? scheduleForm.assigned_perangkat : [] })} className="w-3.5 h-3.5 text-zinc-500 bg-gray-950 border-gray-700 rounded focus:ring-gray-600" />
                  <span className="text-xs text-gray-300">Relasikan perangkat</span>
                </div>

                {scheduleForm.relate_perangkat && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Pilih Perangkat *</label>
                    <div className="relative mb-2">
                      <input type="text" value={perangkatSearch} onChange={(e) => setPerangkatSearch(e.target.value)} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500" placeholder="Cari perangkat..." />
                      <MagnifyingGlassPlusIcon className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <ScrollArea className="max-h-36 bg-gray-950 border border-gray-800 rounded-lg">
                      <div className="space-y-1 p-2.5">
                      {perangkatList.filter(p => { if (!perangkatSearch) return true; const q = perangkatSearch.toLowerCase(); return (p.id_perangkat || '').toLowerCase().includes(q) || (p.nama_perangkat || '').toLowerCase().includes(q); }).map((perangkat) => (
                        <label key={perangkat.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-900 p-1.5 rounded text-xs">
                          <input type="checkbox" checked={scheduleForm.assigned_perangkat.includes(perangkat.id)} onChange={(e) => { if (e.target.checked) { setScheduleForm({ ...scheduleForm, assigned_perangkat: [...scheduleForm.assigned_perangkat, perangkat.id] }); } else { setScheduleForm({ ...scheduleForm, assigned_perangkat: scheduleForm.assigned_perangkat.filter(id => id !== perangkat.id) }); } }} className="w-3.5 h-3.5 text-zinc-500 bg-gray-900 border-gray-700 rounded focus:ring-gray-600" />
                          <span className="text-gray-300 flex-1"><span className="font-mono font-bold text-yellow-400">{perangkat.id_perangkat}</span>{perangkat.nama_perangkat && ` - ${perangkat.nama_perangkat}`}</span>
                        </label>
                      ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Footer inside form */}
                <div className="flex gap-2 justify-center pt-3 border-t border-gray-800">
                  <button type="button" onClick={() => { setShowScheduleModal(false); setScheduleForm({ title: '', description: '', priority: 'normal', skp_category_id: '', assigned_users: [], scheduled_date: '', scheduled_hour: '', scheduled_minute: '', relate_perangkat: true, assigned_perangkat: [] }); setPerangkatSearch(''); }} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                    Batal
                  </button>
                  <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {submitting ? (<><div className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-500 border-t-zinc-100" />Memproses...</>) : ('Jadwalkan')}
                  </button>
                </div>
              </form>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {showAddForm && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto modal-backdrop-enter"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAddForm(false); setForm({ title: '', description: '', priority: 'normal', skp_category_id: '', assigned_users: [], relate_perangkat: true, assigned_perangkat: [] }); } }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full md:w-[540px] my-4 md:my-8 font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter max-h-[85vh]">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <span className="font-bold text-white text-sm">Buat Penugasan Baru</span>
                <button
                  onClick={() => { setShowAddForm(false); setForm({ title: '', description: '', priority: 'normal', skp_category_id: '', assigned_users: [], relate_perangkat: true, assigned_perangkat: [] }); }}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2"
                >
                  ×
                </button>
              </div>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1">
              <form onSubmit={handleSubmit} className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Judul Tugas *</label>
                  <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500" placeholder="Perbaikan komputer ruang meeting" autoComplete="off" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Deskripsi</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500 resize-none" placeholder="Detail tugas..." rows="3" autoComplete="off" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Assign ke IT Support *</label>
                  {allITSupport.length === 0 ? (
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-yellow-400 mb-1">Tidak ada IT Support tersedia</p>
                      <p className="text-[10px] text-gray-500">Semua petugas sedang aktif. Anda bisa Hold Task ini.</p>
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="max-h-36 bg-gray-950 border border-gray-800 rounded-lg">
                        <div className="space-y-1 p-2.5">
                        {allITSupport.map((its) => {
                          const isDisabled = !its.isAvailable;
                          const activeTaskNumbers = its.activeTasks.map(t => t.task_number).join(', ');
                          return (
                            <label key={its.id} className={`flex items-center gap-2 p-1.5 rounded text-xs ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-900'}`}>
                              <input type="checkbox" checked={form.assigned_users.includes(its.id)} disabled={isDisabled} onChange={(e) => { if (e.target.checked && !isDisabled) { setForm({ ...form, assigned_users: [...form.assigned_users, its.id], skp_category_id: form.assigned_users.length === 0 ? '' : form.skp_category_id }); } else if (!isDisabled) { setForm({ ...form, assigned_users: form.assigned_users.filter(id => id !== its.id) }); } }} className="w-3.5 h-3.5 text-zinc-500 bg-gray-900 border-gray-700 rounded focus:ring-gray-600 disabled:opacity-50 disabled:cursor-not-allowed" />
                              <span className={`flex-1 ${isDisabled ? 'text-gray-500' : 'text-gray-300'}`}>
                                {its.name} ({its.email})
                                {isDisabled && activeTaskNumbers && <span className="ml-1 text-[10px] text-yellow-400">- aktif: {activeTaskNumbers}</span>}
                                {!isDisabled && <span className="ml-1 text-[10px] text-green-400">- Available</span>}
                              </span>
                            </label>
                          );
                        })}
                        </div>
                      </ScrollArea>
                      {form.assigned_users.length > 0 && (
                        <p className="text-[10px] text-green-400 mt-1">{form.assigned_users.length} petugas dipilih</p>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Kategori SKP *</label>
                    {form.assigned_users.length === 0 ? (
                      skpCategories.length === 0 ? (
                        <div className="w-full px-3 py-2 border border-gray-800 rounded-lg bg-gray-950 text-gray-500 text-xs">Memuat SKP...</div>
                      ) : (
                        <select required value={form.skp_category_id} onChange={(e) => setForm({ ...form, skp_category_id: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                          <option value="">-- Pilih SKP --</option>
                          {skpCategories.map((skp) => (<option key={skp.id} value={skp.id}>{skp.name}</option>))}
                        </select>
                      )
                    ) : filteredSkpCategories.length === 0 ? (
                      <div className="w-full px-3 py-2 border border-yellow-500/30 rounded-lg bg-yellow-500/5 text-yellow-400 text-xs">IT Support belum punya SKP</div>
                    ) : (
                      <select required value={form.skp_category_id} onChange={(e) => setForm({ ...form, skp_category_id: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                        <option value="">-- Pilih SKP --</option>
                        {filteredSkpCategories.map((skp) => (<option key={skp.id} value={skp.id}>{skp.name}</option>))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Prioritas</label>
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent">
                      <option value="low">Rendah</option>
                      <option value="normal">Normal</option>
                      <option value="high">Tinggi</option>
                      <option value="urgent">Mendesak</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                    <input type="checkbox" checked={!!form.relate_perangkat} onChange={(e) => { const checked = e.target.checked; setForm({ ...form, relate_perangkat: checked, assigned_perangkat: checked ? form.assigned_perangkat : [] }); }} className="w-3.5 h-3.5 text-zinc-500 bg-gray-950 border-gray-700 rounded focus:ring-gray-600" />
                    Relasi ke Perangkat? (opsional)
                  </label>
                  {!form.relate_perangkat && (
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-500">Perangkat tidak diperlukan.</div>
                  )}
                </div>

                {form.relate_perangkat && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Pilih Perangkat *</label>
                    <input type="text" placeholder="Cari ID Perangkat..." value={perangkatSearch} onChange={(e) => setPerangkatSearch(e.target.value)} className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent placeholder-gray-500 mb-2" />
                    <ScrollArea className="max-h-36 bg-gray-950 border border-gray-800 rounded-lg">
                      <div className="space-y-1 p-2.5">
                      {perangkatList.filter(p => p.id_perangkat.toLowerCase().includes(perangkatSearch.toLowerCase()) || (p.nama_perangkat && p.nama_perangkat.toLowerCase().includes(perangkatSearch.toLowerCase()))).map((perangkat) => (
                        <label key={perangkat.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-900 p-1.5 rounded text-xs">
                          <input type="checkbox" checked={form.assigned_perangkat.includes(perangkat.id)} onChange={(e) => { if (e.target.checked) { setForm({ ...form, assigned_perangkat: [...form.assigned_perangkat, perangkat.id] }); } else { setForm({ ...form, assigned_perangkat: form.assigned_perangkat.filter(id => id !== perangkat.id) }); } }} className="w-3.5 h-3.5 text-zinc-500 bg-gray-900 border-gray-700 rounded focus:ring-gray-600" />
                          <span className="text-gray-300 flex-1">
                            <span className="font-mono font-bold text-yellow-400">{perangkat.id_perangkat}</span>
                            {perangkat.nama_perangkat && ` - ${perangkat.nama_perangkat}`}
                            <span className={`ml-1 text-[10px] ${perangkat.status_perangkat === 'layak' ? 'text-green-400' : 'text-red-400'}`}>({perangkat.status_perangkat})</span>
                          </span>
                        </label>
                      ))}
                      </div>
                    </ScrollArea>
                    {form.assigned_perangkat.length > 0 && (
                      <p className="text-[10px] text-green-400 mt-1">{form.assigned_perangkat.length} perangkat dipilih</p>
                    )}
                  </div>
                )}

                {/* Footer inside form */}
                <div className="flex gap-2 justify-center pt-3 border-t border-gray-800">
                  <button type="button" onClick={() => { setShowAddForm(false); setForm({ title: '', description: '', priority: 'normal', skp_category_id: '', assigned_users: [], assigned_perangkat: [] }); setPerangkatSearch(''); }} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                    Batal
                  </button>
                  {allITSupport.filter(u => u.isAvailable).length === 0 ? (
                    <button type="button" onClick={handleHoldTask} disabled={submitting} className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      {submitting ? (<><div className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-500 border-t-zinc-100" />Memproses...</>) : ('Hold Task')}
                    </button>
                  ) : (
                    <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                      {submitting ? (<><div className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-500 border-t-zinc-100" />Memproses...</>) : ('Buat Tugas')}
                    </button>
                  )}
                </div>
              </form>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Assign Held Task Modal */}
        {showAssignModal && selectedHeldTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 modal-backdrop-enter"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAssignModal(false); setSelectedHeldTask(null); } }}
          >
            <div className="bg-black rounded-xl shadow-2xl shadow-black/50 border border-gray-800 w-full md:w-[420px] font-['Open_Sans'] flex flex-col overflow-hidden modal-content-enter">
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex justify-between items-start px-4 py-3 bg-black border-b border-gray-800">
                <span className="font-bold text-white text-sm">Assign Tugas</span>
                <button onClick={() => { setShowAssignModal(false); setSelectedHeldTask(null); }} className="flex-shrink-0 text-gray-400 hover:text-white transition text-lg font-bold leading-none ml-2">×</button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-white">{selectedHeldTask.task_number}</span>
                    {getPriorityBadge(selectedHeldTask.priority)}
                  </div>
                  <p className="text-xs font-semibold text-white mb-1.5">{selectedHeldTask.title}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                    <span className="inline-flex items-center gap-1"><ClockIcon className="w-3 h-3" />{formatWaitingDuration(waitingTime[selectedHeldTask.id] || 0)}</span>
                    <span className="inline-flex items-center gap-1"><TagIcon className="w-3 h-3" />{selectedHeldTask.skp_name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Pilih IT Support *</label>
                  {allITSupport.length === 0 ? (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-400">
                      Tidak ada IT Support tersedia.
                    </div>
                  ) : (
                    <select id="assign-it-support" className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-800 text-white rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-transparent" defaultValue="">
                      <option value="">-- Pilih IT Support --</option>
                      {allITSupport.map((its) => {
                        const isDisabled = !its.isAvailable;
                        const activeTaskNumbers = its.activeTasks.map(t => t.task_number).join(', ');
                        const label = isDisabled ? `${its.name} - aktif: ${activeTaskNumbers}` : `${its.name} - Available`;
                        return (<option key={its.id} value={its.id} disabled={isDisabled} style={{ color: isDisabled ? '#6b7280' : '#f3f4f6' }}>{label}</option>);
                      })}
                    </select>
                  )}
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 p-3 border-t border-gray-800 flex justify-center items-center gap-2 bg-black">
                <button onClick={() => { setShowAssignModal(false); setSelectedHeldTask(null); }} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const select = document.getElementById('assign-it-support');
                    if (select && select.value) {
                      const selectedUser = allITSupport.find(u => u.id === select.value);
                      if (selectedUser && !selectedUser.isAvailable) { toast.warning('IT Support ini sedang aktif'); return; }
                      handleSubmitAssignment(select.value);
                    } else { toast.warning('Silakan pilih IT Support'); }
                  }}
                  disabled={allITSupport.filter(u => u.isAvailable).length === 0}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Held Tasks Section */}
        {heldTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-white">Held Tasks</span>
              <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full">{heldTasks.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              {heldTasks.map((task) => {
                const currentWait = waitingTime[task.id] || Math.floor(task.current_waiting_minutes);
                const isOverOneHour = currentWait > 60;
                
                return (
                  <div key={task.id} className={`bg-black rounded-lg px-2.5 pt-2.5 pb-2 border relative hover:border-gray-700 transition ${
                    isOverOneHour ? 'border-red-500/30' : 'border-[#1a1a1a]'
                  }`}>
                    <button 
                      onClick={() => handleAssignHeldTask(task)}
                      className="absolute top-2 right-2 w-5 h-5 text-gray-500 hover:text-white flex items-center justify-center text-xs transition"
                      title="Assign ke IT Support"
                    >
                      +
                    </button>
                    <div className="pr-6">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-white">{task.task_number}</span>
                        {getStatusBadge('on_hold')}
                      </div>
                      <p className="text-xs font-semibold text-white mb-1 line-clamp-2">{task.title}</p>
                      <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                        <span className="inline-flex items-center gap-1"><TagIcon className="w-2.5 h-2.5" />{task.skp_name}</span>
                        <span className="inline-flex items-center gap-1"><UserIcon className="w-2.5 h-2.5" />{task.assigned_by_name}</span>
                        <span className={`inline-flex items-center gap-1 font-medium ${isOverOneHour ? 'text-red-400' : 'text-gray-400'}`}>
                          <ClockIcon className="w-2.5 h-2.5" />{formatWaitingDuration(currentWait)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="bg-black border border-[#1a1a1a] rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500">Held</p>
            <p className="text-lg font-bold text-zinc-100 tabular-nums">{heldTasks.length}</p>
            {heldTasks.filter(t => (waitingTime[t.id] || 0) > 60).length > 0 && (
              <p className="text-[10px] text-red-400">{heldTasks.filter(t => (waitingTime[t.id] || 0) > 60).length} &gt; 1 jam</p>
            )}
          </div>
          <div className="bg-black border border-[#1a1a1a] rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500">Total</p>
            <p className="text-lg font-bold text-zinc-100 tabular-nums">{tasks.length}</p>
          </div>
          <div className="bg-black border border-[#1a1a1a] rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500">Dikerjakan</p>
            <p className="text-lg font-bold text-purple-400 tabular-nums">
              {tasks.filter(t => ['in_progress', 'paused'].includes(t.status)).length}
            </p>
          </div>
          <div className="bg-black border border-[#1a1a1a] rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500">Selesai</p>
            <p className="text-lg font-bold text-green-400 tabular-nums">
              {tasks.filter(t => t.status === 'completed').length}
            </p>
          </div>
          <div className="bg-black border border-[#1a1a1a] rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500">Menunggu</p>
            <p className="text-lg font-bold text-yellow-400 tabular-nums">
              {tasks.filter(t => t.status === 'pending').length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-black border border-[#1a1a1a] rounded-lg overflow-hidden">
          <ScrollArea className="w-full">
            <table className="min-w-full divide-y divide-[#1a1a1a]">
              <thead className="bg-zinc-900/50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">No. Tugas</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Judul & SKP</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Petugas</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Perangkat</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Prioritas</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Dibuat</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Selesai</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Durasi</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button
                        onClick={() => handleViewDetail(task)}
                        className="text-xs font-mono font-bold text-white hover:text-gray-300 hover:underline cursor-pointer"
                        title="Klik untuk lihat detail"
                      >
                        {task.task_number}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-white truncate max-w-[200px]">{task.title}</p>
                        <p className="text-[10px] text-gray-500">{task.skp_category?.name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 min-w-[120px]">
                      {task.assigned_users && task.assigned_users.length > 0 ? (
                        <div className="space-y-0.5">
                          {task.assigned_users.map((au, idx) => {
                            const userName = au.profiles?.full_name || au.profiles?.email || (au.user_id ? `User ${au.user_id.substring(0, 8)}...` : 'Unknown');
                            return (
                              <p key={idx} className="text-xs text-gray-300 truncate" title={au.user_id || ''}>{userName}</p>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {task.assigned_devices && task.assigned_devices.length > 0 ? (
                        <div className="space-y-0.5">
                          {task.assigned_devices.map((ad, idx) => {
                            const perangkatId = ad.perangkat?.id_perangkat || (ad.perangkat && typeof ad.perangkat === 'object' && ad.perangkat.id_perangkat) || '-';
                            const perangkatName = ad.perangkat?.nama_perangkat || (ad.perangkat && typeof ad.perangkat === 'object' && ad.perangkat.nama_perangkat) || '';
                            return (
                              <p key={idx} className="text-[10px] font-mono font-semibold text-yellow-400 truncate" title={perangkatName ? `${perangkatId} - ${perangkatName}` : perangkatId}>{perangkatId}</p>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{getPriorityBadge(task.priority)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{getStatusBadge(task.status)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">{formatDate(task.created_at)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">
                      {task.completed_at ? (<span className="text-green-400">{formatDate(task.completed_at)}</span>) : '-'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">
                      {task.status === 'completed' ? (
                        <span className="font-semibold text-green-400">
                          {(() => {
                            if (task.total_duration_minutes && task.total_duration_minutes > 0) return formatDuration(task.total_duration_minutes);
                            if (task.assigned_at && task.completed_at) { const c = calculateDuration(task.assigned_at, task.completed_at); return c && c > 0 ? formatDuration(c) : '0 menit'; }
                            return '0 menit';
                          })()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => handleViewDetail(task)} className="text-gray-500 hover:text-white transition" title="Lihat detail">
                          <MagnifyingGlassPlusIcon className="w-4 h-4" />
                        </button>
                        {task.status === 'pending' && permissions.canDelete && (
                          <button onClick={() => handleDeleteClick(task)} className="text-gray-500 hover:text-red-400 transition text-xs" title="Hapus tugas">
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {tasks.length === 0 && (
            <div className="bg-gray-950 border-t border-[#1a1a1a] p-8 text-center">
              <p className="text-xs text-gray-500">Belum ada tugas yang dibuat</p>
              <p className="text-[10px] text-gray-600 mt-1">Klik "Buat Tugas" untuk memulai</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Penugasan;
