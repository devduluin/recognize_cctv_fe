import EventVisitorPage from "../../event_visitor/page";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventVisitorPage eventId={eventId} />;
}
