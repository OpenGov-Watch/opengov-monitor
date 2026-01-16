import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Page Not Found</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>The page you're looking for doesn't exist or has been moved.</p>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/")}
              variant="default"
              className="flex-1"
            >
              Go Home
            </Button>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="flex-1"
            >
              Go Back
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
