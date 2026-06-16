import { describe, expect, it } from "vitest";

import {
  correctSpanishText,
  correctSpanishWord,
  correctWordBeforeIndex
} from "../../src/renderer/lib/spanish-accents.js";

describe("correctSpanishWord", () => {
  it("adds the missing accent to known words", () => {
    expect(correctSpanishWord("rapido")).toBe("rápido");
    expect(correctSpanishWord("informacion")).toBe("información");
    expect(correctSpanishWord("tambien")).toBe("también");
  });

  it("covers a broad lexicon of common words", () => {
    const cases: Record<string, string> = {
      telefono: "teléfono",
      corazon: "corazón",
      arbol: "árbol",
      lapiz: "lápiz",
      jardin: "jardín",
      energia: "energía",
      economia: "economía",
      sabado: "sábado",
      quimica: "química",
      pajaro: "pájaro",
      kilometro: "kilómetro",
      musica: "música",
      pagina: "página",
      medico: "médico",
      numero: "número",
      genero: "género",
      titulo: "título"
    };
    for (const [bare, accented] of Object.entries(cases)) {
      expect(correctSpanishWord(bare)).toBe(accented);
    }
  });

  it("handles -ción / -sión nouns by rule", () => {
    expect(correctSpanishWord("navegacion")).toBe("navegación");
    expect(correctSpanishWord("version")).toBe("versión");
    expect(correctSpanishWord("television")).toBe("televisión");
    expect(correctSpanishWord("decision")).toBe("decisión");
    expect(correctSpanishWord("opcion")).toBe("opción");
  });

  it("handles superlatives, adverbs, feminines and plurals by rule", () => {
    expect(correctSpanishWord("rapidisimo")).toBe("rapidísimo");
    expect(correctSpanishWord("buenisimo")).toBe("buenísimo");
    expect(correctSpanishWord("rapidamente")).toBe("rápidamente");
    expect(correctSpanishWord("facilmente")).toBe("fácilmente");
    expect(correctSpanishWord("medica")).toBe("médica");
    expect(correctSpanishWord("rapida")).toBe("rápida");
    expect(correctSpanishWord("paginas")).toBe("páginas");
    expect(correctSpanishWord("medicos")).toBe("médicos");
    expect(correctSpanishWord("rapidas")).toBe("rápidas");
  });

  it("preserves the original casing", () => {
    expect(correctSpanishWord("Tambien")).toBe("También");
    expect(correctSpanishWord("RAPIDO")).toBe("RÁPIDO");
    expect(correctSpanishWord("Mexico")).toBe("México");
  });

  it("leaves already-accented words untouched", () => {
    expect(correctSpanishWord("rápido")).toBe("rápido");
    expect(correctSpanishWord("información")).toBe("información");
  });

  it("never touches ambiguous homographs", () => {
    // The unaccented form is a valid, different Spanish word, so these must
    // never be auto-accented.
    const untouched = [
      "esta",
      "este",
      "esto",
      "el",
      "tu",
      "si",
      "mas",
      "solo",
      "como",
      "cuando",
      "donde",
      "hacia",
      "seria",
      "varia",
      "tenia",
      "publico",
      "practica",
      "para",
      "casa",
      "cosa",
      "mira",
      "cara"
    ];
    for (const word of untouched) {
      expect(correctSpanishWord(word)).toBe(word);
    }
  });

  it("leaves unknown words and other languages unchanged", () => {
    expect(correctSpanishWord("perro")).toBe("perro");
    expect(correctSpanishWord("hello")).toBe("hello");
    expect(correctSpanishWord("information")).toBe("information");
  });

  it("never changes a word's length", () => {
    for (const word of [
      "informacion",
      "rapidisimo",
      "rapidamente",
      "paginas",
      "medica",
      "corazon"
    ]) {
      expect(correctSpanishWord(word)).toHaveLength(word.length);
    }
  });
});

describe("correctSpanishText", () => {
  it("corrects every completed word in a sentence", () => {
    expect(correctSpanishText("rapido y facil")).toBe("rápido y fácil");
  });

  it("corrects a realistic mixed sentence", () => {
    expect(
      correctSpanishText("la informacion del telefono es rapidisima")
    ).toBe("la información del teléfono es rapidísima");
  });

  it("keeps punctuation and spacing intact", () => {
    expect(correctSpanishText("¡musica, por favor!")).toBe(
      "¡música, por favor!"
    );
  });

  it("does not rewrite words inside URLs", () => {
    const input = "mira https://example.com/informacion aqui";
    expect(correctSpanishText(input)).toBe(
      "mira https://example.com/informacion aquí"
    );
  });

  it("does not rewrite words inside inline code", () => {
    expect(correctSpanishText("usa `informacion` aqui")).toBe(
      "usa `informacion` aquí"
    );
  });

  it("preserves real digits when restoring protected spans", () => {
    expect(correctSpanishText("ver https://x.com 2024 informacion")).toBe(
      "ver https://x.com 2024 información"
    );
  });
});

describe("correctWordBeforeIndex", () => {
  it("corrects the word ending just before the boundary", () => {
    expect(correctWordBeforeIndex("rapido ", 6)).toBe("rápido ");
  });

  it("preserves length so the caret stays valid", () => {
    const corrected = correctWordBeforeIndex("escribo musica ", 14);
    expect(corrected).toBe("escribo música ");
    expect(corrected).toHaveLength("escribo musica ".length);
  });
});
