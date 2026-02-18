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
  { icon: Shield, label: "LGPD" },
];

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left: Branded panel - hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between bg-primary p-10 text-primary-foreground">
        <FlowmediLogo href="/" showText={true} size="md" variant="light" />
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Tudo para sua clínica em um só lugar
            </h2>
            <p className="mt-3 text-primary-foreground/90 text-lg">
              Agenda, formulários e comunicação integrados. Simples e em conformidade.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-4 py-2"
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} FlowMedi
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden border-b border-border px-4 py-4">
          <FlowmediLogo size="sm" />
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
