"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadClinicLogo, uploadDoctorLogo, deleteClinicLogo, deleteDoctorLogo, updateClinicLogoScale, updateDoctorLogoScale } from "./actions";
import { Upload, X, Loader2 } from "lucide-react";

export function LogoUpload({
  currentLogoUrl,
  currentScale,
  type,
}: {
  currentLogoUrl: string | null;
  currentScale: number;
  type: "clinic" | "doctor";
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [scale, setScale] = useState<number>(currentScale);
  const [uploading, setUploading] = useState(false);
  const [savingScale, setSavingScale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      setError("Por favor, selecione um arquivo de imagem.");
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5MB.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = type === "clinic" 
        ? await uploadClinicLogo(formData)
        : await uploadDoctorLogo(formData);

      if ("error" in res) {
        setError(res.error);
        setUploading(false);
        return;
      }

      if (res.url) {
        setLogoUrl(res.url);
        window.location.reload();
      }
    } catch (err) {
      setError("Erro ao fazer upload da imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja remover a logo?")) return;

    setUploading(true);
    try {
      const res = type === "clinic"
        ? await deleteClinicLogo()
        : await deleteDoctorLogo();

      if ("error" in res && res.error) {
        setError(res.error);
        setUploading(false);
        return;
      }

      setLogoUrl(null);
      window.location.reload();
    } catch (err) {
      setError("Erro ao remover a logo.");
      setUploading(false);
    }
  }

  async function handleScaleChange(newScale: number) {
    setScale(newScale);
    setSavingScale(true);
    setError(null);
    
    try {
      const res = type === "clinic"
        ? await updateClinicLogoScale(newScale)
        : await updateDoctorLogoScale(newScale);

      if ("error" in res && res.error) {
        setError(res.error);
        setScale(currentScale); // Reverter se der erro
      }
    } catch (err) {
      setError("Erro ao salvar escala.");
      setScale(currentScale);
    } finally {
      setSavingScale(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </p>
        )}
        
        {logoUrl && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative inline-block">
              <div className="w-32 h-32 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                  style={{ transform: `scale(${scale / 100})` }}
                />
              </div>
              {!uploading && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2"
                  onClick={handleDelete}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-3 pt-4 border-t border-border max-w-md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`logo-scale-${type}`} className="font-medium">
                  Escala da logo
                </Label>
                <span className="text-sm font-medium text-muted-foreground">
                  {scale}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <div 
                    className="absolute h-2 rounded-lg left-0 top-0 pointer-events-none"
                    style={{
                      width: `${((scale - 50) / (200 - 50)) * 100}%`,
                      background: 'hsl(var(--primary))',
                    }}
                  />
                  <input
                    type="range"
                    id={`logo-scale-${type}`}
                    min="50"
                    max="200"
                    step="5"
                    value={scale}
                    onChange={(e) => handleScaleChange(parseInt(e.target.value, 10))}
                    disabled={savingScale}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer relative z-10"
                    style={{
                      background: 'transparent',
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ajuste o tamanho da logo (50% a 200%). Padrão: 100%.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`logo-upload-${type}`}>
          {logoUrl ? "Alterar logo" : "Enviar logo"}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={`logo-upload-${type}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={uploading}
            className="cursor-pointer"
          />
          {uploading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Formatos aceitos: JPEG, PNG, WebP. Tamanho máximo: 5MB.
        </p>
      </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        #logo-scale-${type}::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 20;
        }
        #logo-scale-${type}::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        #logo-scale-${type}:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}} />
    </>
  );
}
