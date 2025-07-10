/**
 * InterviewHomepage.tsx
 * @AshokSaravanan222 & @siladiea
 * Used to show all of the interviews that have happened
 * 2025-07-09
 */

import { getChats } from "@/utils/queries/chats/get-all-chats";
import { Button } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";


export default function InterviewHomepage() {
    const { data: chats } = useQuery({
        queryKey: ['chats'],
        queryFn: () => getChats(),
    });

    return (
        <div>
            <h1>Interview Homepage</h1>
            <Button asChild>
                <Link href="/interview/new">New Interview</Link>
            </Button>
            <div>
                {chats?.map((chat) => (
                    <Link href={`/interview/c/${chat.id}`} key={chat.id}>
                        <div className="flex flex-col gap-2">
                            <h2>{chat.title}</h2>
                            <p>{chat.created_at}</p>
                            <p>{chat.completed_at}</p>
                            <p>{chat.type}</p>
                            <p>{chat.name}</p>
                            <p>{chat.position}</p>
                            <p>{chat.additional_info}</p>
                            <p>{chat.resume_id}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}