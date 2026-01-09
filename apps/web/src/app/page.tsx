"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-gray-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">DS ProSolution</h2>
        <nav className="space-y-1">
          {/* Active tab - Dashboard */}
          <div className="text-sm font-medium text-white bg-gray-800 px-3 py-2 rounded-md border-l-2 border-white">
            Dashboard
          </div>
          {/* Inactive tab */}
          <Link
            href="/bookkeeping"
            className="block text-sm text-gray-400 px-3 py-2 rounded-md hover:bg-gray-800 cursor-pointer"
          >
            Order Tracker
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold mb-6 text-white">Welcome to DS-ProSolution</h1>
          <p className="text-gray-400 mb-8">
            Your in-house order tracking solution.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
