export function findClosedCustomSatelliteInstance(
  instances: CustomSatelliteInstanceRecord[],
  customTypeId: string
): CustomSatelliteInstanceRecord | null {
  return (
    instances
      .filter(
        (instance) => instance.customTypeId === customTypeId && !instance.isOpen
      )
      .toSorted((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      )[0] ?? null
  );
}
