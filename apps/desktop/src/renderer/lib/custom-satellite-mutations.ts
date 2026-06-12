interface CustomSatelliteMutationCoordinatorOptions {
  loadState: () => Promise<CustomSatelliteStateRecord>;
  onError: (instanceId: string, message: string) => void;
  onReconcile: (
    instanceId: string,
    instance: CustomSatelliteInstanceRecord | null
  ) => void;
}

interface MutationState {
  generation: number;
  pending: number;
  recoveryNeeded: boolean;
}

export class CustomSatelliteMutationCoordinator {
  private readonly mutations = new Map<string, MutationState>();

  constructor(
    private readonly options: CustomSatelliteMutationCoordinatorOptions
  ) {}

  async run(
    instanceId: string,
    mutation: () => Promise<unknown>
  ): Promise<void> {
    const state = this.getState(instanceId);
    state.generation += 1;
    state.pending += 1;

    try {
      await mutation();
    } catch (error: unknown) {
      state.recoveryNeeded = true;
      this.options.onError(instanceId, describeMutationError(error));
    } finally {
      state.pending -= 1;
    }

    await this.reconcileIfIdle(instanceId, state);
  }

  private getState(instanceId: string): MutationState {
    const existing = this.mutations.get(instanceId);
    if (existing) {
      return existing;
    }

    const state: MutationState = {
      generation: 0,
      pending: 0,
      recoveryNeeded: false
    };
    this.mutations.set(instanceId, state);
    return state;
  }

  private async reconcileIfIdle(
    instanceId: string,
    state: MutationState
  ): Promise<void> {
    if (state.pending > 0 || !state.recoveryNeeded) {
      return;
    }

    const recoveryGeneration = state.generation;
    let authoritativeState: CustomSatelliteStateRecord;
    try {
      authoritativeState = await this.options.loadState();
    } catch (error: unknown) {
      this.options.onError(instanceId, describeMutationError(error));
      return;
    }
    if (
      state.pending > 0 ||
      state.generation !== recoveryGeneration ||
      !state.recoveryNeeded
    ) {
      return;
    }

    state.recoveryNeeded = false;
    this.options.onReconcile(
      instanceId,
      authoritativeState.instances.find(
        (instance) => instance.id === instanceId
      ) ?? null
    );
  }
}

function describeMutationError(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': Error:\s*/,
        ""
      )
    : "No se pudo guardar el Satellite.";
}
