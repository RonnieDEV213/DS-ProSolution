"use client";

import { motion } from "framer-motion";

interface WaitingForAccessProps {
  isPending: boolean;
  needsAccessProfile: boolean;
}

export function WaitingForAccess({ isPending, needsAccessProfile }: WaitingForAccessProps) {
  const title = isPending
    ? "Account Pending Activation"
    : "Access Profile Required";

  const message = isPending
    ? "Your account has been created but is awaiting activation. Please wait for an administrator to activate your account."
    : "Your account is active, but you need an Access Profile to use the system. Please wait for an administrator to assign you an Access Profile.";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-8 text-center"
      >
        <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">{title}</h1>

        <p className="text-gray-400 mb-6">{message}</p>

        <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300">
          <p>
            If you believe this is an error, please contact your administrator.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
