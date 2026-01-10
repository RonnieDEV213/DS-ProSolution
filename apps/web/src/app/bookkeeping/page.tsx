import { redirect } from "next/navigation";

// This page is deprecated - redirect to login which will route to appropriate dashboard
export default function BookkeepingPage() {
  redirect("/login");
}
