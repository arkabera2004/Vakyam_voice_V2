import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ConsoleShell } from "@/console/ConsoleShell";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const Home = lazy(() => import("./pages/console/Home"));
const LiveCalls = lazy(() => import("./pages/console/LiveCalls"));
const LiveCallDetail = lazy(() => import("./pages/console/LiveCallDetail"));
const WarmTransfer = lazy(() => import("./pages/console/WarmTransfer"));
const CallReview = lazy(() => import("./pages/console/CallReview"));
const QAScorecards = lazy(() => import("./pages/console/QAScorecards"));
const AgentStudio = lazy(() => import("./pages/console/AgentStudio"));
const Tools = lazy(() => import("./pages/console/Tools"));
const Routing = lazy(() => import("./pages/console/Routing"));
const Knowledge = lazy(() => import("./pages/console/Knowledge"));
const Compliance = lazy(() => import("./pages/console/Compliance"));
const Analytics = lazy(() => import("./pages/console/Analytics"));
const MobileSupervisor = lazy(() => import("./pages/console/MobileSupervisor"));

const Loading = () => <div className="p-8 text-sm text-zinc-500">Loading…</div>;

const App = () => (
  <>
    <Toaster />
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/console" replace />} />
            <Route path="/voice" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/console" element={<ProtectedRoute><ConsoleShell /></ProtectedRoute>}>
              <Route index element={<Home />} />
              <Route path="live" element={<LiveCalls />} />
              <Route path="live/:id" element={<LiveCallDetail />} />
              <Route path="transfers" element={<WarmTransfer />} />
              <Route path="review" element={<CallReview />} />
              <Route path="qa" element={<QAScorecards />} />
              <Route path="studio" element={<AgentStudio />} />
              <Route path="tools" element={<Tools />} />
              <Route path="routing" element={<Routing />} />
              <Route path="knowledge" element={<Knowledge />} />
              <Route path="compliance" element={<Compliance />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="alerts" element={<MobileSupervisor />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </>
);

export default App;
