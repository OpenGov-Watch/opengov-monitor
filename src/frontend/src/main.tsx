import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";
import { router } from "./router";
import { ApiProvider } from "./contexts/api-context";
import { AuthProvider } from "./contexts/auth-context";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ApiProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ApiProvider>
    </ThemeProvider>
  </StrictMode>
);
