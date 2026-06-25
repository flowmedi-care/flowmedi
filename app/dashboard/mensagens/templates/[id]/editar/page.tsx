import { redirect } from "next/navigation";

export default async function EditarTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/mensagens/templates/salvos?edit=${id}`);
}
