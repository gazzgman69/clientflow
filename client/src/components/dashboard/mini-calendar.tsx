import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function MiniCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];

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

  const days = getDaysInMonth(currentDate);
  const today = currentDate.getDate();

  return (
    <Card data-testid="mini-calendar-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Calendar</CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-view-full-calendar">
            View Full
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" data-testid="calendar-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h4 className="font-semibold text-foreground" data-testid="calendar-month-year">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h4>
          <Button variant="ghost" size="icon" data-testid="calendar-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {/* Day headers */}
          {daysOfWeek.map((day, index) => (
            <div key={`day-header-${index}`} className="p-2 text-muted-foreground font-medium">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((day, index) => (
            <div
              key={index}
              className={`p-2 ${
                day === null 
                  ? '' 
                  : day === today 
                    ? 'bg-primary text-primary-foreground rounded-full font-medium' 
                    : day === 16 
                      ? 'bg-accent/20 text-accent rounded-full font-medium'
                      : 'text-muted-foreground hover:bg-muted rounded-full cursor-pointer'
              }`}
              data-testid={day ? `calendar-day-${day}` : `calendar-empty-${index}`}
            >
              {day}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
