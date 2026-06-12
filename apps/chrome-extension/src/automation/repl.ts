import { executeNavigateTool } from "./navigate";
import { handleReplArtifactAction } from "./repl-artifacts";
import { ensureAutomationContentScript, runBrowserJs } from "./repl-browser-js";
import { validateReplCode } from "./repl-policy";

export type ReplArgs = {
  title: string;
  code: string;
};

export type SandboxFile = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

let activeAbortController: AbortController | null = null;
let replAbortListenerAttached = false;

function ensureReplAbortListener() {
  if (replAbortListenerAttached) return;
  replAbortListenerAttached = true;
  chrome.runtime.onMessage.addListener((raw) => {
    if (!raw || typeof raw !== "object") return;
    const type = (raw as { type?: string }).type;
    if (type === "automation:abort-repl" || type === "automation:abort-agent") {
      activeAbortController?.abort();
    }
  });
}

type ReplResult = {
  output: string;
  files?: SandboxFile[];
};

async function sendReplOverlay(
  tabId: number,
  action: "show" | "hide",
  message?: string,
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "automation:repl-overlay",
      action,
      message: message ?? null,
    });
    return;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const noReceiver =
      msg.includes("Receiving end does not exist") ||
      msg.includes("Could not establish connection");
    if (!noReceiver) return;
  }

  await ensureAutomationContentScript(tabId);
  await new Promise((resolve) => setTimeout(resolve, 120));
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "automation:repl-overlay",
      action,
      message: message ?? null,
    });
  } catch {
    // ignore
  }
}

