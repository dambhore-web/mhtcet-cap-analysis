import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProfileProvider, useProfile } from "./lib/ProfileContext";
import { Layout } from "./components/Layout";
import { FindPage } from "./pages/FindPage";
import { CollegesPage } from "./pages/CollegesPage";
import { ListPage } from "./pages/ListPage";
import { AskPage } from "./pages/AskPage";
import { OnboardingPage } from "./pages/OnboardingPage";

function RequireProfile({ children }: { children: React.ReactNode }) {
  const { hasProfile } = useProfile();
  return hasProfile ? <>{children}</> : <Navigate to="/welcome" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="welcome" element={<OnboardingPage />} />
      <Route element={<Layout />}>
        <Route
          index
          element={
            <RequireProfile>
              <FindPage />
            </RequireProfile>
          }
        />
        <Route path="colleges" element={<CollegesPage />} />
        <Route path="list" element={<ListPage />} />
        <Route path="ask" element={<AskPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ProfileProvider>
        <AppRoutes />
      </ProfileProvider>
    </BrowserRouter>
  );
}
