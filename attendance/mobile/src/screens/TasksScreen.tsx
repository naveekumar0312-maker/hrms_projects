import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import {
  Eye,
  Calendar,
  Clock,
  X,
  Users,
  User,
  Plus,
  MessageSquare,
  Paperclip,
  Activity,
  Send,
  Mic,
  Square,
  Link2,
  FileText,
  Image as ImageIcon,
  Play,
  Pause,
  Download,
  Timer,
  History,
  UploadCloud,
  FolderCheck,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import {
  getEmployeeTasks,
  updateTaskStatus,
  addTaskComment,
  getTaskComments,
  getAssignableMembers,
  createTask,
  updateTask,
  deleteTask,
  transcribeAudio,
  getTaskDetail,
  logTaskTime,
  uploadTaskAttachment,
  MobileTask,
  AssignedEmployee,
} from '../services/taskService';
import { MobileEmployeeMultiSelect } from '../components/pickers/MobileEmployeeMultiSelect';
import { DatePicker } from '../components/pickers/DatePicker';
import { colors } from '../theme/colors';
import { resolveMediaUrl } from '../utils/imageUtils';
import { AppHeader } from '../components/AppHeader';
import { AuthContext } from '../context/AuthContext';
import { useAppMessage } from '../context/MessageContext';

export const TasksScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const { showSuccess, showError, showWarning, showConfirm } = useAppMessage();
  const isManagerOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR', 'REPORTING_MANAGER', 'TEAM_LEADER'].includes(
    user?.role || ''
  );

  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  // View/Update Task Workspace Modal State
  const [selectedTask, setSelectedTask] = useState<MobileTask | null>(null);
  const [taskCommentsList, setTaskCommentsList] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('IN_PROGRESS');
  const [commentText, setCommentText] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  // Comment Attachments (Workspace modal)
  const [activeCommentType, setActiveCommentType] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'LINK' | 'FILE'>('TEXT');
  const [linkInput, setLinkInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ uri: string; name: string; type?: string; size?: string } | null>(null);
  const [sendingComment, setSendingComment] = useState(false);

  // Audio Recording State
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<any>(null);

  // Audio Playback State
  const [playingAudioId, setPlayingAudioId] = useState<number | string | null>(null);
  const activeAudioPlayer = useRef<any>(null);

  // In-App Media Viewer State (Photo, File, Link) - No Chrome redirect
  const [viewingMedia, setViewingMedia] = useState<{
    type: 'IMAGE' | 'FILE';
    url: string;
    title?: string;
  } | null>(null);

  // Create Task Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [statusVal, setStatusVal] = useState<string>('PENDING');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<number[]>([]);
  const [assignableMembers, setAssignableMembers] = useState<AssignedEmployee[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Tabs in Create Modal
  const [createModalTab, setCreateModalTab] = useState<'comment' | 'attachment' | 'activity' | 'timelog'>('comment');
  const [instructionComment, setInstructionComment] = useState('');
  const [createAttachedFile, setCreateAttachedFile] = useState<{ uri: string; name: string; type?: string; size?: string } | null>(null);
  const [createCommentType, setCreateCommentType] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'LINK' | 'FILE'>('TEXT');
  const [createLinkInput, setCreateLinkInput] = useState('');
  const [createEstimatedHours, setCreateEstimatedHours] = useState('0');

  // Edit Task State
  const [editingTask, setEditingTask] = useState<MobileTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [editStatus, setEditStatus] = useState<string>('PENDING');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editEstimatedHours, setEditEstimatedHours] = useState('0');
  const [editAssignedIds, setEditAssignedIds] = useState<number[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEmployeeTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load mobile tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const members = await getAssignableMembers();
      setAssignableMembers(members);
    } catch (e) {
      console.error('Failed to load assignable team members:', e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadCommentsForTask = async (taskId: number) => {
    try {
      setLoadingComments(true);
      const data = await getTaskComments(taskId);
      setTaskCommentsList(data);
    } catch (e) {
      console.log('Failed to load task comments:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  // IMAGE PICKER
  const pickImage = async (forCreate: boolean = false) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showWarning('Permission Denied', 'Camera roll permissions are required to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const filename = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
        const fileObj = {
          uri: asset.uri,
          name: filename,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize ? `${(asset.fileSize / 1024).toFixed(1)} KB` : 'Image',
        };
        if (forCreate) {
          setCreateAttachedFile(fileObj);
          setCreateCommentType('IMAGE');
        } else {
          setAttachedFile(fileObj);
          setActiveCommentType('IMAGE');
        }
      }
    } catch (e) {
      console.log('Error picking image:', e);
      showError('Failed to pick image.');
    }
  };

  // DOCUMENT / FILE PICKER
  const pickDocument = async (forCreate: boolean = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileObj = {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size ? `${(asset.size / 1024).toFixed(1)} KB` : 'File',
        };
        if (forCreate) {
          setCreateAttachedFile(fileObj);
          setCreateCommentType('FILE');
        } else {
          setAttachedFile(fileObj);
          setActiveCommentType('FILE');
        }
      }
    } catch (e) {
      console.log('Error picking document:', e);
      showError('Failed to select document.');
    }
  };

  
  // VOICE AUDIO (Safe Document/Audio Picker to support Expo Go without native ExponentAV crash)
  
  // Voice-to-Text Speech Recognition State for Task Title & Description
  const [voiceTypingTarget, setVoiceTypingTarget] = useState<'title' | 'description' | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [titleVoiceAudioUri, setTitleVoiceAudioUri] = useState<string | null>(null);
  const [descVoiceAudioUri, setDescVoiceAudioUri] = useState<string | null>(null);
  const voiceTypingRecorder = useRef<any>(null);
  const voiceTypingSeconds = useRef<number>(0);
  const voiceTypingInterval = useRef<any>(null);

  const startVoiceTyping = async (target: 'title' | 'description') => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showWarning('Microphone Permission', 'Please allow microphone access to speak and enter text.');
        return;
      }

      if (voiceTypingTarget) {
        await stopVoiceTyping();
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recorder.prepareToRecordAsync();
      recorder.record();
      voiceTypingRecorder.current = recorder;
      setVoiceTypingTarget(target);
      voiceTypingSeconds.current = 0;

      voiceTypingInterval.current = setInterval(() => {
        voiceTypingSeconds.current += 1;
      }, 1000);
    } catch (e: any) {
      console.log('Error starting voice typing:', e);
      showError('Unable to access microphone for voice typing.');
      setVoiceTypingTarget(null);
    }
  };

  const stopVoiceTyping = async () => {
    const target = voiceTypingTarget;
    if (voiceTypingInterval.current) {
      clearInterval(voiceTypingInterval.current);
      voiceTypingInterval.current = null;
    }

    if (voiceTypingRecorder.current && target) {
      try {
        setTranscribing(true);
        await voiceTypingRecorder.current.stop();
        const uri = voiceTypingRecorder.current.uri;
        voiceTypingRecorder.current = null;

        if (uri) {
          if (target === 'title') {
            setTitleVoiceAudioUri(uri);
          } else {
            setDescVoiceAudioUri(uri);
          }

          const text = await transcribeAudio(uri, 'audio/m4a', 'voice_speech.m4a');
          if (text && text.trim()) {
            if (target === 'title') {
              setTitle((prev) => (prev ? prev.trim() + ' ' + text.trim() : text.trim()));
            } else {
              setDescription((prev) => (prev ? prev.trim() + ' ' + text.trim() : text.trim()));
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to transcribe voice:', err);
      } finally {
        setTranscribing(false);
        setVoiceTypingTarget(null);
      }
    } else {
      setVoiceTypingTarget(null);
    }
  };

  // LIVE AUDIO RECORDING VIA EXPO-AUDIO
  const [audioRecorderInstance, setAudioRecorderInstance] = useState<any>(null);

  const startLiveRecording = async (forCreate: boolean = false) => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showWarning('Microphone Permission', 'Please grant microphone access to record voice messages.');
        return;
      }

      // Prepare recorder with High Quality preset
      const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recorder.prepareToRecordAsync();
      recorder.record();

      setAudioRecorderInstance(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (e: any) {
      console.log('Error starting live recording, fallback to audio picker:', e);
      pickAudioFile(forCreate);
    }
  };

  const stopLiveRecording = async (forCreate: boolean = false) => {
    try {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      setIsRecording(false);

      if (audioRecorderInstance) {
        await audioRecorderInstance.stop();
        const uri = audioRecorderInstance.uri;
        setAudioRecorderInstance(null);

        if (uri) {
          const fileObj = {
            uri,
            name: `voice_note_${Date.now()}.m4a`,
            type: 'audio/m4a',
            size: `${recordingDuration}s Audio`,
          };
          if (forCreate) {
            setCreateAttachedFile(fileObj);
            setCreateCommentType('AUDIO');
          } else {
            setAttachedFile(fileObj);
            setActiveCommentType('AUDIO');
          }
        }
      }
    } catch (e) {
      console.log('Error stopping recording:', e);
    }
  };

  const pickAudioFile = async (forCreate: boolean = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileObj = {
          uri: asset.uri,
          name: asset.name || 'voice_note.m4a',
          type: asset.mimeType || 'audio/m4a',
          size: asset.size ? (asset.size / 1024).toFixed(1) + ' KB Audio' : 'Audio',
        };
        if (forCreate) {
          setCreateAttachedFile(fileObj);
          setCreateCommentType('AUDIO');
        } else {
          setAttachedFile(fileObj);
          setActiveCommentType('AUDIO');
        }
      }
    } catch (e) {
      console.log('Error selecting audio:', e);
      showError('Failed to pick audio file.');
    }
  };


  const playAudio = async (audioUri: string, id: number | string) => {
    try {
      const fullUri = (audioUri.startsWith('file://') || audioUri.startsWith('content://'))
        ? audioUri
        : (resolveMediaUrl(audioUri) || audioUri);

      if (playingAudioId === id) {
        // Toggle pause / stop
        if (activeAudioPlayer.current) {
          activeAudioPlayer.current.pause();
          activeAudioPlayer.current = null;
        }
        setPlayingAudioId(null);
        return;
      }

      // Stop any existing player
      if (activeAudioPlayer.current) {
        try {
          activeAudioPlayer.current.pause();
        } catch (e) {}
        activeAudioPlayer.current = null;
      }

      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
      } catch (err) {}

      const player = createAudioPlayer(fullUri);
      activeAudioPlayer.current = player;
      setPlayingAudioId(id);

      player.play();

      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          setPlayingAudioId(null);
          activeAudioPlayer.current = null;
        }
      });
    } catch (e) {
      console.log('Error opening/playing audio in-app:', e);
      setPlayingAudioId(null);
      showError('Unable to play voice message directly.');
    }
  };

  const handleOpenCreateModal = () => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setStatusVal('PENDING');
    setStartDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date().toISOString().split('T')[0]);
    setAssignedEmployeeIds([]);
    setInstructionComment('');
    setCreateAttachedFile(null);
    setCreateCommentType('TEXT');
    setCreateLinkInput('');
    setCreateModalTab('comment');
    setCreateModalVisible(true);
    loadMembers();
  };

  const handleCreateNewTask = async (isDraft: boolean = false) => {
    if (!title.trim()) {
      showWarning('Required', 'Please enter a Task Title.');
      return;
    }
    if (assignedEmployeeIds.length === 0) {
      showWarning('Required', 'Please assign at least one employee to this task.');
      return;
    }

    try {
      setCreating(true);
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status: isDraft ? 'DRAFT' : statusVal,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        estimated_hours: Number(createEstimatedHours) || 0,
        assigned_employee_ids: assignedEmployeeIds,
        additional_instructions: instructionComment.trim() || undefined,
      };

      const created = await createTask(payload);
      if (created?.id) {
        // If voice / image / file / link is present, post as comment
        if (createAttachedFile || createLinkInput.trim() || instructionComment.trim()) {
          try {
            await addTaskComment(created.id, instructionComment.trim(), {
              comment_type: createCommentType,
              link_url: createLinkInput.trim() || undefined,
              fileUri: createAttachedFile?.uri,
              fileName: createAttachedFile?.name,
              mimeType: createAttachedFile?.type,
              fileSize: createAttachedFile?.size,
            });
          } catch (cErr) {
            console.log('Error adding attached comment:', cErr);
          }
        }
      }

      setCreateModalVisible(false);
      showSuccess('Success', `Task "${created.title}" created successfully!`);
      loadTasks();
    } catch (err: any) {
      console.error('Failed to create task:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Failed to create task.';
      showError(detail);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (task: MobileTask) => {
    setEditingTask(task);
    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    const ids = task.assigned_employees?.map((e: any) => e.id) || ((task as any).assigned_to ? [(task as any).assigned_to] : []);
    setEditAssignedIds(ids);
    setEditStartDate(task.start_date || '');
    setEditDueDate(task.due_date || '');
    setEditPriority(task.priority || 'MEDIUM');
    setEditStatus(task.status || 'PENDING');
    setEditEstimatedHours(String(task.estimated_hours || 0));
  };

  const handleSaveEditTask = async () => {
    if (!editingTask) return;
    if (!editTitle.trim()) {
      showWarning('Required', 'Task title cannot be empty.');
      return;
    }
    setSavingEdit(true);
    try {
      const payload: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        status: editStatus,
        estimated_hours: Number(editEstimatedHours) || 0,
        assigned_employee_ids: editAssignedIds,
      };
      if (editStartDate) payload.start_date = editStartDate;
      if (editDueDate) payload.due_date = editDueDate;

      const updated = await updateTask(editingTask.id, payload);
      showSuccess('Success', `Task "${updated.title}" updated successfully!`);
      setEditingTask(null);
      if (selectedTask?.id === editingTask.id) {
        const full = await getTaskDetail(editingTask.id);
        setSelectedTask(full);
      }
      loadTasks();
    } catch (err: any) {
      console.error('Failed to update task:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Failed to update task.';
      showError(detail);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTask = (taskId: number, taskTitle: string) => {
    showConfirm({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${taskTitle}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteTask(taskId);
          showSuccess('Success', 'Task deleted successfully.');
          if (selectedTask?.id === taskId) {
            setSelectedTask(null);
          }
          loadTasks();
        } catch (err: any) {
          console.error('Failed to delete task:', err);
          const detail = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete task.';
          showError(detail);
        }
      },
    });
  };

  const [detailTab, setDetailTab] = useState<'comment' | 'attachment' | 'activity' | 'timelog'>('comment');
  const [logHours, setLogHours] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logDescription, setLogDescription] = useState('');
  const [loggingTime, setLoggingTime] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const handleOpenTask = async (task: MobileTask) => {
    setSelectedTask(task);
    setNewStatus(task.status === 'PENDING' ? 'IN_PROGRESS' : task.status);
    setCommentText('');
    setCompletionNotes(task.completion_notes || '');
    setAttachedFile(null);
    setActiveCommentType('TEXT');
    setLinkInput('');
    setDetailTab('comment');
    setLogHours('');
    setLogDescription('');
    loadCommentsForTask(task.id);
    try {
      const full = await getTaskDetail(task.id);
      if (full) setSelectedTask(full);
    } catch {}
  };

  const handleSaveTimeLog = async () => {
    if (!selectedTask) return;
    const h = parseFloat(logHours);
    if (isNaN(h) || h <= 0) {
      showWarning('Required', 'Please enter valid hours (e.g. 1.5).');
      return;
    }
    try {
      setLoggingTime(true);
      await logTaskTime(selectedTask.id, {
        hours: h,
        date: logDate || new Date().toISOString().split('T')[0],
        description: logDescription.trim() || undefined,
      });
      setLogHours('');
      setLogDescription('');
      showSuccess('Success', `${h} hours logged successfully!`);
      const updated = await getTaskDetail(selectedTask.id);
      if (updated) setSelectedTask(updated);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to log time.';
      showError(msg);
    } finally {
      setLoggingTime(false);
    }
  };

  const handlePickAndUploadDirectAttachment = async (type: 'doc' | 'image') => {
    if (!selectedTask) return;
    try {
      if (type === 'image') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showWarning('Permission Denied', 'Camera roll access is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          setUploadingAttachment(true);
          await uploadTaskAttachment(selectedTask.id, asset.uri, asset.fileName || 'photo.jpg', asset.mimeType || 'image/jpeg');
          showSuccess('Success', 'Photo uploaded to task attachments!');
          const updated = await getTaskDetail(selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          setUploadingAttachment(true);
          await uploadTaskAttachment(selectedTask.id, asset.uri, asset.name || 'document', asset.mimeType || 'application/octet-stream');
          showSuccess('Success', 'File uploaded to task attachments!');
          const updated = await getTaskDetail(selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }
    } catch (e: any) {
      showError('Failed to upload attachment.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handlePostWorkspaceComment = async () => {
    if (!selectedTask) return;
    if (!commentText.trim() && !attachedFile && !linkInput.trim()) {
      showWarning('Required', 'Please enter a message, record voice, or attach a file.');
      return;
    }

    try {
      setSendingComment(true);
      await addTaskComment(selectedTask.id, commentText.trim(), {
        comment_type: activeCommentType,
        link_url: linkInput.trim() || undefined,
        fileUri: attachedFile?.uri,
        fileName: attachedFile?.name,
        mimeType: attachedFile?.type,
        fileSize: attachedFile?.size,
      });

      setCommentText('');
      setAttachedFile(null);
      setLinkInput('');
      setActiveCommentType('TEXT');
      loadCommentsForTask(selectedTask.id);
    } catch (e: any) {
      console.error('Failed to post comment:', e);
      showError('Failed to post comment.');
    } finally {
      setSendingComment(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!selectedTask) return;
    try {
      setUpdating(true);
      const updated = await updateTaskStatus(
        selectedTask.id,
        newStatus,
        commentText.trim() || undefined,
        completionNotes.trim() || undefined
      );
      setSelectedTask(updated);
      loadTasks();
      showSuccess('Success', 'Workspace status updated successfully.');
    } catch (err: any) {
      console.error('Failed to update task:', err);
      showError('Failed to update workspace status.');
    } finally {
      setUpdating(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'PENDING') {
      return ['TODO', 'IN_PROGRESS', 'PENDING_REVIEW', 'OVERDUE', 'ON_HOLD', 'PENDING'].includes(t.status);
    }
    if (activeTab === 'COMPLETED') {
      return t.status === 'COMPLETED';
    }
    return true;
  });

  const getPriorityBadge = (p: string) => {
    let color = '#22c55e';
    let bg = '#F0F9FF';
    let borderColor = '#BAE6FD';
    if (p === 'MEDIUM') {
      color = '#22C55E';
      bg = '#F0F9FF';
      borderColor = '#BAE6FD';
    } else if (p === 'HIGH') {
      color = '#B45309';
      bg = '#FFFBEB';
      borderColor = '#FDE68A';
    } else if (p === 'URGENT') {
      color = '#DC2626';
      bg = '#FEF2F2';
      borderColor = '#FECACA';
    }
    return { color, bg, borderColor };
  };

  const getStatusBadge = (s: string) => {
    let color = '#444444';
    let bg = '#F5F5F5';
    let borderColor = '#E5E5E5';
    if (s === 'ON_HOLD') {
      color = '#92400E';
      bg = '#FEF3C7';
      borderColor = '#FDE68A';
    } else if (s === 'IN_PROGRESS') {
      color = '#22C55E';
      bg = '#EBF3FC';
      borderColor = '#BAE6FD';
    } else if (s === 'COMPLETED') {
      color = '#15803D';
      bg = '#DCFCE7';
      borderColor = '#BBF7D0';
    } else if (s === 'OVERDUE') {
      color = '#B91C1C';
      bg = '#FEE2E2';
      borderColor = '#FECACA';
    }
    return { color, bg, borderColor };
  };

  const formatCreatedDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `Created ${mm}/${dd}/${yyyy}`;
    } catch {
      return `Created ${dateStr}`;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" hidden={false} />
      <AppHeader
        title="Tasks"
        subtitle="Manage and track assigned project tasks"
        rightAction={
          isManagerOrAdmin ? (
            <TouchableOpacity
              style={styles.createTaskHeaderBtn}
              onPress={handleOpenCreateModal}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.createTaskHeaderBtnText}>Create Task</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* HEADER TABS - Clean Pill Design */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'ALL' && styles.tabItemActive]}
          onPress={() => setActiveTab('ALL')}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
            All Tasks ({tasks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'PENDING' && styles.tabItemActive]}
          onPress={() => setActiveTab('PENDING')}
        >
          <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>Pending</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'COMPLETED' && styles.tabItemActive]}
          onPress={() => setActiveTab('COMPLETED')}
        >
          <Text style={[styles.tabText, activeTab === 'COMPLETED' && styles.tabTextActive]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {/* TASK LIST - Web Reference Matched Cards */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading workspace tasks...</Text>
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>No Tasks Found</Text>
          <Text style={styles.emptySubtitle}>You have no tasks in this category.</Text>
          {isManagerOrAdmin && (
            <TouchableOpacity style={styles.emptyCreateBtn} onPress={handleOpenCreateModal}>
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyCreateBtnText}>Create First Task</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const pBadge = getPriorityBadge(item.priority);
            const sBadge = getStatusBadge(item.status);
            const loggedH = Number(item.total_logged_hours || 0);
            const estH = Number(item.estimated_hours || 0);

            return (
              <View style={styles.taskCard}>
                {/* Row 1: Task Title & Category */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.titleCol}>
                    <Text style={styles.taskTitle}>{item.title}</Text>
                    <Text style={styles.createdDateText}>{formatCreatedDate(item.created_at)}</Text>
                  </View>
                  <View style={styles.badgesCol}>
                    <View style={[styles.badgePill, { backgroundColor: pBadge.bg, borderColor: pBadge.borderColor }]}>
                      <Text style={[styles.badgeText, { color: pBadge.color }]}>{item.priority}</Text>
                    </View>
                    <View style={[styles.badgePill, { backgroundColor: sBadge.bg, borderColor: sBadge.borderColor }]}>
                      <Text style={[styles.badgeText, { color: sBadge.color }]}>{item.status.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                {item.description ? (
                  <Text style={styles.taskDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {/* Dates & Hours Bar */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Calendar size={13} color="#666666" />
                    <Text style={styles.metaText}>
                      {item.start_date || 'No Start'} - {item.due_date || 'No Due'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color="#666666" />
                    <Text style={styles.metaText}>
                      {loggedH.toFixed(1)}h / {estH.toFixed(1)}h
                    </Text>
                  </View>
                </View>

                {/* Bottom Row: Assignees & Workspace Button */}
                <View style={styles.cardFooter}>
                  <View style={styles.avatarGroup}>
                    {item.assigned_employees && item.assigned_employees.length > 0 ? (
                      item.assigned_employees.slice(0, 3).map((emp, i) => (
                        <View key={emp.id} style={[styles.avatarCircle, { marginLeft: i > 0 ? -8 : 0 }]}>
                          {(emp.profile_photo_url || (emp as any).profile_photo) ? (
                            <Image source={{ uri: resolveMediaUrl((emp.profile_photo_url || (emp as any).profile_photo))! }} style={styles.avatarImg} />
                          ) : (
                            <Text style={styles.avatarInitial}>{emp.full_name?.charAt(0) || 'U'}</Text>
                          )}
                        </View>
                      ))
                    ) : (
                      <View style={styles.unassignedBadge}>
                        <User size={12} color="#888888" />
                        <Text style={styles.unassignedText}>Unassigned</Text>
                      </View>
                    )}
                    {item.assigned_employees && item.assigned_employees.length > 3 && (
                      <View style={[styles.avatarCircle, { marginLeft: -8, backgroundColor: '#E0E7FF' }]}>
                        <Text style={[styles.avatarInitial, { color: '#4338CA' }]}>
                          +{item.assigned_employees.length - 3}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}
                      onPress={() => openEditModal(item)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Pencil size={14} color="#22C55E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}
                      onPress={() => handleDeleteTask(item.id, item.title)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Trash2 size={14} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.openBtn} onPress={() => handleOpenTask(item)}>
                      <Text style={styles.openBtnText}>Open Task</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* CREATE NEW TASK MODAL - WITH RICH COMMENT (VOICE, IMAGE, FILE, LINK) */}
      <Modal visible={createModalVisible} animationType="slide" transparent={false} presentationStyle="fullScreen">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.modalTitle}>Create New Task</Text>
                <View style={styles.newTaskBadge}>
                  <Text style={styles.newTaskBadgeText}>NEW TASK</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formLabelRow}>
                <Text style={styles.formLabel}>Task Title *</Text>
                <TouchableOpacity
                  style={[
                    styles.voiceTypingBtn,
                    voiceTypingTarget === 'title' && styles.voiceTypingBtnActive,
                  ]}
                  onPress={() => {
                    if (voiceTypingTarget === 'title') {
                      stopVoiceTyping();
                    } else {
                      startVoiceTyping('title');
                    }
                  }}
                  disabled={transcribing}
                  activeOpacity={0.8}
                >
                  {transcribing && voiceTypingTarget === 'title' ? (
                    <ActivityIndicator size="small" color="#22C55E" />
                  ) : (
                    <>
                      <Mic
                        size={13}
                        color={voiceTypingTarget === 'title' ? '#DC2626' : '#475569'}
                      />
                      <Text
                        style={[
                          styles.voiceTypingBtnText,
                          voiceTypingTarget === 'title' && styles.voiceTypingBtnTextActive,
                        ]}
                      >
                        {voiceTypingTarget === 'title' ? 'Tap to Stop' : 'Voice'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.formInput}
                placeholder="Enter task title (or tap Voice)..."
                placeholderTextColor="#999999"
                value={title}
                onChangeText={setTitle}
              />
              {titleVoiceAudioUri && (
                <View style={styles.voiceAudioBox}>
                  <TouchableOpacity
                    style={styles.voiceAudioPlayBtn}
                    onPress={() => playAudio(titleVoiceAudioUri, 'title_voice')}
                  >
                    {playingAudioId === 'title_voice' ? (
                      <Pause size={14} color="#22C55E" />
                    ) : (
                      <Play size={14} color="#22C55E" />
                    )}
                    <Text style={styles.voiceAudioPlayText}>Play Title Voice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setTitleVoiceAudioUri(null)}>
                    <X size={14} color="#888888" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.formLabelRow, { marginTop: 6 }]}>
                <Text style={styles.formLabel}>Description</Text>
                <TouchableOpacity
                  style={[
                    styles.voiceTypingBtn,
                    voiceTypingTarget === 'description' && styles.voiceTypingBtnActive,
                  ]}
                  onPress={() => {
                    if (voiceTypingTarget === 'description') {
                      stopVoiceTyping();
                    } else {
                      startVoiceTyping('description');
                    }
                  }}
                  disabled={transcribing}
                  activeOpacity={0.8}
                >
                  {transcribing && voiceTypingTarget === 'description' ? (
                    <ActivityIndicator size="small" color="#22C55E" />
                  ) : (
                    <>
                      <Mic
                        size={13}
                        color={voiceTypingTarget === 'description' ? '#DC2626' : '#475569'}
                      />
                      <Text
                        style={[
                          styles.voiceTypingBtnText,
                          voiceTypingTarget === 'description' && styles.voiceTypingBtnTextActive,
                        ]}
                      >
                        {voiceTypingTarget === 'description' ? 'Tap to Stop' : 'Voice'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.formInput, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Provide full context, technical specifications, and expected deliverables (or tap Voice)..."
                placeholderTextColor="#999999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              {descVoiceAudioUri && (
                <View style={styles.voiceAudioBox}>
                  <TouchableOpacity
                    style={styles.voiceAudioPlayBtn}
                    onPress={() => playAudio(descVoiceAudioUri, 'desc_voice')}
                  >
                    {playingAudioId === 'desc_voice' ? (
                      <Pause size={14} color="#22C55E" />
                    ) : (
                      <Play size={14} color="#22C55E" />
                    )}
                    <Text style={styles.voiceAudioPlayText}>Play Description Voice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDescVoiceAudioUri(null)}>
                    <X size={14} color="#888888" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ marginTop: 6, marginBottom: 8 }}>
                <MobileEmployeeMultiSelect
                  members={assignableMembers}
                  selectedIds={assignedEmployeeIds}
                  onChange={setAssignedEmployeeIds}
                  label="Assign Employees"
                />
              </View>

              <View style={styles.dateBlockContainer}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <DatePicker
                    label="Started Date"
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Select start date"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <DatePicker
                    label="Ended Date"
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="Select end date"
                    required
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.formLabel}>Status</Text>
                  <View style={styles.pickerSelector}>
                    {['PENDING', 'IN_PROGRESS'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.selectorPill,
                          statusVal === st && styles.selectorPillActive,
                        ]}
                        onPress={() => setStatusVal(st)}
                      >
                        <Text style={[styles.selectorPillText, statusVal === st && styles.selectorPillTextActive]}>
                          {st === 'PENDING' ? 'To Do' : 'In Progress'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.formLabel}>Priority</Text>
                  <View style={styles.pickerSelector}>
                    {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((pr) => (
                      <TouchableOpacity
                        key={pr}
                        style={[
                          styles.selectorPill,
                          priority === pr && styles.selectorPillActive,
                        ]}
                        onPress={() => setPriority(pr)}
                      >
                        <Text style={[styles.selectorPillText, priority === pr && styles.selectorPillTextActive]}>
                          {pr.charAt(0) + pr.slice(1).toLowerCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Rich Tabs: Discussion, Files, Time Log, Activity */}
              <View style={styles.webTabContainer}>
                <View style={styles.webTabHeader}>
                  <TouchableOpacity
                    style={[styles.webTabItem, createModalTab === 'comment' && styles.webTabItemActive]}
                    onPress={() => setCreateModalTab('comment')}
                  >
                    <MessageSquare size={13} color={createModalTab === 'comment' ? '#22C55E' : '#666666'} />
                    <Text style={[styles.webTabText, createModalTab === 'comment' && styles.webTabTextActive]}>
                      Discussion
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.webTabItem, createModalTab === 'attachment' && styles.webTabItemActive]}
                    onPress={() => setCreateModalTab('attachment')}
                  >
                    <Paperclip size={13} color={createModalTab === 'attachment' ? '#22C55E' : '#666666'} />
                    <Text style={[styles.webTabText, createModalTab === 'attachment' && styles.webTabTextActive]}>
                      Files
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.webTabItem, createModalTab === 'timelog' && styles.webTabItemActive]}
                    onPress={() => setCreateModalTab('timelog')}
                  >
                    <Clock size={13} color={createModalTab === 'timelog' ? '#22C55E' : '#666666'} />
                    <Text style={[styles.webTabText, createModalTab === 'timelog' && styles.webTabTextActive]}>
                      Time Log
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.webTabItem, createModalTab === 'activity' && styles.webTabItemActive]}
                    onPress={() => setCreateModalTab('activity')}
                  >
                    <Activity size={13} color={createModalTab === 'activity' ? '#22C55E' : '#666666'} />
                    <Text style={[styles.webTabText, createModalTab === 'activity' && styles.webTabTextActive]}>
                      Activity Log
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.webTabBody}>
                  {createModalTab === 'comment' && (
                    <View>
                      {/* Selected attachment pill */}
                      {createAttachedFile && (
                        <View style={styles.attachmentPill}>
                          {createCommentType === 'AUDIO' ? (
                            <Mic size={14} color="#22C55E" />
                          ) : createCommentType === 'IMAGE' ? (
                            <ImageIcon size={14} color="#22C55E" />
                          ) : (
                            <FileText size={14} color="#22C55E" />
                          )}
                          <Text style={styles.attachmentPillText} numberOfLines={1}>
                            {createAttachedFile.name} ({createAttachedFile.size})
                          </Text>
                          <TouchableOpacity onPress={() => setCreateAttachedFile(null)}>
                            <X size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {createCommentType === 'LINK' && (
                        <View style={styles.linkInputRow}>
                          <Link2 size={15} color="#22C55E" />
                          <TextInput
                            style={styles.linkInput}
                            placeholder="Paste link URL (e.g. https://...)"
                            placeholderTextColor="#999"
                            value={createLinkInput}
                            onChangeText={setCreateLinkInput}
                            autoCapitalize="none"
                          />
                          <TouchableOpacity onPress={() => { setCreateLinkInput(''); setCreateCommentType('TEXT'); }}>
                            <X size={14} color="#888" />
                          </TouchableOpacity>
                        </View>
                      )}

                      <TextInput
                        style={styles.commentInputBox}
                        placeholder="Type a message, instruction, or update..."
                        placeholderTextColor="#999999"
                        value={instructionComment}
                        onChangeText={setInstructionComment}
                        multiline
                      />

                      {/* Attachment Actions Toolbar: Image, Doc, Voice, Link */}
                      <View style={styles.composerToolbar}>
                        <View style={styles.composerIcons}>
                          <TouchableOpacity
                            style={styles.toolIconBtn}
                            onPress={() => pickImage(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <ImageIcon size={18} color="#22C55E" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.toolIconBtn}
                            onPress={() => pickDocument(true)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Paperclip size={18} color="#22C55E" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.toolIconBtn, isRecording && styles.toolIconBtnActive]}
                            onPress={() => (isRecording ? stopLiveRecording(true) : startLiveRecording(true))}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {isRecording ? <Square size={16} color="#EF4444" /> : <Mic size={18} color="#22C55E" />}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.toolIconBtn}
                            onPress={() => setCreateCommentType('LINK')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Link2 size={18} color="#22C55E" />
                          </TouchableOpacity>

                          {isRecording && (
                            <View style={styles.recordingLiveIndicator}>
                              <View style={styles.redDot} />
                              <Text style={styles.recordingDurationText}>{recordingDuration}s</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {createModalTab === 'attachment' && (
                    <View style={{ padding: 12 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: '#1E293B', marginBottom: 8 }}>
                        Task Files & Attachments
                      </Text>
                      {createAttachedFile ? (
                        <View style={[styles.attachmentPill, { marginBottom: 12 }]}>
                          <FileText size={16} color="#22C55E" />
                          <Text style={styles.attachmentPillText} numberOfLines={1}>
                            {createAttachedFile.name} ({createAttachedFile.size || 'Attached'})
                          </Text>
                          <TouchableOpacity onPress={() => setCreateAttachedFile(null)}>
                            <X size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic', marginBottom: 12 }}>
                          No files attached yet. You can attach reference files or images below.
                        </Text>
                      )}

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#F0FDF4',
                            borderWidth: 1,
                            borderColor: '#BBF7D0',
                            borderRadius: 8,
                            paddingVertical: 10,
                            gap: 6,
                          }}
                          onPress={() => pickImage(true)}
                        >
                          <ImageIcon size={16} color="#22C55E" />
                          <Text style={{ fontSize: 12, fontFamily: 'Comfortaa_700Bold', color: '#22C55E' }}>Upload Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#EFF6FF',
                            borderWidth: 1,
                            borderColor: '#BFDBFE',
                            borderRadius: 8,
                            paddingVertical: 10,
                            gap: 6,
                          }}
                          onPress={() => pickDocument(true)}
                        >
                          <Paperclip size={16} color="#0284C7" />
                          <Text style={{ fontSize: 12, fontFamily: 'Comfortaa_700Bold', color: '#0284C7' }}>Upload Document</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {createModalTab === 'timelog' && (
                    <View style={{ padding: 12 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: '#1E293B', marginBottom: 4 }}>
                        Estimated Working Hours
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
                        Estimated time allocated to finish this task (in hours).
                      </Text>
                      <TextInput
                        style={[styles.formInput, { minHeight: 44 }]}
                        placeholder="e.g. 4.5"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={createEstimatedHours}
                        onChangeText={setCreateEstimatedHours}
                      />
                      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
                          Assignees will log real working hours against this task in their Time Log workspace.
                        </Text>
                      </View>
                    </View>
                  )}

                  {createModalTab === 'activity' && (
                    <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center' }}>
                      <Activity size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                      <Text style={{ fontSize: 13, fontFamily: 'Comfortaa_700Bold', color: '#334155', textAlign: 'center', marginBottom: 4 }}>
                        Activity Trail Ready
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 16 }}>
                        Task creation, employee assignment, status updates, file uploads, and logged hours will be automatically recorded here.
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Bottom Actions: Close | Draft | Submit */}
              <View style={styles.createModalActions}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setCreateModalVisible(false)}
                  disabled={creating}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.draftBtn}
                    onPress={() => handleCreateNewTask(true)}
                    disabled={creating}
                  >
                    <Text style={styles.draftBtnText}>Draft</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitTaskBtn}
                    onPress={() => handleCreateNewTask(false)}
                    disabled={creating}
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitTaskBtnText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT TASK MODAL */}
      <Modal visible={!!editingTask} animationType="slide" transparent={false} presentationStyle="fullScreen">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.modalTitle}>Edit Task</Text>
                <View style={[styles.newTaskBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.newTaskBadgeText, { color: '#1D4ED8' }]}>EDIT</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEditingTask(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color="#444444" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.formLabel}>Task Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter task title..."
                placeholderTextColor="#999999"
                value={editTitle}
                onChangeText={setEditTitle}
              />

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Description</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Task description and deliverables..."
                placeholderTextColor="#999999"
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={3}
              />

              <View style={{ marginTop: 10, marginBottom: 8 }}>
                <MobileEmployeeMultiSelect
                  members={assignableMembers}
                  selectedIds={editAssignedIds}
                  onChange={setEditAssignedIds}
                  label="Assign Employees"
                />
              </View>

              <View style={styles.dateBlockContainer}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <DatePicker
                    label="Started Date"
                    value={editStartDate}
                    onChange={setEditStartDate}
                    placeholder="Select start date"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <DatePicker
                    label="Ended Date"
                    value={editDueDate}
                    onChange={setEditDueDate}
                    placeholder="Select end date"
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.formLabel}>Status</Text>
                  <View style={styles.pickerSelector}>
                    {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.selectorPill,
                          editStatus === st && styles.selectorPillActive,
                        ]}
                        onPress={() => setEditStatus(st)}
                      >
                        <Text style={[styles.selectorPillText, editStatus === st && styles.selectorPillTextActive]}>
                          {st === 'PENDING' ? 'To Do' : st === 'IN_PROGRESS' ? 'Progress' : st.replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.formLabel}>Priority</Text>
                  <View style={styles.pickerSelector}>
                    {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((pr) => (
                      <TouchableOpacity
                        key={pr}
                        style={[
                          styles.selectorPill,
                          editPriority === pr && styles.selectorPillActive,
                        ]}
                        onPress={() => setEditPriority(pr)}
                      >
                        <Text style={[styles.selectorPillText, editPriority === pr && styles.selectorPillTextActive]}>
                          {pr.charAt(0) + pr.slice(1).toLowerCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Estimated Hours</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 44 }]}
                placeholder="e.g. 5"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={editEstimatedHours}
                onChangeText={setEditEstimatedHours}
              />

              <View style={[styles.createModalActions, { marginTop: 20 }]}>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setEditingTask(null)}
                  disabled={savingEdit}
                >
                  <Text style={styles.closeBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitTaskBtn, { flex: 1 }]}
                  onPress={handleSaveEditTask}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitTaskBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* VIEW & UPDATE TASK WORKSPACE MODAL - WITH RICH COMMENTS & PLAYBACK */}
      <Modal visible={!!selectedTask} animationType="slide" transparent={false} presentationStyle="fullScreen">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {selectedTask && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{selectedTask.title}</Text>
                    <Text style={styles.modalSubtitle}>{formatCreatedDate(selectedTask.created_at)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => openEditModal(selectedTask)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 6, backgroundColor: '#F0FDF4', borderRadius: 8, borderWidth: 1, borderColor: '#DCFCE7' }}
                    >
                      <Pencil size={18} color="#22C55E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteTask(selectedTask.id, selectedTask.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FEE2E2' }}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSelectedTask(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <X size={22} color="#000000" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Priority & Status Bar */}
                <View style={styles.modalBadgeRow}>
                  <View style={[styles.badgePill, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                    <Text style={[styles.badgeText, { color: '#22C55E' }]}>{selectedTask.priority}</Text>
                  </View>
                  <View style={[styles.badgePill, { backgroundColor: '#EBF3FC', borderColor: '#BAE6FD' }]}>
                    <Text style={[styles.badgeText, { color: '#22C55E' }]}>{selectedTask.status.replace(/_/g, ' ')}</Text>
                  </View>
                </View>

                {/* Full Description */}
                <Text style={styles.sectionHeading}>Task Scope & Deliverables</Text>
                <Text style={styles.modalDescription}>
                  {selectedTask.description || 'No detailed instructions provided.'}
                </Text>

                {/* Assigned Employees */}
                <Text style={styles.sectionHeading}>Assigned Team Members</Text>
                <View style={styles.assignedMembersContainer}>
                  {selectedTask.assigned_employees && selectedTask.assigned_employees.length > 0 ? (
                    selectedTask.assigned_employees.map((emp) => (
                      <View key={emp.id} style={styles.memberCard}>
                        <View style={styles.memberAvatarCircle}>
                          {(emp.profile_photo_url || (emp as any).profile_photo) ? (
                            <Image
                              source={{ uri: resolveMediaUrl((emp.profile_photo_url || (emp as any).profile_photo))! }}
                              style={styles.memberAvatarImg}
                            />
                          ) : (
                            <Text style={styles.memberAvatarInitial}>
                              {emp.full_name?.charAt(0) || 'U'}
                            </Text>
                          )}
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{emp.full_name}</Text>
                          <Text style={styles.memberRole}>
                            {emp.employee_id} {emp.designation ? `• ${emp.designation}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyMembersText}>No employees currently assigned.</Text>
                  )}
                </View>

                {/* Task Workspace Tabs (Discussion, Attachments, Activity, Time Log) */}
                <View style={styles.webTabContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.webTabHeader}>
                    <TouchableOpacity
                      style={[styles.webTabItem, detailTab === 'comment' && styles.webTabItemActive]}
                      onPress={() => setDetailTab('comment')}
                    >
                      <MessageSquare size={13} color={detailTab === 'comment' ? '#22C55E' : '#666666'} />
                      <Text style={[styles.webTabText, detailTab === 'comment' && styles.webTabTextActive]}>
                        Discussion ({taskCommentsList.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.webTabItem, detailTab === 'attachment' && styles.webTabItemActive]}
                      onPress={() => setDetailTab('attachment')}
                    >
                      <Paperclip size={13} color={detailTab === 'attachment' ? '#22C55E' : '#666666'} />
                      <Text style={[styles.webTabText, detailTab === 'attachment' && styles.webTabTextActive]}>
                        Files ({((selectedTask.task_attachments?.length || 0) + taskCommentsList.filter(c => c.attachment).length)})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.webTabItem, detailTab === 'activity' && styles.webTabItemActive]}
                      onPress={() => setDetailTab('activity')}
                    >
                      <History size={13} color={detailTab === 'activity' ? '#22C55E' : '#666666'} />
                      <Text style={[styles.webTabText, detailTab === 'activity' && styles.webTabTextActive]}>
                        Activity Log ({selectedTask.activities?.length || 0})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.webTabItem, detailTab === 'timelog' && styles.webTabItemActive]}
                      onPress={() => setDetailTab('timelog')}
                    >
                      <Timer size={13} color={detailTab === 'timelog' ? '#22C55E' : '#666666'} />
                      <Text style={[styles.webTabText, detailTab === 'timelog' && styles.webTabTextActive]}>
                        Time Log ({selectedTask.total_logged_hours || 0}h)
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* TAB 1: DISCUSSION THREAD */}
                {detailTab === 'comment' && (
                  <>
                    <Text style={[styles.sectionHeading, { marginTop: 14 }]}>
                      Discussion Thread ({taskCommentsList.length})
                    </Text>
                    {loadingComments ? (
                      <ActivityIndicator size="small" color="#22C55E" style={{ marginVertical: 10 }} />
                    ) : taskCommentsList.length === 0 ? (
                      <Text style={styles.noCommentsText}>No comments or attachments posted yet.</Text>
                    ) : (
                      <View style={styles.commentsList}>
                        {taskCommentsList.map((comm) => (
                          <View key={comm.id} style={styles.commentItem}>
                            <View style={styles.commentHeader}>
                              <Text style={styles.commentAuthor}>{comm.author_name || 'Member'}</Text>
                              <Text style={styles.commentTime}>
                                {new Date(comm.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </Text>
                            </View>

                            {/* Text Comment */}
                            {comm.comment ? <Text style={styles.commentBodyText}>{comm.comment}</Text> : null}

                            {/* Image Attachment - In-app Full Screen Viewer */}
                            {comm.comment_type === 'IMAGE' && comm.attachment && (
                              <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() =>
                                  setViewingMedia({
                                    type: 'IMAGE',
                                    url: resolveMediaUrl(comm.attachment)!,
                                    title: comm.file_name || 'Photo Attachment',
                                  })
                                }
                              >
                                <Image
                                  source={{ uri: resolveMediaUrl(comm.attachment)! }}
                                  style={styles.commentAttachedImage}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            )}

                            {/* Voice Note Audio Playback - In-app Player */}
                            {comm.comment_type === 'AUDIO' && comm.attachment && (
                              <TouchableOpacity
                                style={styles.voicePlayBtn}
                                onPress={() => playAudio(comm.attachment, comm.id)}
                              >
                                {playingAudioId === comm.id ? (
                                  <Pause size={16} color="#FFFFFF" />
                                ) : (
                                  <Play size={16} color="#FFFFFF" />
                                )}
                                <Text style={styles.voicePlayText}>
                                  {playingAudioId === comm.id ? 'Playing Voice Note...' : 'Play Voice Message'}
                                </Text>
                              </TouchableOpacity>
                            )}

                            {/* File Attachment - In-app Preview Modal */}
                            {comm.comment_type === 'FILE' && comm.attachment && (
                              <TouchableOpacity
                                style={styles.fileDownloadPill}
                                onPress={() =>
                                  setViewingMedia({
                                    type: 'FILE',
                                    url: resolveMediaUrl(comm.attachment)!,
                                    title: comm.file_name || 'Document File',
                                  })
                                }
                              >
                                <FileText size={15} color="#22C55E" />
                                <Text style={styles.fileNameText} numberOfLines={1}>
                                  {comm.file_name || 'View Attachment'}
                                </Text>
                                <Eye size={14} color="#22C55E" />
                              </TouchableOpacity>
                            )}

                            {/* Link */}
                            {comm.comment_type === 'LINK' && comm.link_url && (
                              <TouchableOpacity
                                style={styles.linkPill}
                                onPress={() => Linking.openURL(comm.link_url)}
                              >
                                <Link2 size={14} color="#22C55E" />
                                <Text style={styles.linkText} numberOfLines={1}>{comm.link_url}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Rich Comment Composer */}
                    <Text style={styles.sectionHeading}>Post Update / Media</Text>
                    <View style={styles.richComposerBox}>
                      {attachedFile && (
                        <View style={styles.attachmentPill}>
                          {activeCommentType === 'AUDIO' ? (
                            <Mic size={14} color="#22C55E" />
                          ) : activeCommentType === 'IMAGE' ? (
                            <ImageIcon size={14} color="#22C55E" />
                          ) : (
                            <FileText size={14} color="#22C55E" />
                          )}
                          <Text style={styles.attachmentPillText} numberOfLines={1}>
                            {attachedFile.name} ({attachedFile.size})
                          </Text>
                          <TouchableOpacity onPress={() => setAttachedFile(null)}>
                            <X size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {activeCommentType === 'LINK' && (
                        <View style={styles.linkInputRow}>
                          <Link2 size={15} color="#22C55E" />
                          <TextInput
                            style={styles.linkInput}
                            placeholder="Paste link URL..."
                            placeholderTextColor="#999"
                            value={linkInput}
                            onChangeText={setLinkInput}
                            autoCapitalize="none"
                          />
                          <TouchableOpacity onPress={() => { setLinkInput(''); setActiveCommentType('TEXT'); }}>
                            <X size={14} color="#888" />
                          </TouchableOpacity>
                        </View>
                      )}

                      <TextInput
                        style={styles.richTextInput}
                        placeholder="Share updates, notes or instructions..."
                        placeholderTextColor="#888888"
                        value={commentText}
                        onChangeText={setCommentText}
                        multiline
                      />

                      {/* Toolbar */}
                      <View style={styles.richToolbarRow}>
                        <View style={styles.composerIcons}>
                          <TouchableOpacity
                            style={styles.toolIconBtn}
                            onPress={() => pickImage(false)}
                          >
                            <ImageIcon size={18} color="#22C55E" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.toolIconBtn}
                            onPress={() => pickDocument(false)}
                          >
                            <Paperclip size={18} color="#22C55E" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.toolIconBtn, isRecording && styles.toolIconBtnActive]}
                            onPress={() => (isRecording ? stopLiveRecording(false) : startLiveRecording(false))}
                          >
                            {isRecording ? <Square size={16} color="#EF4444" /> : <Mic size={18} color="#22C55E" />}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.toolIconBtn}
                            onPress={() => setActiveCommentType('LINK')}
                          >
                            <Link2 size={18} color="#22C55E" />
                          </TouchableOpacity>

                          {isRecording && (
                            <View style={styles.recordingLiveIndicator}>
                              <View style={styles.redDot} />
                              <Text style={styles.recordingDurationText}>{recordingDuration}s</Text>
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.sendCommentBtn}
                          onPress={handlePostWorkspaceComment}
                          disabled={sendingComment}
                        >
                          {sendingComment ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Send size={15} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {/* TAB 2: ATTACHMENTS & FILE UPLOAD */}
                {detailTab === 'attachment' && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.sectionHeading}>Task Files & Uploads</Text>

                    {/* Upload Buttons */}
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#F0FDF4',
                          borderWidth: 1,
                          borderColor: '#BBF7D0',
                          paddingVertical: 10,
                          borderRadius: 8,
                        }}
                        onPress={() => handlePickAndUploadDirectAttachment('image')}
                        disabled={uploadingAttachment}
                      >
                        <ImageIcon size={16} color="#16A34A" />
                        <Text style={{ fontSize: 12, color: '#16A34A', fontFamily: 'Comfortaa_700Bold' }}>
                          Upload Photo
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#EFF6FF',
                          borderWidth: 1,
                          borderColor: '#BFDBFE',
                          paddingVertical: 10,
                          borderRadius: 8,
                        }}
                        onPress={() => handlePickAndUploadDirectAttachment('doc')}
                        disabled={uploadingAttachment}
                      >
                        <UploadCloud size={16} color="#2563EB" />
                        <Text style={{ fontSize: 12, color: '#2563EB', fontFamily: 'Comfortaa_700Bold' }}>
                          Upload Document
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {uploadingAttachment && (
                      <View style={{ alignItems: 'center', marginVertical: 8 }}>
                        <ActivityIndicator size="small" color="#22C55E" />
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Uploading attachment...</Text>
                      </View>
                    )}

                    {/* Direct Task Attachments List */}
                    {selectedTask.task_attachments && selectedTask.task_attachments.length > 0 ? (
                      selectedTask.task_attachments.map((att: any) => (
                        <View
                          key={att.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            padding: 10,
                            borderRadius: 8,
                            marginBottom: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <FileText size={18} color="#22C55E" />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>
                                {att.file_name || 'Task Attachment'}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#64748B' }}>
                                {att.file_size || ''} {att.uploaded_by_name ? `• ${att.uploaded_by_name}` : ''}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              setViewingMedia({
                                type: (att.file_type || '').includes('image') ? 'IMAGE' : 'FILE',
                                url: resolveMediaUrl(att.file || att.file_url)!,
                                title: att.file_name || 'Attachment',
                              })
                            }
                            style={{ padding: 6 }}
                          >
                            <Eye size={16} color="#22C55E" />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noCommentsText}>No dedicated files uploaded to this task yet.</Text>
                    )}
                  </View>
                )}

                {/* TAB 3: ACTIVITY LOG */}
                {detailTab === 'activity' && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.sectionHeading}>Task Activity Trail</Text>
                    {selectedTask.activities && selectedTask.activities.length > 0 ? (
                      selectedTask.activities.map((act: any) => (
                        <View
                          key={act.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 10,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            padding: 10,
                            borderRadius: 8,
                            marginBottom: 8,
                          }}
                        >
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: '#F0FDF4',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: 2,
                            }}
                          >
                            <History size={14} color="#16A34A" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                                {act.action || 'Activity'}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                                {new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                              {act.description || ''}
                            </Text>
                            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                              By {act.user_name || 'System'}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noCommentsText}>No activity recorded on this task yet.</Text>
                    )}
                  </View>
                )}

                {/* TAB 4: TIME LOG */}
                {detailTab === 'timelog' && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.sectionHeading}>Work Time Logs</Text>

                    {/* Total Logged Hours Banner */}
                    <View
                      style={{
                        backgroundColor: '#F0FDF4',
                        borderWidth: 1,
                        borderColor: '#BBF7D0',
                        borderRadius: 10,
                        padding: 14,
                        alignItems: 'center',
                        marginBottom: 14,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '600' }}>TOTAL LOGGED TIME</Text>
                      <Text style={{ fontSize: 24, fontWeight: '800', color: '#15803D', marginTop: 2 }}>
                        {selectedTask.total_logged_hours || 0} hrs
                      </Text>
                    </View>

                    {/* Log New Time Entry Form */}
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 16,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>
                        Log Hours Spent
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Hours *</Text>
                          <TextInput
                            style={{
                              borderWidth: 1,
                              borderColor: '#CBD5E1',
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              fontSize: 13,
                              color: '#0F172A',
                            }}
                            placeholder="e.g. 2.5"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={logHours}
                            onChangeText={setLogHours}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Date *</Text>
                          <TextInput
                            style={{
                              borderWidth: 1,
                              borderColor: '#CBD5E1',
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              fontSize: 13,
                              color: '#0F172A',
                            }}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#94A3B8"
                            value={logDate}
                            onChangeText={setLogDate}
                          />
                        </View>
                      </View>

                      <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Work Description</Text>
                      <TextInput
                        style={{
                          borderWidth: 1,
                          borderColor: '#CBD5E1',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          fontSize: 13,
                          color: '#0F172A',
                          minHeight: 50,
                          textAlignVertical: 'top',
                          marginBottom: 12,
                        }}
                        placeholder="What work was completed during this time?"
                        placeholderTextColor="#94A3B8"
                        value={logDescription}
                        onChangeText={setLogDescription}
                        multiline
                      />

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#22C55E',
                          borderRadius: 8,
                          paddingVertical: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPress={handleSaveTimeLog}
                        disabled={loggingTime}
                      >
                        {loggingTime ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                            Save Time Log
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Past Logs List */}
                    <Text style={[styles.sectionHeading, { fontSize: 12 }]}>Previous Time Logs</Text>
                    {selectedTask.time_logs && selectedTask.time_logs.length > 0 ? (
                      selectedTask.time_logs.map((tl: any) => (
                        <View
                          key={tl.id}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            padding: 10,
                            borderRadius: 8,
                            marginBottom: 6,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                              {tl.hours} hrs on {tl.date}
                            </Text>
                            {tl.description ? (
                              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                {tl.description}
                              </Text>
                            ) : null}
                            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                              Logged by {tl.user_name || 'Staff'}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noCommentsText}>No time logged on this task yet.</Text>
                    )}
                  </View>
                )}

                {/* Status Switcher */}
                <Text style={styles.sectionHeading}>Update Workspace Status</Text>
                <View style={styles.statusButtonGroup}>
                  {['PENDING', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.statusBtn,
                        newStatus === st && styles.statusBtnActive,
                      ]}
                      onPress={() => setNewStatus(st)}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          newStatus === st && styles.statusBtnTextActive,
                        ]}
                      >
                        {st.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {newStatus === 'COMPLETED' && (
                  <>
                    <Text style={styles.sectionHeading}>Completion Summary Notes</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Summary of finished deliverables..."
                      placeholderTextColor="#888888"
                      value={completionNotes}
                      onChangeText={setCompletionNotes}
                      multiline
                    />
                  </>
                )}

                {/* Action Buttons */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setSelectedTask(null)}
                    disabled={updating}
                  >
                    <Text style={styles.cancelBtnText}>Close</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveStatus}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Status</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* IN-APP MEDIA VIEWER MODAL (PHOTO & FILE) - NO CHROME REDIRECT */}
      <Modal visible={!!viewingMedia} animationType="fade" transparent presentationStyle="overFullScreen">
        <View style={styles.mediaViewerOverlay}>
          <View style={styles.mediaViewerHeader}>
            <Text style={styles.mediaViewerTitle} numberOfLines={1}>
              {viewingMedia?.title || 'Attachment Preview'}
            </Text>
            <TouchableOpacity
              style={styles.mediaViewerCloseBtn}
              onPress={() => setViewingMedia(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.mediaViewerBody}>
            {viewingMedia?.type === 'IMAGE' ? (
              <Image
                source={{ uri: viewingMedia.url }}
                style={styles.mediaViewerFullImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.filePreviewContainer}>
                <View style={styles.fileIconBig}>
                  <FileText size={48} color="#22C55E" />
                </View>
                <Text style={styles.filePreviewName} numberOfLines={2}>
                  {viewingMedia?.title}
                </Text>
                <Text style={styles.filePreviewSub}>File loaded securely in-app</Text>

                <TouchableOpacity
                  style={styles.openExternalBtn}
                  onPress={() => {
                    if (viewingMedia?.url) {
                      Linking.openURL(viewingMedia.url);
                    }
                  }}
                >
                  <Download size={16} color="#FFFFFF" />
                  <Text style={styles.openExternalBtnText}>Download to Device</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TasksScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  createTaskHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  createTaskHeaderBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF3',
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  tabItemActive: {
    backgroundColor: '#EBF3FC',
    borderColor: 'rgba(0, 86, 179, 0.25)',
  },
  tabText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
  },
  tabTextActive: {
    color: '#22C55E',
    fontFamily: 'Comfortaa_700Bold',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#777777',
    fontFamily: 'Comfortaa_500Medium',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#777777',
    marginTop: 4,
    fontFamily: 'Comfortaa_500Medium',
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginTop: 16,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleCol: {
    flex: 1,
    paddingRight: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  createdDateText: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
    fontFamily: 'Comfortaa_500Medium',
  },
  badgesCol: {
    flexDirection: 'row',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  taskDesc: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    lineHeight: 18,
    fontFamily: 'Comfortaa_500Medium',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8F9FC',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8F9FC',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 28,
    height: 28,
  },
  avatarInitial: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#555555',
  },
  unassignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unassignedText: {
    fontSize: 11,
    color: '#888888',
    fontFamily: 'Comfortaa_500Medium',
  },
  openBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openBtnText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#22C55E',
  },

  // Modals Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-start',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: 40,
    flex: 1,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF3',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  newTaskBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newTaskBadgeText: {
    color: '#15803D',
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
    fontFamily: 'Comfortaa_500Medium',
  },
  modalBody: {
    marginTop: 12,
  },
  formLabel: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#222222',
  },
  formLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  voiceTypingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voiceTypingBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
  },
  voiceTypingBtnText: {
    fontSize: 10,
    fontFamily: 'Comfortaa_700Bold',
    color: '#475569',
  },
  voiceTypingBtnTextActive: {
    color: '#DC2626',
  },
  voiceAudioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  voiceAudioPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceAudioPlayText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
    color: '#22C55E',
  },
  formInput: {
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Comfortaa_500Medium',
  },
  dateBlockContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    width: '100%',
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  pickerSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  selectorPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    marginBottom: 4,
  },
  selectorPillActive: {
    backgroundColor: '#EBF3FC',
    borderColor: '#22C55E',
  },
  selectorPillText: {
    fontSize: 11,
    color: '#555555',
    fontFamily: 'Comfortaa_500Medium',
  },
  selectorPillTextActive: {
    color: '#22C55E',
    fontFamily: 'Comfortaa_700Bold',
  },
  webTabContainer: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 10,
    overflow: 'hidden',
  },
  webTabHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FC',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF3',
  },
  webTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  webTabItemActive: {
    borderBottomColor: '#22C55E',
    backgroundColor: '#FFFFFF',
  },
  webTabText: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
  },
  webTabTextActive: {
    color: '#22C55E',
    fontFamily: 'Comfortaa_700Bold',
  },
  webTabBody: {
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  commentInputBox: {
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#000000',
    minHeight: 50,
    fontFamily: 'Comfortaa_500Medium',
  },
  composerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
  },
  composerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolIconBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  recordingLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingDurationText: {
    fontSize: 11,
    color: '#DC2626',
    fontFamily: 'Comfortaa_700Bold',
  },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBF3FC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  attachmentPillText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#22C55E',
  },
  linkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  linkInput: {
    flex: 1,
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Comfortaa_500Medium',
  },
  createModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECEEF3',
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  closeBtnText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#444444',
  },
  draftBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
  },
  draftBtnText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#22C55E',
  },
  submitTaskBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#22C55E',
  },
  submitTaskBtnText: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
  },

  // View Workspace Modal Elements
  modalBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    marginTop: 14,
    marginBottom: 6,
  },
  modalDescription: {
    fontSize: 13,
    color: '#444444',
    lineHeight: 18,
    fontFamily: 'Comfortaa_500Medium',
  },
  assignedMembersContainer: {
    gap: 8,
    marginTop: 4,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    gap: 10,
  },
  memberAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  memberAvatarImg: {
    width: 32,
    height: 32,
  },
  memberAvatarInitial: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#4338CA',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
  },
  memberRole: {
    fontSize: 11,
    color: '#666666',
    marginTop: 1,
    fontFamily: 'Comfortaa_500Medium',
  },
  emptyMembersText: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
  },
  commentsList: {
    gap: 10,
    marginTop: 4,
  },
  noCommentsText: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
    marginVertical: 4,
  },
  commentItem: {
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 10,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontFamily: 'Comfortaa_700Bold',
    color: '#22C55E',
  },
  commentTime: {
    fontSize: 10,
    color: '#888888',
    fontFamily: 'Comfortaa_500Medium',
  },
  commentBodyText: {
    fontSize: 12,
    color: '#222222',
    lineHeight: 16,
    fontFamily: 'Comfortaa_500Medium',
  },
  commentAttachedImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  voicePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  voicePlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Comfortaa_700Bold',
  },
  fileDownloadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF3FC',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  fileNameText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#22C55E',
  },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#EBF3FC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  linkText: {
    flex: 1,
    fontSize: 11,
    color: '#22C55E',
    fontFamily: 'Comfortaa_600SemiBold',
    textDecorationLine: 'underline',
  },
  richComposerBox: {
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  richTextInput: {
    fontSize: 12,
    color: '#000000',
    minHeight: 50,
    fontFamily: 'Comfortaa_500Medium',
  },
  richToolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ECEEF3',
    paddingTop: 8,
    marginTop: 6,
  },
  sendCommentBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    backgroundColor: '#F8F9FC',
    alignItems: 'center',
  },
  statusBtnActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  statusBtnText: {
    fontSize: 11,
    fontFamily: 'Comfortaa_600SemiBold',
    color: '#555555',
  },
  statusBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
  },
  textInput: {
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#000000',
    minHeight: 60,
    fontFamily: 'Comfortaa_500Medium',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#444444',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: 'Comfortaa_700Bold',
    color: '#FFFFFF',
  },
  // In-App Media Viewer Styles
  mediaViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'space-between',
  },
  mediaViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 16,
  },
  mediaViewerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    marginRight: 12,
  },
  mediaViewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mediaViewerFullImage: {
    width: '100%',
    height: '100%',
  },
  filePreviewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '88%',
    maxWidth: 360,
  },
  fileIconBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF3FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  filePreviewName: {
    fontSize: 16,
    fontFamily: 'Comfortaa_700Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 6,
  },
  filePreviewSub: {
    fontSize: 13,
    color: '#666666',
    fontFamily: 'Comfortaa_500Medium',
    marginBottom: 20,
  },
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  openExternalBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Comfortaa_700Bold',
    fontSize: 14,
  },

});
