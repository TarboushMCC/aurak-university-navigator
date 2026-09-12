import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";

describe("App", () => {
  it("renders the home page shell", () => {
    render(<App />);
    expect(screen.getByText(/University Navigator/i)).toBeInTheDocument();
  });
});
