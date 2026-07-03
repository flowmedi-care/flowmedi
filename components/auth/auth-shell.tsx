"use client";

import { motion } from "framer-motion";
import { FlowmediLogo } from "@/components/flowmedi-logo";
import { FlowCanvas } from "@/components/auth/flow-canvas";
import {
  Calendar,
  FileText,
  MessageSquare,
  Shield,
} from "lucide-react";

const features = [
  { icon: Calendar, label: "Agenda central" },
  { icon: FileText, label: "Formulários clínicos" },
  { icon: MessageSquare, label: "Comunicação" },
  { icon: Shield, label: "Privacidade" },
];

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthShell({
  children,
  title,
  subtitle,
}: AuthShellProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-stone-50 p-4">
      <div className="md:hidden w-full max-w-md mb-4 absolute top-4 left-4 right-4">
        <FlowmediLogo size="sm" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-4xl overflow-hidden rounded-2xl flex bg-card shadow-elevated-lg border border-border/60"
      >
        {/* Left panel — animated flows */}
        <div className="hidden md:block w-1/2 h-[600px] relative overflow-hidden border-r border-border/60">
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-sage-50 via-stone-50 to-sage-100/80">
            <FlowCanvas />

            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8">
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.45 }}
                className="mb-6"
              >
                <FlowmediLogo href="/" showText={false} size="lg" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.62, duration: 0.45 }}
                className="mb-8 rounded-xl bg-background/70 backdrop-blur-sm px-4 py-3 border border-border/40 shadow-sm"
              >
                <h2 className="text-3xl font-bold mb-2 text-center text-primary">
                  FlowMed
                </h2>
                <p className="text-sm text-center text-muted-foreground max-w-xs">
                  Tudo para sua clínica em um só lugar. Agenda, formulários,
                  comunicação e site público integrados.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.85, duration: 0.45 }}
                className="flex flex-wrap justify-center gap-2"
              >
                {features.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 rounded-lg bg-background/60 backdrop-blur-sm px-3 py-1.5 border border-border/50 text-xs font-medium text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center bg-card min-h-[520px] md:min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold mb-1 text-foreground">
              {title}
            </h1>
            <p className="text-muted-foreground mb-8">{subtitle}</p>
            {children}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
