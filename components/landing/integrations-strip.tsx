import { INTEGRATIONS } from "@/lib/landing/content";
import { PublicSectionHeader } from "@/components/landing/public-section-header";

export function IntegrationsStrip() {
  return (
    <section className="py-16 md:py-20 border-y border-border">
      <div className="container mx-auto px-4">
        <PublicSectionHeader
          eyebrow="Integrações"
          title="Conecte com as ferramentas que você já usa"
          description="Ecossistema integrado para comunicação, notificações e pagamentos."
          className="mb-12"
        />

        <div className="mx-auto max-w-3xl grid gap-6 sm:grid-cols-3">
          {INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            return (
              <div
                key={integration.name}
                className="flex flex-col items-center text-center rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-primary mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground">{integration.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{integration.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
