import { useEffect } from "react";
import { useRouteError, isRouteErrorResponse } from "react-router";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function RouteErrorBoundary() {
  const error = useRouteError();

  // Check if this is a chunk loading error
  const isChunkLoadError =
    error instanceof Error &&
    (error.message.includes("Failed to fetch dynamically imported module") ||
     error.message.includes("Importing a module script failed") ||
     error.message.includes("error loading dynamically imported module"));

  useEffect(() => {
    // Log error for debugging
    console.error("Route error:", error);

    // Auto-reload for chunk errors after showing message briefly
    if (isChunkLoadError) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error, isChunkLoadError]);

  // Handle chunk loading errors specially
  if (isChunkLoadError) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Alert className="max-w-lg">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertTitle>Update Available</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              A new version of the application is available. Reloading to get the latest version...
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="default"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Now
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle React Router errors
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error {error.status}</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>{error.statusText || "An error occurred while loading this page."}</p>
            {error.data && (
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {typeof error.data === "string" ? error.data : JSON.stringify(error.data, null, 2)}
              </pre>
            )}
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full"
            >
              Go Back
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
  const errorStack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>{errorMessage}</p>
          {errorStack && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium mb-2">Error details</summary>
              <pre className="bg-muted p-2 rounded overflow-auto max-h-40">
                {errorStack}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.reload()}
              variant="default"
              className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
            <Button
              onClick={() => window.history.back()}
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
