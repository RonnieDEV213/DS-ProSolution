"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder */}
      <aside className="w-64 border-r bg-gray-50 p-4">
        <h2 className="text-lg font-semibold mb-4">Order Tracker</h2>
        <nav className="space-y-2">
          <div className="text-sm text-gray-600">Dashboard</div>
          <div className="text-sm text-gray-600">Orders</div>
          <div className="text-sm text-gray-600">Settings</div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold mb-6">Welcome to DS-ProSolution</h1>
          <p className="text-gray-600 mb-8">
            Your in-house order tracking solution.
          </p>
          <Button size="lg">Start Bookkeeping</Button>
        </motion.div>
      </main>
    </div>
  );
}
