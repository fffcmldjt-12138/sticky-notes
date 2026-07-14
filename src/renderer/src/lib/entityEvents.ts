export function acceptNewer<T extends { id: string; revision: number }>(
  current: T | undefined,
  incoming: T
): T {
  return !current || incoming.revision > current.revision ? incoming : current
}

export function upsertNewer<T extends { id: string; revision: number }>(
  entities: T[],
  incoming: T
): T[] {
  const index = entities.findIndex((entity) => entity.id === incoming.id)
  if (index < 0) return [incoming, ...entities]
  if (entities[index].revision >= incoming.revision) return entities
  return entities.map((entity, candidate) =>
    candidate === index ? incoming : entity
  )
}
