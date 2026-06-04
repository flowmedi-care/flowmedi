"use client";

import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  ClipboardList,
  FileText,
  Bell,
  Mail,
  MessageSquare,
  Package,
  CircleDollarSign,
  Users,
  UserPlus,
  Target,
  Stethoscope,
  ShoppingCart,
  Wallet,
  Settings,
  ShieldCheck,
  Cake,
  Truck,
  Contact,
  FileEdit,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/dashboard-nav-config";

const ICON_MAP: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  calendar: Calendar,
  "calendar-days": CalendarDays,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  bell: Bell,
  mail: Mail,
  "message-square": MessageSquare,
  package: Package,
  "circle-dollar-sign": CircleDollarSign,
  users: Users,
  "user-plus": UserPlus,
  target: Target,
  stethoscope: Stethoscope,
  "shopping-cart": ShoppingCart,
  wallet: Wallet,
  settings: Settings,
  "shield-check": ShieldCheck,
  cake: Cake,
  truck: Truck,
  contact: Contact,
  "file-edit": FileEdit,
};

export function DashboardNavIcon({
  name,
  className = "h-4 w-4",
}: {
  name: NavIconName;
  className?: string;
}) {
  const Icon = ICON_MAP[name];
  return <Icon className={className} />;
}
