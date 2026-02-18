export type BlockType = 
  | "heading" 
  | "text" 
  | "button" 
  | "variable" 
  | "spacer" 
  | "divider"
  | "image";

export interface EmailBlock {
  id: string;
  type: BlockType;
  content: string;
  styles?: {
    fontSize?: string;
    fontWeight?: string;
    textAlign?: "left" | "center" | "right";
    color?: string;
    backgroundColor?: string;
    padding?: string;
    margin?: string;
  };
  // Específico para botões
  buttonUrl?: string;
  buttonText?: string;
  buttonStyle?: "primary" | "secondary" | "outline";
  // Específico para espaçadores
  height?: number;
  // Específico para variáveis
  variableName?: string;
}

export interface EmailTemplateData {
  blocks: EmailBlock[];
}
