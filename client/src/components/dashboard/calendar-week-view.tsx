import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock } from "lucide-react";
import { addDays, format, isToday, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { Task } from "@shared/schema";

export default function CalendarWeekView() {
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  // Mock events for demonstration - in real app, these would come from API
  const mockEvents = [
    { date: today, title: "Client Meeting", time: "10:00 AM", type: "meeting", clientName: "John Smith" },
    { date: addDays(today, 1), title: "Project Review", time: "2:00 PM", type: "review", clientName: "Tech Corp" },
    { date: addDays(today, 2), title: "Follow-up Call", time: "11:00 AM", type: "call", clientName: "Creative Studio" },
    { date: addDays(today, 4), title: "Contract Signing", time: "3:00 PM", type: "meeting", clientName: "Music Venue" },
    { date: addDays(today, 6), title: "Event Setup", time: "9:00 AM", type: "event", clientName: "Wedding Party" },
  ];

  const getEventsForDay = (date: Date) => {
    return mockEvents.filter(event => isSameDay(event.date, date));
  };

  const getTasksForDay = (date: Date) => {
    if (!tasks) return [];
    return tasks.filter(task => 
      task.dueDate && isSameDay(new Date(task.dueDate), date)
    );
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-500 text-white';
      case 'review': return 'bg-green-500 text-white';
      case 'call': return 'bg-yellow-500 text-white';
      case 'event': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <Card data-testid="calendar-week-view-card" className="w-full">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1 text-sm">
            <CalendarIcon className="h-3 w-3" />
            Next 7 Days
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            {format(today, 'MMM yyyy')}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((date, index) => {
            const dayEvents = getEventsForDay(date);
            const dayTasks = getTasksForDay(date);
            const isCurrentDay = isToday(date);

            return (
              <div
                key={index}
                className={`p-1 rounded border transition-colors ${
                  isCurrentDay 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-muted/50 border-border hover:bg-muted'
                }`}
                data-testid={`calendar-day-${index}`}
              >
                {/* Day Header */}
                <div className="text-center mb-1">
                  <div className={`text-[10px] font-medium ${
                    isCurrentDay ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {format(date, 'EEE')}
                  </div>
                  <div className={`text-sm font-semibold ${
                    isCurrentDay ? 'text-primary' : 'text-foreground'
                  }`}>
                    {format(date, 'd')}
                  </div>
                </div>

                {/* Events and Tasks */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event, eventIndex) => (
                    <div
                      key={`event-${eventIndex}`}
                      className="text-[9px] p-1 rounded border-l border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      data-testid={`event-${index}-${eventIndex}`}
                    >
                      <div className="font-medium text-blue-700 dark:text-blue-300 truncate leading-tight">
                        {event.title}
                      </div>
                      <div className="text-blue-600 dark:text-blue-400 truncate leading-tight">
                        {event.time}
                      </div>
                    </div>
                  ))}

                  {dayTasks.slice(0, 1).map((task, taskIndex) => (
                    <div
                      key={`task-${taskIndex}`}
                      className="text-[9px] p-1 rounded border-l border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                      data-testid={`task-${index}-${taskIndex}`}
                    >
                      <div className="font-medium text-orange-700 dark:text-orange-300 truncate leading-tight">
                        {task.title}
                      </div>
                    </div>
                  ))}

                  {dayEvents.length === 0 && dayTasks.length === 0 && (
                    <div className="text-[9px] text-muted-foreground text-center py-1">
                      No events
                    </div>
                  )}
                  
                  {(dayEvents.length > 2 || dayTasks.length > 1) && (
                    <div className="text-[8px] text-muted-foreground text-center">
                      +{Math.max(0, dayEvents.length - 2) + Math.max(0, dayTasks.length - 1)} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}