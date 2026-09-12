import { BrowserRouter, Route, Routes } from "react-router";

import { CampusProvider } from "@/app/CampusProvider";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { HomePage } from "@/features/home/HomePage";

export function App() {
  return (
    <ErrorBoundary>
      <CampusProvider campusId="aurak">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </BrowserRouter>
      </CampusProvider>
    </ErrorBoundary>
  );
}
