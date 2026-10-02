import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  shell,
} from "electron";
import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getServerConfig } from "./store";

const APP_TITLE = "Personel Management Application";

app.setName(APP_TITLE);

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: APP_TITLE,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.webContents.setZoomFactor(0.8);
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const A4_PRINT_OPTIONS = {
  silent: false,
  printBackground: true,
  pageSize: "A4" as const,
  scaleFactor: 100,
  margins: { marginType: "none" as const },
};

function printWebContents(
  contents: Electron.WebContents,
  landscape = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    contents.print(
      { ...A4_PRINT_OPTIONS, landscape },
      (success, failureReason) => {
        const cancelled =
          typeof failureReason === "string" && /cancel/i.test(failureReason);
        if (success || cancelled) resolve();
        else reject(new Error(failureReason || "Print failed"));
      },
    );
  });
}

async function loadHtmlDocument(
  target: BrowserWindow,
  html: string,
): Promise<string> {
  const tempPath = join(
    tmpdir(),
    `report-${randomBytes(8).toString("hex")}.html`,
  );
  await writeFile(tempPath, html, "utf8");

  const loadDone = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out loading print document"));
    }, 20000);

    const onFail = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
    ) => {
      cleanup();
      reject(new Error(`Load failed (${errorCode}): ${errorDescription}`));
    };
    const onDone = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      target.webContents.removeListener("did-finish-load", onDone);
      target.webContents.removeListener("did-fail-load", onFail);
    };

    target.webContents.once("did-finish-load", onDone);
    target.webContents.once("did-fail-load", onFail);
  });

  await target.loadURL(pathToFileURL(tempPath).href);
  await loadDone;
  return tempPath;
}

