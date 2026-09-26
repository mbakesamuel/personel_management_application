import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
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
  const tempPath = join(
    tmpdir(),
    `appraisal-print-${randomBytes(8).toString("hex")}.html`,
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
      printWindow.webContents.removeListener("did-finish-load", onDone);
      printWindow.webContents.removeListener("did-fail-load", onFail);
    };

    printWindow.webContents.once("did-finish-load", onDone);
    printWindow.webContents.once("did-fail-load", onFail);
  });

  await printWindow.loadURL(pathToFileURL(tempPath).href);
  await loadDone;

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
    `document.fonts && document.fonts.status !== "loaded"
      ? document.fonts.ready.then(() => true)
      : true`,
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
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

        await new Promise<void>((resolve, reject) => {
          printWindow.webContents.print(
            {
              silent: false,
              printBackground: true,
              pageSize: "A4",
              landscape: options?.landscape === true,
              scaleFactor: 100,
              margins: { marginType: "none" },
            },
            (success, failureReason) => {
              const cancelled =
                typeof failureReason === "string" &&
                /cancel/i.test(failureReason);
              if (success || cancelled) resolve();
              else reject(new Error(failureReason || "Print failed"));
            },
          );
        });
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

      const printWindow = createPrintWindow();
      let tempPath: string | null = null;

      try {
        tempPath = await preparePrintWindow(printWindow, html);
        await waitForPrintReady(printWindow);
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
