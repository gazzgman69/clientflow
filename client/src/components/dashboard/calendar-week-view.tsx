import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CalendarIcon, Clock } from "lucide-react";
import { addDays, format, isToday, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Task } from "@shared/schema";

export default function CalendarWeekView() {
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [, setLocation] = useLocation();

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  // Mock events for demonstration - in real app, these would come from API
  const mockEvents = [
    { date: today, title: "Client Meeting", time: "10:00 AM", type: "meeting", clientName: "John Smith" },
    { date: today, title: "Venue Walkthrough", time: "12:30 PM", type: "meeting", clientName: "Grand Ballroom" },
    { date: today, title: "Sound Check", time: "2:00 PM", type: "event", clientName: "Wedding Party" },
    { date: today, title: "Final Details Call", time: "4:15 PM", type: "call", clientName: "Sarah Johnson" },
    { date: today, title: "Equipment Delivery", time: "6:00 PM", type: "event", clientName: "Tech Solutions" },
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
      <CardHeader className="pt-2 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-0.5 text-xs">
            <CalendarIcon className="h-2.5 w-2.5" />
            Next 7 Days
          </CardTitle>
          <div className="text-[10px] text-muted-foreground">
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
              <HoverCard key={index}>
                <HoverCardTrigger asChild>
                  <div
                    className={`p-1 rounded border transition-colors cursor-pointer ${
                      isCurrentDay 
                        ? 'bg-primary/10 border-primary hover:bg-primary/20' 
                        : 'bg-muted/50 border-border hover:bg-muted'
                    }`}
                    data-testid={`calendar-day-${index}`}
                    onClick={() => setLocation('/calendar')}
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
                </HoverCardTrigger>
                <HoverCardContent className="w-80" side="top">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{format(date, 'EEEE, MMM d')}</h4>
                      <Badge variant={isCurrentDay ? "default" : "secondary"}>
                        {isCurrentDay ? "Today" : format(date, 'EEE')}
                      </Badge>
                    </div>
                    
                    {/* All Events */}
                    {dayEvents.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-muted-foreground mb-2">Events</h5>
                        <div className="space-y-2">
                          {dayEvents.map((event, eventIndex) => (
                            <div
                              key={`detail-event-${eventIndex}`}
                              className="p-2 rounded border-l-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            >
                              <div className="font-medium text-blue-700 dark:text-blue-300">
                                {event.title}
                              </div>
                              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm mt-1">
                                <Clock className="h-3 w-3" />
                                {event.time}
                              </div>
                              <div className="text-blue-600 dark:text-blue-400 text-sm">
                                {event.clientName}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Tasks */}
                    {dayTasks.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-muted-foreground mb-2">Tasks</h5>
                        <div className="space-y-2">
                          {dayTasks.map((task, taskIndex) => (
                            <div
                              key={`detail-task-${taskIndex}`}
                              className="p-2 rounded border-l-2 border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                            >
                              <div className="font-medium text-orange-700 dark:text-orange-300">
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
                        </div>
                      </div>
                    )}

                    {dayEvents.length === 0 && dayTasks.length === 0 && (
                      <div className="text-center text-muted-foreground py-4">
                        <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No events or tasks scheduled</p>
                      </div>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}