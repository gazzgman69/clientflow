import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { 
  BarChart3, Users, UserPlus, Briefcase, FileText, 
  File, Receipt, Calendar, Bot, Settings,
  Music, MapPin, FolderOpen, Mail
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const staticNavigationItems = [
  { href: "/", icon: BarChart3, label: "Dashboard", badge: null },
  { 
    href: "/leads", 
    icon: UserPlus, 
    label: "Leads", 
    badge: null, // Will be populated dynamically
    subItems: [
      { href: "/leads/capture", icon: FileText, label: "Lead Capture Forms", badge: null }
    ]
  },
  { href: "/contacts", icon: Users, label: "Contacts", badge: null },
  { href: "/projects", icon: Briefcase, label: "Projects", badge: null },
  { href: "/members", icon: Music, label: "Members", badge: null },
  { href: "/venues", icon: MapPin, label: "Venues", badge: null },
  { href: "/documents", icon: FolderOpen, label: "Documents", badge: null },
  { href: "/calendar", icon: Calendar, label: "Calendar", badge: null },
  { href: "/automations", icon: Bot, label: "Automations", badge: null },
  { href: "/settings", icon: Settings, label: "Settings", badge: null },
];

export default function Sidebar() {
  const [location] = useLocation();

  // Fetch leads summary for new leads count
  const { data: leadsSummary } = useQuery({
    queryKey: ["/api/leads/summary"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leads/summary");
      return response.json();
    },
    refetchInterval: 1000, // Poll every 1 second for real-time updates
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  // Create navigation items with dynamic badge for leads
  const navigationItems = staticNavigationItems.map(item => {
    if (item.label === "Leads") {
      return {
        ...item,
        badge: leadsSummary?.counts?.new || null
      };
    }
    return item;
  });

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">BusinessCRM</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "sidebar-link flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium",
                  isActive 
                    ? "active bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={() => {
                  if (item.label === 'Leads') {
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('leads:manual-refresh'));
                    }, 0);
                  }
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
              
              {/* Sub-items */}
              {hasSubItems && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.subItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = location === subItem.href;
                    
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={cn(
                          "sidebar-link flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium",
                          isSubActive 
                            ? "active bg-primary text-primary-foreground" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                        data-testid={`nav-${subItem.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <SubIcon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                        {subItem.badge && (
                          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground">
                            {subItem.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <img 
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100" 
            alt="User avatar" 
            className="w-10 h-10 rounded-full object-cover"
            data-testid="user-avatar"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid="user-name">John Smith</p>
            <p className="text-xs text-muted-foreground truncate" data-testid="user-email">john@company.com</p>
          </div>
          <button className="text-muted-foreground hover:text-foreground" data-testid="user-menu">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
