import html2canvas from "html2canvas";

/**
 * Export a chart element as PNG image
 * @param element - The DOM element to export
 * @param filename - The name for the downloaded file
 * @param width - Target width in pixels (default 1200)
 * @param height - Target height in pixels (default 800)
 */
export async function exportChartAsPNG(
  element: HTMLElement,
  filename: string,
  width = 1200,
  height = 800
): Promise<void> {
  try {
    // Calculate scale to achieve target dimensions while maintaining aspect ratio
    const rect = element.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const scale = Math.min(scaleX, scaleY);

    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: scale,
      width: rect.width,
      height: rect.height,
      logging: false,
    });

    // Create a new canvas with exact dimensions
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = width;
    finalCanvas.height = height;
    const ctx = finalCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    // Fill background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Center the chart in the target dimensions
    const scaledWidth = rect.width * scale;
    const scaledHeight = rect.height * scale;
    const x = (width - scaledWidth) / 2;
    const y = (height - scaledHeight) / 2;

    ctx.drawImage(canvas, x, y, scaledWidth, scaledHeight);

    // Download the image
    finalCanvas.toBlob((blob) => {
      if (!blob) {
        throw new Error("Failed to create image blob");
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    console.error("Failed to export chart:", error);
    throw error;
  }
}

/**
 * Copy a chart element as PNG image to clipboard
 * @param element - The DOM element to copy
 * @param width - Target width in pixels (default 1200)
 * @param height - Target height in pixels (default 800)
 */
export async function copyChartToClipboard(
  element: HTMLElement,
  width = 1200,
  height = 800
): Promise<void> {
  try {
    // Calculate scale to achieve target dimensions while maintaining aspect ratio
    const rect = element.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const scale = Math.min(scaleX, scaleY);

    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: scale,
      width: rect.width,
      height: rect.height,
      logging: false,
    });

    // Create a new canvas with exact dimensions
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = width;
    finalCanvas.height = height;
    const ctx = finalCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    // Fill background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Center the chart in the target dimensions
    const scaledWidth = rect.width * scale;
    const scaledHeight = rect.height * scale;
    const x = (width - scaledWidth) / 2;
    const y = (height - scaledHeight) / 2;

    ctx.drawImage(canvas, x, y, scaledWidth, scaledHeight);

    // Copy to clipboard
    finalCanvas.toBlob(async (blob) => {
      if (!blob) {
        throw new Error("Failed to create image blob");
      }

      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error("Clipboard API not supported");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
    });
  } catch (error) {
    console.error("Failed to copy chart to clipboard:", error);
    throw error;
  }
}
