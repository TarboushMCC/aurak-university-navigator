import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";

describe("App", () => {
  it("renders the home page shell with campus data", () => {
    render(<App />);
    expect(screen.getByText(/AURAK University Navigator/i)).toBeInTheDocument();
    expect(screen.getByText(/Powered by SGA/i)).toBeInTheDocument();
  });
});
