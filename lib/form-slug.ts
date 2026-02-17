/**
 * Mapa de caracteres acentuados/c especiais para ASCII (só substitui, nunca remove letras)
 */
const ACCENT_MAP: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ñ: 'n', Ñ: 'n',
  ç: 'c', Ç: 'c',
};

/**
 * Gera um slug amigável a partir de um nome/texto
 * Substitui acentos e ç/ñ por equivalentes ASCII (nunca remove letras)
 * Exemplo: "Clínica Saúde" -> "clinica-saude", "Formulário de Anamnese" -> "formulario-de-anamnese"
 */
export function slugify(text: string): string {
  if (typeof text !== 'string' || !text.trim()) return '';
  let s = text.trim();
  // Substituir caracteres acentuados/ especiais por equivalente ASCII
  s = s
    .split('')
    .map((c) => ACCENT_MAP[c] ?? c)
    .join('');
  // Normalizar NFD e remover apenas combining marks (acentos combinados)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Gera um slug único a partir de um nome, adicionando sufixo numérico se necessário
 */
export async function generateUniqueSlugFromName(
  supabase: any,
  name: string,
  table: 'form_instances' | 'form_templates',
  column: string = 'slug',
  maxAttempts: number = 10
): Promise<string> {
  const baseSlug = slugify(name);
  
  // Tentar o slug base primeiro
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq(column, baseSlug)
    .maybeSingle();
  
  if (error) {
    console.warn('Erro ao verificar slug único:', error);
    return baseSlug;
  }
  
  if (!data) {
    // Slug base não existe, pode usar
    return baseSlug;
  }
  
  // Slug existe, tentar com sufixo numérico
  for (let i = 1; i <= maxAttempts; i++) {
    const slugWithSuffix = `${baseSlug}-${i}`;
    const { data: existing, error: checkError } = await supabase
      .from(table)
      .select('id')
      .eq(column, slugWithSuffix)
      .maybeSingle();
    
    if (checkError) {
      console.warn('Erro ao verificar slug único:', checkError);
      return slugWithSuffix;
    }
    
    if (!existing) {
      return slugWithSuffix;
    }
  }
  
  // Se todas as tentativas falharam, usar timestamp
  return `${baseSlug}-${Date.now().toString(36)}`;
}

/**
 * Gera um slug amigável e curto para links de formulários (fallback)
 * Exemplo: "abc123" ao invés de "7d0a8e7eb26f418bb932a555c8166ccemlp2bb7i"
 * 
 * Usa caracteres alfanuméricos (a-z, 0-9) para garantir URLs amigáveis
 * Tamanho padrão: 8 caracteres (pode ser ajustado)
 */
export function generateFormSlug(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  
  // Garantir que comece com letra para melhor legibilidade
  slug += chars[Math.floor(Math.random() * 26)];
  
  // Adicionar caracteres aleatórios
  for (let i = 1; i < length; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return slug;
}

/**
 * Gera um slug único verificando no banco de dados
 * Se o slug já existir, tenta novamente com um novo
 */
export async function generateUniqueFormSlug(
  supabase: any,
  maxAttempts: number = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = generateFormSlug();
    
    // Verificar se já existe
    const { data, error } = await supabase
      .from('form_instances')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    
    if (error) {
      // Se houver erro na consulta, retornar o slug mesmo assim
      // (pode ser problema de conexão, não necessariamente duplicata)
      console.warn('Erro ao verificar slug único:', error);
      return slug;
    }
    
    if (!data) {
      // Slug não existe, pode usar
      return slug;
    }
    
    // Slug existe, tentar novamente
  }
  
  // Se todas as tentativas falharam, usar um slug com timestamp
  return generateFormSlug(10) + Date.now().toString(36).slice(-4);
}
