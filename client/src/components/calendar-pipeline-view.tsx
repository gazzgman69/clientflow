import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Download, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, parse } from 'date-fns';

interface Calendar {
  id: string;
  tenantId: string;
  name: string;
  type: 'leads' | 'booked' | 'completed';
  color: string;
  isVisible: boolean;
  createdAt: string;
}

interface PipelineEvent {
  id: string;
  tenantId: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  projectId?: string;
  createdBy: string;
  timezone: string;
  history: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'lead' | 'booked' | 'completed';
  startDate?: string;
  endDate?: string;
  primaryEventId?: string;
}

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  location: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

// Format date to dd/mm/yyyy
const formatDateDDMMYYYY = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Format datetime for input (YYYY-MM-DDTHH:mm)
const formatForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function CalendarPipelineView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarType, setSelectedCalendarType] = useState<'all' | 'leads' | 'booked' | 'completed'>('all');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  // Initialize calendars on mount
  useEffect(() => {
    if (currentUser) {
      initCalendarsMutation.mutate();
    }
  }, [currentUser]);

  // Fetch calendars
  const { data: calendars, isLoading: calendarsLoading } = useQuery<Calendar[]>({
    queryKey: ['/api/calendars'],
    enabled: !!currentUser,
  });

  // Fetch all events across calendars
  const { data: allEvents, isLoading: eventsLoading } = useQuery<PipelineEvent[]>({
    queryKey: ['/api/calendars/events'],
    queryFn: async () => {
      if (!calendars) return [];
      
      const eventPromises = calendars.map(calendar => 
        fetch(`/api/calendars/${calendar.id}/events`, { credentials: 'include' })
          .then(res => res.json())
      );
      
      const eventsArrays = await Promise.all(eventPromises);
      return eventsArrays.flat();
    },
    enabled: !!calendars && calendars.length > 0,
  });

  // Initialize system calendars
  const initCalendarsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/calendars/init');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendars'] });
    },
    onError: (error: any) => {
      // Silently fail if calendars already exist
      console.log('Calendars already initialized or error:', error.message);
    },
  });

  // Create project with event
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const projectData = {
        ...data,
        tenantId: currentUser?.tenantId,
        userId: currentUser?.id,
        status: 'lead' as const,
      };
      const response = await apiRequest('POST', '/api/calendar-projects', projectData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Project and event created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/calendars'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendars/events'] });
      setShowProjectModal(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create project', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Update project status (moves event)
  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const response = await apiRequest('PATCH', `/api/calendar-projects/${projectId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Project status updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/calendars/events'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update project status', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      location: "",
    },
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
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
    
    const startDateTime = new Date(clickedDate);
    startDateTime.setHours(9, 0, 0, 0);
    const endDateTime = new Date(clickedDate);
    endDateTime.setHours(10, 0, 0, 0);
    
    form.reset({
      name: "",
      description: "",
      startDate: formatForInput(startDateTime),
      endDate: formatForInput(endDateTime),
      location: "",
    });
    
    setShowProjectModal(true);
  };

  const onSubmit = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const handleDownloadICS = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}/export.ics`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to export calendar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calendar_${calendarId}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: 'Calendar exported successfully' });
    } catch (error: any) {
      toast({ 
        title: 'Failed to export calendar', 
        description: error.message,
        variant: 'destructive' 
      });
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
    if (!allEvents) return [];
    
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    let filteredEvents = allEvents.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === dayDate.toDateString();
    });

    if (selectedCalendarType !== 'all' && calendars) {
      const selectedCalendar = calendars.find(c => c.type === selectedCalendarType);
      if (selectedCalendar) {
        filteredEvents = filteredEvents.filter(e => e.calendarId === selectedCalendar.id);
      }
    }

    return filteredEvents;
  };

  const getCalendarTypeColor = (calendarId: string) => {
    const calendar = calendars?.find(c => c.id === calendarId);
    if (!calendar) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    
    switch (calendar.type) {
      case 'leads':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'booked':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCalendarBadge = (calendarId: string) => {
    const calendar = calendars?.find(c => c.id === calendarId);
    return calendar?.type || 'Unknown';
  };

  if (calendarsLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading calendar pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Pipeline Status */}
      <Card data-testid="pipeline-status">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <CardTitle>Calendar Pipeline</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={selectedCalendarType} onValueChange={(v) => setSelectedCalendarType(v as any)}>
                <TabsList data-testid="calendar-filter-tabs">
                  <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
                  <TabsTrigger value="leads" data-testid="filter-leads">Leads</TabsTrigger>
                  <TabsTrigger value="booked" data-testid="filter-booked">Booked</TabsTrigger>
                  <TabsTrigger value="completed" data-testid="filter-completed">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {calendars?.map(calendar => {
          const calendarEvents = allEvents?.filter(e => e.calendarId === calendar.id) || [];
          return (
            <Card key={calendar.id} data-testid={`summary-card-${calendar.type}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className={getCalendarTypeColor(calendar.id)}>
                      {calendar.name}
                    </Badge>
                    <p className="text-2xl font-bold mt-2">{calendarEvents.length}</p>
                    <p className="text-sm text-muted-foreground">Events</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadICS(calendar.id)}
                    data-testid={`download-ics-${calendar.type}`}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Calendar Controls */}
      <Card data-testid="calendar-controls">
        <CardHeader>
          <div className="flex items-center justify-between">
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
            
            <Button onClick={() => setShowProjectModal(true)} data-testid="button-add-project">
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card data-testid="calendar-grid">
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
            {days.map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              
              return (
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
                      <div className="font-medium mb-1" data-testid={`day-number-${day}`}>
                        {formatDateDDMMYYYY(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map((event, eventIndex) => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded ${getCalendarTypeColor(event.calendarId)}`}
                            data-testid={`event-${day}-${eventIndex}`}
                          >
                            <div className="font-medium truncate">{event.title}</div>
                            <div className="text-xs opacity-80">
                              {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Project Modal */}
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent data-testid="project-modal">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-project-name" />
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
                      <Textarea {...field} data-testid="input-project-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date & Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        data-testid="input-project-start-date"
                      />
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
                    <FormLabel>End Date & Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        data-testid="input-project-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-project-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowProjectModal(false)}
                  data-testid="button-cancel-project"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createProjectMutation.isPending}
                  data-testid="button-submit-project"
                >
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
