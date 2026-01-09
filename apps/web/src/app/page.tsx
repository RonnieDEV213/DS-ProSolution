"use client";

import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-gray-50 p-4">
        <h2 className="text-lg font-semibold mb-4">DS ProSolution</h2>
        <nav className="space-y-1">
          {/* Active tab - Dashboard */}
          <div className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-2 rounded-md border-l-2 border-gray-900">
            Dashboard
          </div>
          {/* Inactive tab */}
          <div className="text-sm text-gray-600 px-3 py-2 rounded-md hover:bg-gray-100 cursor-pointer">
            Order Tracker
          </div>
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
        </motion.div>
      </main>
    </div>
  );
}
