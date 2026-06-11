import type { AppearancePreferences } from "@gravity/application";
import {
  Bell,
  Boxes,
  KeyRound,
  Mail,
  RotateCcw,
  Settings,
  Users
} from "lucide-react";
import { useState } from "react";

import { SurfaceSwitcher } from "../../components/SurfaceSwitcher.js";
import { ThemePicker } from "../../components/ThemePicker.js";
import { useAuthState } from "../../composition/use-auth-state.js";
import type { AppSurface } from "../../lib/app-surface.js";

type SettingsSection =
  | "api-provider"
  | "features"
  | "notifications"
  | "mail"
  | "teams";

const settingsSections = [
  {
    description: "Conecta los modelos que usará Gravity.",
    icon: KeyRound,
    id: "api-provider",
    label: "Api provider",
    status: "Disponible"
  },
  {
    description: "Personaliza cómo se siente y se comporta Gravity.",
    icon: Boxes,
    id: "features",
    label: "Features",
    status: "Disponible"
  },
  {
    description: "Elige cómo Gravity llama tu atención.",
    icon: Bell,
    id: "notifications",
    label: "Notifications",
    status: "Próximamente"
  },
  {
    description: "Configura cuentas y entrega de correo.",
    icon: Mail,
    id: "mail",
    label: "Mail",
    status: "Próximamente"
  },
  {
    description: "Administra espacios compartidos y miembros.",
    icon: Users,
    id: "teams",
    label: "Teams",
    status: "Próximamente"
  }
] as const satisfies ReadonlyArray<{
  description: string;
  icon: typeof Settings;
  id: SettingsSection;
  label: string;
  status: "Disponible" | "Próximamente";
}>;

