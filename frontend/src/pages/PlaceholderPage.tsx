import { FileSignature } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl bg-card/50">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
        <FileSignature className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        This module is currently under construction.
      </p>
      
      <div className="bg-secondary/50 text-secondary-foreground text-sm font-medium px-4 py-2 rounded-md border border-border">
        Analytics modules will appear here
      </div>
    </div>
  );
}
