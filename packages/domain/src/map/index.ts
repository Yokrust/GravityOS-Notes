export interface MapDocument {
  path: string;
  isRoot: boolean;
}

export interface MapState {
  status: "present" | "missing";
  rootMapPath: string | null;
}

export function createMapState(input: {
  hasRootMap: boolean;
  rootMapPath: string;
}): MapState {
  return {
    status: input.hasRootMap ? "present" : "missing",
    rootMapPath: input.hasRootMap ? input.rootMapPath : null
  };
}

export function createMapDocument(input: {
  path: string;
  isRoot: boolean;
}): MapDocument {
  return {
    path: input.path,
    isRoot: input.isRoot
  };
}
