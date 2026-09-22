import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { rendre } from "@/tests/utilitaires";
import { FICHES } from "@/tests/espace";
import { ExplicationVaccin } from "./ExplicationVaccin";

describe("ExplicationVaccin", () => {
  it("n'affiche rien sans description", () => {
    const { container } = rendre(<ExplicationVaccin fiche={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dit contre quoi le vaccin protège", () => {
    rendre(<ExplicationVaccin fiche={FICHES[0]} ouvert />);
    expect(screen.getByText(/protège contre la tuberculose/i)).toBeInTheDocument();
  });

  it("découpe la description en paragraphes", () => {
    rendre(<ExplicationVaccin fiche={FICHES[0]} ouvert />);
    expect(screen.getByText("Premier paragraphe du BCG.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraphe du BCG.")).toBeInTheDocument();
  });

  it("renvoie vers la fiche complète du vaccin", () => {
    rendre(<ExplicationVaccin fiche={FICHES[0]} ouvert />);
    expect(
      screen.getByRole("link", { name: /voir la fiche complète/i }),
    ).toHaveAttribute("href", "/vaccins?code=BCG");
  });
});
