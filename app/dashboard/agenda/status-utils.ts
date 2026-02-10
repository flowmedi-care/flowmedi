// Funções utilitárias para cores de status - podem ser usadas em server e client components

// Cores de fundo para calendário baseadas no status
export function getStatusBackgroundColor(status: string): string {
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case "agendada":
    case "agendado":
      return "bg-blue-50 dark:bg-blue-950/20"; // azul claro
    case "confirmada":
    case "confirmado":
      return "bg-green-50 dark:bg-green-950/20"; // verde claro
    case "realizada":
    case "realizado":
      return "bg-purple-50 dark:bg-purple-950/20"; // roxo
    case "falta":
      return "bg-yellow-50 dark:bg-yellow-950/20"; // amarelo
    case "cancelada":
    case "cancelado":
      return "bg-red-50 dark:bg-red-950/20"; // vermelho
    default:
      return "bg-muted/50";
  }
}

// Cores de texto para calendário baseadas no status
export function getStatusTextColor(status: string): string {
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case "agendada":
    case "agendado":
      return "text-blue-700 dark:text-blue-300";
    case "confirmada":
    case "confirmado":
      return "text-green-700 dark:text-green-300";
    case "realizada":
    case "realizado":
      return "text-purple-700 dark:text-purple-300";
    case "falta":
      return "text-yellow-700 dark:text-yellow-300";
    case "cancelada":
    case "cancelado":
      return "text-red-700 dark:text-red-300";
    default:
      return "text-foreground";
  }
}

// Cores de badge baseadas no status (para usar com Badge component)
export function getStatusBadgeClassName(status: string): string {
  const bgColor = getStatusBackgroundColor(status);
  const textColor = getStatusTextColor(status);
  return `${bgColor} ${textColor} font-semibold`;
}
