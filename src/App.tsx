import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Projects from "./pages/Projects.tsx";
import NewProject from "./pages/NewProject.tsx";
import ProjectDetail from "./pages/ProjectDetail.tsx";
import Sessions from "./pages/Sessions.tsx";
import SessionDetail from "./pages/SessionDetail.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import AdminReports from "./pages/AdminReports.tsx";
import AdminActivityLog from "./pages/AdminActivityLog.tsx";
import SelectMode from "./pages/SelectMode.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/select-mode" element={<SelectMode />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<NewProject />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/sessions/:id" element={<SessionDetail />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/actividad" element={<AdminActivityLog />} />
              <Route path="/assign-reviewers" element={<div className="text-muted-foreground">Asignar Revisores — Próximamente</div>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
