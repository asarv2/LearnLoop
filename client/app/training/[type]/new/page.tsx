/**
 * app/training/[type]/new/page.tsx  
 * Generic new training page that routes to specific training types
 */

import NewInterview from "@/client/components/NewInterview";
import NewOffboarding from "@/client/components/NewOffboarding";
import { use } from "react";
import { notFound } from "next/navigation";

export default function NewTrainingPage({
    params,
}: {
    params: Promise<{ type: string }>;
}) {
    const { type } = use(params);

    switch (type) {
        case 'interview':
            return <NewInterview />;
        case 'offboarding':
            return <NewOffboarding />;
        default:
            notFound();
    }
} 