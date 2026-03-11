import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/comunicacao/email";
import { assertEmailFeatureAccessForCurrentClinic } from "@/lib/integration-plan-access";

/**
 * Testa o envio de email
 * POST /api/integrations/email/test
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireClinicAdmin();
    const emailAccess = await assertEmailFeatureAccessForCurrentClinic();
    if (!emailAccess.allowed) {
      return NextResponse.json({ error: emailAccess.error }, { status: 403 });
    }
    const body = await request.json();
    const { to, subject, body: emailBody } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Campos 'to', 'subject' e 'body' são obrigatórios" },
        { status: 400 }
      );
    }

    // Enviar email
    const result = await sendEmail(admin.clinicId, {
      to,
      subject,
      body: emailBody,
      html: emailBody.replace(/\n/g, "<br>"), // Converte quebras de linha em HTML
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erro ao enviar email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: "Email enviado com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao testar envio de email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar email" },
      { status: 500 }
    );
  }
}
