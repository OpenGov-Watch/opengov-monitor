import html2canvas from "html2canvas";

/**
 * Export a chart element as PNG image with title and legend
 * @param element - The DOM element containing the chart
 * @param title - The title to render at the top
 * @param filename - The name for the downloaded file
 * @param width - Target width in pixels (default 1200)
 * @param height - Target height in pixels (default 800)
 */
export async function exportChartAsPNG(
  element: HTMLElement,
  title: string,
  filename: string,
  width = 1200,
  height = 800
): Promise<void> {
  try {
    // Create a temporary container for the export with title and chart
    const exportContainer = document.createElement("div");
    exportContainer.style.position = "fixed";
    exportContainer.style.left = "-9999px";
    exportContainer.style.top = "0";
    exportContainer.style.width = `${width}px`;
    exportContainer.style.height = `${height}px`;
    exportContainer.style.backgroundColor = "#ffffff";
    exportContainer.style.display = "flex";
    exportContainer.style.flexDirection = "column";
    exportContainer.style.padding = "24px";
    exportContainer.style.boxSizing = "border-box";

    // Create title element
    const titleElement = document.createElement("div");
    titleElement.textContent = title;
    titleElement.style.fontSize = "24px";
    titleElement.style.fontWeight = "600";
    titleElement.style.marginBottom = "16px";
    titleElement.style.color = "#000000";
    titleElement.style.textAlign = "center";

    // Clone the chart element
    const chartClone = element.cloneNode(true) as HTMLElement;
    chartClone.style.flex = "1";
    chartClone.style.minHeight = "0";
    chartClone.style.display = "flex";
    chartClone.style.flexDirection = "column";

    // Append elements to container
    exportContainer.appendChild(titleElement);
    exportContainer.appendChild(chartClone);
    document.body.appendChild(exportContainer);

    // Wait for any pending renders
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Capture the container
    const canvas = await html2canvas(exportContainer, {
      backgroundColor: "#ffffff",
      width: width,
      height: height,
      scale: 1,
      logging: false,
    });

    // Clean up
    document.body.removeChild(exportContainer);

    // Download the image
    canvas.toBlob((blob) => {
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
 * Copy a chart element as PNG image to clipboard with title and legend
 * @param element - The DOM element containing the chart
 * @param title - The title to render at the top
 * @param width - Target width in pixels (default 1200)
 * @param height - Target height in pixels (default 800)
 */
export async function copyChartToClipboard(
  element: HTMLElement,
  title: string,
  width = 1200,
  height = 800
): Promise<void> {
  try {
    // Create a temporary container for the export with title and chart
    const exportContainer = document.createElement("div");
    exportContainer.style.position = "fixed";
    exportContainer.style.left = "-9999px";
    exportContainer.style.top = "0";
    exportContainer.style.width = `${width}px`;
    exportContainer.style.height = `${height}px`;
    exportContainer.style.backgroundColor = "#ffffff";
    exportContainer.style.display = "flex";
    exportContainer.style.flexDirection = "column";
    exportContainer.style.padding = "24px";
    exportContainer.style.boxSizing = "border-box";

    // Create title element
    const titleElement = document.createElement("div");
    titleElement.textContent = title;
    titleElement.style.fontSize = "24px";
    titleElement.style.fontWeight = "600";
    titleElement.style.marginBottom = "16px";
    titleElement.style.color = "#000000";
    titleElement.style.textAlign = "center";

    // Clone the chart element
    const chartClone = element.cloneNode(true) as HTMLElement;
    chartClone.style.flex = "1";
    chartClone.style.minHeight = "0";
    chartClone.style.display = "flex";
    chartClone.style.flexDirection = "column";

    // Append elements to container
    exportContainer.appendChild(titleElement);
    exportContainer.appendChild(chartClone);
    document.body.appendChild(exportContainer);

    // Wait for any pending renders
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Capture the container
    const canvas = await html2canvas(exportContainer, {
      backgroundColor: "#ffffff",
      width: width,
      height: height,
      scale: 1,
      logging: false,
    });

    // Clean up
    document.body.removeChild(exportContainer);

    // Copy to clipboard
    canvas.toBlob(async (blob) => {
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