function buildSandboxHtml(): string {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <script>
          const formatValue = (value) => {
            if (value == null) return 'null'
            if (typeof value === 'string') return value
            try { return JSON.stringify(value) } catch { return String(value) }
          }

          const toBase64 = (input) => {
            if (typeof input === 'string') {
              return btoa(unescape(encodeURIComponent(input)))
            }
            if (input instanceof ArrayBuffer) {
              const bytes = new Uint8Array(input)
              let binary = ''
              bytes.forEach((b) => { binary += String.fromCharCode(b) })
              return btoa(binary)
            }
            if (ArrayBuffer.isView(input)) {
              const bytes = new Uint8Array(input.buffer)
              let binary = ''
              bytes.forEach((b) => { binary += String.fromCharCode(b) })
              return btoa(binary)
            }
            return btoa(unescape(encodeURIComponent(String(input))))
          }

          const sendRpc = (action, payload) => {
            return new Promise((resolve, reject) => {
              const requestId = \`\${Date.now()}-\${Math.random().toString(36).slice(2)}\`
              const handler = (event) => {
                const data = event.data || {}
                if (data.source !== 'summarize-repl' || data.type !== 'rpc-result') return
                if (data.requestId !== requestId) return
                window.removeEventListener('message', handler)
                if (data.ok) resolve(data.result)
                else reject(new Error(data.error || 'RPC failed'))
              }
              window.addEventListener('message', handler)
              window.parent.postMessage(
                { source: 'summarize-repl', type: 'rpc', requestId, action, payload },
                '*'
              )
            })
          }

          window.addEventListener('message', async (event) => {
            const data = event.data || {}
            if (data.source !== 'summarize-repl' || data.type !== 'execute') return

            const { requestId, code } = data
            const logs = []
            const files = []

            const original = { ...console }
            const capture = (...args) => {
              logs.push(args.map((arg) => formatValue(arg)).join(' '))
            }
            console.log = (...args) => { capture(...args); original.log(...args) }
            console.info = (...args) => { capture(...args); original.info(...args) }
            console.warn = (...args) => { capture(...args); original.warn(...args) }
            console.error = (...args) => { capture(...args); original.error(...args) }

            const browserjs = async (fn, ...args) => {
              if (typeof fn !== 'function') throw new Error('browserjs() expects a function')
              const result = await sendRpc('browserjs', { fnSource: fn.toString(), args })
              if (result && typeof result === 'object' && '__browserLogs' in result) {
                const payload = result
                if (Array.isArray(payload.__browserLogs)) {
                  logs.push(...payload.__browserLogs)
                }
                return payload.value
              }
              return result
            }

            const navigate = async (args) => sendRpc('navigate', args)

            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

            const listArtifacts = async () => sendRpc('listArtifacts', {})
            const getArtifact = async (fileName, options) =>
              sendRpc('getArtifact', { fileName, ...(options || {}) })
            const createOrUpdateArtifact = async (fileName, content, mimeType) =>
              sendRpc('createOrUpdateArtifact', { fileName, content, mimeType })
            const deleteArtifact = async (fileName) =>
              sendRpc('deleteArtifact', { fileName })

            const returnFile = (fileNameOrObj, maybeContent, maybeMimeType) => {
              let fileName = ''
              let content = ''
              let mimeType = 'text/plain'
              if (typeof fileNameOrObj === 'object' && fileNameOrObj) {
                fileName = fileNameOrObj.fileName || fileNameOrObj.name || ''
                content = fileNameOrObj.content ?? ''
                mimeType = fileNameOrObj.mimeType || fileNameOrObj.type || mimeType
              } else {
                fileName = String(fileNameOrObj || '')
                content = maybeContent ?? ''
                mimeType = maybeMimeType || mimeType
              }
              if (!fileName) {
                throw new Error('returnFile() requires a fileName')
              }
              const contentBase64 = toBase64(content)
              files.push({ fileName, mimeType, contentBase64 })
            }

            try {
              const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
              const fn = new AsyncFunction(
                'browserjs',
                'navigate',
                'sleep',
                'returnFile',
                'createOrUpdateArtifact',
                'getArtifact',
                'listArtifacts',
                'deleteArtifact',
                'console',
                code
              )
              const result = await fn(
                browserjs,
                navigate,
                sleep,
                returnFile,
                createOrUpdateArtifact,
                getArtifact,
                listArtifacts,
                deleteArtifact,
                console
              )
              if (result !== undefined) {
                logs.push(\`=> \${formatValue(result)}\`)
              }
              window.parent.postMessage(
                { source: 'summarize-repl', type: 'result', requestId, ok: true, logs, files },
                '*'
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              window.parent.postMessage(
                { source: 'summarize-repl', type: 'result', requestId, ok: false, error: message, logs, files },
                '*'
              )
            } finally {
              console.log = original.log
              console.info = original.info
              console.warn = original.warn
              console.error = original.error
            }
          })
        </script>
      </body>
    </html>
  `;
}

async function runSandboxedRepl(
  code: string,
  handlers: {
    onBrowserJs: (payload: { fnSource: string; args: unknown[] }) => Promise<unknown>;
    onNavigate: (payload: { url: string; newTab?: boolean }) => Promise<unknown>;
    onArtifacts: (payload: {
      action: "list" | "get" | "upsert" | "delete";
      fileName?: string;
      content?: unknown;
      mimeType?: string;
      asBase64?: boolean;
    }) => Promise<unknown>;
  },
  signal?: AbortSignal,
): Promise<{ logs: string[]; files: SandboxFile[]; error?: string }> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.style.display = "none";
  iframe.srcdoc = buildSandboxHtml();

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    const abortHandler = () => {
      cleanup();
      resolve({ logs: [], files: [], error: "Execution aborted" });
    };

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
      window.removeEventListener("message", onMessage);
      iframe.remove();
    };

    const sendExecute = () => {
      iframe.contentWindow?.postMessage(
        { source: "summarize-repl", type: "execute", requestId, code },
        "*",
      );
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as {
        source?: string;
        type?: string;
        requestId?: string;
        action?: string;
        payload?: unknown;
        ok?: boolean;
        result?: unknown;
        error?: string;
        logs?: string[];
        files?: SandboxFile[];
      };
      if (data?.source !== "summarize-repl") return;
      if (data.type === "rpc" && data.requestId) {
        const handle = async () => {
          try {
            if (data.action === "browserjs") {
              const result = await handlers.onBrowserJs(
                data.payload as { fnSource: string; args: unknown[] },
              );
              iframe.contentWindow?.postMessage(
                {
                  source: "summarize-repl",
                  type: "rpc-result",
                  requestId: data.requestId,
                  ok: true,
                  result,
                },
                "*",
              );
            } else if (data.action === "navigate") {
              const result = await handlers.onNavigate(
                data.payload as { url: string; newTab?: boolean },
              );
              iframe.contentWindow?.postMessage(
                {
                  source: "summarize-repl",
                  type: "rpc-result",
                  requestId: data.requestId,
                  ok: true,
                  result,
                },
                "*",
              );
            } else if (data.action === "listArtifacts") {
              const result = await handlers.onArtifacts({ action: "list" });
              iframe.contentWindow?.postMessage(
                {
                  source: "summarize-repl",
                  type: "rpc-result",
                  requestId: data.requestId,
                  ok: true,
                  result,
                },
                "*",
              );
            } else if (data.action === "getArtifact") {
              const result = await handlers.onArtifacts({
                action: "get",
                ...(data.payload as { fileName?: string; asBase64?: boolean }),
              });
              iframe.contentWindow?.postMessage(
                {
                  source: "summarize-repl",
                  type: "rpc-result",
                  requestId: data.requestId,
                  ok: true,
                  result,
                },
                "*",
              );
            } else if (data.action === "createOrUpdateArtifact") {
              const result = await handlers.onArtifacts({
                action: "upsert",
                ...(data.payload as { fileName?: string; content?: unknown; mimeType?: string }),
              });
              iframe.contentWindow?.postMessage(
                {
                  source: "summarize-repl",
                  type: "rpc-result",
                  requestId: data.requestId,
                  ok: true,
                  result,
                },
                "*",
              );
            } else if (data.action === "deleteArtifact") {
              const result = await handlers.onArtifacts({
                action: "delete",
                ...(data.payload as { fileName?: string }),
              });
              iframe.contentWindow?.postMessage(
                {
                  source: "summarize-repl",
                  type: "rpc-result",
                  requestId: data.requestId,
                  ok: true,
                  result,
                },
                "*",
              );
            } else {
              iframe.contentWindow?.postMessage(
                {
                  source: "summarize-repl",
                  type: "rpc-result",
                  requestId: data.requestId,
                  ok: false,
                  error: `Unknown action: ${data.action}`,
                },
                "*",
              );
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            iframe.contentWindow?.postMessage(
              {
                source: "summarize-repl",
                type: "rpc-result",
                requestId: data.requestId,
                ok: false,
                error: message,
              },
              "*",
            );
          }
        };
        void handle();
        return;
      }

      if (data.type === "result" && data.requestId === requestId) {
        cleanup();
        resolve({
          logs: data.logs ?? [],
          files: data.files ?? [],
          error: data.ok ? undefined : data.error || "Execution failed",
        });
      }
    };

    window.addEventListener("message", onMessage);
    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    iframe.addEventListener("load", sendExecute, { once: true });
    document.body.appendChild(iframe);
  });
}

