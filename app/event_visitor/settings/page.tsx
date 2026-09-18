import { redirect } from "next/navigation";

export default function VisitorSettingsRedirect() {
  redirect("/events");
}
