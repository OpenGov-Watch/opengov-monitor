import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";

/**
 * Export a chart as PNG image with title and legend on right side
 * @param renderChart - A callback that renders the chart component with legendPosition="right"
 * @param title - The title to render at the top
 * @param filename - The name for the downloaded file
 * @param width - Target width in pixels (default 1200)
 * @param height - Target height in pixels (default 800)
 */
export async function exportChartAsPNG(
  renderChart: () => ReactNode,
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
    exportContainer.style.padding = "16px 24px 24px 24px"; // 0.5rem less at top
    exportContainer.style.boxSizing = "border-box";

    // Create title element
    const titleElement = document.createElement("div");
    titleElement.textContent = title;
    titleElement.style.fontSize = "29px";
    titleElement.style.fontWeight = "600";
    titleElement.style.marginBottom = "16px"; // 1rem below title
    titleElement.style.color = "#000000";
    titleElement.style.textAlign = "center";

    // Create chart wrapper
    const chartWrapper = document.createElement("div");
    chartWrapper.style.flex = "1";
    chartWrapper.style.minHeight = "0";
    chartWrapper.style.display = "flex";
    chartWrapper.style.flexDirection = "column";

    // Append elements to container
    exportContainer.appendChild(titleElement);
    exportContainer.appendChild(chartWrapper);
    document.body.appendChild(exportContainer);

    // Render chart using React
    const root = createRoot(chartWrapper);
    root.render(renderChart());

    // Wait for render to complete
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
    root.unmount();
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
 * Copy a chart as PNG image to clipboard with title and legend on right side
 * @param renderChart - A callback that renders the chart component with legendPosition="right"
 * @param title - The title to render at the top
 * @param width - Target width in pixels (default 1200)
 * @param height - Target height in pixels (default 800)
 */
export async function copyChartToClipboard(
  renderChart: () => ReactNode,
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
    exportContainer.style.padding = "16px 24px 24px 24px"; // 0.5rem less at top
    exportContainer.style.boxSizing = "border-box";

    // Create title element
    const titleElement = document.createElement("div");
    titleElement.textContent = title;
    titleElement.style.fontSize = "29px";
    titleElement.style.fontWeight = "600";
    titleElement.style.marginBottom = "16px"; // 1rem below title
    titleElement.style.color = "#000000";
    titleElement.style.textAlign = "center";

    // Create chart wrapper
    const chartWrapper = document.createElement("div");
    chartWrapper.style.flex = "1";
    chartWrapper.style.minHeight = "0";
    chartWrapper.style.display = "flex";
    chartWrapper.style.flexDirection = "column";

    // Append elements to container
    exportContainer.appendChild(titleElement);
    exportContainer.appendChild(chartWrapper);
    document.body.appendChild(exportContainer);

    // Render chart using React
    const root = createRoot(chartWrapper);
    root.render(renderChart());

    // Wait for render to complete
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
    root.unmount();
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
