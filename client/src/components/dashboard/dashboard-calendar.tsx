import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import { useLocation } from "wouter";
import type { Task, Event } from "@shared/schema";

interface DotProps {
  color: string;
}

function Dot({ color }: DotProps) {
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: 5, height: 5, background: color }}
    />
  );
}

export default function DashboardCalendar() {
  const [viewDate, setViewDate] = useState(new Date());
  const [, setLocation] = useLocation();

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!currentUser,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  // Build the calendar grid: Mon → Sun weeks
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Mon
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  const getEventsForDay = (date: Date) => ({
    gigs: (events as Event[]).filter(
      (e) => !e.isReadonly && isSameDay(new Date(e.startDate), date)
    ),
    googleCal: (events as Event[]).filter(
      (e) => e.isReadonly && isSameDay(new Date(e.startDate), date)
    ),
    tasks: (tasks as Task[]).filter(
      (t) => t.dueDate && isSameDay(new Date(t.dueDate), date)
    ),
  });

  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card className="overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {format(viewDate, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <CardContent className="p-3">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((day, idx) => {
            const { gigs, googleCal, tasks: dayTasks } = getEventsForDay(day);
            const inMonth = isSameMonth(day, viewDate);
            const today = isToday(day);
            const hasAnything = gigs.length > 0 || googleCal.length > 0 || dayTasks.length > 0;

            return (
              <HoverCard key={idx} openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div
                    className={`
                      flex flex-col items-center py-1 rounded-lg cursor-pointer transition-colors
                      ${today
                        ? "bg-primary text-primary-foreground font-bold"
                        : inMonth
                        ? "hover:bg-muted text-foreground"
                        : "text-muted-foreground/40 hover:bg-muted/50"
                      }
                    `}
                    onClick={() => setLocation("/calendar")}
                    data-testid={`cal-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <span className="text-xs leading-none mb-0.5">
                      {format(day, "d")}
                    </span>
                    {/* Dot row */}
                    {hasAnything && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {gigs.slice(0, 2).map((_, i) => (
                          <Dot key={`g${i}`} color={today ? "rgba(255,255,255,0.8)" : "#22c55e"} />
                        ))}
                        {dayTasks.slice(0, 1).map((_, i) => (
                          <Dot key={`t${i}`} color={today ? "rgba(255,255,255,0.8)" : "#f59e0b"} />
                        ))}
                        {googleCal.slice(0, 1).map((_, i) => (
                          <Dot key={`gc${i}`} color={today ? "rgba(255,255,255,0.8)" : "#6366f1"} />
                        ))}
                      </div>
                    )}
                  </div>
                </HoverCardTrigger>

                {/* Hover popup */}
                {hasAnything && (
                  <HoverCardContent className="w-72 p-3" side="top">
                    <p className="text-xs font-semibold text-foreground mb-2">
                      {format(day, "EEEE, d MMMM")}
                    </p>

                    {gigs.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">
                          Gigs
                        </p>
                        {gigs.map((e) => (
                          <div key={e.id} className="flex items-start gap-1.5 mb-1">
                            <Dot color="#22c55e" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="h-2.5 w-2.5" />
                                {format(new Date(e.startDate), "HH:mm")}
                                {e.location && (
                                  <>
                                    <MapPin className="h-2.5 w-2.5 ml-1" />
                                    <span className="truncate">{e.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {dayTasks.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                          Tasks Due
                        </p>
                        {dayTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-1.5 mb-1">
                            <Dot color="#f59e0b" />
                            <p className="text-xs text-foreground truncate">{t.title}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {googleCal.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">
                          Google Calendar
                        </p>
                        {googleCal.map((e) => (
                          <div key={e.id} className="flex items-start gap-1.5 mb-1">
                            <Dot color="#6366f1" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="h-2.5 w-2.5" />
                                {format(new Date(e.startDate), "HH:mm")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </HoverCardContent>
                )}
              </HoverCard>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t flex-wrap">
          <div className="flex items-center gap-1">
            <Dot color="#22c55e" />
            <span className="text-[10px] text-muted-foreground">Gig</span>
          </div>
          <div className="flex items-center gap-1">
            <Dot color="#f59e0b" />
            <span className="text-[10px] text-muted-foreground">Task due</span>
          </div>
          <div className="flex items-center gap-1">
            <Dot color="#6366f1" />
            <span className="text-[10px] text-muted-foreground">Google Cal</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
