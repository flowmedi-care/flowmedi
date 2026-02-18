"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Image as ImageIcon, Phone, Mail, MapPin } from "lucide-react";
import { LogoUpload } from "@/app/dashboard/configuracoes/logo-upload";
import { updateClinicInfo } from "@/app/dashboard/configuracoes/actions";

interface ClinicInfoTabsProps {
  clinicId: string;
  initialData: {
    name: string | null;
    logoUrl: string | null;
    logoScale: number;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
}

export function ClinicInfoTabs({ clinicId, initialData }: ClinicInfoTabsProps) {
  const [activeTab, setActiveTab] = useState<"info" | "logo" | "contact">("info");
  const [name, setName] = useState(initialData.name || "");
  const [phone, setPhone] = useState(initialData.phone || "");
  const [email, setEmail] = useState(initialData.email || "");
  const [address, setAddress] = useState(initialData.address || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSaveInfo = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    const result = await updateClinicInfo({
      name: name.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Informações da Clínica</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie as informações básicas da sua clínica
        </p>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="flex gap-2 border-b mb-6">
          <Button
            variant={activeTab === "info" ? "default" : "ghost"}
            onClick={() => setActiveTab("info")}
            className="rounded-b-none"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Informações Básicas
          </Button>
          <Button
            variant={activeTab === "logo" ? "default" : "ghost"}
            onClick={() => setActiveTab("logo")}
            className="rounded-b-none"
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Logo
          </Button>
          <Button
            variant={activeTab === "contact" ? "default" : "ghost"}
            onClick={() => setActiveTab("contact")}
            className="rounded-b-none"
          >
            <Phone className="h-4 w-4 mr-2" />
            Contato
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "info" && (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm">
                Informações salvas com sucesso!
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Nome da Clínica *</Label>
              <Input
                id="clinic-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Clínica Saúde"
                required
              />
              <p className="text-xs text-muted-foreground">
                Este nome será usado em emails, formulários e outras comunicações
              </p>
            </div>
            <Button onClick={handleSaveInfo} disabled={saving || !name.trim()}>
              {saving ? "Salvando..." : "Salvar Informações"}
            </Button>
          </div>
        )}

        {activeTab === "logo" && (
          <div className="space-y-4">
            <div>
              <Label>Logo da Clínica</Label>
              <p className="text-sm text-muted-foreground mb-4">
                A logo aparecerá no topo dos formulários e emails enviados aos pacientes
              </p>
              <LogoUpload
                currentLogoUrl={initialData.logoUrl}
                currentScale={initialData.logoScale}
                type="clinic"
              />
            </div>
          </div>
        )}

        {activeTab === "contact" && (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm">
                Informações de contato salvas com sucesso!
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-phone">
                  <Phone className="h-4 w-4 inline mr-2" />
                  Telefone
                </Label>
                <Input
                  id="clinic-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
                <p className="text-xs text-muted-foreground">
                  Será usado nos cabeçalhos e rodapés dos emails
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic-email">
                  <Mail className="h-4 w-4 inline mr-2" />
                  Email
                </Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@clinica.com"
                />
                <p className="text-xs text-muted-foreground">
                  Será usado nos cabeçalhos e rodapés dos emails
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic-address">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Endereço
                </Label>
                <Input
                  id="clinic-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF"
                />
                <p className="text-xs text-muted-foreground">
                  Endereço completo da clínica (opcional)
                </p>
              </div>
            </div>
            <Button onClick={handleSaveInfo} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Contato"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
