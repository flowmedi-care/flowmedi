import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ action?: string; filter?: string }>;
};

export default async function PendenciasRedirect({ searchParams }: Props) {
  await searchParams;
  redirect("/dashboard/hoje?focus=atencao");
}
