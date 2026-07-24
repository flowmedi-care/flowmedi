"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  BarChart3,
  ArrowRight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO_SCREEN_IMAGES } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

type ScreenId = "dashboard" | "crm" | "chat" | "reports";

interface MenuItem {
  id: ScreenId;
  icon: LucideIcon;
  title: string;
  description: string;
}

interface ScreenConfig {
  id: ScreenId;
  title: string;
  image: string;
  position: { x: number; y: number; z: number; rotation: number };
  size: { width: number; height: number };
  animation: { speed: number; amplitude: number };
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Visão geral da sua clínica.",
  },
  {
    id: "crm",
    icon: Users,
    title: "CRM",
    description: "Gestão completa de pacientes e leads.",
  },
  {
    id: "chat",
    icon: MessageCircle,
    title: "Chat IA",
    description: "Atendimento inteligente via WhatsApp.",
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Relatórios",
    description: "Financeiro, agenda e performance.",
  },
];

const SCREENS: ScreenConfig[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    image: HERO_SCREEN_IMAGES.dashboard,
    position: { x: 120, y: 260, z: 20, rotation: -12 },
    size: { width: 580, height: 360 },
    animation: { speed: 2.4, amplitude: 12 },
  },
  {
    id: "crm",
    title: "CRM",
    image: HERO_SCREEN_IMAGES.crm,
    position: { x: 540, y: 120, z: 40, rotation: 16 },
    size: { width: 520, height: 330 },
    animation: { speed: 2, amplitude: 10 },
  },
  {
    id: "chat",
    title: "Chat",
    image: HERO_SCREEN_IMAGES.chat,
    position: { x: 760, y: 420, z: 15, rotation: -18 },
    size: { width: 420, height: 280 },
    animation: { speed: 1.7, amplitude: 9 },
  },
  {
    id: "reports",
    title: "Reports",
    image: HERO_SCREEN_IMAGES.reports,
    position: { x: 300, y: 560, z: 5, rotation: 12 },
    size: { width: 470, height: 300 },
    animation: { speed: 2.8, amplitude: 11 },
  },
];

const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 720;

const springConfig = { stiffness: 140, damping: 22, mass: 0.9 };

function FloatingScreen({
  screen,
  isActive,
  isFocused,
  hasFocus,
  onSelect,
  parallaxX,
  parallaxY,
  reducedMotion,
}: {
  screen: ScreenConfig;
  isActive: boolean;
  isFocused: boolean;
  hasFocus: boolean;
  onSelect: (id: ScreenId) => void;
  parallaxX: ReturnType<typeof useMotionValue<number>>;
  parallaxY: ReturnType<typeof useMotionValue<number>>;
  reducedMotion: boolean;
}) {
  const depthFactor = screen.position.z / 40;
  const px = useTransform(parallaxX, (v) => v * depthFactor * 0.4);
  const py = useTransform(parallaxY, (v) => v * depthFactor * 0.4);

  const dimmed = hasFocus && !isFocused;
  const elevated = isFocused || (isActive && !hasFocus);

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{
        width: screen.size.width,
        height: screen.size.height,
        zIndex: elevated ? 50 : screen.position.z,
      }}
      initial={false}
      animate={{
        x: screen.position.x,
        y: reducedMotion
          ? screen.position.y
          : [screen.position.y, screen.position.y - screen.animation.amplitude, screen.position.y],
        rotateZ: isFocused ? 0 : screen.position.rotation,
        scale: isFocused ? 1.05 : dimmed ? 0.88 : isActive ? 1.02 : 1,
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? "blur(6px)" : "blur(0px)",
      }}
      transition={{
        x: { type: "spring", ...springConfig },
        y: reducedMotion
          ? { duration: 0.5 }
          : { duration: screen.animation.speed, repeat: Infinity, ease: "easeInOut" },
        rotateZ: { type: "spring", ...springConfig },
        scale: { type: "spring", ...springConfig },
        opacity: { duration: 0.5, ease: "easeInOut" },
        filter: { duration: 0.5, ease: "easeInOut" },
      }}
    >
      <motion.button
        type="button"
        onClick={() => onSelect(screen.id)}
        className="h-full w-full cursor-pointer will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        style={{ x: px, y: py }}
        whileHover={hasFocus ? undefined : { scale: isActive ? 1.02 : 1.01 }}
      >
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/80 backdrop-blur-md transition-shadow duration-500",
          isFocused
            ? "shadow-xl ring-2 ring-sage-500/40"
            : elevated
              ? "shadow-md ring-2 ring-sage-500/30"
              : "shadow-lg"
        )}
      >
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/30 via-transparent to-transparent" />
        <div className="flex items-center gap-2 border-b border-stone-200/60 bg-stone-50/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-sage-400/80" />
          </div>
          <span className="ml-1 text-xs font-medium text-stone-500">{screen.title}</span>
        </div>
        <div className="relative h-[calc(100%-41px)] w-full overflow-hidden bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screen.image}
            alt={screen.title}
            className="h-full w-full object-cover object-top"
            loading="lazy"
            draggable={false}
          />
        </div>
      </div>
      </motion.button>
    </motion.div>
  );
}

