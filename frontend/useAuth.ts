import { useEffect, useState } from "react";

type AuthUser = { id: string; name?: string | null; email?: string | null };
export function useAuth() { const [user, setUser] = useState<AuthUser | null>(null); const [loading, setLoading] = useState(true); useEffect(() => { fetch("/api/auth/status").then(response => response.json()).then(data => setUser(data.user || null)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []); return { user, loading, isAuthenticated: Boolean(user), logout: async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); } }; }
