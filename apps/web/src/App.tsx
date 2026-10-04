import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ProfileProvider, useProfile } from "./lib/ProfileContext";
import { CompareProvider } from "./lib/CompareContext";
import { AuthProvider } from "./lib/AuthContext";
import { Layout } from "./components/Layout";
import { ConsentBanner } from "./components/ConsentBanner";
import { FindPage } from "./pages/FindPage";
import { CollegesPage } from "./pages/CollegesPage";
import { CollegePage } from "./pages/CollegePage";
import { ListPage } from "./pages/ListPage";
import { AskPage } from "./pages/AskPage";
import { ComparePage } from "./pages/ComparePage";
import { OnboardingWizard } from "./pages/OnboardingPage";
import { LandingPage } from "./pages/LandingPage";
import { LegalPage } from "./pages/LegalPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AccountPage } from "./pages/AccountPage";
import { SignInPage } from "./pages/SignInPage";
import { PlansPage } from "./pages/PlansPage";
import { PAYMENTS_ENABLED } from "./lib/plans";
import { GuidePage } from "./pages/GuidePage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { EstimatePage } from "./pages/EstimatePage";
import { AddOptionsPage } from "./pages/AddOptionsPage";
import { SummaryPage } from "./pages/SummaryPage";
import { DataPage } from "./pages/DataPage";
import { EligibilityPage } from "./pages/EligibilityPage";
import { BranchTrendsPage } from "./pages/BranchTrendsPage";
import { AllotmentPage } from "./pages/AllotmentPage";
import { ExportPage } from "./pages/ExportPage";
import { BranchesPage } from "./pages/BranchesPage";
import { DistrictPage } from "./pages/DistrictPage";

/** A shared result link: a merit number or a percentile in the URL. */
const hasScore = (search: string) => {
  const p = new URLSearchParams(search);
  return p.has("merit") || p.has("pct");
};

/** Find needs saved details or a score in the URL (a shared result link); otherwise start at the landing page. */
function RequireProfile({ children }: { children: React.ReactNode }) {
  const { hasProfile } = useProfile();
  const { search } = useLocation();
  return hasProfile || hasScore(search) ? <>{children}</> : <Navigate to="/" replace />;
}

/** `/` is the landing page for everyone (#142); older result links (`/?merit=…`) move to `/find`. */
function Home() {
  const { search } = useLocation();
  return hasScore(search) ? <Navigate to={`/find${search}`} replace /> : <LandingPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="welcome" element={<Navigate to="/" replace />} />
      <Route path="welcome/start" element={<OnboardingWizard />} />
      <Route element={<Layout />}>
        <Route
          path="find"
          element={
            <RequireProfile>
              <FindPage />
            </RequireProfile>
          }
        />
        <Route path="colleges" element={<CollegesPage />} />
        <Route path="colleges/:code" element={<CollegePage />} />
        <Route path="colleges/:code/:choiceCode" element={<BranchTrendsPage />} />
        <Route path="engineering-colleges" element={<DistrictPage />} />
        <Route path="engineering-colleges/:district" element={<DistrictPage />} />
        <Route path="engineering-colleges/:district/:group" element={<DistrictPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="list" element={<ListPage />} />
        <Route path="list/add" element={<AddOptionsPage />} />
        <Route path="ask" element={<AskPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="profile" element={<AccountPage />} />
        <Route path="profile/details" element={<ProfilePage />} />
        <Route path="signin" element={<SignInPage />} />
        <Route path="plans" element={PAYMENTS_ENABLED ? <PlansPage /> : <Navigate to="/" replace />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="simulator" element={<SimulatorPage />} />
        <Route path="estimate" element={<EstimatePage />} />
        <Route path="allotment" element={<AllotmentPage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="branches/:group" element={<BranchesPage />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="eligibility" element={<EligibilityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
            <ConsentBanner />
          </CompareProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
