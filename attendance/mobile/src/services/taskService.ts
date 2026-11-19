import { Platform } from 'react-native';
import { api } from '../context/AuthContext';

export interface AssignedEmployee {
  id: number;
  full_name: string;
  employee_id?: string;
  department?: string;
  designation?: string;
  branch_name?: string;
  company_id?: number | null;
  company_name?: string;
  role?: string;
  profile_photo_url?: string | null;
}

export interface TaskItem {
  id: number;
  title: string;
  description?: string;
  category?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  assigned_to?: number | null;
  assigned_to_name?: string;
  assigned_to_code?: string;
  assigned_to_role?: string;
  assigned_to_avatar?: string | null;
  company_name?: string;
  start_date?: string;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  estimated_hours?: number;
  total_logged_hours?: number;
  is_overdue?: boolean;
  completion_notes?: string;
  additional_instructions?: string;
  assigned_by_name?: string;
  assigned_by_role?: string;
  assigned_employees?: AssignedEmployee[];
  assigned_employee_ids?: number[];
  reporting_manager_name?: string;
  team_leader_name?: string;
  comments?: TaskComment[];
  task_attachments?: any[];
  activities?: any[];
  time_logs?: any[];
  attachment?: string | null;
  voice_note?: string | null;
  voice_note_url?: string | null;
  created_at: string;
}

export type MobileTask = TaskItem;

export interface TaskComment {
  id: number;
  task: number;
  author_name: string;
  comment: string;
  comment_type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'LINK';
  attachment?: string | null;
  file_name?: string;
  file_size?: string;
  link_url?: string;
  created_at: string;
}

export const getTasks = async (params?: any): Promise<TaskItem[]> => {
  const response = await api.get('/tasks-module/tasks/', { params });
  return Array.isArray(response.data) ? response.data : (response.data?.results || []);
};

export const getEmployeeTasks = async (): Promise<MobileTask[]> => {
  return getTasks();
};

export const getAssignableMembers = async (): Promise<AssignedEmployee[]> => {
  const response = await api.get('/tasks-module/tasks/assignable_members/');
  return Array.isArray(response.data) ? response.data : [];
};

export const getTaskDetail = async (id: number): Promise<TaskItem> => {
  const response = await api.get(`/tasks-module/tasks/${id}/`);
  return response.data;
};

export const createTask = async (data: any): Promise<TaskItem> => {
  if (data instanceof FormData) {
    const response = await api.post('/tasks-module/tasks/', data, {
      transformRequest: (d: any, headers: any) => {
        if (headers) {
          delete headers['Content-Type'];
        }
        return d;
      },
    });
    return response.data;
  }
  const response = await api.post('/tasks-module/tasks/', data);
  return response.data;
};

export const updateTask = async (id: number, data: any): Promise<TaskItem> => {
  if (data instanceof FormData) {
    const response = await api.patch(`/tasks-module/tasks/${id}/`, data, {
      transformRequest: (d: any, headers: any) => {
        if (headers) {
          delete headers['Content-Type'];
        }
        return d;
      },
    });
    return response.data;
  }
  const response = await api.patch(`/tasks-module/tasks/${id}/`, data);
  return response.data;
};

export const deleteTask = async (id: number): Promise<void> => {
  await api.delete(`/tasks-module/tasks/${id}/`);
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
      await addComment(taskId, comment.trim());
    } catch (e) {
      console.log('Error adding comment with status update:', e);
    }
  }

  return response.data;
};

export const addComment = async (
  taskId: number,
  comment: string,
  extra?: {
    comment_type?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'LINK';
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
      const cleanUri = Platform.OS === 'android' ? extra.fileUri : extra.fileUri.replace('file://', '');
      formData.append('attachment', {
        uri: cleanUri,
        name: extra.fileName || 'file',
        type: extra.mimeType || 'application/octet-stream',
      } as any);
    }

    const response = await api.post(`/tasks-module/tasks/${taskId}/comments/`, formData, {
      transformRequest: (data: any, headers: any) => {
        if (headers) {
          delete headers['Content-Type'];
        }
        return data;
      },
    });
    return response.data;
  }

  const payload: any = { comment };
  if (extra?.comment_type) payload.comment_type = extra.comment_type;
  if (extra?.link_url) payload.link_url = extra.link_url;

  const response = await api.post(`/tasks-module/tasks/${taskId}/comments/`, payload);
  return response.data;
};

export const addTaskComment = addComment;

export const getTaskComments = async (taskId: number): Promise<TaskComment[]> => {
  const response = await api.get(`/tasks-module/tasks/${taskId}/comments/`);
  return Array.isArray(response.data) ? response.data : [];
};

export const logTaskTime = async (
  taskId: number,
  data: { hours: number; date: string; description?: string; start_time?: string; end_time?: string }
) => {
  const response = await api.post(`/tasks-module/tasks/${taskId}/timelogs/`, data);
  return response.data;
};

export const uploadTaskAttachment = async (
  taskId: number,
  fileUri: string,
  fileName?: string,
  mimeType?: string
) => {
  const formData = new FormData();
  const cleanUri = Platform.OS === 'android' ? fileUri : fileUri.replace('file://', '');
  formData.append('file', {
    uri: cleanUri,
    name: fileName || 'attachment',
    type: mimeType || 'application/octet-stream',
  } as any);

  const response = await api.post(`/tasks-module/tasks/${taskId}/attachments/`, formData, {
    transformRequest: (data: any, headers: any) => {
      if (headers) {
        delete headers['Content-Type'];
      }
      return data;
    },
  });
  return response.data;
};

export const transcribeAudio = async (audioUri: string, mimeType?: string, fileName?: string): Promise<string> => {
  const formData = new FormData();
  const cleanUri = Platform.OS === 'android' ? audioUri : audioUri.replace('file://', '');
  formData.append('audio', {
    uri: cleanUri,
    name: fileName || 'voice_recording.m4a',
    type: mimeType || 'audio/m4a',
  } as any);

  const response = await api.post('/tasks-module/tasks/transcribe-audio/', formData, {
    transformRequest: (data: any, headers: any) => {
      if (headers) {
        delete headers['Content-Type'];
      }
      return data;
    },
  });
  return response.data?.text || '';
};
