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
import { useScenarios } from "@/lib/api/hooks/useScenarios";
import {
  useInterviewScores,
  useOffboardingScores,
} from "@/lib/api/hooks/useScores";
import { useStandards } from "@/lib/api/hooks/useStandards";
import { useTrainings } from "@/lib/api/hooks/useTrainings";
import { Flame, LineChartIcon, Timer } from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";
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

type TrainingTypeOption =
  | "Interview"
  | "Offboarding"
  | "Leadership"
  | "Cross-Cultural"
  | "Difficult Conversations"
  | "Coaching"
  | "Performance Management";

const TRAINING_TYPES: TrainingTypeOption[] = [
  "Interview",
  "Offboarding",
  "Leadership",
  "Cross-Cultural",
  "Difficult Conversations",
  "Coaching",
];

const INTERVIEW_CATEGORIES = [
  { key: "question_quality", label: "Question Quality & Depth" },
  { key: "followup_skills", label: "Follow-up & Probing Skills" },
  { key: "assessment_thoughtfulness", label: "Assessment Thoughtfulness" },
  { key: "interview_conduct", label: "Interview Conduct & Flow" },
  { key: "communication_rapport", label: "Communication & Rapport" },
  { key: "professional_judgment", label: "Professional Judgment" },
] as const;

const OFFBOARDING_CATEGORIES = [
  {
    key: "empathy_emotional_intelligence",
    label: "Empathy & Emotional Intelligence",
  },
  {
    key: "communication_professionalism",
    label: "Communication Clarity & Professionalism",
  },
  { key: "clarity_of_next_steps", label: "Clarity of Next Steps" },
  {
    key: "transition_planning_logistics",
    label: "Transition Planning & Logistics",
  },
  {
    key: "conflict_resolution",
    label: "Conflict Resolution & Difficult Conversations",
  },
  {
    key: "assessment_thoughtfulness",
    label: "Assessment Thoughtfulness & Reflection",
  },
] as const;

// Types with rubric dimensions currently supported by the category chart
// const TYPES_WITH_RUBRICS: TrainingTypeOption[] = ["Interview", "Offboarding"];

