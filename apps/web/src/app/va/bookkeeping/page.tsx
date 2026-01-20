import { redirect } from "next/navigation";

// Redirect old path to new path
export default function VABookkeepingPage() {
  redirect("/va/order-tracking");
}
