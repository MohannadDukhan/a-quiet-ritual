import { redirect } from "next/navigation";

type LegacyPromptEntryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyPromptEntryPage({ params }: LegacyPromptEntryPageProps) {
  const { id } = await params;
  redirect(`/entries/${encodeURIComponent(id)}`);
}
