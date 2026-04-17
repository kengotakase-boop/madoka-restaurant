"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      alert("ログインに失敗しました");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-gray-500">
        Loading...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-8">まどかレストラン</h1>
        <button
          onClick={handleLogin}
          className="px-6 py-3 bg-white border border-gray-300 rounded shadow hover:bg-gray-50"
        >
          Googleでログイン
        </button>
      </div>
    </main>
  );
}
