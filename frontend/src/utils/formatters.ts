export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '';
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatCompactNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '';
  return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(num);
}

export function formatPercent(num: number | undefined | null): string {
  if (num === undefined || num === null) return '';
  return (num * 100).toFixed(2) + '%';
}

export function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null) return '';
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
}

export function formatCompactCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null) return '';
  return '₹' + new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(num);
}
