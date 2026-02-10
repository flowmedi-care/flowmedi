"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusBackgroundColor, getStatusTextColor } from "./agenda/status-utils";
import { updateAppointment } from "./agenda/actions";
import { useRouter } from "next/navigation";

type AppointmentStatus = "agendada" | "confirmada" | "realizada" | "falta" | "cancelada";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

const STATUS_OPTIONS: Array<{ value: AppointmentStatus; label: string }> = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "realizada", label: "Realizada" },
  { value: "falta", label: "Falta" },
  { value: "cancelada", label: "Cancelada" },
];

export function StatusToggle({
  appointmentId,
  currentStatus,
  onStatusChange,
  size = "default",
}: {
  appointmentId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  size?: "default" | "sm";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setUpdating(true);
    const res = await updateAppointment(appointmentId, {
      status: newStatus,
    });

    if (!res.error) {
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
      // Recarregar dados do dashboard
      router.refresh();
    } else {
      alert(`Erro ao alterar status: ${res.error}`);
    }

    setUpdating(false);
    setIsOpen(false);
  }

  const statusLabel = STATUS_LABELS[currentStatus as AppointmentStatus] || currentStatus;
  const bgColor = getStatusBackgroundColor(currentStatus);
  const textColor = getStatusTextColor(currentStatus);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={updating}
        className="inline-flex items-center gap-1"
      >
        <Badge
          className={cn(
            "cursor-pointer hover:opacity-80 font-semibold",
            size === "sm" ? "text-xs" : "text-sm",
            bgColor,
            textColor,
            updating && "opacity-50"
          )}
        >
          {statusLabel}
        </Badge>
        <ChevronDown className={cn("text-muted-foreground", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-[100] bg-background border border-border rounded-md shadow-lg min-w-[140px]">
          <div className="p-1">
            {STATUS_OPTIONS.map((option) => {
              const optionBgColor = getStatusBackgroundColor(option.value);
              const optionTextColor = getStatusTextColor(option.value);
              const isActive = currentStatus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStatusChange(option.value);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-sm transition-colors font-semibold",
                    isActive
                      ? `${optionBgColor} ${optionTextColor}`
                      : "bg-background hover:bg-muted text-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
