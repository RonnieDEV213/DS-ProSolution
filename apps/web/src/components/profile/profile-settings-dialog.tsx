"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileTab } from "./profile-tab";
import { SecurityTab } from "./security-tab";
import { ExtensionTab } from "./extension-tab";
import { ThemePicker } from "./theme-picker";

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "profile" | "security" | "extension" | "theme";

interface UserData {
  displayName: string | null;
  email: string;
  role: string;
}

export function ProfileSettingsDialog({
  open,
  onOpenChange,
}: ProfileSettingsDialogProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onOpenChange(false);
    router.push("/login");
  };

  const fetchUserData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", user.id)
        .single();

      // Get membership for role
      const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserData({
        displayName: profile?.display_name ?? null,
        email: profile?.email || user.email || "",
        role: membership?.role || "unknown",
      });
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setActiveTab("profile");
      setLoading(true);
      fetchUserData();
    }
  }, [open, fetchUserData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="sm:max-w-3xl p-0 bg-gray-900 border-gray-800 text-white overflow-hidden"
      >
        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-52 border-r border-gray-800 flex flex-col bg-gray-950">
            {/* Header */}
            <DialogHeader className="p-4 border-b border-gray-800">
              <DialogTitle className="text-base">Profile Settings</DialogTitle>
              <DialogDescription className="sr-only">
                View your profile information and manage extension settings
              </DialogDescription>
            </DialogHeader>

            {/* Tab Navigation */}
            <nav className="flex-1 p-2 space-y-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                  activeTab === "profile"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                )}
              >
                Profile
              </button>
              {userData && (userData.role === "admin" || userData.role === "va") && (
                <button
                  onClick={() => setActiveTab("security")}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                    activeTab === "security"
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800"
                  )}
                >
                  Security
                </button>
              )}
              <button
                onClick={() => setActiveTab("extension")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                  activeTab === "extension"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                )}
              >
                Extension
              </button>
              <button
                onClick={() => setActiveTab("theme")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                  activeTab === "theme"
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                )}
              >
                Theme
              </button>
            </nav>

            {/* Sign Out button at bottom */}
            <div className="p-3 border-t border-gray-800">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "theme" ? (
                <ThemePicker />
              ) : loading ? (
                <div className="space-y-4">
                  <div className="h-6 bg-gray-800 rounded w-1/3 animate-pulse" />
                  <div className="h-4 bg-gray-800 rounded w-2/3 animate-pulse" />
                  <div className="h-4 bg-gray-800 rounded w-1/2 animate-pulse" />
                </div>
              ) : userData ? (
                <>
                  {activeTab === "profile" && (
                    <ProfileTab
                      displayName={userData.displayName}
                      email={userData.email}
                      role={userData.role}
                    />
                  )}
                  {activeTab === "security" && (userData.role === "admin" || userData.role === "va") && (
                    <SecurityTab />
                  )}
                  {activeTab === "extension" && (
                    <ExtensionTab role={userData.role} />
                  )}
                </>
              ) : (
                <p className="text-gray-400">Unable to load profile data.</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
