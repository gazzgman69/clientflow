import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Plus, Search, Moon, Sun } from "lucide-react";
import QuickActionModal from "@/components/modals/quick-action-modal";
import { EmailSyncStatus } from "@/components/ui/email-sync-status";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDarkMode = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <>
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between text-[12px] pt-[5px] pb-[5px]">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground" data-testid="page-subtitle">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Page-specific actions */}
          {actions}
          
          {/* Search */}
          <div className="relative">
            <Input 
              type="text" 
              placeholder="Search..." 
              className="pl-10 pr-4 py-2 w-64"
              data-testid="header-search"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          </div>
          
          {/* Email Sync Status */}
          <EmailSyncStatus />
          
          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            data-testid="theme-toggle"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" data-testid="notifications-button">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </Button>
          
          {/* Quick Actions */}
          <Button 
            onClick={() => setShowQuickActions(true)}
            data-testid="quick-add-button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Quick Add
          </Button>
        </div>
      </header>
      <QuickActionModal 
        isOpen={showQuickActions} 
        onClose={() => setShowQuickActions(false)} 
      />
    </>
  );
}