export function InteractiveHeroShowcase() {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<ScreenId>("dashboard");
  const [focusedId, setFocusedId] = useState<ScreenId | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useSpring(mouseX, springConfig);
  const parallaxY = useSpring(mouseY, springConfig);

  const activeScreen = SCREENS.find((s) => s.id === activeId)!;

  const cameraX = useSpring(0, springConfig);
  const cameraY = useSpring(0, springConfig);
  const cameraScale = useSpring(1, springConfig);

  const moveCameraToScreen = useCallback(
    (id: ScreenId) => {
      const screen = SCREENS.find((s) => s.id === id);
      if (!screen) return;

      setActiveId(id);
      setFocusedId(id);

      const centerX = CANVAS_WIDTH / 2 - screen.size.width / 2;
      const centerY = CANVAS_HEIGHT / 2 - screen.size.height / 2;

      cameraX.set(centerX - screen.position.x);
      cameraY.set(centerY - screen.position.y);
      cameraScale.set(1.18);
    },
    [cameraX, cameraY, cameraScale]
  );

  const restoreLayout = useCallback(() => {
    setFocusedId(null);
    cameraX.set(0);
    cameraY.set(0);
    cameraScale.set(1);
  }, [cameraX, cameraY, cameraScale]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion || focusedId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 35;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 35;
      mouseX.set(x);
      mouseY.set(y);
    },
    [focusedId, mouseX, mouseY, reducedMotion]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    restoreLayout();
  }, [mouseX, mouseY, restoreLayout]);

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-stone-50">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-sage-500/8 blur-[80px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-sage-400/5 blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] flex-col px-4 lg:flex-row">
        {/* Left panel */}
        <div className="flex w-full flex-col justify-center py-12 lg:w-[42%] lg:py-16 lg:pr-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="inline-flex items-center rounded-full bg-sage-50 px-3 py-1 text-sm font-semibold text-sage-600">
              Plataforma
            </span>
          </motion.div>

          <motion.h1
            className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            Tudo que sua clínica precisa
            <br />
            <span className="text-sage-600">em um só lugar</span>
          </motion.h1>

          <motion.p
            className="mt-5 max-w-md text-lg leading-relaxed text-stone-600"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          >
            Agenda, pacientes, comunicação e financeiro — centralizados em uma plataforma moderna, segura e feita para equipes de saúde.
          </motion.p>

          {/* Interactive menu — desktop/tablet */}
          <nav className="mt-10 hidden space-y-2 md:block" aria-label="Módulos da plataforma">
            {MENU_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => moveCameraToScreen(item.id)}
                  className={cn(
                    "group flex w-full items-start gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors duration-300",
                    isActive
                      ? "border-sage-500 bg-sage-50 shadow-md"
                      : "border-transparent bg-transparent hover:scale-[1.02] hover:bg-sage-50"
                  )}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1, ease: "easeOut" }}
                  whileHover={isActive ? undefined : { scale: 1.02 }}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-sage-600 text-white" : "bg-stone-100 text-stone-600 group-hover:bg-sage-100 group-hover:text-sage-600"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-stone-500">{item.description}</p>
                  </div>
                </motion.button>
              );
            })}
          </nav>

          {/* Mobile menu pills */}
          <div className="mt-8 flex flex-wrap gap-2 md:hidden">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    activeId === item.id
                      ? "bg-sage-600 text-white"
                      : "bg-white text-stone-600 shadow-sm ring-1 ring-stone-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </button>
              );
            })}
          </div>

          <motion.div
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary shadow-sm">
              <Zap className="h-4 w-4" />
              <span>Comece grátis — sem cartão</span>
            </div>
            <div className="flex flex-wrap gap-3">
            <Link href="/criar-conta">
              <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/25">
                Criar conta gratuita
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/precos">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                Ver planos
              </Button>
            </Link>
            </div>
          </motion.div>
        </div>

        {/* Right panel — 3D canvas (desktop/tablet) */}
        <div className="hidden flex-1 items-center justify-center py-8 lg:flex lg:w-[58%]">
          <div
            ref={canvasRef}
            className="relative h-[min(720px,calc(100vh-8rem))] w-full max-w-[1100px]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: 1400 }}
          >
            <motion.div
              className="relative h-full w-full"
              style={{
                x: cameraX,
                y: cameraY,
                scale: cameraScale,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className="relative mx-auto"
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: "scale(0.85)", transformOrigin: "center center" }}
              >
                {SCREENS.map((screen) => (
                  <FloatingScreen
                    key={screen.id}
                    screen={screen}
                    isActive={activeId === screen.id}
                    isFocused={focusedId === screen.id}
                    hasFocus={focusedId !== null}
                    onSelect={moveCameraToScreen}
                    parallaxX={parallaxX}
                    parallaxY={parallaxY}
                    reducedMotion={!!reducedMotion}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Mobile carousel */}
        <div className="pb-12 lg:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden rounded-[28px] border border-stone-200/60 bg-white shadow-lg"
            >
              <div className="flex items-center gap-2 border-b border-stone-200/60 bg-stone-50/80 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-sage-400/80" />
                </div>
                <span className="ml-1 text-xs font-medium text-stone-500">{activeScreen.title}</span>
              </div>
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeScreen.image}
                  alt={activeScreen.title}
                  className="h-full w-full object-cover object-top"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
