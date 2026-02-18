"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface TextEditorWithVariablesProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  availableVariables: string[];
}

export function TextEditorWithVariables({
  value,
  onChange,
  label,
  placeholder,
  rows = 4,
  availableVariables,
}: TextEditorWithVariablesProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Função para inserir variável na posição do cursor
  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    onChange(newText);
    
    // Reposiciona o cursor após a variável inserida
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variable.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Função para destacar variáveis no texto
  const highlightVariables = (text: string): string => {
    // Regex para encontrar variáveis no formato {{nome_variavel}}
    const variableRegex = /\{\{[\w_]+\}\}/g;
    
    return text.replace(variableRegex, (match) => {
      return `<span class="variable-highlight">${match}</span>`;
    });
  };

  // Extrai variáveis do texto
  const extractVariables = (text: string): string[] => {
    const variableRegex = /\{\{[\w_]+\}\}/g;
    const matches = text.match(variableRegex);
    return matches ? [...new Set(matches)] : [];
  };

  const variablesInText = extractVariables(value);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Digite o texto aqui... Você pode usar variáveis como {{nome_paciente}}"}
          rows={rows}
          className="font-mono text-sm"
        />
        
        {/* Preview com variáveis destacadas */}
        {value && (
          <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
            <div 
              className="text-sm prose prose-sm max-w-none [&_.variable-highlight]:inline-block [&_.variable-highlight]:px-1.5 [&_.variable-highlight]:py-0.5 [&_.variable-highlight]:bg-blue-100 [&_.variable-highlight]:text-blue-800 [&_.variable-highlight]:rounded [&_.variable-highlight]:font-mono [&_.variable-highlight]:text-xs [&_.variable-highlight]:font-semibold [&_.variable-highlight]:mx-0.5"
              dangerouslySetInnerHTML={{ 
                __html: highlightVariables(value.replace(/\n/g, "<br />")) 
              }}
            />
          </div>
        )}

        {/* Variáveis encontradas no texto */}
        {variablesInText.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground">Variáveis usadas:</span>
            {variablesInText.map((variable) => (
              <span
                key={variable}
                className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-mono"
              >
                {variable}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Botão para inserir variável */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Inserir variável:</Label>
        <select
          onChange={(e) => {
            if (e.target.value) {
              insertVariable(e.target.value);
              e.target.value = "";
            }
          }}
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Selecione uma variável...</option>
          {availableVariables.map((variable) => (
            <option key={variable} value={variable}>
              {variable}
            </option>
          ))}
        </select>
      </div>

    </div>
  );
}