function createVisibleReportWindow(title: string): BrowserWindow {
  return new BrowserWindow({
    width: 794,
    height: 1123,
    show: false,
    title,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
}

function createPrintWindow(): BrowserWindow {
  // Keep A4 bounds so Windows print metrics are valid, but never flash a
  // visible preview: off-screen, transparent, and out of the taskbar.
  return new BrowserWindow({
    width: 794,
    height: 1123,
    x: -20000,
    y: -20000,
    show: false,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    opacity: 0,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
}

async function preparePrintWindow(
  printWindow: BrowserWindow,
  html: string,
): Promise<string> {
  const tempPath = await loadHtmlDocument(printWindow, html);

  // Shown only so Chromium reports a page size; opacity 0 + off-screen
  // keeps it from appearing in front of the print dialog.
  printWindow.setOpacity(0);
  printWindow.setPosition(-20000, -20000);
  printWindow.showInactive();
  return tempPath;
}

/** Wait until layout/fonts are ready so printToPDF does not emit blank pages. */
async function waitForPrintReady(printWindow: BrowserWindow): Promise<void> {
  await printWindow.webContents.executeJavaScript(
    `(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })
      return true
    })()`,
  );
}

function createPdfWindow(): BrowserWindow {
  // No opacity: 0. On Windows a fully transparent window is never composited,
  // so printToPDF returns a valid file whose pages are blank.
  return new BrowserWindow({
    width: 794,
    height: 1123,
    show: false,
    paintWhenInitiallyHidden: true,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
}

function bitmapHasInk(image: Electron.NativeImage): boolean {
  const { width, height } = image.getSize();
  if (width === 0 || height === 0) return false;
  const bitmap = image.toBitmap();
  const stepX = Math.max(1, Math.floor(width / 24));
  const stepY = Math.max(1, Math.floor(height / 32));
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const offset = (y * width + x) * 4;
      const blue = bitmap[offset] ?? 255;
      const green = bitmap[offset + 1] ?? 255;
      const red = bitmap[offset + 2] ?? 255;
      if (red < 250 || green < 250 || blue < 250) return true;
    }
  }
  return false;
}

/** Hidden windows on Windows often paint white. Show one long enough to composite, behind the app. */
async function ensurePdfPainted(printWindow: BrowserWindow): Promise<void> {
  printWindow.setOpacity(1);
  printWindow.setPosition(-20000, -20000);
  printWindow.showInactive();
  await waitForPrintReady(printWindow);
  let painted = false;
  try {
    painted = bitmapHasInk(await printWindow.webContents.capturePage());
  } catch {
    painted = false;
  }
  if (painted) return;

  const area = screen.getPrimaryDisplay().workArea;
  printWindow.setBounds({
    x: area.x + 24,
    y: area.y + 24,
    width: 794,
    height: Math.min(1123, Math.max(400, area.height - 48)),
  });
  printWindow.showInactive();
  const front = BrowserWindow.getAllWindows().find(
    (other) =>
      other.id !== printWindow.id && !other.isDestroyed() && other.isVisible(),
  );
  front?.moveTop();
  await waitForPrintReady(printWindow);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  ipcMain.handle("server-config:get", () => getServerConfig());

  ipcMain.handle(
    "file:save",
    async (
      event,
      payload: { defaultName?: unknown; data?: unknown },
    ): Promise<{ cancelled: true } | { ok: true; path: string }> => {
      const defaultName = sanitizeSaveFileName(payload?.defaultName);
      const data = toUint8Array(payload?.data);
      if (!data || data.byteLength === 0) {
        throw new Error("File data is required");
      }

      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const options = {
        title: "Save Excel file",
        defaultPath: join(app.getPath("documents"), defaultName),
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      };
      const result = parentWindow
        ? await dialog.showSaveDialog(parentWindow, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) {
        return { cancelled: true };
      }

      const filePath = ensureXlsxExtension(result.filePath);
      await writeFile(filePath, data);
      return { ok: true, path: filePath };
    },
  );

  ipcMain.handle(
    "report:open-html",
    async (_event, html: string, title?: string) => {
      if (typeof html !== "string" || html.trim().length === 0) {
        throw new Error("Report HTML is required");
      }
      const windowTitle =
        typeof title === "string" && title.trim().length > 0 ? title.trim() : "Letter";
      const reportWindow = createVisibleReportWindow(windowTitle);
      let tempPath: string | null = null;
      reportWindow.on("closed", () => {
        if (tempPath) void unlink(tempPath).catch(() => undefined);
      });
      try {
        tempPath = await loadHtmlDocument(reportWindow, html);
        reportWindow.show();
        return { ok: true };
      } catch (err) {
        if (!reportWindow.isDestroyed()) reportWindow.destroy();
        if (tempPath) await unlink(tempPath).catch(() => undefined);
        throw err;
      }
    },
  );

  ipcMain.handle("report-window:print", async (event) => {
    await printWebContents(event.sender, false);
    return { ok: true };
  });

  // Print HTML directly (no in-app PDF preview).
  ipcMain.handle(
    "report:print-html",
    async (_event, html: string, options?: { landscape?: boolean }) => {
      if (typeof html !== "string" || html.trim().length === 0) {
        throw new Error("Print HTML is required");
      }

      const printWindow = createPrintWindow();
      let tempPath: string | null = null;

      try {
        tempPath = await preparePrintWindow(printWindow, html);

        await printWebContents(
          printWindow.webContents,
          options?.landscape === true,
        );
        return { ok: true };
      } finally {
        if (!printWindow.isDestroyed()) printWindow.destroy();
        if (tempPath) await unlink(tempPath).catch(() => undefined);
      }
    },
  );

  ipcMain.handle(
    "report:html-to-pdf",
    async (_event, html: string, options?: { landscape?: boolean }) => {
      if (typeof html !== "string" || html.trim().length === 0) {
        throw new Error("PDF HTML is required");
      }

      const printWindow = createPdfWindow();
      let tempPath: string | null = null;

      try {
        tempPath = await loadHtmlDocument(printWindow, html);
        await ensurePdfPainted(printWindow);
        const pdfBuffer = await printWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: "A4",
          landscape: options?.landscape === true,
          margins: { marginType: "none" },
        });
        if (!pdfBuffer || pdfBuffer.byteLength === 0) {
          throw new Error("PDF generation returned empty output");
        }
        // Base64 avoids structured-clone issues with TypedArrays across IPC.
        return pdfBuffer.toString("base64");
      } finally {
        if (!printWindow.isDestroyed()) printWindow.destroy();
        if (tempPath) await unlink(tempPath).catch(() => undefined);
      }
    },
  );

  ipcMain.handle(
    "report:save-pdf",
    async (
      event,
      payload: { defaultName?: unknown; data?: unknown },
    ): Promise<{ cancelled: true } | { ok: true; path: string }> => {
      const defaultName = sanitizePdfFileName(payload?.defaultName);
      const data = toUint8Array(payload?.data);
      if (!data || data.byteLength === 0) {
        throw new Error("PDF data is required");
      }

      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const options = {
        title: "Save PDF",
        defaultPath: join(app.getPath("documents"), defaultName),
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
      };
      const result = parentWindow
        ? await dialog.showSaveDialog(parentWindow, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) {
        return { cancelled: true };
      }

      const filePath = ensurePdfExtension(result.filePath);
      await writeFile(filePath, data);
      return { ok: true, path: filePath };
    },
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function sanitizeSaveFileName(value: unknown): string {
  const raw = typeof value === "string" ? value : "appraisals.xlsx";
  const base = raw.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return ensureXlsxExtension(base || "appraisals.xlsx");
}

function sanitizePdfFileName(value: unknown): string {
  const raw = typeof value === "string" ? value : "report.pdf";
  const base = raw.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return ensurePdfExtension(base || "report.pdf");
}

function ensureXlsxExtension(path: string): string {
  return path.toLowerCase().endsWith(".xlsx") ? path : `${path}.xlsx`;
}

function ensurePdfExtension(path: string): string {
  return path.toLowerCase().endsWith(".pdf") ? path : `${path}.pdf`;
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}
