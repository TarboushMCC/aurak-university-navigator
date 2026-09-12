import { BrowserRouter, Route, Routes } from "react-router";

import { HomePage } from "@/features/home/HomePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
