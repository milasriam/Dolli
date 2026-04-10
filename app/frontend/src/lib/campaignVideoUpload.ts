import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';

export type PresignVideoResult = {
  upload_url: string;
  access_url: string;
  object_key: string;
};

/** Keep below reverse-proxy `client_max_body_size` (staging nginx uses 128m). */
const MAX_VIDEO_BYTES = 120 * 1024 * 1024;

export async function presignCampaignVideo(filename: string): Promise<PresignVideoResult> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${getAPIBaseURL()}/api/v1/entities/campaigns/presign-video`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename }),
    credentials: 'omit',
  });
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string;
    upload_url?: string;
    access_url?: string;
    object_key?: string;
  };
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not start video upload');
  }
  if (!data.upload_url) throw new Error('No upload URL returned');
  return {
    upload_url: data.upload_url,
    access_url: data.access_url || '',
    object_key: data.object_key || '',
  };
}

export async function uploadCampaignVideoFile(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video is too large (max ~120 MB). Trim or compress, then try again.');
  }
  const { upload_url, access_url } = await presignCampaignVideo(file.name);
  const put = await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!put.ok) {
    throw new Error('Upload failed — try again or paste a direct .mp4 / YouTube link.');
  }
  if (!access_url) {
    throw new Error('Upload succeeded but no public URL was returned.');
  }
  return access_url;
}
