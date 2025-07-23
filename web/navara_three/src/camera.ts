import { type CRSTypes, type CameraPositionByCRS } from "@navara/core";
import { EventHandler } from "@navara/core/src/eventHandler";
import { Core, CameraStatus, CameraStatusType } from "@navara/engine";
import { PerspectiveCamera } from "three";

export type CameraEvent = {
  movestart: () => void;
  move: () => void;
  moveend: () => void;
  frustumChanged: () => void;
};

export class ThreeViewCamera extends EventHandler<CameraEvent> {
  private _camera: PerspectiveCamera;
  private _core: Core | undefined;
  private _status: CameraStatus | undefined;

  constructor(cam?: PerspectiveCamera) {
    super();
    if (cam instanceof PerspectiveCamera) {
      this._camera = cam;
    } else {
      this._camera = new PerspectiveCamera();
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
        case CameraStatusType.MoveStart:
          this.emit("movestart");
          break;
        case CameraStatusType.Moving:
          this.emit("move");
          break;
        case CameraStatusType.MoveEnd:
        case CameraStatusType.LookAt:
        case CameraStatusType.Rotate:
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

  set fov(val: number) {
    if (val < 1 || val > 180) {
      return;
    }

    this._core?.setFrustum(val, undefined, undefined);
  }

  set near(val: number) {
    if (val <= 0) {
      return;
    }

    this._core?.setFrustum(undefined, val, undefined);
  }

  set far(val: number) {
    if (val <= this._camera.near) {
      return;
    }

    this._core?.setFrustum(undefined, undefined, val);
  }
}
