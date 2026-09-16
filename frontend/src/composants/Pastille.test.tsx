import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pastille } from "./Pastille";

describe("Pastille", () => {
  it("annonce le statut aux lecteurs d'écran", () => {
    render(<Pastille statut="en_retard" />);

    expect(screen.getByRole("img", { name: /en retard/i })).toBeInTheDocument();
  });

  it("distingue chaque statut par un libellé propre", () => {
    const { rerender } = render(<Pastille statut="administree" />);
    expect(screen.getByRole("img", { name: /administrée/i })).toBeInTheDocument();

    rerender(<Pastille statut="a_venir" />);
    expect(screen.getByRole("img", { name: /à venir/i })).toBeInTheDocument();

    rerender(<Pastille statut="due" />);
    expect(screen.getByRole("img", { name: /^due$/i })).toBeInTheDocument();
  });
});
