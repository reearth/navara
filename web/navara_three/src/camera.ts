import { type CRSTypes, type CameraPositionByCRS } from "@navara/core";
import { EventHandler } from "@navara/core/src/eventHandler";
import { Core, CameraStatus, CameraStatusType } from "@navara/engine";
import { PerspectiveCamera } from "three";

export type CameraEvent = {
  movestart: () => void;
  move: () => void;
  moveend: () => void;
  change: () => void;
  lookat: () => void;
  rotate: () => void;
};

export class ThreeViewCamera extends EventHandler<CameraEvent> {
  private _camera: PerspectiveCamera;
  private _core: Core | undefined;
  private _status: CameraStatus | undefined;

  constructor(cam: PerspectiveCamera);
  constructor(fov: number, aspect: number, near: number, far: number);

  constructor(
    camOrFov?: PerspectiveCamera | number,
    aspect?: number,
    near?: number,
    far?: number,
  ) {
    super();
    if (camOrFov instanceof PerspectiveCamera) {
      this._camera = camOrFov;
    } else {
      this._camera = new PerspectiveCamera(camOrFov, aspect, near, far);
    }
  }

  get innerCam(): PerspectiveCamera {
    return this._camera;
  }

  set core(core: Core | undefined) {
    this._core = core;
  }

  updateStatus() {
    this._status = this._core?.getCameraStatus();
    if (!this._status) {
      return;
    }

    for (const val of this._status.status) {
      switch (val) {
        case CameraStatusType.Change:
          this.emit("change");
          break;
        case CameraStatusType.LookAt:
          this.emit("lookat");
          break;
        case CameraStatusType.Rotate:
          this.emit("rotate");
          break;
        case CameraStatusType.MoveStart:
          this.emit("movestart");
          break;
        case CameraStatusType.Moving:
          this.emit("move");
          break;
        case CameraStatusType.MoveEnd:
          this.emit("moveend");
          break;
        default:
          break;
      }
    }
  }

  getPosition<CRS extends CRSTypes = "geographic">(
    crs: CRS = "geographic" as CRS,
  ): CameraPositionByCRS<CRS> | undefined {
    const orient = this._core?.getCameraOrientation();
    if (!orient) {
      return undefined;
    }

    if (crs === "geographic") {
      const pos = this._core?.getCameraPositionLLE();
      if (pos) {
        return {
          lng: pos[0],
          lat: pos[1],
          height: pos[2],
          pitch: orient.pitch,
          heading: orient.heading,
          roll: orient.roll,
        } as CameraPositionByCRS<CRS>;
      }
    } else if (crs === "ecef") {
      const pos = this._core?.getCameraPositionECEF();
      if (pos) {
        return {
          x: pos[0],
          y: pos[1],
          z: pos[2],
          pitch: orient.pitch,
          heading: orient.heading,
          roll: orient.roll,
        } as CameraPositionByCRS<CRS>;
      }
    }

    return undefined;
  }
}
