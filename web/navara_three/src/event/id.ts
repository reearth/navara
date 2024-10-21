import type { EntityEvent } from "navara";

export function generate_id_from_entity(entity: EntityEvent) {
  return `${entity.ind}_${entity.gen}`;
}

export function to_globe_depth_id(id: string) {
  return `${id}_globe_depth`;
}

export function to_draped_feature_id(id: string) {
  return `${id}_draped_feature`;
}
