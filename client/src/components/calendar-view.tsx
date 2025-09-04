import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin, User, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Header from '@/components/layout/header';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Client, Lead } from '@shared/schema';

interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string;
  clientId?: string;
  projectId?: string;
  type: string;
  status: string;
  priority: string;
  attendees?: string[];
  reminderMinutes?: number;
  recurring: boolean;
  recurrenceRule?: string;
  calendarIntegrationId?: string;
  externalEventId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  type: z.enum(['meeting', 'call', 'email', 'task', 'deadline', 'reminder', 'other']).default('meeting'),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).default('confirmed'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  attendees: z.string().optional(),
  reminderMinutes: z.number().default(15),
  recurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface CalendarViewProps {
  viewMode?: 'month' | 'week' | 'day';
}

export default function CalendarView({ viewMode = 'month' }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events', 'test-user'],
    queryFn: () => fetch('/api/events?userId=test-user').then(res => res.json()),
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      allDay: false,
      location: "",
      type: "meeting",
      status: "confirmed",
      priority: "medium",
      attendees: "",
      reminderMinutes: 15,
      recurring: false,
      recurrenceRule: "",
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const eventData = {
        ...data,
        attendees: data.attendees ? data.attendees.split(',').map(email => email.trim()).filter(Boolean) : null,
        createdBy: 'test-user',
      };
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Event creation failed:', errorData);
        throw new Error(errorData.message || 'Failed to create event');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Event created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/events', 'test-user'] });
      setShowEventModal(false);
      setEditingEvent(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create event', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormData & { id: string }) => {
      const { id, ...eventData } = data;
      const updateData = {
        ...eventData,
        attendees: eventData.attendees ? eventData.attendees.split(',').map(email => email.trim()).filter(Boolean) : null,
      };
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        throw new Error('Failed to update event');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Event updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowEventModal(false);
      setEditingEvent(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update event', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete event');
      }
      return true; // DELETE returns 204 with no body
    },
    onSuccess: () => {
      toast({ title: 'Event deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/events', 'test-user'] });
      setShowEventModal(false);
      setEditingEvent(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete event', 
        description: error.message,
        variant: 'destructive' 
      });
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
    setEditingEvent(null);
    
    // Set default start and end times
    const startDateTime = new Date(clickedDate);
    startDateTime.setHours(9, 0, 0, 0); // 9:00 AM
    const endDateTime = new Date(clickedDate);
    endDateTime.setHours(10, 0, 0, 0); // 10:00 AM
    
    // Reset form with the selected date
    form.reset({
      title: "",
      description: "",
      startDate: startDateTime.toISOString().slice(0, 16),
      endDate: endDateTime.toISOString().slice(0, 16),
      allDay: false,
      location: "",
      type: "meeting",
      status: "confirmed",
      priority: "medium",
      attendees: "",
      reminderMinutes: 15,
      recurring: false,
      recurrenceRule: "",
    });
    
    setShowEventModal(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description || "",
      startDate: new Date(event.startDate).toISOString().slice(0, 16),
      endDate: new Date(event.endDate).toISOString().slice(0, 16),
      allDay: event.allDay,
      location: event.location || "",
      clientId: event.clientId || "",
      type: event.type as any,
      status: event.status as any,
      priority: event.priority as any,
      attendees: event.attendees ? event.attendees.join(', ') : "",
      reminderMinutes: event.reminderMinutes || 15,
      recurring: event.recurring,
      recurrenceRule: event.recurrenceRule || "",
    });
    setShowEventModal(true);
  };

  const handleAddEvent = () => {
    setSelectedDate(null);
    setEditingEvent(null);
    form.reset();
    setShowEventModal(true);
  };

  const onSubmit = (data: EventFormData) => {
    if (editingEvent) {
      updateEventMutation.mutate({ ...data, id: editingEvent.id });
    } else {
      createEventMutation.mutate(data);
    }
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();
  const isToday = (day: number) => {
    return today.getFullYear() === currentDate.getFullYear() &&
           today.getMonth() === currentDate.getMonth() &&
           today.getDate() === day;
  };

  const getEventsForDay = (day: number) => {
    if (!events) return [];
    
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === dayDate.toDateString();
    });
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'call': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'email': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'task': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'deadline': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'reminder': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatEventTime = (startDate: string, endDate: string, allDay: boolean) => {
    if (allDay) return 'All Day';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getUpcomingEvents = () => {
    if (!events) return [];
    
    const now = new Date();
    return events
      .filter(event => new Date(event.startDate) >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  };

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <Card data-testid="calendar-controls">
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
                  variant={currentViewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentViewMode('month')}
                  data-testid="view-month"
                >
                  Month
                </Button>
                <Button
                  variant={currentViewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentViewMode('week')}
                  data-testid="view-week"
                >
                  Week
                </Button>
                <Button
                  variant={currentViewMode === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentViewMode('day')}
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-3" data-testid="calendar-grid">
          <CardContent className="p-6">
            {eventsLoading ? (
              <div className="text-center py-8">Loading calendar...</div>
            ) : (
              <>
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
                      className={`min-h-[120px] p-2 border rounded-lg cursor-pointer transition-colors ${
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
                                key={event.id}
                                className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${getEventTypeColor(event.type)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditEvent(event);
                                }}
                                data-testid={`event-${day}-${eventIndex}`}
                              >
                                <div className="font-medium truncate">{event.title}</div>
                                <div className="text-xs opacity-80">
                                  {formatEventTime(event.startDate, event.endDate, event.allDay)}
                                </div>
                                {event.location && (
                                  <div className="text-xs opacity-70 truncate">📍 {event.location}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events Sidebar */}
        <Card data-testid="upcoming-events">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="text-center py-4">Loading events...</div>
            ) : getUpcomingEvents().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-4">
                {getUpcomingEvents().map((event, index) => (
                  <div 
                    key={event.id} 
                    className="border-l-4 border-primary pl-3 cursor-pointer hover:bg-muted/50 p-2 rounded-r"
                    onClick={() => handleEditEvent(event)}
                    data-testid={`upcoming-event-${index + 1}`}
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.startDate).toLocaleDateString()} at {formatEventTime(event.startDate, event.endDate, event.allDay)}
                    </div>
                    {event.location && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </div>
                    )}
                    <Badge variant="outline" className="text-xs mt-1">
                      {event.type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            
            <Button variant="ghost" className="w-full mt-4" data-testid="view-all-events">
              View All Events
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Event Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingEvent ? (
                <>
                  <Edit className="h-5 w-5" />
                  Edit Event
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Add New Event
                </>
              )}
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-event-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date & Time *</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-event-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="allDay"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-all-day"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>All Day Event</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="call">Call</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                          <SelectItem value="deadline">Deadline</SelectItem>
                          <SelectItem value="reminder">Reminder</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-event-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Meeting room, address, or online link" data-testid="input-event-location" />
                    </FormControl>
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
                name="attendees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attendees (Email addresses, comma separated)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="john@example.com, sarah@example.com" data-testid="input-event-attendees" />
                    </FormControl>
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
              
              <div className="flex items-center justify-between pt-4">
                <div>
                  {editingEvent && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this event?')) {
                          deleteEventMutation.mutate(editingEvent.id);
                        }
                      }}
                      disabled={deleteEventMutation.isPending}
                      data-testid="button-delete-event"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Event
                    </Button>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => setShowEventModal(false)}
                    data-testid="button-cancel-event"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createEventMutation.isPending || updateEventMutation.isPending}
                    data-testid="button-save-event"
                  >
                    {editingEvent ? 'Update Event' : 'Create Event'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}