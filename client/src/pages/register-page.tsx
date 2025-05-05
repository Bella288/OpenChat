
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const { registerMutation } = useAuth();

  const [, setLocation] = useLocation();
  
  const handleRegister = async () => {
    try {
      await registerMutation.mutateAsync();
      setLocation('/'); // Redirect to home page after successful registration
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  return (
    <div className="container flex min-h-screen w-full items-center justify-center px-4 py-6">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Sign up for a new account using your Replit profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRegister}
            className="w-full"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting to Replit...
              </>
            ) : (
              "Sign up with Replit"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
