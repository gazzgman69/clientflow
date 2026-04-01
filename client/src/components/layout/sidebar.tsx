import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { 
  BarChart3, Users, UserPlus, Briefcase, FileText, 
  File, Receipt, Calendar, Bot, Settings, LogOut,
  Music, MapPin, FolderOpen, Mail, ChevronDown, ListMusic
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const staticNavigationItems = [
  { href: "/", icon: BarChart3, label: "Dashboard", emoji: "📊", badge: null },
  {
    href: "/projects",
    icon: Briefcase,
    label: "Projects",
    emoji: "📋",
    badge: null,
    subItems: [
      { href: "/leads/capture", icon: FileText, label: "Lead Forms", emoji: "📝", badge: null }
    ]
  },
  { href: "/contacts", icon: Users, label: "Contacts", emoji: "👥", badge: null },
  { href: "/members", icon: Music, label: "Members", emoji: "🎵", badge: null },
  { href: "/repertoire", icon: ListMusic, label: "Repertoire", emoji: "🎶", badge: null },
  { href: "/performer-contracts", icon: FileText, label: "Performer Contracts", emoji: "📄", badge: null },
  { href: "/quotes", icon: FileText, label: "Quotes", emoji: "📝", badge: null },
  { href: "/invoices", icon: Receipt, label: "Invoices", emoji: "💰", badge: null },
  { href: "/venues", icon: MapPin, label: "Venues", emoji: "📍", badge: null },
  { href: "/documents", icon: FolderOpen, label: "Documents", emoji: "📁", badge: null },
  { href: "/scheduler", icon: Calendar, label: "Scheduler", emoji: "📅", badge: null },
  { href: "/calendar", icon: Calendar, label: "Calendar", emoji: "🗓️", badge: null },
  { href: "/email", icon: Mail, label: "Email", emoji: "✉️", badge: null },
  { href: "/portal/client", icon: Mail, label: "Client Portal", emoji: "📧", badge: null },
  { href: "/automations", icon: Bot, label: "Automations", emoji: "🤖", badge: null },
  { href: "/settings", icon: Settings, label: "Settings", emoji: "⚙️", badge: null },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { toast } = useToast();

  // Fetch project status counts for new enquiry badge
  const { data: projectStatusCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/projects/status-counts"],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  // Get current user info
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Logged out successfully",
        description: "You have been signed out of your account"
      });
      // Clear the auth cache and redirect to login
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      window.location.href = '/';
    },
    onError: (error: any) => {
      toast({
        title: "Logout error",
        description: error.message || "Failed to log out",
        variant: "destructive"
      });
    }
  });

  // Create navigation items with dynamic badge for new enquiries
  const navigationItems = staticNavigationItems.map(item => {
    if (item.label === "Projects") {
      return {
        ...item,
        badge: projectStatusCounts?.new || null
      };
    }
    return item;
  });

  return (
    <div className="w-52 h-full min-h-screen flex flex-col" style={{ background: '#111827', color: '#e5e7eb' }}>
      {/* Logo/Brand */}
      <div className="p-6" style={{ borderBottom: '1px solid #1f2937' }}>
        <div className="flex items-center space-x-3">
          <span className="font-bold text-lg text-white">ClientFlow</span>
        </div>
      </div>
      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = location === item.href;
          const hasSubItems = item.subItems && item.subItems.length > 0;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "sidebar-link flex items-center space-x-3 px-3 py-2 rounded-lg text-sm",
                  isActive
                    ? "active"
                    : ""
                )}
                style={{
                  color: isActive ? '#fff' : '#9ca3af',
                  background: isActive ? '#1f2937' : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                }}
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={() => {}}
              >
                <span className="text-base leading-none">{item.emoji}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#3b82f6', color: '#fff' }}>
                    {item.badge}
                  </span>
                )}
              </Link>
              {/* Sub-items */}
              {hasSubItems && (
                <div className="ml-7 mt-1 space-y-1">
                  {item.subItems.map((subItem) => {
                    const isSubActive = location === subItem.href;

                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={cn(
                          "sidebar-link flex items-center space-x-3 px-3 py-2 rounded-lg text-sm",
                          isSubActive ? "active" : ""
                        )}
                        style={{
                          color: isSubActive ? '#fff' : '#9ca3af',
                          background: isSubActive ? '#1f2937' : 'transparent',
                          fontWeight: isSubActive ? 500 : 400,
                        }}
                        data-testid={`nav-${subItem.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <span className="text-base leading-none">{subItem.emoji}</span>
                        <span>{subItem.label}</span>
                        {subItem.badge && (
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#3b82f6', color: '#fff' }}>
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
      <div className="p-4 mt-auto" style={{ borderTop: '1px solid #1f2937' }}>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full" data-testid="user-menu">
            <div className="flex items-center space-x-3 rounded-lg p-2 transition-colors" style={{ cursor: 'pointer' }}>
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100"
                alt="User avatar"
                className="w-10 h-10 rounded-full object-cover"
                data-testid="user-avatar"
              />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate" data-testid="user-name">
                  {currentUser?.user ? `${currentUser.user.firstName} ${currentUser.user.lastName}` : 'John Smith'}
                </p>
                <p className="text-xs truncate" style={{ color: '#9ca3af' }} data-testid="user-email">
                  {currentUser?.user?.email || 'john@company.com'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4" style={{ color: '#9ca3af' }} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center space-x-2 w-full" data-testid="menu-settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center space-x-2 text-red-600 focus:text-red-600"
              data-testid="menu-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>{logoutMutation.isPending ? 'Signing out...' : 'Sign out'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
