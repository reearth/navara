import type ThreeView from "@navara/three";
import {
  PMREMGenerator,
  EquirectangularReflectionMapping,
  type WebGLCubeRenderTarget,
} from "three";
import { LightProbeGenerator } from "three/examples/jsm/lights/LightProbeGenerator.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

export const run = async (view: ThreeView): Promise<void> => {
  const renderer = view.renderer;

  // Create file input element
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".exr";
  fileInput.style.position = "absolute";
  fileInput.style.top = "10px";
  fileInput.style.left = "10px";
  fileInput.style.zIndex = "1000";
  fileInput.style.padding = "10px";
  fileInput.style.backgroundColor = "white";
  fileInput.style.border = "1px solid #ccc";
  fileInput.style.borderRadius = "4px";

  // Create status div
  const statusDiv = document.createElement("div");
  statusDiv.style.position = "absolute";
  statusDiv.style.top = "60px";
  statusDiv.style.left = "10px";
  statusDiv.style.zIndex = "1000";
  statusDiv.style.padding = "10px";
  statusDiv.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  statusDiv.style.border = "1px solid #ccc";
  statusDiv.style.borderRadius = "4px";
  statusDiv.style.maxWidth = "400px";
  statusDiv.style.fontFamily = "monospace";
  statusDiv.style.fontSize = "12px";
  statusDiv.innerHTML =
    "Select an EXR file to generate spherical harmonic coefficients";

  // Create output textarea for coefficients
  const outputArea = document.createElement("textarea");
  outputArea.style.position = "absolute";
  outputArea.style.top = "100px";
  outputArea.style.left = "10px";
  outputArea.style.width = "400px";
  outputArea.style.height = "300px";
  outputArea.style.zIndex = "1000";
  outputArea.style.padding = "10px";
  outputArea.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  outputArea.style.border = "1px solid #ccc";
  outputArea.style.borderRadius = "4px";
  outputArea.style.fontFamily = "monospace";
  outputArea.style.fontSize = "11px";
  outputArea.readOnly = true;
  outputArea.placeholder =
    "Spherical harmonic coefficients will appear here...";

  // Add elements to DOM
  document.body.appendChild(fileInput);
  document.body.appendChild(statusDiv);
  document.body.appendChild(outputArea);

  // Create EXR loader
  const exrLoader = new EXRLoader();

  // Handle file selection
  fileInput.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      statusDiv.innerHTML = "No file selected";
      return;
    }

    statusDiv.innerHTML = `Processing: ${file.name}...`;
    outputArea.value = "";

    // Create object URL for the file
    const url = URL.createObjectURL(file);

    try {
      // Create PMREM Generator for environment map processing
      const pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();

      // Load EXR file and generate LightProbe
      exrLoader.load(
        url,
        async (texture) => {
          try {
            // Set mapping for equirectangular texture
            texture.mapping = EquirectangularReflectionMapping;

            statusDiv.innerHTML = `Converting ${file.name} to cube map...`;

            // Convert to cube map
            const renderTarget = pmremGenerator.fromEquirectangular(texture);

            // Generate LightProbe from cube render target
            const cubeRenderTarget =
              renderTarget as WebGLCubeRenderTarget;

            statusDiv.innerHTML = `Generating spherical harmonics for ${file.name}...`;

            const lightProbe = await LightProbeGenerator.fromCubeRenderTarget(
              renderer,
              cubeRenderTarget,
            );

            // Extract spherical harmonics coefficients
            const sh = lightProbe.sh;

            // Format output
            const coefficients = sh.coefficients;
            let output = `// Spherical Harmonic Coefficients for: ${file.name}\n`;
            output += "// " + "=".repeat(48) + "\n\n";

            // Create Vector3 array format
            output += "[\n";
            for (let i = 0; i < coefficients.length; i++) {
              const coefficient = coefficients[i];
              output += `  new Vector3(${coefficient.x}, ${coefficient.y}, ${coefficient.z})`;
              if (i < coefficients.length - 1) {
                output += ",";
              }
              output += "\n";
            }
            output += "]\n\n";

            // Also add readable format
            output += "// Detailed breakdown by band:\n";
            output += "// " + "-".repeat(48) + "\n";
            for (let i = 0; i < coefficients.length; i++) {
              const coefficient = coefficients[i];
              output += `// Band ${Math.floor(i / 9)}, Coefficient ${i % 9}: R=${coefficient.x}, G=${coefficient.y}, B=${coefficient.z}\n`;
            }

            // Log to console for easy copying
            console.log("Spherical Harmonic Coefficients:", sh);
            console.log("Raw coefficients array:", coefficients);

            // Create JSON representation for additional reference
            const jsonRepresentation = {
              filename: file.name,
              coefficients: coefficients.map((c) => ({
                r: c.x,
                g: c.y,
                b: c.z,
              })),
            };

            output += "\n// JSON Format:\n";
            output += "// " + "=".repeat(48) + "\n";
            output +=
              "// " +
              JSON.stringify(jsonRepresentation, null, 2).replace(
                /\n/g,
                "\n// ",
              );

            outputArea.value = output;
            statusDiv.innerHTML = `✓ Successfully generated SH coefficients for ${file.name}`;

            // Log formatted data to console
            console.log("JSON representation:", jsonRepresentation);

            // Cleanup
            texture.dispose();
            pmremGenerator.dispose();
            renderTarget.dispose();
          } catch (error) {
            console.error("Error processing texture:", error);
            statusDiv.innerHTML = `Error processing texture: ${error}`;
            outputArea.value = `Error: ${error}`;
          }
        },
        undefined,
        (error) => {
          console.error("Error loading EXR file:", error);
          statusDiv.innerHTML = `Error loading EXR file: ${error}`;
          outputArea.value = `Error: ${error}`;
        },
      );
    } catch (error) {
      console.error("Error:", error);
      statusDiv.innerHTML = `Error: ${error}`;
      outputArea.value = `Error: ${error}`;
    } finally {
      // Clean up object URL
      URL.revokeObjectURL(url);
    }
  });

  // Add copy button
  const copyButton = document.createElement("button");
  copyButton.textContent = "Copy to Clipboard";
  copyButton.style.position = "absolute";
  copyButton.style.top = "410px";
  copyButton.style.left = "10px";
  copyButton.style.zIndex = "1000";
  copyButton.style.padding = "8px 16px";
  copyButton.style.backgroundColor = "#4CAF50";
  copyButton.style.color = "white";
  copyButton.style.border = "none";
  copyButton.style.borderRadius = "4px";
  copyButton.style.cursor = "pointer";
  copyButton.style.fontSize = "14px";

  copyButton.addEventListener("click", () => {
    if (outputArea.value) {
      navigator.clipboard.writeText(outputArea.value).then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = "Copied!";
        setTimeout(() => {
          copyButton.textContent = originalText;
        }, 2000);
      });
    }
  });

  document.body.appendChild(copyButton);
};
