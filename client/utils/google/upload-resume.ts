// utils/google/upload-resume.ts
// Uploads a resume to get google file id

import { getGoogleGenAIClient } from "../ai/main";

export const uploadResume = async (formData: FormData) => {
    const resume = formData.get("resume") as File;
    const google = await getGoogleGenAIClient();
    const response = await google.files.upload({
        file: resume,
        config: {
            mimeType: "application/pdf",
        }
    });
    
    return response.name;
}