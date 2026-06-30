/** Mensagem segura para o cliente — evita vazar detalhes de schema/constraints do Postgres. */
export function sanitizeDbErrorMessage(message: string, fallback: string): string {
  if (
    /violates not-null constraint|violates foreign key|violates unique|duplicate key|relation "/i.test(
      message
    )
  ) {
    return fallback;
  }
  return message;
}
