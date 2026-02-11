/**
 * Tipos para dados do plano
 */
export interface PlanLimits {
  max_doctors: number | null;
  max_secretaries: number | null;
  max_appointments_per_month: number | null;
  max_patients: number | null;
  max_form_templates: number | null;
  max_custom_fields: number | null;
  storage_mb: number | null;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  custom_logo_enabled: boolean;
  priority_support: boolean;
}

export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number;
}

/**
 * Considerar "acesso Pro" apenas quando a clínica está no plano Pro
 * e a assinatura está ativa (não past_due, canceled ou unpaid).
 */
export function hasProAccess(planSlug: string | null, subscriptionStatus: string | null): boolean {
  return planSlug === "pro" && subscriptionStatus === "active";
}

/**
 * Verifica se um limite numérico foi atingido
 */
function checkNumericLimit(
  currentCount: number,
  limit: number | null | undefined,
  resourceName: string
): PlanCheckResult {
  if (limit === null || limit === undefined) {
    return { allowed: true }; // Ilimitado
  }

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `Limite de ${resourceName} atingido (${currentCount}/${limit})`,
      currentCount,
      limit,
    };
  }

  return { allowed: true, currentCount, limit };
}

/**
 * Verifica se pode adicionar médico
 */
export function canAddDoctor(
  planLimits: PlanLimits,
  currentDoctorCount: number
): PlanCheckResult {
  return checkNumericLimit(currentDoctorCount, planLimits.max_doctors, "médicos");
}

/**
 * Verifica se pode adicionar secretário
 */
export function canAddSecretary(
  planLimits: PlanLimits,
  currentSecretaryCount: number
): PlanCheckResult {
  return checkNumericLimit(currentSecretaryCount, planLimits.max_secretaries, "secretários");
}

/**
 * Verifica se pode criar consulta no mês atual
 */
export function canCreateAppointment(
  planLimits: PlanLimits,
  currentMonthAppointments: number
): PlanCheckResult {
  return checkNumericLimit(
    currentMonthAppointments,
    planLimits.max_appointments_per_month,
    "consultas/mês"
  );
}

/**
 * Verifica se pode criar template de formulário
 */
export function canCreateFormTemplate(
  planLimits: PlanLimits,
  currentTemplateCount: number
): PlanCheckResult {
  return checkNumericLimit(
    currentTemplateCount,
    planLimits.max_form_templates,
    "formulários"
  );
}

/**
 * Verifica se pode criar campo customizado
 */
export function canCreateCustomField(
  planLimits: PlanLimits,
  currentCustomFieldCount: number
): PlanCheckResult {
  return checkNumericLimit(
    currentCustomFieldCount,
    planLimits.max_custom_fields,
    "campos customizados"
  );
}

/**
 * Verifica se pode criar paciente no mês atual
 */
export function canCreatePatient(
  planLimits: PlanLimits,
  currentMonthPatients: number
): PlanCheckResult {
  return checkNumericLimit(
    currentMonthPatients,
    planLimits.max_patients,
    "pacientes/mês"
  );
}

/**
 * Verifica se pode fazer upload de arquivo (exames)
 */
export function canUploadFile(
  planLimits: PlanLimits,
  currentStorageMB: number,
  fileSizeMB: number
): PlanCheckResult {
  const limitMB = planLimits.storage_mb;
  
  if (limitMB === null || limitMB === undefined) {
    return { allowed: true }; // Ilimitado
  }

  const newTotalMB = currentStorageMB + fileSizeMB;
  
  if (newTotalMB > limitMB) {
    return {
      allowed: false,
      reason: `Limite de armazenamento atingido (${currentStorageMB.toFixed(2)}/${limitMB} MB). Upgrade para Pro para mais espaço.`,
      currentCount: Math.round(currentStorageMB),
      limit: limitMB,
    };
  }

  // Aviso ao atingir 80% (só para Pro)
  if (limitMB >= 10240 && newTotalMB >= limitMB * 0.8) {
    return {
      allowed: true,
      reason: `Atenção: você está usando ${((newTotalMB / limitMB) * 100).toFixed(0)}% do seu armazenamento`,
      currentCount: Math.round(currentStorageMB),
      limit: limitMB,
    };
  }

  return { allowed: true, currentCount: Math.round(currentStorageMB), limit: limitMB };
}

/**
 * Verifica se pode usar WhatsApp
 */
export function canUseWhatsApp(planSlug: string | null, subscriptionStatus: string | null): boolean {
  return hasProAccess(planSlug, subscriptionStatus);
}

/**
 * Verifica se pode usar e-mail automático
 */
export function canUseEmail(planLimits: PlanLimits, planSlug: string | null, subscriptionStatus: string | null): boolean {
  return planLimits.email_enabled && hasProAccess(planSlug, subscriptionStatus);
}

/**
 * Verifica se pode usar logo personalizada
 */
export function canUseCustomLogo(planLimits: PlanLimits, planSlug: string | null, subscriptionStatus: string | null): boolean {
  return planLimits.custom_logo_enabled && hasProAccess(planSlug, subscriptionStatus);
}

/**
 * Obtém mensagem de upsell baseada no recurso bloqueado
 * Não inclui números hardcoded - usa valores dinâmicos do plano
 */
export function getUpgradeMessage(resourceName: string): string {
  const messages: Record<string, string> = {
    médicos: "Upgrade para Pro para adicionar mais médicos",
    secretários: "Upgrade para Pro para adicionar mais secretários",
    "consultas/mês": "Upgrade para Pro para agendar sem limites",
    "pacientes/mês": "Upgrade para Pro para cadastrar sem limites",
    formulários: "Upgrade para Pro para criar formulários ilimitados",
    "campos customizados": "Upgrade para Pro para criar campos customizados ilimitados",
    armazenamento: "Upgrade para Pro para mais espaço (10 GB)",
    whatsapp: "WhatsApp transacional disponível no plano Pro",
    email: "E-mail automático disponível no plano Pro",
    logo: "Logo personalizada disponível no plano Pro",
  };

  return messages[resourceName] || "Upgrade para Pro para desbloquear este recurso";
}
