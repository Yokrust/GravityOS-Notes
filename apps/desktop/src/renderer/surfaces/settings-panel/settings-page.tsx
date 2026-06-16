import { useState } from "react";
import {
  Bell,
  Check,
  Cpu,
  Languages,
  Mail,
  RotateCcw,
  SlidersHorizontal,
  Users,
  type LucideIcon
} from "lucide-react";

import { SurfaceSwitcher } from "../../components/SurfaceSwitcher.js";
import { ThemePicker } from "../../components/ThemePicker.js";
import { useAuthState } from "../../composition/use-auth-state.js";
import type { AppearancePreferencesController } from "../../composition/use-appearance-preferences.js";
import type { AppSurface } from "../../lib/app-surface.js";
import {
  getLanguage,
  LANGUAGES,
  setLanguage,
  t,
  type Language
} from "../../lib/i18n.js";

type SettingsSectionId =
  | "api-provider"
  | "features"
  | "notifications"
  | "mail"
  | "teams";

interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  status: string;
  icon: LucideIcon;
}

const SECTIONS: SettingsSection[] = [
  {
    description: t("Conecta los modelos que usará Gravity."),
    icon: Cpu,
    id: "api-provider",
    label: t("Api provider"),
    status: t("Disponible")
  },
  {
    description: t("Personaliza cómo se siente y se comporta Gravity."),
    icon: SlidersHorizontal,
    id: "features",
    label: "Features",
    status: t("Disponible")
  },
  {
    description: t("Elige cómo Gravity llama tu atención."),
    icon: Bell,
    id: "notifications",
    label: "Notifications",
    status: t("Próximamente")
  },
  {
    description: t("Configura cuentas y entrega de correo."),
    icon: Mail,
    id: "mail",
    label: "Mail",
    status: t("Próximamente")
  },
  {
    description: t("Administra espacios compartidos y miembros."),
    icon: Users,
    id: "teams",
    label: "Teams",
    status: t("Próximamente")
  }
];

