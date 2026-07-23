"use client";

import {
  LayoutDashboard,
  ListTodo,
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
  Receipt,
  Tags,
  Landmark,
  Settings,
  ShieldCheck,
  Cake,
  Truck,
  Contact,
  FileEdit,
  Plug,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/dashboard-nav-config";

const ICON_MAP: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "list-todo": ListTodo,
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
  receipt: Receipt,
  tags: Tags,
  landmark: Landmark,
  settings: Settings,
  "shield-check": ShieldCheck,
  cake: Cake,
  truck: Truck,
  contact: Contact,
  "file-edit": FileEdit,
  plug: Plug,
  "book-open": BookOpen,
};

export function DashboardNavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: NavIconName;
  className?: string;
}) {
  const Icon = ICON_MAP[name];
  return <Icon className={className} />;
}
