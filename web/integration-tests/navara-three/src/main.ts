import ThreeView, {
  Color,
  geodeticToVector3,
  degreeToRadian,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navara/three";
import {
  ToneMappingMode,
  type SphereMeshLayer,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";

type LayerDescriptions = DefaultLayerDescriptions;

async function main() {
  // Create the view - this tests that the main export works
  const view = new ThreeView<LayerDescriptions>({});

  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);

  // Initialize the view - this tests WASM loading
  await view.init();

  // Set exposure
  view.toneMappingExposure = 10;

  view.atmosphere.date.setHours(12);

  // Add default atmosphere layers - tests layer system
  const effects = plugin.addDefaultPhotorealLayers();

  // Simplify by removing sky mesh (use aerial perspective for sky)
  effects.sky.delete();
  effects.aerialPerspective.update({
    aerialPerspective: {
      sky: true,
    },
  });

  effects.toneMapping.update({
    toneMapping: {
      mode: ToneMappingMode.REINHARD,
    },
  });

  // Add terrain layer - tests terrain system
  view.addLayer({
    type: "terrain",
    data: {
      url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 6,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  // Add tile layer - tests tile system
  view.addLayer({
    type: "tiles",
    data: {
      url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    },
    rasterTile: {
      color: new Color().setStyle("#ffffff"),
      maxZoom: 18,
      opacity: 1,
    },
  });

  // Add a rotating sphere mesh - tests mesh layer and geospatial API
  addRotatingSphere(view);

  // Log success message
  console.log("Navara integration test loaded successfully!");
  console.log(
    "If you can see the 3D globe with a rotating sphere, the library is working correctly.",
  );
}

/**
 * Add a sphere that rotates around the globe.
 * Tests: SphereMeshLayer, geodeticToVector3, LLE, degreeToRadian APIs
 */
function addRotatingSphere(view: ThreeView<LayerDescriptions>) {
  // Create a sphere mesh layer
  const sphereLayer = view.addLayer<SphereMeshLayer>({
    type: "mesh",
    sphere: {
      radius: 1,
      color: new Color().setHex(0xff6600), // Orange color
      emissiveColor: new Color().setHex(0x331100),
    },
    position: { x: 0, y: 0, z: 0 },
  });

  // Get the raw Three.js mesh for direct manipulation
  const sphere = sphereLayer.ref.raw;
  if (!sphere) {
    console.error("Failed to create sphere mesh");
    return;
  }

  // Set sphere size
  const sphereRadius = 200000; // 200km radius
  sphere.scale.set(sphereRadius, sphereRadius, sphereRadius);

  // Animation state
  let lng = 0;
  let lat = 0;
  let latDirection = 1;
  const lngSpeed = 0.5; // degrees per frame
  const latSpeed = 0.1; // degrees per frame
  const altitude = 500000; // 500km above surface

  // Animation loop
  const animate = () => {
    // Update longitude (0 to 360)
    lng += lngSpeed;
    if (lng >= 360) lng -= 360;
    if (lng < 0) lng += 360;

    // Update latitude (-60 to 60, bouncing)
    lat += latSpeed * latDirection;
    if (lat > 60) {
      lat = 60;
      latDirection = -1;
    } else if (lat < -60) {
      lat = -60;
      latDirection = 1;
    }

    // Convert geodetic coordinates to 3D position
    const position = geodeticToVector3({
      lat: degreeToRadian(lat),
      lng: degreeToRadian(lng),
      height: altitude,
    });

    // Update sphere position
    sphere.position.set(position.x, position.y, position.z);

    // Request re-render
    view.forceUpdate();

    // Continue animation
    requestAnimationFrame(animate);
  };

  // Start animation
  animate();

  console.log("Rotating sphere added - testing geospatial APIs");
}

main().catch(console.error);
