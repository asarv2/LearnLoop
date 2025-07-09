// utils/google/get-valid-resume.ts
// Wrapper around getResume that checks if the resume is valid in google, and uploads the latest if necessary

import { getResume } from "../queries/resumes/get-resume";

export const getValidResume = async (resumeId: string) => {
    // TODO: check that the google file id is still valid
    const resume = await getResume(resumeId);
    return resume;
}