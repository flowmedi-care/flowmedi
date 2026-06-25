"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X } from "lucide-react";
import { clearHeroImage, uploadHeroImage } from "./actions";

type Props = {
  currentUrl: string;
  disabled?: boolean;
  onUrlChange: (url: string) => void;
};

export function HeroImageUpload({ currentUrl, disabled, onUrlChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = currentUrl.trim() || null;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadHeroImage(formData);

      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.url) {
        onUrlChange(res.url);
      }
    } catch {
      setError("Erro ao enviar a imagem.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleClear() {
    if (!confirm("Remover a imagem do hero e usar o padrão do template?")) return;

    setUploading(true);
    setError(null);

    try {
      const res = await clearHeroImage();
      if (res.error) {
        setError(res.error);
        return;
      }
      onUrlChange("");
    } catch {
      setError("Erro ao remover a imagem.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Label>Imagem do hero</Label>

      {previewUrl ? (
        <div className="relative rounded-lg border overflow-hidden bg-muted aspect-[4/3] max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview do hero" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/40 aspect-[4/3] max-w-sm flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
          Nenhuma imagem — será usada a foto padrão do template
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1.5" />
          )}
          Enviar imagem
        </Button>
        {previewUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={handleClear}
          >
            <X className="h-4 w-4 mr-1.5" />
            Remover
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleFileSelect}
      />

      <div className="space-y-1">
        <Label htmlFor="hero_image_url" className="text-xs text-muted-foreground">
          Ou cole uma URL externa
        </Label>
        <Input
          id="hero_image_url"
          value={currentUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://..."
          disabled={disabled}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
