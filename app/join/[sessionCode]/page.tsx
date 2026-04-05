import AppClient from "@/components/AppClient";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;
  return <AppClient mode="join" initialSessionCode={sessionCode} />;
}
