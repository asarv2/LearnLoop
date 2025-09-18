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
import { useAllRubricGrades } from "@/lib/api/hooks/useRubrics";
import { useAllStandardGrades } from "@/lib/api/hooks/useStandards";
import { useTrainings } from "@/lib/api/hooks/useTrainings";
import { type ComponentType, useCallback, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

const INTERVIEW_CATEGORIES = [
  { key: "question_quality", label: "Question Quality & Depth" },
  { key: "followup_skills", label: "Follow-up & Probing Skills" },
  { key: "assessment_thoughtfulness", label: "Assessment Thoughtfulness" },
  { key: "interview_conduct", label: "Interview Conduct & Flow" },
  { key: "communication_rapport", label: "Communication & Rapport" },
  { key: "professional_judgment", label: "Professional Judgment" },
] as const;

// Types with rubric dimensions currently supported by the category chart
// const TYPES_WITH_RUBRICS: TrainingTypeOption[] = ["Interview", "Offboarding"];

export default function Overview() {
  const { data: chats } = useChats();
  const { data: rubricGrades } = useAllRubricGrades();
  const { data: standardGrades } = useAllStandardGrades();
  const { data: trainings } = useTrainings();

  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [selectedType, setSelectedType] =
    useState<TrainingTypeOption>("Interview");
  const [avgType, setAvgType] = useState<TrainingTypeOption>("Interview");
  const [hoursType, setHoursType] = useState<TrainingTypeOption>("Interview");

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

  const totals = useMemo(() => {
    const completed = (chats || []).filter((c) => c.completed).length;

    // Completed trainings in the current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedThisMonth = (chats || []).filter((c) => {
      if (!c.completed) return false;
      const createdAt = c.created_at ? new Date(c.created_at) : null;
      return createdAt !== null && createdAt >= monthStart;
    }).length;

    // Find highest score this month and the training it was from
    let highestScoreThisMonth = 0;
    let highestScoreTrainingName: string | null = null;

    for (const chat of chats || []) {
      if (!chat.completed || !chat.created_at) continue;

      const createdAt = new Date(chat.created_at);
      if (createdAt < monthStart) continue;

      const score = getChatScore(chat.id || "");
      if (score > highestScoreThisMonth) {
        highestScoreThisMonth = score;
        const training = (trainings || []).find(
          (t) => t.id === chat.training_id
        );
        highestScoreTrainingName = training?.title || "Training Session";
      }
    }

    // Active days in last 30 days
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeDays30d = new Set(
      (chats || [])
        .filter(
          (c) => c.completed && c.created_at && new Date(c.created_at) >= last30
        )
        .map((c) => new Date(c.created_at || 0).toDateString())
    ).size;

    // Total hours practiced this month filtered by training type
    const hoursThisMonth = (() => {
      const sessions = getChatsByType(hoursType).filter((c) => {
        if (!c.completed) return false;
        if (!c.created_at) return false;
        const createdAt = new Date(c.created_at);
        return createdAt >= monthStart;
      });

      const totalMs = sessions.reduce((acc, c) => {
        const start = c.created_at ? new Date(c.created_at).getTime() : 0;
        const end = (c as { updated_at?: string }).updated_at
          ? new Date(
              (c as { updated_at?: string }).updated_at as string
            ).getTime()
          : start;
        const ms = Math.max(0, end - start);
        return acc + ms;
      }, 0);
      const hours = totalMs / (1000 * 60 * 60);
      return Math.round(hours * 10) / 10;
    })();

    // Calculate current streak: consecutive days with at least one completed chat
    const days = new Set(
      (chats || [])
        .filter((c) => c.completed)
        .map((c) => new Date(c.created_at || 0).toDateString())
    );
    let currentStreak = 0;
    const d = new Date();
    while (days.has(d.toDateString())) {
      currentStreak += 1;
      d.setDate(d.getDate() - 1);
    }

    return {
      completed,
      completedThisMonth,
      highestScoreThisMonth,
      highestScoreTrainingName,
      currentStreak,
      activeDays30d,
      hoursThisMonth,
    };
  }, [chats, trainings, hoursType, getChatScore, getChatsByType]);

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

  const avgByCategory30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = getChatsByType(avgType).filter(
      (s) => new Date(s.created_at || 0).getTime() >= cutoff
    );

    // Get recent chat IDs for filtering standard grades
    const recentChatIds = new Set(recent.map((chat) => chat.id));

    // Debug: Log the data we're working with
    console.log("Recent chats for", avgType, ":", recent.length);
    console.log("Standard grades available:", standardGrades?.length || 0);
    console.log("Recent chat IDs:", Array.from(recentChatIds));
    console.log("Sample standard grade:", standardGrades?.[0]);
    console.log(
      "All standard grade names:",
      standardGrades?.map((sg) => sg.name)
    );

    if (avgType === "Interview") {
      return INTERVIEW_CATEGORIES.map((cat) => {
        // Get all standard grades for recent chats
        const recentStandardGrades = (standardGrades || []).filter((sg) =>
          recentChatIds.has(sg.rubric_grades?.chat_id)
        );

        console.log(`Category ${cat.label} (${cat.key}):`, {
          totalStandardGrades: standardGrades?.length || 0,
          recentStandardGrades: recentStandardGrades.length,
          allNames: recentStandardGrades.map((sg) => sg.name),
          catKey: cat.key,
          catLabel: cat.label,
        });

        // Try to find matching standard grades by name
        let standardGradeData = recentStandardGrades.filter((sg) => {
          const name = sg.name?.toLowerCase() || "";
          const key = cat.key.toLowerCase();
          const labelWords = cat.label.toLowerCase().split(" ");

          return (
            name.includes(key) ||
            name.includes(labelWords[0]) ||
            name.includes(labelWords[1] || "") ||
            key.includes(name.split(" ")[0] || "")
          );
        });

        // If no matches found, try a more flexible approach
        if (standardGradeData.length === 0 && recentStandardGrades.length > 0) {
          // For now, just take the first few standard grades and distribute them
          // This is a temporary solution until we understand the data structure better
          standardGradeData = recentStandardGrades.slice(0, 1);
        }

        if (standardGradeData.length > 0) {
          const total = standardGradeData.reduce(
            (sum, sg) => sum + (sg.score || 0),
            0
          );
          const avg = Math.round((total / standardGradeData.length) * 10) / 10;
          return { name: cat.label, avg };
        }

        // Fallback to chat data if no standard grades
        const total = recent.reduce((sum, s) => {
          const value = (
            s as unknown as { [k: string]: number | null | undefined }
          )[cat.key];
          return sum + (typeof value === "number" ? value : 0);
        }, 0);
        const avg = recent.length
          ? Math.round(((total / recent.length) as number) * 10) / 10
          : 0;
        return { name: cat.label, avg };
      });
    }

    if (avgType === "Leadership") {
      const categories = [
        "Communication",
        "Decision Making",
        "Team Management",
        "Strategic Thinking",
        "Conflict Resolution",
        "Performance Management",
      ];

      return categories.map((category) => {
        const recentStandardGrades = (standardGrades || []).filter((sg) =>
          recentChatIds.has(sg.rubric_grades?.chat_id)
        );

        console.log(`Leadership Category ${category}:`, {
          recentStandardGrades: recentStandardGrades.length,
          allNames: recentStandardGrades.map((sg) => sg.name),
        });

        let standardGradeData = recentStandardGrades.filter((sg) => {
          const name = sg.name?.toLowerCase() || "";
          const categoryLower = category.toLowerCase();
          return (
            name.includes(categoryLower) ||
            categoryLower.includes(name.split(" ")[0] || "")
          );
        });

        // If no matches found, try a more flexible approach
        if (standardGradeData.length === 0 && recentStandardGrades.length > 0) {
          standardGradeData = recentStandardGrades.slice(0, 1);
        }

        if (standardGradeData.length > 0) {
          const total = standardGradeData.reduce(
            (sum, sg) => sum + (sg.score || 0),
            0
          );
          const avg = Math.round((total / standardGradeData.length) * 10) / 10;
          return { name: category, avg };
        }

        return { name: category, avg: 0 };
      });
    }

    if (avgType === "Critical Conversations") {
      const categories = [
        "Active Listening",
        "Empathy & Understanding",
        "Clear Communication",
        "Conflict Resolution",
        "Emotional Intelligence",
        "Problem Solving",
      ];

      return categories.map((category) => {
        const recentStandardGrades = (standardGrades || []).filter((sg) =>
          recentChatIds.has(sg.rubric_grades?.chat_id)
        );

        console.log(`Critical Conversations Category ${category}:`, {
          recentStandardGrades: recentStandardGrades.length,
          allNames: recentStandardGrades.map((sg) => sg.name),
        });

        let standardGradeData = recentStandardGrades.filter((sg) => {
          const name = sg.name?.toLowerCase() || "";
          const categoryLower = category.toLowerCase();
          return (
            name.includes(categoryLower) ||
            categoryLower.includes(name.split(" ")[0] || "")
          );
        });

        // If no matches found, try a more flexible approach
        if (standardGradeData.length === 0 && recentStandardGrades.length > 0) {
          standardGradeData = recentStandardGrades.slice(0, 1);
        }

        if (standardGradeData.length > 0) {
          const total = standardGradeData.reduce(
            (sum, sg) => sum + (sg.score || 0),
            0
          );
          const avg = Math.round((total / standardGradeData.length) * 10) / 10;
          return { name: category, avg };
        }

        return { name: category, avg: 0 };
      });
    }

    // Fallback placeholder if no standards are found
    return [{ name: "Overall", avg: 0 }];
  }, [getChatsByType, avgType, standardGrades]);

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Performance Analytics Dashboard
            </h2>
            <p className="text-slate-600 text-base mt-2">
              Comprehensive insights into your training progress, skill
              development, and performance metrics
            </p>
          </div>
          <div />
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Highest Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {totals.highestScoreThisMonth}
              </div>
              <p className="text-xs text-slate-500">
                {totals.highestScoreTrainingName || "This month"}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {totals.completedThisMonth}
              </div>
              <p className="text-xs text-slate-500">Completed sessions</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Hours Practiced
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={hoursType}
                  onValueChange={(v) => setHoursType(v as TrainingTypeOption)}
                >
                  <SelectTrigger className="w-32 rounded-full shadow-sm bg-white text-slate-900 border-slate-200 h-8 px-3 text-xs">
                    <SelectValue placeholder="Type" />
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
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {totals.hoursThisMonth}
              </div>
              <p className="text-xs text-slate-500">This month</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Current Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {totals.currentStreak}
              </div>
              <p className="text-xs text-slate-500">Consecutive days</p>
            </CardContent>
          </Card>
        </div>

        {/* Score Trends */}
        <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Score Trends</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={range}
                onValueChange={(v) =>
                  setRange(v === "weekly" ? "weekly" : "monthly")
                }
              >
                <SelectTrigger className="w-40 rounded-full shadow-sm bg-white text-slate-900 border-slate-200">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900 border border-slate-200">
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedType}
                onValueChange={(v) => setSelectedType(v as TrainingTypeOption)}
              >
                <SelectTrigger className="w-56 rounded-full shadow-sm bg-white text-slate-900 border-slate-200">
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
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#4f46e5"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#4f46e5"
                        stopOpacity={0.06}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tick={{ fill: "#64748b" }}
                  />
                  <RCTooltip
                    wrapperStyle={{
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                    contentStyle={{ borderRadius: 8 }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#4f46e5"
                    fill="url(#colorScore)"
                    isAnimationActive
                    dot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Average Score by Training Type (Last 30 Days) */}
        {(() => {
          const RCResponsiveContainer =
            ResponsiveContainer as unknown as ComponentType<
              Record<string, unknown>
            >;
          const RCBarChart = BarChart as unknown as ComponentType<
            Record<string, unknown>
          >;
          const RCCartesianGrid = CartesianGrid as unknown as ComponentType<
            Record<string, unknown>
          >;
          const RCXAxis = XAxis as unknown as ComponentType<
            Record<string, unknown>
          >;
          const RCYAxis = YAxis as unknown as ComponentType<
            Record<string, unknown>
          >;
          const RCBar = Bar as unknown as ComponentType<
            Record<string, unknown>
          >;
          const RCTip = RCTooltip as unknown as ComponentType<
            Record<string, unknown>
          >;
          return (
            <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Average Score by Category (Last 30 Days)</CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={avgType}
                    onValueChange={(v) => setAvgType(v as TrainingTypeOption)}
                  >
                    <SelectTrigger className="w-44 rounded-full shadow-sm bg-white text-slate-900 border-slate-200 h-8 px-3">
                      <SelectValue placeholder="Training" />
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
              </CardHeader>
              <CardContent>
                <div className="h-[420px] w-full">
                  <RCResponsiveContainer width="100%" height="100%">
                    <RCBarChart
                      data={avgByCategory30d}
                      margin={{ left: 8, right: 8, top: 8, bottom: 10 }}
                    >
                      <RCCartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <RCXAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        height={80}
                        interval={0}
                        tick={(props: {
                          x: number;
                          y: number;
                          payload: { value: string };
                        }) => {
                          const { x, y, payload } = props;
                          const text = payload.value;
                          const words = text.split(" ");
                          const maxWordsPerLine = 2;

                          // Split into lines with max 2 words each
                          const lines = [];
                          for (
                            let i = 0;
                            i < words.length;
                            i += maxWordsPerLine
                          ) {
                            lines.push(
                              words.slice(i, i + maxWordsPerLine).join(" ")
                            );
                          }

                          return (
                            <g transform={`translate(${x},${y})`}>
                              {lines.map((line, index) => (
                                <text
                                  key={index}
                                  x={0}
                                  y={index * 12 + 5}
                                  textAnchor="middle"
                                  fill="#64748b"
                                  fontSize="11"
                                >
                                  {line}
                                </text>
                              ))}
                            </g>
                          );
                        }}
                      />
                      <RCYAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickCount={6}
                      />
                      <RCTip
                        wrapperStyle={{
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                        }}
                        contentStyle={{ borderRadius: 8 }}
                      />
                      <RCBar
                        dataKey="avg"
                        fill="#4f46e5"
                        radius={[8, 8, 0, 0]}
                      />
                    </RCBarChart>
                  </RCResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}
