import { Card, CardContent } from "@/components/ui/card";

export function SchemaErrorBanner({ message }: { message: string }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-4">
        <p className="text-sm font-medium text-destructive">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground mt-1">
          {message}. Verifique se as migrations do Supabase foram aplicadas (serviços, procedimentos
          hub, fichas clínicas).
        </p>
      </CardContent>
    </Card>
  );
}
