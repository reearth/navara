import type { EntityEvent } from "@navara/engine";

export function generate_id_from_entity(entity: EntityEvent) {
  return `${entity.ind}_${entity.gen}`;
}

export function to_globe_id(id: string) {
  return `${id}_globe`;
}

export function to_draped_feature_id(id: string) {
  return `${id}_draped_feature`;
}

export function isEntityEvent(v: unknown): v is EntityEvent {
  return !!v && typeof v === "object" && "ind" in v && "gen" in v;
}