export default function Overview() {
  const { data: chats } = useChats();
  const { data: interviewScores } = useInterviewScores();
  const { data: offboardingScores } = useOffboardingScores();
  const { data: trainings } = useTrainings();
  const { data: scenarios } = useScenarios();
  const { data: standards } = useStandards();

  const [range, setRange] = useState<"weekly" | "monthly">("weekly");
  const [selectedType, setSelectedType] =
    useState<TrainingTypeOption>("Interview");
  const [avgType, setAvgType] = useState<TrainingTypeOption>("Interview");
  const [hoursType, setHoursType] = useState<TrainingTypeOption>("Interview");

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

    // Highest Interview Score (This Month) and its training name
    const interviewThisMonth = (interviewScores || []).filter((s) => {
      const createdAt = s.created_at ? new Date(s.created_at) : null;
      return createdAt !== null && createdAt >= monthStart;
    });
    let highestInterviewScoreThisMonth = 0;
    let highestInterviewTrainingName: string | null = null;
    for (const s of interviewThisMonth) {
      const score = (s as { overall_score?: number }).overall_score || 0;
      if (score >= highestInterviewScoreThisMonth) {
        highestInterviewScoreThisMonth = score;
        const chatId = (s as { chat_id?: string }).chat_id || null;
        if (chatId) {
          const chat = (chats || []).find((c) => c.id === chatId);
          const trainingId = chat?.training_id || null;
          if (trainingId) {
            const training = (trainings || []).find((t) => t.id === trainingId);
            highestInterviewTrainingName =
              training?.title || training?.type || null;
          } else {
            highestInterviewTrainingName = "Interview";
          }
        }
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
      const typeNorm = hoursType.toLowerCase();
      const sessions = (chats || []).filter((c) => {
        const t = (c.training_type || "").toLowerCase();
        if (t !== typeNorm) return false;
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

    // simple streak: consecutive days with at least one completed chat
    const days = new Set(
      (chats || [])
        .filter((c) => c.completed)
        .map((c) => new Date(c.created_at || 0).toDateString())
    );
    let streak = 0;
    const d = new Date();
    while (days.has(d.toDateString())) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }

    return {
      completed,
      completedThisMonth,
      // replaced avgScore with highest interview score & its training
      highestInterviewScoreThisMonth,
      highestInterviewTrainingName,
      activeDays30d,
      hoursThisMonth,
      streak,
    };
  }, [chats, interviewScores, trainings, hoursType]);

  const trendData = useMemo(() => {
    const all = [
      ...(interviewScores || []).map((s) => ({
        date: new Date(s.created_at || 0),
        score: s.overall_score || 0,
        type: "Interview",
      })),
      ...(offboardingScores || []).map((s) => ({
        date: new Date(s.created_at || 0),
        score: s.overall_score || 0,
        type: "Offboarding",
      })),
    ];
    const filtered = all.filter((x) => x.type === selectedType);

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
  }, [interviewScores, offboardingScores, range, selectedType]);

  const avgByCategory30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    if (avgType === "Interview") {
      const recent = (interviewScores || []).filter(
        (s) => new Date(s.created_at || 0).getTime() >= cutoff
      );
      return INTERVIEW_CATEGORIES.map((cat) => {
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

    if (avgType === "Offboarding") {
      const recent = (offboardingScores || []).filter(
        (s) => new Date(s.created_at || 0).getTime() >= cutoff
      );
      return OFFBOARDING_CATEGORIES.map((cat) => {
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

    // For other training types, find categories from standards using exact title matching
    const matchingTrainings = (trainings || []).filter((training) =>
      training.title?.toLowerCase().includes(avgType.toLowerCase())
    );

    if (matchingTrainings.length > 0) {
      // Get the first matching training
      const training = matchingTrainings[0];
      const scenario = (scenarios || []).find(
        (s) => s.training_id === training.id
      );
      const trainingStandards = (standards || []).filter(
        (s) => s.rubric_id === scenario?.rubric_id
      );

      if (trainingStandards.length > 0) {
        // Use standards as categories, all starting at 0
        return trainingStandards.map((standard) => ({
          name: (standard as { name?: string }).name || "Category",
          avg: 0,
        }));
      }
    }

    // Fallback placeholder if no standards are found
    return [{ name: "Overall", avg: 0 }];
  }, [
    interviewScores,
    offboardingScores,
    avgType,
    trainings,
    scenarios,
    standards,
  ]);

  const insights = useMemo(() => {
    // Build per-training insight with 0-defaults
    const empty = {
      avg: 0,
      count: 0,
      blurb: "No data yet. Keep practicing to unlock insights.",
    };
    const byType = TRAINING_TYPES.reduce((acc, t) => {
      acc[t] = { ...empty };
      return acc;
    }, {} as Record<TrainingTypeOption, { avg: number; count: number; blurb: string }>);

    const add = (type: TrainingTypeOption, score: number) => {
      const v = byType[type];
      const total = v.avg * v.count + score;
      v.count += 1;
      v.avg = Math.round(total / v.count);
      if (v.count > 0) {
        v.blurb =
          v.avg >= 75
            ? "Strong performance—maintain consistency and increase difficulty gradually."
            : "Focus on fundamentals—review guidelines and practice shorter sessions more often.";
      }
    };

    (interviewScores || []).forEach((s) =>
      add("Interview", s.overall_score || 0)
    );
    (offboardingScores || []).forEach((s) =>
      add("Offboarding", s.overall_score || 0)
    );

    return (
      Object.entries(byType) as [
        TrainingTypeOption,
        { avg: number; count: number; blurb: string }
      ][]
    ).map(([type, v]) => ({ type, ...v }));
  }, [interviewScores, offboardingScores]);

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Analytics
          </h2>
          <div />
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Trainings Completed
              </CardTitle>
              <LineChartIcon className="h-5 w-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {totals.completedThisMonth}
              </div>
              <p className="text-xs text-slate-500">Current Month</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Highest Interview Score (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {totals.highestInterviewScoreThisMonth ?? 0}
              </div>
              <p className="text-xs text-slate-500">
                {totals.highestInterviewTrainingName
                  ? `From ${totals.highestInterviewTrainingName}`
                  : "Interview"}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Total Hours Practiced
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={hoursType}
                  onValueChange={(v) => setHoursType(v as TrainingTypeOption)}
                >
                  <SelectTrigger className="w-40 rounded-full shadow-sm bg-white text-slate-900 border-slate-200 h-8 px-3">
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
                <Timer className="h-5 w-5 text-slate-400" />
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
                Training Streak
              </CardTitle>
              <Flame className="h-5 w-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold text-indigo-600">
                {totals.streak} days
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
                <div className="h-72 w-full">
                  <RCResponsiveContainer width="100%" height="100%">
                    <RCBarChart
                      data={avgByCategory30d}
                      margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                    >
                      <RCCartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <RCXAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748b" }}
                      />
                      <RCYAxis
                        allowDecimals
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 5]}
                        ticks={[0, 1, 2, 3, 4, 5]}
                        tick={{ fill: "#64748b" }}
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

        {/* Feedback & AI Insights */}
        <Card className="rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-[1px] bg-white">
          <CardHeader>
            <CardTitle>Feedback & AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((it) => (
                <div
                  key={it.type}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700">
                      {it.type}
                    </div>
                    <div className="text-xs text-slate-500">
                      {it.count} sessions
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/10">
                      Avg Score: {it.avg}
                    </span>
                  </div>
                  <p
                    className="mt-3 text-sm text-slate-600 truncate"
                    title={it.blurb}
                  >
                    {it.blurb}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
