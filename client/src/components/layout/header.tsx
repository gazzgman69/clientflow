import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Plus, Search } from "lucide-react";
import QuickActionModal from "@/components/modals/quick-action-modal";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [showQuickActions, setShowQuickActions] = useState(false);

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
