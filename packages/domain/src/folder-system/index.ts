export type CoreRole =
  | "map"
  | "context_source"
  | "work_area"
  | "output_area"
  | "policy_rules";

export interface RoleAssignment {
  path: string;
  role: CoreRole;
}

export interface Project {
  id: string;
  displayName: string;
  rootPath: string;
  roleAssignments: RoleAssignment[];
}

export function createProject(input: {
  id: string;
  displayName: string;
  rootPath: string;
  roleAssignments?: RoleAssignment[];
}): Project {
  return {
    id: input.id,
    displayName: input.displayName,
    rootPath: input.rootPath,
    roleAssignments: input.roleAssignments ?? []
  };
}
