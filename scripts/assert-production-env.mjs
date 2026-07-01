const PRODUCTION_REQUIRED = ["META_WHATSAPP_WEBHOOK_VERIFY_TOKEN"];

if (process.env.VERCEL_ENV === "production") {
  for (const key of PRODUCTION_REQUIRED) {
    if (!process.env[key]?.trim()) {
      console.error(
        `[build] Variável de ambiente obrigatória ausente em produção: ${key}`
      );
      process.exit(1);
    }
  }
}
