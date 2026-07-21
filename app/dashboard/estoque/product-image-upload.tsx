"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadProductImage } from "./actions";

type Props = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function ProductImageUpload({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const previewUrl = value.trim() || null;

  async function uploadFile(file: File) {
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
      const res = await uploadProductImage(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.url) {
        onChange(res.url);
        setShowUrl(false);
      }
    } catch {
      setError("Erro ao enviar a imagem.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  if (!previewUrl) {
    return (
      <div className="space-y-2 sm:col-span-2">
        <Label>Imagem</Label>
        <div
          className={cn(
            "rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center transition-colors",
            dragOver && "border-primary bg-primary/5",
            (disabled || uploading) && "opacity-60"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Adicionar imagem</p>
          <p className="text-xs text-muted-foreground mt-1">Arraste aqui ou selecione um arquivo</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            Selecionar arquivo
          </Button>
          <div className="mt-3">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              disabled={disabled}
              onClick={() => setShowUrl((v) => !v)}
            >
              Usar URL
            </button>
          </div>
        </div>
        {showUrl && (
          <div className="space-y-1">
            <Label htmlFor="product_image_url_empty" className="text-xs text-muted-foreground">
              URL da imagem
            </Label>
            <Input
              id="product_image_url_empty"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://…"
              disabled={disabled}
            />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          className="hidden"
          disabled={disabled || uploading}
          onChange={handleFileSelect}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <Label>Imagem</Label>
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative h-28 w-28 overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview do produto" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col gap-2">
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
            Trocar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => {
              onChange("");
              setShowUrl(false);
              setError(null);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Remover
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setShowUrl((v) => !v)}
          >
            <Link2 className="h-4 w-4 mr-1.5" />
            Usar URL
          </Button>
        </div>
      </div>
      {showUrl && (
        <div className="space-y-1 max-w-md">
          <Label htmlFor="product_image_url" className="text-xs text-muted-foreground">
            URL da imagem
          </Label>
          <Input
            id="product_image_url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            disabled={disabled}
          />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleFileSelect}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
