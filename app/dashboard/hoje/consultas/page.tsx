import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ stage?: string }> };

export default async function AtendimentosRedirect({ searchParams }: Props) {
  const { stage } = await searchParams;
  const q = new URLSearchParams({ area: "atendimentos" });
  if (stage) q.set("stage", stage);
  redirect(`/dashboard/hoje?${q.toString()}`);
}