export async function executeReplTool(args: ReplArgs): Promise<ReplResult> {
  if (!args.code?.trim()) throw new Error("Missing code");
  validateReplCode(args.code);
  ensureReplAbortListener();

  const usesBrowserJs = args.code.includes("browserjs(");
  let overlayTabId: number | null = null;
  const abortController = new AbortController();
  activeAbortController = abortController;
  if (usesBrowserJs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      overlayTabId = tab.id;
      await sendReplOverlay(overlayTabId, "show", args.title || "Running automation");
    }
  }

  try {
    const sandboxResult = await runSandboxedRepl(
      args.code,
      {
        onBrowserJs: async ({ fnSource, args: fnArgs }) => {
          const res = await runBrowserJs(fnSource, fnArgs, abortController.signal);
          if (!res.ok) throw new Error(res.error || "browserjs failed");
          if (res.logs?.length) {
            return { value: res.value, __browserLogs: res.logs };
          }
          return res.value;
        },
        onNavigate: async (input) => executeNavigateTool(input),
        onArtifacts: handleReplArtifactAction,
      },
      abortController.signal,
    );

    const logs = sandboxResult.logs ?? [];
    if (sandboxResult.files?.length) {
      logs.push(`[Files returned: ${sandboxResult.files.length}]`);
      for (const file of sandboxResult.files) {
        logs.push(`- ${file.fileName} (${file.mimeType})`);
      }
    }
    if (sandboxResult.error) {
      logs.push(`Error: ${sandboxResult.error}`);
    }
    const output = logs.join("\n").trim() || "Code executed successfully (no output)";
    return {
      output,
      files: sandboxResult.files?.length ? sandboxResult.files : undefined,
    };
  } finally {
    abortController.abort();
    activeAbortController = null;
    if (overlayTabId) {
      await sendReplOverlay(overlayTabId, "hide");
    }
  }
}
