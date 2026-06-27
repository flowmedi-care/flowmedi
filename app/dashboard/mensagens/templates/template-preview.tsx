"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Mail, MessageSquare } from "lucide-react";
import { getClinicEmailBranding, type MessageChannel } from "../actions";
import {
  WhatsAppPreviewBubble,
  EmailPreviewPanel,
} from "@/components/comunicacao/message-preview";

export { WhatsAppPreviewBubble, EmailPreviewPanel } from "@/components/comunicacao/message-preview";

export type TemplatePreviewData = {
  name: string;
  channel: MessageChannel;
  subject?: string | null;
  body_html: string;
  body_text?: string | null;
  email_header?: string | null;
  email_footer?: string | null;
};

function whatsappDisplayText(data: TemplatePreviewData) {
  if (data.body_text?.trim()) return data.body_text;
  return (data.body_html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplatePreviewData | null;
}) {
  const [emailHeader, setEmailHeader] = useState("");
  const [emailFooter, setEmailFooter] = useState("");
  const [loadingBranding, setLoadingBranding] = useState(false);

  useEffect(() => {
    if (!open || !template || template.channel !== "email") return;
    setLoadingBranding(true);
    getClinicEmailBranding().then((res) => {
      setEmailHeader(template.email_header ?? res.data?.email_header ?? "");
      setEmailFooter(template.email_footer ?? res.data?.email_footer ?? "");
      setLoadingBranding(false);
    });
  }, [open, template]);

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Visualizar — ${template.name}`}
        onClose={() => onOpenChange(false)}
        className="max-w-[96vw] sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {template.channel === "email" ? (
              <>
                <Mail className="h-4 w-4" />
                Email
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </>
            )}
          </div>

          {template.channel === "email" ? (
            loadingBranding ? (
              <p className="text-sm text-muted-foreground">Carregando preview...</p>
            ) : (
              <EmailPreviewPanel
                subject={template.subject}
                bodyHtml={template.body_html}
                emailHeader={emailHeader}
                emailFooter={emailFooter}
                className="max-h-none"
              />
            )
          ) : (
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-2">Preview do WhatsApp</p>
              <WhatsAppPreviewBubble text={whatsappDisplayText(template) || "(sem conteúdo)"} />
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
