
import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  fullName?: string | null;
  location?: string | null;
  interests?: string[] | null;
  profession?: string | null;
  pets?: string | null;
  systemContext?: string | null;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loginMutation: any;
  registerMutation: any;
};

export const AuthContext = createContext<AuthContextType | null>(null);

function loginWithReplit() {
  const h = 500;
  const w = 350;
  const left = screen.width / 2 - w / 2;
  const top = screen.height / 2 - h / 2;

  return new Promise<void>((resolve) => {
    const authWindow = window.open(
      `https://replit.com/auth_with_repl_site?domain=${location.host}`,
      "_blank",
      `modal=yes,toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,copyhistory=no,width=${w},height=${h},top=${top},left=${left}`
    );

    window.addEventListener("message", function authComplete(e) {
      if (e.data !== "auth_complete") {
        return;
      }
      window.removeEventListener("message", authComplete);
      authWindow?.close();
      resolve();
    });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      await loginWithReplit();
      const res = await fetch("/api/auth/replit");
      if (!res.ok) {
        throw new Error("Authentication failed");
      }
      return res.json();
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({
        title: "Welcome!",
        description: "You've successfully logged in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      await loginWithReplit();
      const res = await fetch("/api/auth/replit");
      if (!res.ok) {
        throw new Error("Registration failed");
      }
      return res.json();
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({
        title: "Welcome!",
        description: "Your account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Logout failed");
      }
      
      // Force a full page reload to clear Replit auth state
      window.location.href = "/auth";
      return null;
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.removeQueries();
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        login: loginMutation.mutateAsync,
        logout: logoutMutation.mutateAsync,
        loginMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
