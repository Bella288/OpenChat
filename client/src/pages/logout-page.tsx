
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
        // Redirect will happen in logout function
      } catch (error) {
        console.error("Logout failed:", error);
        window.location.href = "/auth";
      }
    };
    performLogout();
  }, [logout]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-lg">Signing out...</span>
      </div>
    </div>
  );
}
