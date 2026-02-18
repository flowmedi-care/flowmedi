import { EmailBlock } from "./types";

/**
 * Converte HTML simples em blocos visuais
 * Esta é uma conversão básica - para HTML mais complexo, o usuário pode usar o modo HTML
 * IMPORTANTE: Esta função só funciona no cliente (usa DOM)
 */
export function htmlToBlocks(html: string): EmailBlock[] {
  if (typeof window === "undefined") {
    // No servidor, retorna array vazio
    return [];
  }

  if (!html || !html.trim()) {
    return [];
  }

  const blocks: EmailBlock[] = [];
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html.trim();

  // Processa elementos do DOM
  const processElement = (element: Element | Text, parentStyles?: any): void => {
    if (element.nodeType === Node.TEXT_NODE) {
      const text = element.textContent?.trim();
      if (text) {
        blocks.push({
          id: `block-${Date.now()}-${Math.random()}`,
          type: "text",
          content: text,
          styles: parentStyles || {},
        });
      }
      return;
    }

    if (element.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const el = element as Element;
    const tagName = el.tagName.toLowerCase();
    const computedStyles = window.getComputedStyle(el);

    const blockStyles = {
      fontSize: computedStyles.fontSize || undefined,
      fontWeight: computedStyles.fontWeight || undefined,
      textAlign: (computedStyles.textAlign as any) || undefined,
      color: computedStyles.color || undefined,
      margin: computedStyles.margin || undefined,
      padding: computedStyles.padding || undefined,
      ...parentStyles,
    };

    switch (tagName) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        blocks.push({
          id: `block-${Date.now()}-${Math.random()}`,
          type: "heading",
          content: el.textContent || "",
          styles: blockStyles,
        });
        break;

      case "p":
        if (el.textContent?.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random()}`,
            type: "text",
            content: el.innerHTML,
            styles: blockStyles,
          });
        }
        break;

      case "a":
        // Verifica se é um botão (estilizado como botão)
        const htmlEl = el as HTMLElement;
        const isButton = (htmlEl.style && htmlEl.style.backgroundColor) || 
                        el.classList.contains("button") ||
                        el.getAttribute("style")?.includes("background");
        
        if (isButton) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random()}`,
            type: "button",
            content: "",
            buttonText: el.textContent || "Clique aqui",
            buttonUrl: el.getAttribute("href") || "#",
            buttonStyle: "primary",
            styles: blockStyles,
          });
        } else {
          // Link normal - trata como texto com link
          blocks.push({
            id: `block-${Date.now()}-${Math.random()}`,
            type: "text",
            content: el.outerHTML,
            styles: blockStyles,
          });
        }
        break;

      case "hr":
        blocks.push({
          id: `block-${Date.now()}-${Math.random()}`,
          type: "divider",
          content: "",
          styles: blockStyles,
        });
        break;

      case "img":
        blocks.push({
          id: `block-${Date.now()}-${Math.random()}`,
          type: "image",
          content: el.getAttribute("src") || "",
          styles: blockStyles,
        });
        break;

      case "div":
        // Verifica se é um espaçador
        const height = computedStyles.height;
        const heightMatch = height?.match(/(\d+)px/);
        if (heightMatch && parseInt(heightMatch[1]) > 0 && !el.textContent?.trim()) {
          blocks.push({
            id: `block-${Date.now()}-${Math.random()}`,
            type: "spacer",
            content: "",
            height: parseInt(heightMatch[1]),
            styles: {},
          });
        } else {
          // Processa filhos recursivamente
          Array.from(el.childNodes).forEach((child) => {
            processElement(child as Element, blockStyles);
          });
        }
        break;

      case "span":
        // Verifica se contém variáveis
        const text = el.textContent || "";
        if (text.match(/\{\{[\w_]+\}\}/)) {
          const variableMatch = text.match(/\{\{[\w_]+\}\}/);
          if (variableMatch) {
            blocks.push({
              id: `block-${Date.now()}-${Math.random()}`,
              type: "variable",
              content: variableMatch[0],
              variableName: variableMatch[0],
              styles: {},
            });
          }
        } else {
          // Processa filhos recursivamente
          Array.from(el.childNodes).forEach((child) => {
            processElement(child as Element, blockStyles);
          });
        }
        break;

      default:
        // Para outros elementos, processa filhos recursivamente
        Array.from(el.childNodes).forEach((child) => {
          processElement(child as Element, blockStyles);
        });
        break;
    }
  };

  // Processa todos os nós do elemento raiz
  Array.from(tempDiv.childNodes).forEach((child) => {
    processElement(child as Element);
  });

  // Se não encontrou nenhum bloco, cria um bloco de texto com todo o conteúdo
  if (blocks.length === 0 && html.trim()) {
    blocks.push({
      id: `block-${Date.now()}-${Math.random()}`,
      type: "text",
      content: html.trim(),
      styles: {},
    });
  }

  return blocks;
}
