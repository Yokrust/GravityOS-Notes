"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LoaderCircle, Sparkles, Trash2, X } from "lucide-react";

import {
  CUSTOM_SATELLITE_COLORS,
  type CustomSatelliteProposal,
  type CustomSatelliteProperty
} from "@gravity/domain";
import { useStore } from "@/lib/store";

import { CustomSatelliteFields } from "./satellites/CustomSatelliteFields";
import {
  CustomSatelliteIconView,
  customSatelliteColors
} from "./satellites/custom-satellite-visuals";

export function SatelliteCreator({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { confirmCustomSatellite } = useStore();
  const [description, setDescription] = useState("");
  const [proposal, setProposal] = useState<CustomSatelliteProposal | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setDescription("");
      setProposal(null);
      setError(null);
      setGenerating(false);
      setSaving(false);
    }
  }, [open]);

  const previewProperties = useMemo<CustomSatelliteProperty[]>(
    () =>
      proposal?.properties.map((property, index) => ({
        id: `preview-property-${index}`,
        ...property
      })) ?? [],
    [proposal]
  );

  if (!open || typeof document === "undefined") {
    return null;
  }

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      if (!window.gravity?.generateCustomSatellite) {
        throw new Error(
          "La generación de Satellites está disponible en la app de escritorio."
        );
      }
      setProposal(await window.gravity.generateCustomSatellite(description));
    } catch (generationError) {
      setError(errorMessage(generationError));
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!proposal) return;
    setSaving(true);
    setError(null);
    try {
      await confirmCustomSatellite(proposal);
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="satellite-creator-backdrop" role="presentation">
      <motion.section
        aria-label="Crear Satellite"
        aria-modal="true"
        className="satellite-creator"
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        role="dialog"
      >
        <header className="satellite-creator-header">
          <div>
            <span>CREATE SATELLITE</span>
            <h2>
              {proposal ? "Revisa la propuesta" : "Describe la herramienta"}
            </h2>
          </div>
          <button aria-label="Cerrar" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        {!proposal ? (
          <div className="satellite-creator-description-step">
            <label htmlFor="satellite-description">
              ¿Qué debe ayudarte a hacer este Satellite?
            </label>
            <textarea
              autoFocus
              id="satellite-description"
              maxLength={500}
              placeholder="Ejemplo: Quiero organizar los personajes de una novela."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="satellite-creator-description-meta">
              <span>{description.length}/500</span>
              <span>La IA no accede a tus Notes ni archivos.</span>
            </div>
            {error ? <p className="satellite-creator-error">{error}</p> : null}
            <button
              className="satellite-creator-primary"
              disabled={generating || !description.trim()}
              onClick={() => void generate()}
            >
              {generating ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Sparkles size={15} />
              )}
              {generating ? "Generando" : "Generar Satellite"}
            </button>
          </div>
        ) : (
          <div className="satellite-creator-review">
            <div className="satellite-creator-editor">
              <button
                className="satellite-creator-back"
                onClick={() => {
                  setProposal(null);
                  setError(null);
                }}
              >
                <ArrowLeft size={14} />
                Cambiar descripción
              </button>

              <label>
                <span>Nombre</span>
                <input
                  maxLength={50}
                  value={proposal.name}
                  onChange={(event) =>
                    setProposal({ ...proposal, name: event.target.value })
                  }
                />
              </label>

              <label>
                <span>Descripción</span>
                <textarea
                  maxLength={200}
                  rows={2}
                  value={proposal.description ?? ""}
                  onChange={(event) =>
                    setProposal({
                      ...proposal,
                      description: event.target.value
                    })
                  }
                />
              </label>

              <fieldset>
                <legend>Color</legend>
                <div className="satellite-creator-colors">
                  {CUSTOM_SATELLITE_COLORS.map((colorName) => (
                    <button
                      aria-label={colorName}
                      aria-pressed={proposal.color === colorName}
                      key={colorName}
                      onClick={() =>
                        setProposal({ ...proposal, color: colorName })
                      }
                      style={{
                        background: customSatelliteColors[colorName].accent
                      }}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="satellite-creator-properties">
                <div className="satellite-creator-section-title">
                  <span>Información</span>
                  <span>{proposal.properties.length}</span>
                </div>
                {proposal.properties.map((property, index) => (
                  <div
                    className="satellite-creator-property-row"
                    key={`${property.key}-${index}`}
                  >
                    <input
                      aria-label={`Nombre de ${property.label}`}
                      maxLength={50}
                      value={property.label}
                      onChange={(event) =>
                        setProposal({
                          ...proposal,
                          properties: proposal.properties.map(
                            (candidate, candidateIndex) =>
                              candidateIndex === index
                                ? {
                                    ...candidate,
                                    label: event.target.value
                                  }
                                : candidate
                          )
                        })
                      }
                    />
                    <span>{property.valueType}</span>
                    <button
                      aria-label={`Quitar ${property.label}`}
                      disabled={proposal.properties.length === 1}
                      onClick={() =>
                        setProposal({
                          ...proposal,
                          properties: proposal.properties.filter(
                            (_, candidateIndex) => candidateIndex !== index
                          )
                        })
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="satellite-creator-preview">
              <div className="satellite-creator-preview-card">
                <header>
                  <span
                    style={{
                      color: customSatelliteColors[proposal.color].accent
                    }}
                  >
                    <CustomSatelliteIconView icon={proposal.icon} size={14} />
                  </span>
                  <strong>{proposal.name || "Sin nombre"}</strong>
                </header>
                {proposal.description ? <p>{proposal.description}</p> : null}
                <CustomSatelliteFields
                  data={{}}
                  disabled
                  properties={previewProperties}
                />
              </div>
            </div>

            <footer className="satellite-creator-actions">
              {error ? (
                <p className="satellite-creator-error">{error}</p>
              ) : null}
              <button onClick={onClose}>Cancelar</button>
              <button
                className="satellite-creator-primary"
                disabled={saving || !proposal.name.trim()}
                onClick={() => void save()}
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : null}
                {saving ? "Guardando" : "Guardar Satellite"}
              </button>
            </footer>
          </div>
        )}
      </motion.section>
    </div>,
    document.body
  );
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "No se pudo crear el Satellite.";
  }

  return error.message.replace(
    /^Error invoking remote method '[^']+': Error:\s*/,
    ""
  );
}
