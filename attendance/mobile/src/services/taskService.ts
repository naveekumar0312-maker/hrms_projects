import { api } from '../context/AuthContext';

export interface AssignedEmployee {
  id: number;
  full_name: string;
  employee_id?: string;
  department?: string;
  designation?: string;
  role?: string;
  profile_photo_url?: string | null;
}

export interface MobileTask {
  id: number;
  title: string;
  description: string;
  category: string;
  assigned_to_name: string;
  assigned_to_code?: string;
  assigned_to_role?: string;
  assigned_to_avatar?: string | null;
  assigned_employees?: AssignedEmployee[];
  assigned_employee_ids?: number[];
  assigned_by_name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED' | 'DRAFT' | 'OVERDUE';
  due_date: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  estimated_hours?: number;
  total_logged_hours?: number;
  is_overdue: boolean;
  completion_notes?: string;
  additional_instructions?: string;
  comments?: any[];
  created_at: string;
}

export const getEmployeeTasks = async (): Promise<MobileTask[]> => {
  const response = await api.get('/tasks-module/tasks/');
  return Array.isArray(response.data) ? response.data : [];
};

export const getAssignableMembers = async (): Promise<AssignedEmployee[]> => {
  const response = await api.get('/tasks-module/tasks/assignable_members/');
  return Array.isArray(response.data) ? response.data : [];
};

export const createTask = async (payload: any): Promise<MobileTask> => {
  const response = await api.post('/tasks-module/tasks/', payload);
  return response.data;
};

export const updateTask = async (taskId: number, payload: any): Promise<MobileTask> => {
  const response = await api.patch(`/tasks-module/tasks/${taskId}/`, payload);
  return response.data;
};

export const updateTaskStatus = async (
  taskId: number,
  status: string,
  comment?: string,
  completionNotes?: string
): Promise<MobileTask> => {
  const payload: any = { status };
  if (completionNotes) payload.completion_notes = completionNotes;

  const response = await api.patch(`/tasks-module/tasks/${taskId}/`, payload);

  if (comment && comment.trim()) {
    try {
      await addTaskComment(taskId, comment.trim());
    } catch (e) {
      console.log('Error adding comment with status update:', e);
    }
  }

  return response.data;
};

export const addTaskComment = async (
  taskId: number,
  comment: string,
  extra?: {
    comment_type?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'LINK' | 'FILE';
    link_url?: string;
    fileUri?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: string;
  }
) => {
  if (extra && (extra.fileUri || extra.comment_type === 'IMAGE' || extra.comment_type === 'AUDIO' || extra.comment_type === 'FILE')) {
    const formData = new FormData();
    formData.append('comment', comment || extra.fileName || '');
    formData.append('comment_type', extra.comment_type || 'FILE');
    if (extra.fileName) formData.append('file_name', extra.fileName);
    if (extra.fileSize) formData.append('file_size', extra.fileSize);
    if (extra.link_url) formData.append('link_url', extra.link_url);

    if (extra.fileUri) {
      formData.append('attachment', {
        uri: extra.fileUri,
        name: extra.fileName || 'file',
        type: extra.mimeType || 'application/octet-stream',
      } as any);
    }

    const response = await api.post(`/tasks-module/tasks/${taskId}/comments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  const payload: any = { comment };
  if (extra?.comment_type) payload.comment_type = extra.comment_type;
  if (extra?.link_url) payload.link_url = extra.link_url;

  const response = await api.post(`/tasks-module/tasks/${taskId}/comments/`, payload);
  return response.data;
};

export const getTaskComments = async (taskId: number) => {
  const response = await api.get(`/tasks-module/tasks/${taskId}/comments/`);
  return Array.isArray(response.data) ? response.data : [];
};

export const transcribeAudio = async (audioUri: string, mimeType?: string, fileName?: string): Promise<string> => {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    name: fileName || 'voice_recording.wav',
    type: mimeType || 'audio/wav',
  } as any);

  const response = await api.post('/tasks-module/tasks/transcribe-audio/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.text || '';
};

