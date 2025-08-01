// utils/google/get-valid-resume.ts
// Wrapper around getResume that checks if the resume is valid in google, and uploads the latest if necessary

import { Resume } from "@/types";
import { getGoogleGenAIClient } from "../ai/main";
import { getResume } from "../queries/resumes/get-resume";
import { uploadResume } from "./upload-resume";
import { updateResume } from "../mutations/resumes/update-resume";

export const getValidResume = async (resumeId: string, processingAttempts: number = 0): Promise<Resume> => {
    const resume = await getResume(resumeId);
    if (!resume.google_file_id) {
        throw new Error("Resume not found");
    }
    const google = await getGoogleGenAIClient();
    // check that the google file id is still valid
    const response = await google.files.get({
        name: resume.google_file_id,
    });
    if (response.state === "ACTIVE") {
        return resume;
    } else if (response.state === "PROCESSING") {
        if (processingAttempts > 6) { // wait for 60 seconds
            throw new Error("Resume is still processing");
        }
        // wait for 10 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));
        return await getValidResume(resumeId, processingAttempts + 1); // recursive call
    } else {
        // assume that the resume is expired or delete, upload the latest resume, using supabase
        const resumeResponse = await fetch(`/api/resume/${resumeId}`);
        const resumeBlob = await resumeResponse.blob();
        const formData = new FormData();
        formData.append("resume", resumeBlob);
        const newGoogleFileId = await uploadResume(formData);
        // update the resume with the new google file id
        const resume = await updateResume(resumeId, {
            google_file_id: newGoogleFileId,
        });
        return resume;
    }
}