import type {
  DocumentDetailResponse,
  DocumentListResponse,
  DocumentChunksResponse,
  JobEventsListResponse,
  DocumentUploadResponse,
  DocumentFileResponse,
  ErrorEnvelope,
} from '@juris/shared';
import { parseWebConfig } from '../config.js';
import { supabase } from './supabase.js';

const config = parseWebConfig();
const API_BASE = config.VITE_API_URL;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorEnvelope: ErrorEnvelope | null = null;
    try {
      errorEnvelope = (await res.json()) as ErrorEnvelope;
    } catch {
      // Fallback if not JSON
    }
    const message =
      errorEnvelope?.error?.message ||
      `HTTP Request failed with status ${res.status} ${res.statusText}`;
    const code = errorEnvelope?.error?.code || 'INTERNAL_ERROR';
    const err = new Error(message);
    (err as unknown as { code: string; details?: unknown }).code = code;
    (err as unknown as { details?: unknown }).details = errorEnvelope?.error?.details;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function fetchDocuments(): Promise<DocumentListResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/documents`, {
    method: 'GET',
    headers,
  });
  return handleResponse<DocumentListResponse>(res);
}

export async function fetchDocumentDetail(id: string): Promise<DocumentDetailResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/documents/${id}`, {
    method: 'GET',
    headers,
  });
  return handleResponse<DocumentDetailResponse>(res);
}

export async function fetchDocumentChunks(
  id: string,
  query?: string,
): Promise<DocumentChunksResponse> {
  const headers = await getAuthHeaders();
  const url = new URL(`${API_BASE}/api/documents/${id}/chunks`);
  if (query && query.trim()) {
    url.searchParams.set('query', query.trim());
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });
  return handleResponse<DocumentChunksResponse>(res);
}

export async function fetchJobEvents(id: string): Promise<JobEventsListResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/documents/${id}/events`, {
    method: 'GET',
    headers,
  });
  return handleResponse<JobEventsListResponse>(res);
}

export async function fetchDocumentFile(id: string): Promise<DocumentFileResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/documents/${id}/file`, {
    method: 'GET',
    headers,
  });
  return handleResponse<DocumentFileResponse>(res);
}

export async function uploadDocument(file: File): Promise<DocumentUploadResponse> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append('file', file, file.name);

  const res = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return handleResponse<DocumentUploadResponse>(res);
}

export async function deleteDocument(id: string): Promise<{ status: string; id: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/documents/${id}`, {
    method: 'DELETE',
    headers,
  });
  return handleResponse<{ status: string; id: string }>(res);
}
