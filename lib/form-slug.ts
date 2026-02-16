/**
 * Gera um slug amigável e curto para links de formulários
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
