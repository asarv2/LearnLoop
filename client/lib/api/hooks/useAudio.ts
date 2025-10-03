import { api } from "../fetcher";

export async function uploadAudio(id: string, formData: FormData) {
  return await api<{ success: boolean; key: string; message: string }>(
    `/api/v1/audio/${id}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
}
