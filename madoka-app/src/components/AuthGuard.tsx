"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isFamilyMember } from "@/config/family";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!isFamilyMember(user.email)) {
    const handleSignOut = async () => {
      try {
        await signOut(auth);
        router.replace("/login");
      } catch (e) {
        console.error(e);
      }
    };
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase mb-6">
            Our Family Cookbook
          </p>
          <h1 className="font-serif text-3xl text-gray-900 mb-2">madoka</h1>
          <p className="font-serif italic text-2xl text-[#C9A84C] mb-8">
            Restaurant
          </p>
          <p className="text-sm text-gray-700 mb-2">
            このアプリは家族専用です。
          </p>
          <p className="text-xs text-gray-500 mb-8 break-all">
            {user.email} では利用できません。
          </p>
          <button
            onClick={handleSignOut}
            className="w-full px-6 py-3 bg-gray-900 text-white text-sm tracking-[0.2em] hover:bg-gray-800 transition"
          >
            ログアウト
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
