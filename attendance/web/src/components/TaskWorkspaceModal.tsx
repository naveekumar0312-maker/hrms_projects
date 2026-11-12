import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  X,
  AlertCircle,
  Paperclip,
  Send,
  Image,
  Mic,
  Link2,
  FileText,
  Download,
  MessageSquare,
  History,
  Timer,
  Square,
  Plus,
  Loader2,
  Building2,
} from 'lucide-react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { CustomDatePicker } from './CustomDatePicker';
import { CustomSelect } from './CustomSelect';
import { EmployeeMultiSelect } from './EmployeeMultiSelect';
import './TaskWorkspaceModal.css';

interface TaskWorkspaceModalProps {
  taskId?: number | null; // null if creating a new task
  onClose: () => void;
  onSaved: () => void;
}

export const TaskWorkspaceModal: React.FC<TaskWorkspaceModalProps> = ({
  taskId,
  onClose,
  onSaved,
}) => {
  const { user } = useContext(AuthContext);
  const isEmployee = user?.role === 'EMPLOYEE';

  // Active Tab in Right Panel: 'comment' | 'attachment' | 'activity' | 'timelog'
  const [activeTab, setActiveTab] = useState<'comment' | 'attachment' | 'activity' | 'timelog'>('comment');

  // Left Panel Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Development');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<number[]>([]);
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [status, setStatus] = useState<string>('PENDING');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('0.00');
  const [instructions, setInstructions] = useState('');
  const [isDraft, setIsDraft] = useState(false);

  // Assignable employees
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');

  // Task full data for view/edit
  const [taskData, setTaskData] = useState<any>(null);
  const [, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Right Panel: Comments, Attachments, Activity, Time Logs
  const [comments, setComments] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);

  // Comment composer state
  const [commentInput, setCommentInput] = useState('');
  const [commentType, setCommentType] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'LINK' | 'FILE'>('TEXT');
  const [linkInput, setLinkInput] = useState('');
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Voice recording state for comments
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Speech-to-text voice recognition for Title & Description
  const [voiceTarget, setVoiceTarget] = useState<'title' | 'description' | null>(null);
  const [titleVoiceAudioUrl, setTitleVoiceAudioUrl] = useState<string | null>(null);
  const [descVoiceAudioUrl, setDescVoiceAudioUrl] = useState<string | null>(null);
  const speechRecognizerRef = useRef<any>(null);
  const fieldMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fieldAudioChunksRef = useRef<Blob[]>([]);

  const startVoiceInput = async (target: 'title' | 'description') => {
    if (voiceTarget === target) {
      stopVoiceInput();
      return;
    }

    // Stop any existing session
    stopVoiceInput();

    // 1. Start audio recording via MediaRecorder for playback box
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        fieldMediaRecorderRef.current = recorder;
        fieldAudioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            fieldAudioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(fieldAudioChunksRef.current, { type: mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          if (target === 'title') {
            setTitleVoiceAudioUrl(url);
          } else {
            setDescVoiceAudioUrl(url);
          }
          stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start(100);
      }
    } catch (micErr) {
      console.warn('Audio recorder stream could not be started:', micErr);
    }

    // 2. Start SpeechRecognition for converting voice to text
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let initialText = target === 'title' ? title : description;

        recognition.onstart = () => {
          setVoiceTarget(target);
        };

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (target === 'title') {
            setTitle((initialText ? initialText + ' ' : '') + transcript);
          } else {
            setDescription((initialText ? initialText + ' ' : '') + transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setVoiceTarget(null);
        };

        recognition.onend = () => {
          setVoiceTarget(null);
        };

        speechRecognizerRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err);
        setVoiceTarget(null);
      }
    } else {
      setVoiceTarget(target);
    }
  };

  const stopVoiceInput = () => {
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch (e) {
        // ignore
      }
      speechRecognizerRef.current = null;
    }
    if (fieldMediaRecorderRef.current && fieldMediaRecorderRef.current.state !== 'inactive') {
      try {
        fieldMediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      fieldMediaRecorderRef.current = null;
    }
    setVoiceTarget(null);
  };

  // Time log entry state
  const [showTimeLogForm, setShowTimeLogForm] = useState(false);
  const [timeLogDate, setTimeLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeLogHours, setTimeLogHours] = useState('1.00');
  const [timeLogDesc, setTimeLogDesc] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);

  // ---------------------------------------------------------------------------
  // LOAD ASSIGNABLE EMPLOYEES & TASK DETAILS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchAssignable = async () => {
      try {
        const res = await api.get('/tasks-module/tasks/assignable_members/');
        setTeamMembers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to load assignable team members:', err);
      }
    };
    fetchAssignable();

    if (taskId) {
      loadTaskDetails(taskId);
    } else {
      // Default dates
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setDueDate(today);
    }
  }, [taskId, user]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Auto-scroll comments to bottom when comments list updates
  useEffect(() => {
    if (activeTab === 'comment' && commentsScrollRef.current) {
      commentsScrollRef.current.scrollTop = commentsScrollRef.current.scrollHeight;
    }
  }, [comments, activeTab]);

  const loadTaskDetails = async (id: number) => {
    try {
      setLoading(true);
      const res = await api.get(`/tasks-module/tasks/${id}/`);
      const t = res.data;
      setTaskData(t);
      setTitle(t.title || '');
      setDescription(t.description || '');
      setCategory(t.category || 'Development');
      setAssignedTo(t.assigned_to ? String(t.assigned_to) : '');
      const ids = Array.isArray(t.assigned_employee_ids)
        ? t.assigned_employee_ids
        : (Array.isArray(t.assigned_employees)
            ? t.assigned_employees.map((e: any) => e.id)
            : (t.assigned_to ? [t.assigned_to] : []));
      setAssignedEmployeeIds(ids);
      setPriority(t.priority || 'MEDIUM');
      setStatus(t.status || 'PENDING');
      setStartDate(t.start_date || '');
      setDueDate(t.due_date || '');
      setStartTime(t.start_time || '');
      setEndTime(t.end_time || '');
      setEstimatedHours(String(t.estimated_hours || '0.00'));
      setInstructions(t.additional_instructions || '');
      setIsDraft(t.is_draft || false);

      setComments(t.comments || []);
      setAttachments(t.task_attachments || []);
      setActivities(t.activities || []);
      setTimeLogs(t.time_logs || []);
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SAVE TASK (DRAFT OR SUBMIT)
  // ---------------------------------------------------------------------------
  const handleSaveTask = async (draftMode: boolean) => {
    setErrorMsg(null);

    // If employee or updating status only on an existing task, directly submit status
    if (isEmployee && taskId) {
      try {
        setSubmitting(true);
        await api.patch(`/tasks-module/tasks/${taskId}/`, { status });
        onSaved();
        return;
      } catch (err: any) {
        console.error('Failed to update status:', err);
        const backendMsg = err.response?.data?.detail || err.response?.data?.status || 'Failed to update task status.';
        setErrorMsg(typeof backendMsg === 'string' ? backendMsg : JSON.stringify(backendMsg));
        return;
      } finally {
        setSubmitting(false);
      }
    }

    if (!title.trim()) {
      setErrorMsg('Task Title is required.');
      return;
    }
    if (!draftMode && !isEmployee && assignedEmployeeIds.length === 0 && !assignedTo) {
      setErrorMsg('Please select at least one employee to assign this task.');
      return;
    }
    if (!draftMode && !dueDate) {
      setErrorMsg('Ended Date (Due Date) is required for submitted tasks.');
      return;
    }
    if (startDate && dueDate && startDate > dueDate) {
      setErrorMsg('Started date cannot be later than ended date.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        category,
        assigned_to: assignedEmployeeIds.length > 0 ? assignedEmployeeIds[0] : (assignedTo ? parseInt(assignedTo, 10) : null),
        assigned_employee_ids: assignedEmployeeIds,
        priority,
        status: draftMode ? 'DRAFT' : (status === 'DRAFT' ? 'PENDING' : status),
        is_draft: draftMode,
        start_date: startDate || null,
        due_date: dueDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        estimated_hours: parseFloat(estimatedHours) || 0.0,
        additional_instructions: instructions.trim(),
      };

      if (taskId) {
        await api.patch(`/tasks-module/tasks/${taskId}/`, payload);
      } else {
        const createRes = await api.post('/tasks-module/tasks/', payload);
        if (createRes.data?.id) {
          loadTaskDetails(createRes.data.id);
        }
      }
      onSaved();
      if (!taskId) {
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to save task:', err);
      const errMsg = err.response?.data?.due_date || err.response?.data?.detail || err.response?.data?.message || 'Failed to save task.';
      setErrorMsg(Array.isArray(errMsg) ? errMsg[0] : (typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)));
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VOICE RECORDING IMPLEMENTATION (MediaRecorder API)
  // ---------------------------------------------------------------------------
  const startRecording = async () => {
    setCommentError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCommentError('Audio recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mimeType
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(finalBlob);
        setAudioUrl(URL.createObjectURL(finalBlob));
        setCommentType('AUDIO');
        
        // Stop all audio tracks to release microphone hardware
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200); // 200ms slice
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start elapsed timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Audio recording failed to initialize:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCommentError('Microphone permission was denied. Please allow microphone access in your browser settings.');
      } else {
        setCommentError(`Microphone error: ${err.message || 'Could not start recording.'}`);
      }
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
  };

  // ---------------------------------------------------------------------------
  // IMAGE SELECTION & PREVIEW
  // ---------------------------------------------------------------------------
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommentError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setCommentError('Please select a valid image file (JPG, PNG, WEBP, or GIF).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setCommentError('Image size exceeds maximum limit of 10 MB.');
        return;
      }

      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setCommentType('IMAGE');
    }
  };

  // ---------------------------------------------------------------------------
  // FILE / DOCUMENT SELECTION
  // ---------------------------------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommentError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        setCommentError('File size exceeds maximum limit of 25 MB.');
        return;
      }
      setSelectedFile(file);
      setCommentType('FILE');
    }
  };

  // ---------------------------------------------------------------------------
  // URL LINK ATTACHMENT
  // ---------------------------------------------------------------------------
  const handleConfirmLink = () => {
    setCommentError(null);
    const trimmed = linkInput.trim();
    if (!trimmed) {
      setCommentError('Please paste or enter a valid URL.');
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setCommentError('Only HTTP or HTTPS web links are allowed.');
        return;
      }
    } catch {
      setCommentError('Invalid URL format. Please include http:// or https://');
      return;
    }

    setCommentType('LINK');
    setShowLinkPrompt(false);
  };

  // ---------------------------------------------------------------------------
  // SEND COMMENT (TEXT, IMAGE, AUDIO, LINK, FILE)
  // ---------------------------------------------------------------------------
  const handleSendComment = async () => {
    setCommentError(null);
    if (!taskId) {
      setCommentError('Please save the task first before posting comments.');
      return;
    }

    const hasText = commentInput.trim().length > 0;
    const hasAudio = !!audioBlob;
    const hasFile = !!selectedFile;
    const hasLink = commentType === 'LINK' && linkInput.trim().length > 0;

    if (!hasText && !hasAudio && !hasFile && !hasLink) {
      return;
    }

    try {
      setSendingComment(true);
      const formData = new FormData();

      if (hasAudio) {
        const ext = audioBlob?.type?.includes('mp4') ? 'mp4' : 'webm';
        formData.append('attachment', audioBlob!, `voice_note.${ext}`);
        formData.append('comment_type', 'AUDIO');
        formData.append('comment', commentInput.trim() || 'Voice Message');
        formData.append('file_name', `voice_note.${ext}`);
      } else if (hasFile) {
        formData.append('attachment', selectedFile!);
        formData.append('comment_type', commentType);
        formData.append('comment', commentInput.trim() || selectedFile!.name);
        formData.append('file_name', selectedFile!.name);
        const sizeStr = selectedFile!.size > 1024 * 1024
          ? `${(selectedFile!.size / (1024 * 1024)).toFixed(2)} MB`
          : `${(selectedFile!.size / 1024).toFixed(1)} KB`;
        formData.append('file_size', sizeStr);
      } else if (hasLink) {
        formData.append('comment_type', 'LINK');
        formData.append('link_url', linkInput.trim());
        formData.append('comment', commentInput.trim() || linkInput.trim());
      } else {
        formData.append('comment_type', 'TEXT');
        formData.append('comment', commentInput.trim());
      }

      // Do NOT set manual 'Content-Type' multipart header so Axios & browser generate proper boundary
      await api.post(`/tasks-module/tasks/${taskId}/comments/`, formData);

      // Reset composer on success
      setCommentInput('');
      setSelectedFile(null);
      setImagePreviewUrl(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingSeconds(0);
      setShowLinkPrompt(false);
      setLinkInput('');
      setCommentType('TEXT');

      // Refresh task details
      await loadTaskDetails(taskId);
    } catch (err: any) {
      console.error('Send comment failed:', err);
      const errDetail = err.response?.data?.detail || err.response?.data?.comment || 'Failed to post comment.';
      setCommentError(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
    } finally {
      setSendingComment(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UPLOAD ATTACHMENT TAB
  // ---------------------------------------------------------------------------
  const handleUploadAttachmentTab = async (file: File) => {
    if (!taskId) {
      alert('Save task first before uploading attachments.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_type', file.type || 'document');
      await api.post(`/tasks-module/tasks/${taskId}/attachments/`, formData);
      await loadTaskDetails(taskId);
    } catch (err) {
      console.error('Upload attachment failed:', err);
      alert('Failed to upload attachment.');
    }
  };

  // ---------------------------------------------------------------------------
  // TIME LOG SUBMISSION
  // ---------------------------------------------------------------------------
  const handleAddTimeLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId) return;
    try {
      await api.post(`/tasks-module/tasks/${taskId}/timelogs/`, {
        date: timeLogDate,
        hours: parseFloat(timeLogHours) || 0.0,
        description: timeLogDesc.trim(),
      });
      setShowTimeLogForm(false);
      setTimeLogDesc('');
      await loadTaskDetails(taskId);
    } catch (err) {
      console.error('Failed to log time:', err);
      alert('Failed to save time log.');
    }
  };

  return (
    <div className="task-workspace-backdrop" onClick={onClose}>
      <div className="task-workspace-modal" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="task-workspace-header">
          <div className="task-workspace-header-title">
            <h2>{taskId ? (title || 'Task Details') : 'Create New Task'}</h2>
            <span
              className="task-mode-tag"
              style={{
                background: isDraft ? '#f1f5f9' : '#eff6ff',
                color: isDraft ? '#64748b' : '#0757B8',
              }}
            >
              {isDraft ? 'Draft' : (taskId ? 'Published' : 'New Task')}
            </span>
          </div>
          <button type="button" className="rm-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* BODY (TWO COLUMNS) */}
        <div className="task-workspace-body">
          {/* =================================================================
              LEFT PANEL: TASK DETAILS & CONFIGURATION
             ================================================================= */}
          <div className="task-panel-left">
            <div className="task-panel-left-scroll">
              {errorMsg && (
                <div className="rm-modal-error">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* A. TASK INFORMATION */}
              <div className="task-form-section">
                <div className="task-field-group">
                  <div className="task-field-label-row">
                    <label className="task-field-label">
                      Task Title <span className="task-required">*</span>
                    </label>
                    {!isEmployee && (
                      <button
                        type="button"
                        className={`task-voice-btn ${voiceTarget === 'title' ? 'recording' : ''}`}
                        onClick={() => startVoiceInput('title')}
                        title="Voice typing for Title"
                      >
                        {voiceTarget === 'title' ? (
                          <>
                            <span className="task-voice-dot" />
                            <span>Listening...</span>
                          </>
                        ) : (
                          <>
                            <Mic size={12} />
                            <span>Voice</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    className="task-input-title-modern"
                    placeholder="Enter task title (or use voice)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isEmployee}
                    required
                  />
                  {titleVoiceAudioUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>🎙️ Title Audio:</span>
                        <audio controls src={titleVoiceAudioUrl} style={{ height: '28px' }} />
                      </div>
                      <button type="button" className="task-tool-btn" title="Remove Audio" onClick={() => setTitleVoiceAudioUrl(null)}>
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="task-field-group">
                  <div className="task-field-label-row">
                    <label className="task-field-label">Description</label>
                    {!isEmployee && (
                      <button
                        type="button"
                        className={`task-voice-btn ${voiceTarget === 'description' ? 'recording' : ''}`}
                        onClick={() => startVoiceInput('description')}
                        title="Voice typing for Description"
                      >
                        {voiceTarget === 'description' ? (
                          <>
                            <span className="task-voice-dot" />
                            <span>Listening...</span>
                          </>
                        ) : (
                          <>
                            <Mic size={12} />
                            <span>Voice</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <textarea
                    className="task-textarea-modern"
                    rows={4}
                    placeholder="Provide full context, technical specifications, and expected deliverables (or use voice)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isEmployee}
                  />
                  {descVoiceAudioUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>🎙️ Description Audio:</span>
                        <audio controls src={descVoiceAudioUrl} style={{ height: '28px' }} />
                      </div>
                      <button type="button" className="task-tool-btn" title="Remove Audio" onClick={() => setDescVoiceAudioUrl(null)}>
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* ASSIGNED EMPLOYEES SELECTION WITH COMPANY FILTER */}
                <div className="task-field-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <label className="task-field-label" style={{ margin: 0 }}>
                      Assign Employees <span className="task-required">*</span>
                    </label>
                    {/* Show Company filter when there are multiple companies available */}
                    {Array.from(new Set(teamMembers.map((m) => m.company_name).filter(Boolean))).length > 1 && (
                      <div style={{ width: '260px' }}>
                        <CustomSelect
                          value={selectedCompanyFilter}
                          onChange={(val) => setSelectedCompanyFilter(val)}
                          placeholder="Filter by Company"
                          icon={<Building2 size={15} color="#E56108" />}
                          alignRight={true}
                          direction="down"
                          options={[
                            { value: 'ALL', label: `All Companies (${teamMembers.length})` },
                            ...Array.from(new Set(teamMembers.map((m) => m.company_name).filter(Boolean))).map((compName) => {
                              const count = teamMembers.filter((m) => m.company_name === compName).length;
                              return {
                                value: compName,
                                label: `${compName} (${count})`,
                              };
                            })
                          ]}
                        />
                      </div>
                    )}
                  </div>
                  <EmployeeMultiSelect
                    members={
                      selectedCompanyFilter === 'ALL'
                        ? teamMembers
                        : teamMembers.filter((m) => m.company_name === selectedCompanyFilter)
                    }
                    selectedIds={assignedEmployeeIds}
                    onChange={(ids) => {
                      setAssignedEmployeeIds(ids);
                      setAssignedTo(ids.length > 0 ? String(ids[0]) : '');
                    }}
                    disabled={isEmployee}
                    placeholder={
                      selectedCompanyFilter === 'ALL'
                        ? "Search and select employees across companies..."
                        : `Select employees from ${selectedCompanyFilter}...`
                    }
                  />
                </div>
              </div>

              {/* B. DATE CONFIGURATION: Started Date & Ended Date with CustomDatePicker */}
              <div className="task-form-section">
                <div className="task-dates-grid">
                  <div className="task-field-group">
                    <label className="task-field-label">Started Date</label>
                    <CustomDatePicker
                      value={startDate}
                      onChange={(d) => setStartDate(d)}
                      placeholder="Select started date"
                      disabled={isEmployee}
                    />
                  </div>

                  <div className="task-field-group">
                    <label className="task-field-label">Ended Date <span className="task-required">*</span></label>
                    <CustomDatePicker
                      value={dueDate}
                      minDate={startDate || undefined}
                      onChange={(d) => setDueDate(d)}
                      placeholder="Select ended date"
                      disabled={isEmployee}
                    />
                  </div>
                </div>
              </div>

              {/* C. STATUS & PRIORITY DROPDOWNS */}
              <div className="task-form-section">
                <div className="task-controls-grid">
                  {/* Modern Status Dropdown */}
                  <div className="task-field-group">
                    <label className="task-field-label">Status</label>
                    <CustomSelect
                      value={status}
                      onChange={(val) => setStatus(val)}
                      direction="up"
                      options={[
                        { value: 'PENDING', label: 'To Do (Pending)' },
                        { value: 'IN_PROGRESS', label: 'In Progress' },
                        { value: 'COMPLETED', label: 'Completed' },
                        { value: 'ON_HOLD', label: 'On Hold' },
                        { value: 'CANCELLED', label: 'Cancelled' },
                      ]}
                      placeholder="Select status"
                    />
                  </div>

                  {/* Modern Priority Dropdown */}
                  <div className="task-field-group">
                    <label className="task-field-label">Priority</label>
                    <CustomSelect
                      value={priority}
                      onChange={(val) => setPriority(val as any)}
                      disabled={isEmployee}
                      direction="up"
                      options={[
                        { value: 'LOW', label: 'Low' },
                        { value: 'MEDIUM', label: 'Medium' },
                        { value: 'HIGH', label: 'High' },
                        { value: 'URGENT', label: 'Urgent' },
                      ]}
                      placeholder="Select priority"
                    />
                  </div>
                </div>
              </div>

              {/* READ-ONLY METRICS IF SAVED */}
              {taskData && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>Assigned By:</strong> {taskData.assigned_by_name || 'System'} ({taskData.assigned_by_role || 'Manager'})
                  </div>
                  <div>
                    <strong>Total Logged:</strong> {taskData.total_logged_hours || 0} hrs
                  </div>
                  <div>
                    <strong>Created:</strong> {new Date(taskData.created_at).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>

              {/* THREE PERSISTENT BOTTOM BUTTONS: CLOSE, DRAFT, SUBMIT */}
              <div className="task-panel-left-actions">
                <button
                  type="button"
                  className="rm-btn rm-btn-secondary"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Close
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {!isEmployee && (
                    <button
                      type="button"
                      className="rm-btn rm-btn-secondary"
                      style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
                      onClick={() => handleSaveTask(true)}
                      disabled={submitting}
                    >
                      {submitting ? 'Saving Draft...' : 'Draft'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rm-btn rm-btn-primary"
                    onClick={() => handleSaveTask(false)}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : (isEmployee ? 'Update Status' : 'Submit')}
                  </button>
                </div>
              </div>
          </div>

          {/* =================================================================
              RIGHT PANEL: COMMUNICATION & ACTIVITY (4 TABS)
             ================================================================= */}
          <div className="task-panel-right">
            {/* TABS HEADER */}
            <div className="task-tabs-header">
              <button
                type="button"
                className={`task-tab-btn ${activeTab === 'comment' ? 'active' : ''}`}
                onClick={() => setActiveTab('comment')}
              >
                <MessageSquare size={15} />
                <span>Comment ({comments.length})</span>
              </button>

              <button
                type="button"
                className={`task-tab-btn ${activeTab === 'attachment' ? 'active' : ''}`}
                onClick={() => setActiveTab('attachment')}
              >
                <Paperclip size={15} />
                <span>Attachment ({attachments.length})</span>
              </button>

              <button
                type="button"
                className={`task-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
              >
                <History size={15} />
                <span>Log Activity ({activities.length})</span>
              </button>

              <button
                type="button"
                className={`task-tab-btn ${activeTab === 'timelog' ? 'active' : ''}`}
                onClick={() => setActiveTab('timelog')}
              >
                <Timer size={15} />
                <span>Time Log</span>
              </button>
            </div>

            {/* TAB 1: COMMENTS */}
            {activeTab === 'comment' && (
              <div className="task-tab-content">
                <div className="task-comments-list" ref={commentsScrollRef}>
                  {comments.length === 0 ? (
                    <div className="rm-empty-state">
                      <MessageSquare size={36} color="#cbd5e1" />
                      <p>No discussion yet. Post updates, voice notes, or attachments below.</p>
                    </div>
                  ) : (
                    comments.map((c: any) => (
                      <div key={c.id} className="task-comment-card">
                        <div className="task-comment-avatar">
                          {c.author_avatar ? (
                            <img src={c.author_avatar} alt={c.author_name} />
                          ) : (
                            c.author_name?.charAt(0)?.toUpperCase() || 'U'
                          )}
                        </div>

                        <div className="task-comment-body">
                          <div className="task-comment-header">
                            <div>
                              <span className="task-comment-author">{c.author_name}</span>
                              <span className="task-comment-role">{c.author_role}</span>
                            </div>
                            <span className="task-comment-time">
                              {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Message content based on comment_type */}
                          {c.comment_type === 'TEXT' && (
                            <p className="task-comment-text">{c.comment}</p>
                          )}

                          {c.comment_type === 'IMAGE' && (
                            <div>
                              {c.comment && c.comment !== c.file_name && (
                                <p className="task-comment-text">{c.comment}</p>
                              )}
                              {c.attachment_url && (
                                <div style={{ marginTop: '6px' }}>
                                  <img
                                    src={c.attachment_url}
                                    alt={c.file_name || 'Uploaded image'}
                                    className="task-comment-img"
                                    onClick={() => window.open(c.attachment_url, '_blank')}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {c.comment_type === 'AUDIO' && (
                            <div>
                              <p className="task-comment-text" style={{ fontStyle: 'italic', color: '#64748b' }}>
                                🎙️ {c.comment || 'Voice Note'}
                              </p>
                              {c.attachment_url && (
                                <audio controls src={c.attachment_url} className="task-audio-player" style={{ marginTop: '4px' }} />
                              )}
                            </div>
                          )}

                          {c.comment_type === 'LINK' && (
                            <div>
                              {c.comment && c.comment !== c.link_url && (
                                <p className="task-comment-text">{c.comment}</p>
                              )}
                              <a
                                href={c.link_url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="task-comment-link"
                              >
                                <Link2 size={13} /> {c.link_url}
                              </a>
                            </div>
                          )}

                          {c.comment_type === 'FILE' && (
                            <div>
                              {c.comment && c.comment !== c.file_name && (
                                <p className="task-comment-text">{c.comment}</p>
                              )}
                              {c.attachment_url && (
                                <a
                                  href={c.attachment_url}
                                  download
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="task-comment-link"
                                >
                                  <FileText size={13} /> {c.file_name || 'Download Attachment'} ({c.file_size || 'File'})
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ATTACHMENTS */}
            {activeTab === 'attachment' && (
              <div className="task-tab-content">
                <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadAttachmentTab(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="rm-btn rm-btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={14} /> Upload Document
                  </button>
                </div>

                <div className="task-attachment-grid">
                  {attachments.length === 0 ? (
                    <div className="rm-empty-state">
                      <Paperclip size={36} color="#cbd5e1" />
                      <p>No documents attached to this task yet.</p>
                    </div>
                  ) : (
                    attachments.map((att: any) => (
                      <div key={att.id} className="task-attachment-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={20} color="#0284c7" />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                              {att.file_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Uploaded by {att.uploaded_by_name} &bull; {att.file_size}
                            </div>
                          </div>
                        </div>

                        <a
                          href={att.file_url}
                          download
                          target="_blank"
                          rel="noreferrer noopener"
                          className="rm-icon-btn"
                          title="Download File"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: LOG ACTIVITY */}
            {activeTab === 'activity' && (
              <div className="task-tab-content">
                <div className="task-activity-timeline">
                  {activities.length === 0 ? (
                    <div className="rm-empty-state">
                      <History size={36} color="#cbd5e1" />
                      <p>Activity logs will automatically populate as actions occur.</p>
                    </div>
                  ) : (
                    activities.map((act: any) => (
                      <div key={act.id} className="task-activity-node">
                        <div className="task-activity-dot" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                            {act.action}
                          </div>
                          <div style={{ fontSize: '12px', color: '#475569', margin: '2px 0' }}>
                            {act.description}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {act.user_name} &bull; {new Date(act.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: TIME LOG */}
            {activeTab === 'timelog' && (
              <div className="task-tab-content">
                <div className="task-timelog-summary">
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Estimated Hours
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      {estimatedHours}h
                    </div>
                  </div>
                  <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Total Logged
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>
                      {taskData?.total_logged_hours || 0}h
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="rm-btn rm-btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setShowTimeLogForm(!showTimeLogForm)}
                  >
                    <Plus size={14} /> Log Work Time
                  </button>
                </div>

                {showTimeLogForm && (
                  <form onSubmit={handleAddTimeLog} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                    <div className="task-grid-2" style={{ marginBottom: '8px' }}>
                      <div className="rm-form-group">
                        <label>Date</label>
                        <CustomDatePicker
                          value={timeLogDate}
                          onChange={(val) => setTimeLogDate(val)}
                          placeholder="Select log date"
                        />
                      </div>
                      <div className="rm-form-group">
                        <label>Hours Spent</label>
                        <input
                          type="number"
                          step="0.25"
                          className="rm-input"
                          value={timeLogHours}
                          onChange={(e) => setTimeLogHours(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="rm-form-group" style={{ marginBottom: '10px' }}>
                      <label>Work Description</label>
                      <input
                        type="text"
                        className="rm-input"
                        placeholder="What specific tasks were completed during this time?"
                        value={timeLogDesc}
                        onChange={(e) => setTimeLogDesc(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button type="button" className="rm-btn rm-btn-secondary" onClick={() => setShowTimeLogForm(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="rm-btn rm-btn-primary">
                        Save Log
                      </button>
                    </div>
                  </form>
                )}

                <div className="task-activity-timeline">
                  {timeLogs.map((tl: any) => (
                    <div key={tl.id} className="task-attachment-card" style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Timer size={18} color="#10b981" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                            {tl.hours} Hours &bull; {tl.user_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {tl.description || 'No description provided'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{tl.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FIXED BOTTOM COMMENT COMPOSER (Visible in Comment Tab) */}
            {activeTab === 'comment' && (
              <div className="task-comment-composer">
                {commentError && (
                  <div className="rm-modal-error" style={{ marginBottom: '6px', padding: '6px 10px', fontSize: '12px' }}>
                    <AlertCircle size={14} />
                    <span>{commentError}</span>
                  </div>
                )}

                {/* Active voice recording status & counter */}
                {isRecording && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fee2e2', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#b91c1c' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="task-rec-pulse" />
                      <strong>Recording audio... {recordingSeconds}s</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="rm-btn rm-btn-secondary" style={{ padding: '2px 8px', fontSize: '11px', height: '26px' }} onClick={cancelRecording}>
                        Cancel
                      </button>
                      <button type="button" className="rm-btn rm-btn-primary" style={{ padding: '2px 8px', fontSize: '11px', height: '26px', background: '#dc2626' }} onClick={stopRecording}>
                        <Square size={11} style={{ marginRight: '4px' }} /> Stop & Preview
                      </button>
                    </div>
                  </div>
                )}

                {/* Audio preview after recording */}
                {audioUrl && !isRecording && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>🎙️ Audio Preview:</span>
                      <audio controls src={audioUrl} style={{ height: '30px' }} />
                    </div>
                    <button type="button" className="task-tool-btn" title="Remove Audio" onClick={() => { setAudioUrl(null); setAudioBlob(null); }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Image preview before send */}
                {imagePreviewUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f0fdf4', padding: '6px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <img src={imagePreviewUrl} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    <span style={{ fontSize: '12px', color: '#166534', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile?.name}
                    </span>
                    <button type="button" className="task-tool-btn" title="Remove image" onClick={() => { setSelectedFile(null); setImagePreviewUrl(null); }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* File attachment preview */}
                {selectedFile && !imagePreviewUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', color: '#1d4ed8' }}>
                    <FileText size={14} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                    <button type="button" className="task-tool-btn" title="Remove file" onClick={() => setSelectedFile(null)}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Link input prompt */}
                {showLinkPrompt && (
                  <div style={{ display: 'flex', gap: '6px', background: '#f8fafc', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <input
                      type="url"
                      className="rm-input"
                      style={{ height: '32px', fontSize: '12px', flex: 1 }}
                      placeholder="Paste link: https://example.com"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConfirmLink();
                        }
                      }}
                      autoFocus
                    />
                    <button type="button" className="rm-btn rm-btn-primary" style={{ padding: '0 10px', fontSize: '12px', height: '32px' }} onClick={handleConfirmLink}>
                      Attach
                    </button>
                    <button type="button" className="task-tool-btn" onClick={() => setShowLinkPrompt(false)}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Active Link chip */}
                {commentType === 'LINK' && linkInput && !showLinkPrompt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f9ff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#0369a1' }}>
                    <Link2 size={13} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkInput}</span>
                    <button type="button" className="task-tool-btn" onClick={() => { setLinkInput(''); setCommentType('TEXT'); }}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                <div className="task-composer-input-row">
                  <textarea
                    className="task-composer-textarea"
                    placeholder={
                      imagePreviewUrl
                        ? 'Add a caption for this image (optional)...'
                        : audioUrl
                        ? 'Add a note for this voice message (optional)...'
                        : commentType === 'LINK'
                        ? 'Add a message with this link (optional)...'
                        : selectedFile
                        ? 'Add a note for this file (optional)...'
                        : 'Type a message or instruction...'
                    }
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!sendingComment) handleSendComment();
                      }
                    }}
                    disabled={sendingComment}
                  />
                  <button
                    type="button"
                    className="task-send-btn"
                    title="Send message"
                    onClick={handleSendComment}
                    disabled={sendingComment || (!taskId)}
                  >
                    {sendingComment ? <Loader2 size={15} className="task-spin" /> : <Send size={15} />}
                  </button>
                </div>

                {/* BOTTOM COMPOSER TOOLBAR */}
                <div className="task-composer-toolbar">
                  {/* Hidden Image Input */}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: 'none' }}
                    ref={imageInputRef}
                    onChange={handleImageSelect}
                  />
                  <button
                    type="button"
                    className="task-tool-btn"
                    title="Upload Image"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={sendingComment}
                  >
                    <Image size={16} />
                  </button>

                  {/* Hidden Document Input */}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    className="task-tool-btn"
                    title="Attach File (PDF, Word, Excel, ZIP)"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sendingComment}
                  >
                    <Paperclip size={16} />
                  </button>

                  {/* Voice recording toggle */}
                  <button
                    type="button"
                    className={`task-tool-btn ${isRecording ? 'recording' : ''}`}
                    title={isRecording ? 'Stop Recording' : 'Record Voice Message'}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={sendingComment}
                  >
                    {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  </button>

                  {/* Link Attachment button */}
                  <button
                    type="button"
                    className="task-tool-btn"
                    title="Attach URL Link"
                    onClick={() => setShowLinkPrompt(!showLinkPrompt)}
                    disabled={sendingComment}
                  >
                    <Link2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskWorkspaceModal;
