import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Task, Client, Lead } from "@shared/schema";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.string().optional(),
  clientId: z.string().optional(),
  leadId: z.string().optional(),
});

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 11, 12)); // December 2024
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      date: "",
      time: "",
      duration: "60",
    },
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
    form.setValue("date", clickedDate.toISOString().split('T')[0]);
    setShowEventModal(true);
  };

  const handleAddEvent = () => {
    setSelectedDate(null);
    form.reset();
    setShowEventModal(true);
  };

  const onSubmit = (data: z.infer<typeof eventSchema>) => {
    console.log("Event data:", data);
    // In a real app, this would create the event
    setShowEventModal(false);
    form.reset();
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();
  const isToday = (day: number) => {
    return today.getFullYear() === currentDate.getFullYear() &&
           today.getMonth() === currentDate.getMonth() &&
           today.getDate() === day;
  };

  // Mock events for demonstration
  const mockEvents = [
    { date: 12, title: "Client Meeting", time: "10:00 AM", type: "meeting" },
    { date: 16, title: "Project Review", time: "2:00 PM", type: "review" },
    { date: 20, title: "Follow-up Call", time: "11:00 AM", type: "call" },
  ];

  const getEventsForDay = (day: number) => {
    return mockEvents.filter(event => event.date === day);
  };

  return (
    <>
      <Header 
        title="Calendar" 
        subtitle="Schedule and manage appointments and meetings"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar Controls */}
          <Card className="lg:col-span-4" data-testid="calendar-controls">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => navigateMonth('prev')}
                      data-testid="calendar-prev-month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-xl font-semibold" data-testid="calendar-month-year">
                      {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => navigateMonth('next')}
                      data-testid="calendar-next-month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={viewMode === 'month' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('month')}
                      data-testid="view-month"
                    >
                      Month
                    </Button>
                    <Button
                      variant={viewMode === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('week')}
                      data-testid="view-week"
                    >
                      Week
                    </Button>
                    <Button
                      variant={viewMode === 'day' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('day')}
                      data-testid="view-day"
                    >
                      Day
                    </Button>
                  </div>
                </div>
                
                <Button onClick={handleAddEvent} data-testid="button-add-event">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Calendar Grid */}
          <Card className="lg:col-span-3" data-testid="calendar-grid">
            <CardContent className="p-6">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {daysOfWeek.map((day) => (
                  <div key={day} className="text-center font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => (
                  <div
                    key={index}
                    className={`min-h-[100px] p-2 border rounded-lg cursor-pointer transition-colors ${
                      day === null 
                        ? 'bg-muted/20' 
                        : isToday(day)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-muted/50'
                    }`}
                    onClick={() => day && handleDateClick(day)}
                    data-testid={day ? `calendar-day-${day}` : `calendar-empty-${index}`}
                  >
                    {day && (
                      <>
                        <div className="font-medium mb-1">{day}</div>
                        <div className="space-y-1">
                          {getEventsForDay(day).map((event, eventIndex) => (
                            <div
                              key={eventIndex}
                              className="text-xs p-1 bg-accent text-accent-foreground rounded truncate"
                              data-testid={`event-${day}-${eventIndex}`}
                            >
                              <div className="font-medium">{event.title}</div>
                              <div className="text-xs opacity-80">{event.time}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events Sidebar */}
          <Card data-testid="upcoming-events">
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-primary pl-3" data-testid="upcoming-event-1">
                  <div className="font-medium">Client Meeting</div>
                  <div className="text-sm text-muted-foreground">Dec 12, 10:00 AM</div>
                  <div className="text-xs text-muted-foreground">with Sarah Johnson</div>
                </div>
                
                <div className="border-l-4 border-accent pl-3" data-testid="upcoming-event-2">
                  <div className="font-medium">Project Review</div>
                  <div className="text-sm text-muted-foreground">Dec 16, 2:00 PM</div>
                  <div className="text-xs text-muted-foreground">Website Redesign</div>
                </div>
                
                <div className="border-l-4 border-green-500 pl-3" data-testid="upcoming-event-3">
                  <div className="font-medium">Follow-up Call</div>
                  <div className="text-sm text-muted-foreground">Dec 20, 11:00 AM</div>
                  <div className="text-xs text-muted-foreground">with Mike Rodriguez</div>
                </div>
              </div>
              
              <Button variant="ghost" className="w-full mt-4" data-testid="view-all-events">
                View All Events
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Event Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? `Add Event - ${selectedDate.toLocaleDateString()}` : 'Add Event'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-event-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-event-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-event-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-event-duration">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Client</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-event-client">
                          <SelectValue placeholder="Select a client..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3} 
                        placeholder="Event description..." 
                        {...field} 
                        data-testid="textarea-event-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowEventModal(false)}
                  data-testid="button-cancel-event"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-event">
                  Add Event
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
