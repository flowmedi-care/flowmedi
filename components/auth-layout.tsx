import { FlowmediLogo } from "@/components/flowmedi-logo";
import {
  Calendar,
  FileText,
  MessageSquare,
  Shield,
} from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const features = [
  { icon: Calendar, label: "Agenda central" },
  { icon: FileText, label: "Formulários clínicos" },
  { icon: MessageSquare, label: "Comunicação" },
  { icon: Shield, label: "Privacidade" },
];

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Left: Branded panel - hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10">
          <FlowmediLogo href="/" showText={true} size="lg" variant="light" />
        </div>
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Tudo para sua clínica em um só lugar
            </h2>
            <p className="mt-3 text-primary-foreground/90 text-lg">
              Agenda, formulários e comunicação integrados. Dados isolados por clínica.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 backdrop-blur-sm px-4 py-2.5 border border-primary-foreground/10"
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} FlowMed
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden border-b border-border/60 bg-card/80 backdrop-blur-md px-4 py-4">
          <FlowmediLogo size="sm" />
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="surface-elevated rounded-2xl p-8 shadow-elevated-lg">
              <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {title}
                </h1>
                <p className="mt-2 text-muted-foreground">{subtitle}</p>
              </div>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
