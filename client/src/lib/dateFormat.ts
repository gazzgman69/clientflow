export function formatDate(date: Date | string | null | undefined, format: 'dd/mm/yyyy' | 'yyyy-mm-dd' = 'dd/mm/yyyy'): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  if (format === 'dd/mm/yyyy') {
    return `${day}/${month}/${year}`;
  }
  
  return `${year}-${month}-${day}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  
  const dateStr = formatDate(d, 'dd/mm/yyyy');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${dateStr} ${hours}:${minutes}`;
}
