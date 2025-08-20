import { Vector3 } from "three";

// Ref: https://github.com/eukarya-inc/PLATEAU-VIEW/blob/cfcb4b6a444fc9695b4089c8224016d9650cf2b7/extension/src/shared/reearth/scene/Scene.tsx#L13
const debugSphericalHarmonicCoefficients: Vector3[] = [
  new Vector3(0.499745965003967, 0.499196201562881, 0.500154078006744), // L00, irradiance, pre-scaled base
  new Vector3(0.265826553106308, -0.266099184751511, 0.265922993421555), // L1-1, irradiance, pre-scaled base
  new Vector3(0.243236944079399, 0.266723394393921, -0.265380442142487), // L10, irradiance, pre-scaled base
  new Vector3(-0.266895800828934, 0.265416264533997, 0.266921550035477), // L11, irradiance, pre-scaled base
  new Vector3(0.000195000306121, -0.000644546060357, -0.000383183418307), // L2-2, irradiance, pre-scaled base
  new Vector3(-0.000396036746679, -0.000622032093816, 0.000262127199676), // L2-1, irradiance, pre-scaled base
  new Vector3(-0.000214280473301, 0.00004872302452, -0.000059724134189), // L20, irradiance, pre-scaled base
  new Vector3(0.000107143961941, -0.000126510843984, -0.000425444566645), // L21, irradiance, pre-scaled base
  new Vector3(-0.000069071611506, 0.000134039684781, -0.000119135256682), // L22, irradiance, pre-scaled base
];

// Ref: https://github.com/eukarya-inc/PLATEAU-VIEW/blob/cfcb4b6a444fc9695b4089c8224016d9650cf2b7/extension/src/prototypes/view/environments/MapEnvironment.tsx
const whiteSphericalHarmonicCoefficients: Vector3[] = [
  new Vector3(0.651181936264038, 0.651181936264038, 0.651181936264038), // L00, irradiance, pre-scaled base
  new Vector3(0.335859775543213, 0.335859775543213, 0.335859775543213), // L1-1, irradiance, pre-scaled base
  new Vector3(0.000000874592729, 0.000000874592729, 0.000000874592729), // L10, irradiance, pre-scaled base
  new Vector3(0.000000027729817, 0.000000027729817, 0.000000027729817), // L11, irradiance, pre-scaled base
  new Vector3(0.000000014838997, 0.000000014838997, 0.000000014838997), // L2-2, irradiance, pre-scaled base
  new Vector3(-0.000000005038311, -0.000000005038311, -0.000000005038311), // L2-1, irradiance, pre-scaled base
  new Vector3(0.000121221753943, 0.000121221753943, 0.000121221753943), // L20, irradiance, pre-scaled base
  new Vector3(0.000000282587223, 0.000000282587223, 0.000000282587223), // L21, irradiance, pre-scaled base
  new Vector3(0.000364663166692, 0.000364663166692, 0.000364663166692), // L22, irradiance, pre-scaled base
];

// Ref: https://github.com/eukarya-inc/PLATEAU-VIEW/blob/cfcb4b6a444fc9695b4089c8224016d9650cf2b7/extension/src/prototypes/view/environments/SatelliteEnvironment.tsx#L10
const satelliteSphericalHarmonicCoefficients: Vector3[] = [
  new Vector3(1.221931219100952, 1.266084671020508, 1.019550442695618),
  new Vector3(0.800345599651337, 0.841745376586914, 0.723761379718781),
  new Vector3(0.912390112876892, 0.922998011112213, 0.649103164672852),
  new Vector3(-0.843475937843323, -0.853787302970886, -0.601324439048767),
  new Vector3(-0.495116978883743, -0.5034259557724, -0.360104471445084),
  new Vector3(0.497776478528976, 0.507052302360535, 0.364346027374268),
  new Vector3(0.082192525267601, 0.082608506083488, 0.056836795061827),
  new Vector3(-0.925247848033905, -0.940086245536804, -0.678709805011749),
  new Vector3(0.114833705127239, 0.114355310797691, 0.067587599158287),
];

export const SH_COEFFICIENTS = {
  debug: debugSphericalHarmonicCoefficients,
  white: whiteSphericalHarmonicCoefficients,
  satellite: satelliteSphericalHarmonicCoefficients,
};
