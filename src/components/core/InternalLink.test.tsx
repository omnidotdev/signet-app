import { describe, expect, test } from "bun:test";

import { screen } from "@testing-library/react";

import renderWithRouter from "@/test/renderWithRouter";
import InternalLink from "./InternalLink";

describe("InternalLink", () => {
  test("renders as a link element", async () => {
    await renderWithRouter(<InternalLink to="/">Home</InternalLink>);

    const link = await screen.findByRole("link", { name: "Home" });
    expect(link.getAttribute("href")).toBe("/");
  });

  test("renders children content", async () => {
    await renderWithRouter(<InternalLink to="/pricing">About Us</InternalLink>);

    expect(await screen.findByText("About Us")).toBeDefined();
  });

  test("applies custom className", async () => {
    await renderWithRouter(
      <InternalLink to="/" className="custom-test-class">
        Custom Class
      </InternalLink>,
    );

    const link = await screen.findByRole("link");
    expect(link.classList.contains("custom-test-class")).toBe(true);
  });
});
