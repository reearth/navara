import type { BillboardMesh, RenderableFeature } from "navara";
import { Mesh, Sprite, SpriteMaterial, TextureLoader } from "three";

export function renderFeature(f: RenderableFeature): (Mesh | Sprite) | undefined {
    if(f.billboard) {
        return renderBillboard(f.billboard);
    }
}

function renderBillboard(m: BillboardMesh) {
    const map = new TextureLoader().load( m.material.url );
    const material = new SpriteMaterial({ map: map, color: m.material.color, sizeAttenuation: false });
    const sprite = new Sprite(material);
    sprite.center.set(m.material.center.x, m.material.center.y);

    return sprite;
}
