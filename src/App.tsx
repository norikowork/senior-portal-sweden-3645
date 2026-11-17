import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Activate from "./pages/auth/Activate";
import SiteLayout from "@/components/layout/SiteLayout";
import AccountHome from "./pages/auth/AccountHome";
import RequireAuth from "@/components/auth/RequireAuth";
import ProfilePage from "./pages/auth/ProfilePage";
import SecurityPage from "./pages/auth/SecurityPage";
import AuthPage from "./pages/auth/AuthPage";
import PasswordResetComplete from "./pages/auth/PasswordResetComplete";
import PasswordResetRequest from "./pages/auth/PasswordResetRequest";
import VerifySignIn from "./pages/auth/VerifySignIn";
import BecomeProvider from "./pages/BecomeProvider";
import MyPages from "./pages/MyPages";
import Admin from "./pages/Admin";
import ProviderDetail from "./pages/ProviderDetail";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" forcedTheme="light" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
    {/* BrowserRouter wraps the other providers so anything added below it can use Link,
        useNavigate and useLocation. Nesting it innermost puts every provider outside the
        router, where those hooks throw. Add new providers inside it; keep Routes last. */}
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Routes>
            <Route path="/" element={<SiteLayout><Index /></SiteLayout>} />
            <Route path="/utforare/:id" element={<SiteLayout><ProviderDetail /></SiteLayout>} />
            <Route path="/bli-utforare" element={<RequireAuth><SiteLayout><BecomeProvider /></SiteLayout></RequireAuth>} />
            <Route path="/mina-sidor" element={<RequireAuth><SiteLayout><MyPages /></SiteLayout></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><SiteLayout><Admin /></SiteLayout></RequireAuth>} />
            <Route path="/auth/activate" element={<SiteLayout><Activate /></SiteLayout>} />
            <Route path="/account" element={<RequireAuth><SiteLayout><AccountHome /></SiteLayout></RequireAuth>} />
            <Route path="/account/profile" element={<RequireAuth><SiteLayout><ProfilePage /></SiteLayout></RequireAuth>} />
            <Route path="/account/security" element={<RequireAuth><SiteLayout><SecurityPage /></SiteLayout></RequireAuth>} />
            <Route path="/login" element={<SiteLayout><AuthPage /></SiteLayout>} />
            <Route path="/auth/reset/complete" element={<SiteLayout><PasswordResetComplete /></SiteLayout>} />
            <Route path="/auth/reset" element={<SiteLayout><PasswordResetRequest /></SiteLayout>} />
            <Route path="/verify-sign-in" element={<SiteLayout><VerifySignIn /></SiteLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
