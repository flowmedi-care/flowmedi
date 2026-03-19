import type { Metadata } from "next";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { EditTokenClient } from "./token-edit-client";

export const metadata: Metadata = {
  title: "Editar sugestão | FlowMedi",
  description: "Edite ou exclua sua sugestão enviada para a caixa de ideias da FlowMedi.",
};

export default async function EditTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader variant="minimal" />
      <main className="flex-1">
        <section className="container mx-auto max-w-3xl px-4 py-10 md:py-14">
          <EditTokenClient token={token} />
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
