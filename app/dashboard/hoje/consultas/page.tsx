import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ stage?: string }> };

export default async function ConsultasRedirect({ searchParams }: Props) {
  const { stage } = await searchParams;
  const q = new URLSearchParams({ area: "consultas" });
  if (stage) q.set("stage", stage);
  redirect(`/dashboard/hoje?${q.toString()}`);
}
