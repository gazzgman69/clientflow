interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
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
      </div>
    </header>
  );
}
