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
    <Card data-testid="calendar-week-view-card" className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Next 7 Days
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {format(today, 'MMMM yyyy')}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-[6px] pb-[6px]">
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((date, index) => {
            const dayEvents = getEventsForDay(date);
            const dayTasks = getTasksForDay(date);
            const isCurrentDay = isToday(date);

            return (
              <div
                key={index}
                className={`p-3 rounded-lg border transition-colors ${
                  isCurrentDay 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-muted/50 border-border hover:bg-muted'
                }`}
                data-testid={`calendar-day-${index}`}
              >
                {/* Day Header */}
                <div className="text-center mb-3">
                  <div className={`text-xs font-medium ${
                    isCurrentDay ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {format(date, 'EEE')}
                  </div>
                  <div className={`text-lg font-semibold ${
                    isCurrentDay ? 'text-primary' : 'text-foreground'
                  }`}>
                    {format(date, 'd')}
                  </div>
                </div>

                {/* Events and Tasks */}
                <div className="space-y-2">
                  {dayEvents.map((event, eventIndex) => (
                    <div
                      key={`event-${eventIndex}`}
                      className="text-xs p-2 rounded border-l-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      data-testid={`event-${index}-${eventIndex}`}
                    >
                      <div className="font-medium text-blue-700 dark:text-blue-300 truncate">
                        {event.title}
                      </div>
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mt-1">
                        <Clock className="h-3 w-3" />
                        {event.time}
                      </div>
                      <div className="text-blue-600 dark:text-blue-400 truncate">
                        {event.clientName}
                      </div>
                    </div>
                  ))}

                  {dayTasks.map((task, taskIndex) => (
                    <div
                      key={`task-${taskIndex}`}
                      className="text-xs p-2 rounded border-l-2 border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                      data-testid={`task-${index}-${taskIndex}`}
                    >
                      <div className="font-medium text-orange-700 dark:text-orange-300 truncate">
                        {task.title}
                      </div>
                      <Badge 
                        variant="outline" 
                        className="text-xs mt-1 border-orange-300 text-orange-700 dark:border-orange-600 dark:text-orange-400"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                  ))}

                  {dayEvents.length === 0 && dayTasks.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      No events
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