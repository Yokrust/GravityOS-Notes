export class EditorSurfaceService {
  getInitialDocumentState(path: string): { path: string; isDirty: boolean } {
    return {
      path,
      isDirty: false
    };
  }
}
