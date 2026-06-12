import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CustomSatelliteFields } from "../../src/renderer/components/satellites/CustomSatelliteFields.js";

describe("custom satellite fields", () => {
  it("visibly flags an unset required field", () => {
    const markup = renderFields(
      {
        id: "required-number",
        key: "number",
        label: "Number",
        required: true,
        valueType: "number"
      },
      { number: null }
    );

    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("Requerido");
  });

  it.each([
    ["shortText", "Text", "hello"],
    ["number", "Number", 42],
    ["date", "Date", "2026-06-12"],
    ["singleSelect", "Status", "One"],
    ["image", "Image", { imageId: "data:image/png;base64,a" }]
  ] as const)(
    "offers a clear action for an optional %s field",
    (valueType, label, value) => {
      const markup = renderFields(
        {
          id: `optional-${valueType}`,
          key: "value",
          label,
          ...(valueType === "singleSelect" ? { options: ["One", "Two"] } : {}),
          required: false,
          valueType
        },
        { value }
      );

      expect(markup).toContain(`aria-label="Limpiar ${label}"`);
    }
  );

  it("does not restore a default value after an optional field is cleared", () => {
    const markup = renderFields(
      {
        defaultValue: "Default",
        id: "optional-text",
        key: "text",
        label: "Text",
        required: false,
        valueType: "shortText"
      },
      { text: null }
    );

    expect(markup).toContain('value=""');
    expect(markup).not.toContain('value="Default"');
  });
});

function renderFields(
  property: CustomSatellitePropertyRecord,
  data: Record<string, SatelliteValueRecord>
): string {
  return renderToStaticMarkup(
    createElement(CustomSatelliteFields, {
      data,
      onChange: () => {},
      onCommit: () => {},
      properties: [property]
    })
  );
}
