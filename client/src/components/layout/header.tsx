interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-background shrink-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5" data-testid="page-subtitle">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center space-x-3">
          {actions}
        </div>
      )}
    </div>
  );
}
