"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { listBankAccounts, type BankAccountRow } from "@/app/dashboard/financeiro/bank-account-actions";

type Props = {
  value: string;
  onChange: (accountId: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function BankAccountSelect({
  value,
  onChange,
  label = "Conta bancária",
  required = false,
  disabled = false,
  placeholder = "— Selecionar —",
  className,
}: Props) {
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBankAccounts().then((res) => {
      if (cancelled) return;
      if (!res.error) {
        setAccounts(res.data);
        if (!value && res.data.length > 0) {
          const def = res.data.find((a) => a.is_default) ?? res.data[0];
          if (def) onChange(def.id);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-select default once on mount
  }, []);

  if (accounts.length === 0 && !loading) {
    return (
      <p className={`text-xs text-muted-foreground ${className ?? ""}`}>
        Nenhuma conta cadastrada. Configure em Configurações → Contas bancárias.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
      >
        <option value="">{placeholder}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.bank_name ? ` · ${a.bank_name}` : ""}
            {a.is_default ? " (padrão)" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}
