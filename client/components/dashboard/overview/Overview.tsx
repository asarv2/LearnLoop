/**
 * Overview.tsx
 * Used to show the overview of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChats } from "@/lib/api/hooks/useChats";
import { useAllRubricGrades } from "@/lib/api/hooks/useRubrics";
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



export default function Overview() {
  const { user } = useAuth();
  const { data: chats } = useChats();
  const { data: rubricGrades, isLoading: rubricGradesLoading } =
    useAllRubricGrades();

  const [range, setRange] = useState<"weekly" | "monthly">("weekly");

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

  // Get user's chats and their rubric grades
  const userChats = useMemo(() => {
    if (!user?.id) return [];

    return (chats || []).filter((chat) => {
      // Filter chats that belong to the current user
      // Assuming chats have a profile_id or user_id field that matches the user
      return chat.profile_id === user.id;
    });
  }, [chats, user?.id]);

  // Get recent 5 completed conversations with their rubric grades
  const recentConversations = useMemo(() => {
    const completedChats = userChats
      .filter((c) => c.completed && c.created_at)
      .sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      )
      .slice(0, 5);

    return completedChats.map((chat) => {
      const rubricGradeArray = Array.isArray(rubricGrades) ? rubricGrades : [];
      const chatRubricGrade = rubricGradeArray.find(
        (rg: { chat_id: string | null }) => rg.chat_id === chat.id
      );
      return {
        chat,
        rubricGrade: chatRubricGrade,
        score: getChatScore(chat.id || ""),
      };
    });
  }, [userChats, rubricGrades, getChatScore]);

  // Extract strengths and areas for improvement from recent conversations
  const insights = useMemo(() => {
    const allStrengths: string[] = [];
    const allAreasForImprovement: string[] = [];

    recentConversations.forEach(({ rubricGrade }) => {
      if (rubricGrade) {
        // Only use strengths and improvements arrays from rubric_grades table
        if (rubricGrade.strengths && rubricGrade.strengths.length > 0) {
          allStrengths.push(...rubricGrade.strengths);
        }
        if (rubricGrade.improvements && rubricGrade.improvements.length > 0) {
          allAreasForImprovement.push(...rubricGrade.improvements);
        }
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
    // Get all user's completed chats with scores
    const userCompletedChats = userChats
      .filter((c) => c.completed && c.created_at)
      .map((c) => ({
        date: new Date(c.created_at || 0),
        score: getChatScore(c.id || ""),
      }))
      .filter((item) => item.score > 0) // Only include chats with scores
      .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort by date

    if (userCompletedChats.length === 0) {
      return [];
    }

    // Group by time periods based on range
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
        const scores = userCompletedChats.filter(
          (x) => x.date >= start && x.date <= end
        );
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
        const scores = userCompletedChats.filter(
          (x) => x.date >= start && x.date <= end
        );
        const avg =
          scores.length > 0
            ? Math.round(
                scores.reduce((a, b) => a + (b.score || 0), 0) / scores.length
              )
            : 0;
        return { date: label, score: avg };
      });
    }
  }, [userChats, range, getChatScore]);

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
                {rubricGradesLoading ? (
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
                {rubricGradesLoading ? (
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
