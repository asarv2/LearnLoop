/**
 * Overview.tsx
 * Used to show the overview of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChats } from "@/lib/api/hooks/useChats";
import { useFeedback } from "@/lib/api/hooks/useFeedback";
import { useAllRubricGrades } from "@/lib/api/hooks/useRubrics";
import { useTrainings } from "@/lib/api/hooks/useTrainings";
import { useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RCTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

type TrainingTypeOption = "Critical Conversations" | "Interview" | "Leadership";

const TRAINING_TYPES: TrainingTypeOption[] = [
  "Critical Conversations",
  "Interview",
  "Leadership",
];

export default function Overview() {
  const { data: chats } = useChats();
  const { data: rubricGrades } = useAllRubricGrades();
  const { data: feedback, isLoading: feedbackLoading } = useFeedback();
  const { data: trainings } = useTrainings();

  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [selectedType, setSelectedType] =
    useState<TrainingTypeOption>("Interview");

  // Helper function to get score for a chat from its rubric grade
  const getChatScore = useCallback(
    (chatId: string): number => {
      const rubricGrade = (rubricGrades || []).find(
        (rg) => rg.chat_id === chatId
      );
      return rubricGrade?.score || 0;
    },
    [rubricGrades]
  );

  // Helper function to get training type from chat
  const getTrainingTypeFromChat = useCallback(
    (chat: { training_id?: string | null }): TrainingTypeOption => {
      if (!chat.training_id) return "Critical Conversations";

      const training = (trainings || []).find((t) => t.id === chat.training_id);
      if (!training) return "Critical Conversations";

      const title = training.title.toLowerCase();
      if (title.includes("interview")) return "Interview";
      if (title.includes("leadership")) return "Leadership";
      return "Critical Conversations";
    },
    [trainings]
  );

  // Helper function to filter chats by training type
  const getChatsByType = useCallback(
    (type: TrainingTypeOption) => {
      return (chats || []).filter(
        (chat) => getTrainingTypeFromChat(chat) === type
      );
    },
    [chats, getTrainingTypeFromChat]
  );

  // Get recent 5 completed conversations with their feedback
  const recentConversations = useMemo(() => {
    const completedChats = (chats || [])
      .filter((c) => c.completed && c.created_at)
      .sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      )
      .slice(0, 5);

    return completedChats.map((chat) => {
      const feedbackArray = Array.isArray(feedback) ? feedback : [];
      const chatFeedback = feedbackArray.find(
        (f: { chat_id: string }) => f.chat_id === chat.id
      );
      return {
        chat,
        feedback: chatFeedback,
        score: getChatScore(chat.id || ""),
      };
    });
  }, [chats, feedback, getChatScore]);

  // Extract strengths and areas for improvement from recent conversations
  const insights = useMemo(() => {
    const allStrengths: string[] = [];
    const allAreasForImprovement: string[] = [];

    recentConversations.forEach(({ feedback }) => {
      if (feedback) {
        allStrengths.push(...(feedback.strengths || []));
        allAreasForImprovement.push(...(feedback.errors || []));
      }
    });

    // Remove duplicates and limit to top items
    const uniqueStrengths = Array.from(new Set(allStrengths)).slice(0, 5);
    const uniqueAreasForImprovement = Array.from(
      new Set(allAreasForImprovement)
    ).slice(0, 5);

    return {
      strengths: uniqueStrengths,
      areasForImprovement: uniqueAreasForImprovement,
    };
  }, [recentConversations]);

  const trendData = useMemo(() => {
    // Create filtered data with scores from rubric grades for selected training type
    const filtered = getChatsByType(selectedType)
      .filter((c) => c.completed && c.created_at)
      .map((c) => ({
        date: new Date(c.created_at || 0),
        score: getChatScore(c.id || ""),
      }))
      .filter((item) => item.score > 0); // Only include chats with scores

    if (range === "weekly") {
      // Build last 12 full weeks, starting from current week
      const weeks: { start: Date; end: Date; label: string }[] = [];
      const now = new Date();
      const current = new Date(now);
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      current.setDate(diff);
      current.setHours(0, 0, 0, 0);
      for (let i = 11; i >= 0; i--) {
        const start = new Date(current);
        start.setDate(current.getDate() - i * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const label = `${start.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}`;
        weeks.push({ start, end, label });
      }
      return weeks.map(({ start, end, label }) => {
        const scores = filtered.filter((x) => x.date >= start && x.date <= end);
        const avg =
          scores.length > 0
            ? Math.round(
                scores.reduce((a, b) => a + (b.score || 0), 0) / scores.length
              )
            : 0;
        return { date: label, score: avg };
      });
    } else {
      // last 12 months including current
      const months: { start: Date; end: Date; label: string }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(
          start.getFullYear(),
          start.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        const label = start.toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        });
        months.push({ start, end, label });
      }
      return months.map(({ start, end, label }) => {
        const scores = filtered.filter((x) => x.date >= start && x.date <= end);
        const avg =
          scores.length > 0
            ? Math.round(
                scores.reduce((a, b) => a + (b.score || 0), 0) / scores.length
              )
            : 0;
        return { date: label, score: avg };
      });
    }
  }, [getChatsByType, selectedType, range, getChatScore]);

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-8">
        {/* Performance Trends */}
        <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">
                  Performance Trends
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Track your progress over time
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={range}
                  onValueChange={(v) =>
                    setRange(v === "weekly" ? "weekly" : "monthly")
                  }
                >
                  <SelectTrigger className="w-32 rounded-lg shadow-sm bg-white text-slate-900 border-slate-200 h-9">
                    <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-900 border border-slate-200">
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedType}
                  onValueChange={(v) =>
                    setSelectedType(v as TrainingTypeOption)
                  }
                >
                  <SelectTrigger className="w-48 rounded-lg shadow-sm bg-white text-slate-900 border-slate-200 h-9">
                    <SelectValue placeholder="Training type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-900 border border-slate-200">
                    {TRAINING_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ left: 16, right: 16, top: 16, bottom: 16 }}
                >
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <RCTooltip
                    wrapperStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      backgroundColor: "white",
                      border: "none",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorScore)"
                    isAnimationActive
                    dot={{
                      r: 4,
                      fill: "#3b82f6",
                      strokeWidth: 2,
                      stroke: "white",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Insights Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Strengths Card */}
          <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Key Strengths
                  </CardTitle>
                  <p className="text-sm text-slate-600">
                    Based on your recent 5 conversations
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {feedbackLoading ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-sm text-slate-500">
                      Loading insights...
                    </p>
                  </div>
                ) : insights.strengths.length > 0 ? (
                  insights.strengths.map((strength, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-white/60 rounded-lg border border-green-200/50"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {strength}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500">
                      Complete more conversations to see your strengths
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Areas for Improvement Card */}
          <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Areas for Improvement
                  </CardTitle>
                  <p className="text-sm text-slate-600">
                    Focus areas from your recent 5 conversations
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {feedbackLoading ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-sm text-slate-500">
                      Loading insights...
                    </p>
                  </div>
                ) : insights.areasForImprovement.length > 0 ? (
                  insights.areasForImprovement.map((area, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-white/60 rounded-lg border border-amber-200/50"
                    >
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {area}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-amber-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500">
                      Great job! No specific areas for improvement identified
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
