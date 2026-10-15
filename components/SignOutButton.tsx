"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton({ endpoint = "/api/patient/signout", to = "/", label = "Sign out", className = "btn btn-small btn-outline" }: { endpoint?: string; to?: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch(endpoint, { method: "POST" });
        router.replace(to);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
