import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { FindPage } from "./pages/FindPage";
import { CollegesPage } from "./pages/CollegesPage";
import { CollegePage } from "./pages/CollegePage";
import { ListPage } from "./pages/ListPage";
import { AskPage } from "./pages/AskPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<FindPage />} />
          <Route path="colleges" element={<CollegesPage />} />
          <Route path="colleges/:code" element={<CollegePage />} />
          <Route path="list" element={<ListPage />} />
          <Route path="ask" element={<AskPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