export function SettingsPage({
  activeSurface,
  appearance,
  initialSection = "api-provider",
  onSelectSurface
}: {
  activeSurface: AppSurface;
  appearance: AppearancePreferencesController;
  initialSection?: SettingsSectionId;
  onSelectSurface: (surface: AppSurface) => void;
}) {
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>(initialSection);
  const section =
    SECTIONS.find(({ id }) => id === activeSection) ?? SECTIONS[0]!;

  return (
    <section className="settings-surface">
      <aside className="settings-sidebar">
        <div className="notes-sidebar-navigation">
          <SurfaceSwitcher
            activeSurface={activeSurface}
            onSelectSurface={onSelectSurface}
          />
        </div>
        <div className="settings-sidebar-heading">
          <span>{t("Configuración")}</span>
          <strong>Gravity</strong>
        </div>
        <nav
          aria-label={t("Secciones de configuración")}
          className="settings-nav scroll-thin"
        >
          {SECTIONS.map((entry, index) => {
            const Icon = entry.icon;
            const isActive = entry.id === activeSection;
            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={`settings-nav-item ${isActive ? "is-active" : ""}`}
                key={entry.id}
                onClick={() => setActiveSection(entry.id)}
                type="button"
              >
                <span className="settings-nav-index">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <Icon size={15} strokeWidth={1.7} />
                <span>{entry.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="settings-canvas scroll-thin">
        <header className="settings-header">
          <div>
            <span className="settings-eyebrow">{section.status}</span>
            <h1>{section.label}</h1>
          </div>
          <p>{section.description}</p>
        </header>

        {activeSection === "api-provider" ? (
          <ProviderSettings />
        ) : activeSection === "features" ? (
          <FeaturesSettings appearance={appearance} />
        ) : (
          <ComingSoonSection section={section} />
        )}
      </main>
    </section>
  );
}

function FeaturesSettings({
  appearance
}: {
  appearance: AppearancePreferencesController;
}) {
  return (
    <div className="appearance-settings">
      {appearance.error ? (
        <div className="settings-error">{appearance.error}</div>
      ) : null}
      <section className="appearance-theme-card">
        <header className="appearance-theme-heading">
          <div>
            <span>Appearance</span>
            <h2>{t("Ambiente")}</h2>
          </div>
          <div>
            <span className="appearance-save-state">
              {appearance.isHydrated
                ? t("Guardado en este equipo")
                : t("Cargando")}
            </span>
            <button
              className="appearance-reset-button"
              disabled={!appearance.isHydrated}
              onClick={() => {
                void appearance.reset();
              }}
              type="button"
            >
              <RotateCcw size={13} />
              {t("Restaurar")}
            </button>
          </div>
        </header>
        <p className="appearance-theme-description">
          {t(
            "Crea una paleta armónica o mueve cada color libremente. Los cambios se aplican en vivo a Gravity y se conservan al reiniciar la aplicación."
          )}
        </p>
        {appearance.isHydrated ? (
          <ThemePicker
            onChange={appearance.preview}
            onCommit={(preferences) => {
              void appearance.save(preferences);
            }}
            onSchemeSelect={appearance.selectScheme}
            value={appearance.preferences}
          />
        ) : (
          <div className="appearance-loading">
            <strong>{t("Cargando ambiente")}</strong>
            <span>
              {t("Gravity está recuperando tus preferencias guardadas.")}
            </span>
          </div>
        )}
      </section>

      <LanguageSettings />
    </div>
  );
}

function LanguageSettings() {
  const active = getLanguage();
  return (
    <section className="appearance-theme-card language-card">
      <header className="appearance-theme-heading">
        <div>
          <span>Appearance</span>
          <h2>{t("Idioma")}</h2>
        </div>
      </header>
      <p className="appearance-theme-description">
        {t("Elige el idioma de toda la aplicación.")}{" "}
        {t("La aplicación se reiniciará para aplicar el idioma.")}
      </p>
      <div
        className="language-options"
        role="radiogroup"
        aria-label={t("Idioma")}
      >
        {LANGUAGES.map(({ id, label }) => {
          const isActive = id === active;
          return (
            <button
              aria-checked={isActive}
              className={`language-option ${isActive ? "is-active" : ""}`}
              key={id}
              onClick={() => selectAppLanguage(id)}
              role="radio"
              type="button"
            >
              <span className="language-option-flag" aria-hidden="true">
                <Languages size={15} strokeWidth={1.7} />
              </span>
              <span className="language-option-label">{label}</span>
              {isActive ? <Check size={15} strokeWidth={2} /> : null}
            </button>
          );
        })}
      </div>
      <p className="language-hint">
        {t(
          "En español, Gravity corrige automáticamente los acentos mientras escribes tus notas."
        )}
      </p>
    </section>
  );
}

function selectAppLanguage(next: Language) {
  // Persisting reloads the renderer so every surface re-renders in the chosen
  // language at once.
  setLanguage(next);
}

function ProviderSettings() {
  const {
    beginOAuthLogin,
    error,
    logout,
    saveApiKey,
    state,
    submitOAuthInput
  } = useAuthState();
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [flowInput, setFlowInput] = useState("");
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  async function run(providerId: string, action: () => Promise<unknown>) {
    setBusyProviderId(providerId);
    await action();
    setBusyProviderId(null);
  }

  if (!state) {
    return (
      <div className="settings-state-card">
        <span className="settings-card-number">01</span>
        <div>
          <strong>{t("Cargando proveedores")}</strong>
          <p>
            {error ??
              t(
                "Gravity está consultando las conexiones disponibles en este equipo."
              )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-settings">
      {error ? <div className="settings-error">{error}</div> : null}

      {state.activeFlow ? (
        <section className="oauth-flow-card">
          <div className="provider-card-heading">
            <div>
              <span>{t("Inicio de sesión")}</span>
              <h2>{state.activeFlow.providerName}</h2>
            </div>
            <span className="provider-status">{t("En curso")}</span>
          </div>
          {state.activeFlow.instructions ? (
            <p>{state.activeFlow.instructions}</p>
          ) : null}
          {state.activeFlow.authUrl ? (
            <a href={state.activeFlow.authUrl} rel="noreferrer" target="_blank">
              {t("Abrir autorización")}
            </a>
          ) : null}
          {state.activeFlow.progressMessage ? (
            <p>{state.activeFlow.progressMessage}</p>
          ) : null}
          {state.activeFlow.errorMessage ? (
            <div className="settings-error">
              {state.activeFlow.errorMessage}
            </div>
          ) : null}
          {state.activeFlow.prompt ? (
            <form
              className="oauth-prompt"
              onSubmit={(event) => {
                event.preventDefault();
                void submitOAuthInput(state.activeFlow!.flowId, flowInput).then(
                  () => setFlowInput("")
                );
              }}
            >
              <label htmlFor="oauth-flow-input">
                {state.activeFlow.prompt.message}
              </label>
              <div>
                <input
                  id="oauth-flow-input"
                  onChange={(event) => setFlowInput(event.target.value)}
                  placeholder={state.activeFlow.prompt.placeholder}
                  required={!state.activeFlow.prompt.allowEmpty}
                  value={flowInput}
                />
                <button type="submit">{t("Continuar")}</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <div className="provider-grid">
        {state.providers.map((provider, index) => {
          const draft = draftKeys[provider.providerId] ?? "";
          const busy = busyProviderId === provider.providerId;
          return (
            <section className="provider-card" key={provider.providerId}>
              <div className="provider-card-heading">
                <div>
                  <span>
                    {(index + 1).toString().padStart(2, "0")} / Provider
                  </span>
                  <h2>{provider.displayName}</h2>
                </div>
                <span
                  className={`provider-status ${
                    provider.status.configured ? "is-configured" : ""
                  }`}
                >
                  {provider.status.configured
                    ? t("Conectado")
                    : t("Sin configurar")}
                </span>
              </div>
              {provider.status.label ? (
                <p className="provider-detail">{provider.status.label}</p>
              ) : null}
              {provider.supportsApiKey ? (
                <form
                  className="provider-api-key"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(provider.providerId, async () => {
                      const saved = await saveApiKey(
                        provider.providerId,
                        draft
                      );
                      if (saved) {
                        setDraftKeys((previous) => ({
                          ...previous,
                          [provider.providerId]: ""
                        }));
                      }
                    });
                  }}
                >
                  <label htmlFor={`api-key-${provider.providerId}`}>
                    API key
                  </label>
                  <div>
                    <input
                      autoComplete="off"
                      id={`api-key-${provider.providerId}`}
                      onChange={(event) =>
                        setDraftKeys((previous) => ({
                          ...previous,
                          [provider.providerId]: event.target.value
                        }))
                      }
                      placeholder={t("Pega una nueva clave")}
                      required
                      type="password"
                      value={draft}
                    />
                    <button disabled={busy} type="submit">
                      {t("Guardar")}
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="provider-actions">
                {provider.supportsOAuth ? (
                  <button
                    disabled={busy || Boolean(state.activeFlow)}
                    onClick={() => {
                      void run(provider.providerId, () =>
                        beginOAuthLogin(provider.providerId)
                      );
                    }}
                    type="button"
                  >
                    {t("Conectar con OAuth")}
                  </button>
                ) : null}
                {provider.status.configured ? (
                  <button
                    className="is-secondary"
                    disabled={busy}
                    onClick={() => {
                      void run(provider.providerId, () =>
                        logout(provider.providerId)
                      );
                    }}
                    type="button"
                  >
                    {t("Desconectar")}
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ComingSoonSection({ section }: { section: SettingsSection }) {
  const Icon = section.icon;
  return (
    <section className="coming-soon-card">
      <span className="coming-soon-index">{t("En preparación")}</span>
      <Icon size={34} strokeWidth={1.25} />
      <h2>{section.label}</h2>
      <p>
        {t(
          "Esta sección ya tiene un lugar estable en Configuración. Sus controles se habilitarán cuando la capacidad esté disponible."
        )}
      </p>
    </section>
  );
}
