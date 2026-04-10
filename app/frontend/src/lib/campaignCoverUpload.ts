import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';

export type PresignCoverResult = {
  upload_url: string;
  access_url: string;
  object_key: string;
};

export async function presignCampaignCover(filename: string): Promise<PresignCoverResult> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${getAPIBaseURL()}/api/v1/entities/campaigns/presign-cover`, {
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
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not start upload');
  }
  if (!data.upload_url) throw new Error('No upload URL returned');
  return {
    upload_url: data.upload_url,
    access_url: data.access_url || '',
    object_key: data.object_key || '',
  };
}

export async function uploadCoverFile(file: File): Promise<string> {
  const { upload_url, access_url } = await presignCampaignCover(file.name);
  const put = await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!put.ok) {
    throw new Error('Upload failed — try again or paste an image URL.');
  }
  if (!access_url) {
    throw new Error('Upload succeeded but no public URL was returned. Set DOLLI_COVER_PUBLIC_BASE_URL or paste a URL.');
  }
  return access_url;
}
