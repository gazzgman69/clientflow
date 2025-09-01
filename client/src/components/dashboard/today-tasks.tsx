import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type { Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function TodayTasks() {
  const queryClient = useQueryClient();
  
  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const response = await fetch("/api/tasks?today=true&assignedTo=default-user");
      return response.json();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const handleTaskToggle = (taskId: string, completed: boolean) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: {
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? new Date() : null,
      },
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-yellow-100 text-yellow-800';
      case 'medium': return 'bg-green-100 text-green-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-muted rounded"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
                <div className="w-12 h-5 bg-muted rounded-full"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mock tasks for demonstration
  const mockTasks = [
    {
      id: "1",
      title: "Follow up with Sarah Johnson",
      priority: "high",
      status: "pending",
      dueDate: new Date(),
    },
    {
      id: "2",
      title: "Send quote to Mike Rodriguez",
      priority: "medium",
      status: "completed",
      dueDate: new Date(),
    },
    {
      id: "3",
      title: "Review contract terms",
      priority: "low",
      status: "pending",
      dueDate: new Date(),
    },
    {
      id: "4",
      title: "Prepare presentation",
      priority: "urgent",
      status: "pending",
      dueDate: new Date(),
    },
  ];

  const displayTasks = tasks && tasks.length > 0 ? tasks : mockTasks;

  return (
    <Card data-testid="today-tasks-card">
      <CardHeader>
        <CardTitle>Today's Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayTasks.map((task) => (
            <div key={task.id} className="flex items-center space-x-3" data-testid={`task-item-${task.id}`}>
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={(checked) => handleTaskToggle(task.id, !!checked)}
                data-testid={`task-checkbox-${task.id}`}
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  task.status === 'completed' 
                    ? 'line-through text-muted-foreground' 
                    : 'text-foreground'
                }`} data-testid={`task-title-${task.id}`}>
                  {task.title}
                </p>
                <p className="text-xs text-muted-foreground" data-testid={`task-time-${task.id}`}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) : 'No due time'}
                </p>
              </div>
              <Badge 
                className={getPriorityColor(task.priority)}
                data-testid={`task-priority-${task.id}`}
              >
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </Badge>
            </div>
          ))}
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full mt-4 text-primary hover:text-primary/80"
          data-testid="button-add-task"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </CardContent>
    </Card>
  );
}
