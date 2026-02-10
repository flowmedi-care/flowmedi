import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, checked, onChange, disabled, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.target.checked);
      }
    };

    return (
      <label className={cn("flex items-center gap-2 cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          {...props}
        />
        <div className={cn(
          "relative w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-primary transition-colors",
          "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
          "peer-checked:after:translate-x-full peer-checked:after:border-white",
          disabled && "opacity-50"
        )} />
        {label && <span className="text-sm text-foreground">{label}</span>}
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
