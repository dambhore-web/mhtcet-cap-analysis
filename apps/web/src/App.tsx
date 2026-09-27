import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProfileProvider, useProfile } from "./lib/ProfileContext";
import { CompareProvider } from "./lib/CompareContext";
import { AuthProvider } from "./lib/AuthContext";
import { Layout } from "./components/Layout";
import { FindPage } from "./pages/FindPage";
import { CollegesPage } from "./pages/CollegesPage";
import { CollegePage } from "./pages/CollegePage";
import { ListPage } from "./pages/ListPage";
import { AskPage } from "./pages/AskPage";
import { ComparePage } from "./pages/ComparePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { LegalPage } from "./pages/LegalPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SignInPage } from "./pages/SignInPage";
import { PlansPage } from "./pages/PlansPage";
import { GuidePage } from "./pages/GuidePage";

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
        <Route path="colleges/:code" element={<CollegePage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="list" element={<ListPage />} />
        <Route path="ask" element={<AskPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="signin" element={<SignInPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="guide" element={<GuidePage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <CompareProvider>
            <AppRoutes />
          </CompareProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
