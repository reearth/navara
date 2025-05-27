import { type CRSTypes, type CameraPositionByCRS } from "@navara/core";
import { EventHandler } from "@navara/core/src/eventHandler";
import { Core, CameraStatus, CameraStatusObj } from "@navara/engine";
import { PerspectiveCamera } from "three";

export type CameraEvent = {
  movestart: () => void;
  move: () => void;
  moveend: () => void;
  idle: () => void;
};

export class ThreeViewCamera extends EventHandler<CameraEvent> {
  private _camera: PerspectiveCamera;
  private _core: Core | undefined;
  private _statusObj: CameraStatusObj | undefined;

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

  get curStatus(): CameraStatusObj | undefined {
    return this._statusObj;
  }

  updateStatus() {
    this._statusObj = this._core?.getCameraStatusObj();
    if (!this._statusObj) {
      return;
    }

    switch (this._statusObj.status) {
      case CameraStatus.MoveStart:
        this.emit("movestart");
        break;
      case CameraStatus.Move:
        this.emit("move");
        break;
      case CameraStatus.MoveEnd:
        this.emit("moveend");
        break;
      case CameraStatus.Idle:
        this.emit("idle");
        break;
      default:
        break;
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