export function SettingsPage({
  activeSurface,
  appearance,
  initialSection = "api-provider",
  onSelectSurface
}: {
  activeSurface: AppSurface;
  appearance: {
    error: string | null;
    isHydrated: boolean;
    preferences: AppearancePreferences;
    preview: (preferences: AppearancePreferences) => void;
    reset: () => Promise<void>;
    save: (preferences: AppearancePreferences) => Promise<void>;
  };
  initialSection?: SettingsSection;
  onSelectSurface: (surface: AppSurface) => void;
}) {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(initialSection);
  const section = settingsSections.find(({ id }) => id === activeSection)!;

  return (
    <section className="settings-surface">
      <aside className="settings-sidebar">
        <SurfaceSwitcher
          activeSurface={activeSurface}
          onSelectSurface={onSelectSurface}
        />
        <div className="settings-sidebar-heading">
          <span>Configuración</span>
          <strong>Gravity</strong>
        </div>
        <nav aria-label="Secciones de configuración" className="settings-nav">
          {settingsSections.map((item, index) => {
            const Icon = item.icon;
            const isActive = item.id === activeSection;

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={`settings-nav-item ${isActive ? "is-active" : ""}`}
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                type="button"
              >
                <span className="settings-nav-index">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <Icon size={15} strokeWidth={1.7} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="settings-canvas">
        <header className="settings-header">
          <div>
            <span className="settings-eyebrow">{section.status}</span>
            <h1>{section.label}</h1>
          </div>
          <p>{section.description}</p>
        </header>

        {activeSection === "api-provider" ? (
          <ApiProviderSettings />
        ) : activeSection === "features" ? (
          <AppearanceSettings appearance={appearance} />
        ) : (
          <ComingSoonSection section={section} />
        )}
      </main>
    </section>
  );
}

function AppearanceSettings({
  appearance
}: {
  appearance: {
    error: string | null;
    isHydrated: boolean;
    preferences: AppearancePreferences;
    preview: (preferences: AppearancePreferences) => void;
    reset: () => Promise<void>;
    save: (preferences: AppearancePreferences) => Promise<void>;
  };
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
            <h2>Theme</h2>
          </div>
          <div>
            <span className="appearance-save-state">
              {appearance.isHydrated ? "Guardado en este equipo" : "Cargando"}
            </span>
            <button
              className="appearance-reset-button"
              disabled={!appearance.isHydrated}
              onClick={() => void appearance.reset()}
              type="button"
            >
              <RotateCcw size={13} />
              Restaurar
            </button>
          </div>
        </header>
        <p className="appearance-theme-description">
          Crea una paleta armónica o mueve cada color libremente. Los cambios se
          aplican en vivo a Gravity y se conservan al reiniciar la aplicación.
        </p>
        {appearance.isHydrated ? (
          <ThemePicker
            onChange={appearance.preview}
            onCommit={(preferences) => void appearance.save(preferences)}
            value={appearance.preferences}
          />
        ) : (
          <div className="appearance-loading">
            <strong>Cargando tema</strong>
            <span>Gravity está recuperando tus preferencias guardadas.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function ApiProviderSettings() {
  const {
    beginOAuthLogin,
    error,
    logout,
    saveApiKey,
    state,
    submitOAuthInput
  } = useAuthState();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [flowInput, setFlowInput] = useState("");
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  async function runProviderAction(
    providerId: string,
    action: () => Promise<unknown>
  ) {
    setBusyProviderId(providerId);
    await action();
    setBusyProviderId(null);
  }

  if (!state) {
    return (
      <div className="settings-state-card">
        <span className="settings-card-number">01</span>
        <div>
          <strong>Cargando proveedores</strong>
          <p>
            {error ??
              "Gravity está consultando las conexiones disponibles en este equipo."}
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
              <span>Inicio de sesión</span>
              <h2>{state.activeFlow.providerName}</h2>
            </div>
            <span className="provider-status">En curso</span>
          </div>
          {state.activeFlow.instructions ? (
            <p>{state.activeFlow.instructions}</p>
          ) : null}
          {state.activeFlow.authUrl ? (
            <a href={state.activeFlow.authUrl} rel="noreferrer" target="_blank">
              Abrir autorización
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
                <button type="submit">Continuar</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <div className="provider-grid">
        {state.providers.map((provider, index) => {
          const apiKey = apiKeys[provider.providerId] ?? "";
          const isBusy = busyProviderId === provider.providerId;

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
                  {provider.status.configured ? "Conectado" : "Sin configurar"}
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
                    void runProviderAction(provider.providerId, async () => {
                      const nextState = await saveApiKey(
                        provider.providerId,
                        apiKey
                      );
                      if (nextState) {
                        setApiKeys((current) => ({
                          ...current,
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
                        setApiKeys((current) => ({
                          ...current,
                          [provider.providerId]: event.target.value
                        }))
                      }
                      placeholder="Pega una nueva clave"
                      required
                      type="password"
                      value={apiKey}
                    />
                    <button disabled={isBusy} type="submit">
                      Guardar
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="provider-actions">
                {provider.supportsOAuth ? (
                  <button
                    disabled={isBusy || Boolean(state.activeFlow)}
                    onClick={() =>
                      void runProviderAction(provider.providerId, () =>
                        beginOAuthLogin(provider.providerId)
                      )
                    }
                    type="button"
                  >
                    Conectar con OAuth
                  </button>
                ) : null}
                {provider.status.configured ? (
                  <button
                    className="is-secondary"
                    disabled={isBusy}
                    onClick={() =>
                      void runProviderAction(provider.providerId, () =>
                        logout(provider.providerId)
                      )
                    }
                    type="button"
                  >
                    Desconectar
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

function ComingSoonSection({
  section
}: {
  section: (typeof settingsSections)[number];
}) {
  const Icon = section.icon;

  return (
    <section className="coming-soon-card">
      <span className="coming-soon-index">En preparación</span>
      <Icon size={34} strokeWidth={1.25} />
      <h2>{section.label}</h2>
      <p>
        Esta sección ya tiene un lugar estable en Configuración. Sus controles
        se habilitarán cuando la capacidad esté disponible.
      </p>
    </section>
  );
}
