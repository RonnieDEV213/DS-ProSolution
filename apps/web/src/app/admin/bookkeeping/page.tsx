import { redirect } from "next/navigation";

// Redirect old path to new path
export default function AdminBookkeepingPage() {
  redirect("/admin/order-tracking");
}
