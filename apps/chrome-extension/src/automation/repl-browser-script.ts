export function buildBrowserJsWrapper({
  fnSource,
  args,
  libraries,
  nativeInputEnabled,
  nativeInputCapability,
}: {
  fnSource: string;
  args: unknown[];
  libraries: string[];
  nativeInputEnabled: boolean;
  nativeInputCapability: string;
}): string {
  const argsJson = (() => {
    try {
      return JSON.stringify(args ?? []);
    } catch {
      return "[]";
    }
  })();
  const libs = libraries.filter(Boolean).join("\n");

  return `
      (async () => {
        const logs = []
        const capture = (...args) => {
          logs.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
        }
        const originalLog = console.log
        console.log = (...args) => {
          capture(...args)
          originalLog(...args)
        }

        const sendNativeInput = (payload) => {
          if (!${nativeInputEnabled ? "true" : "false"}) {
            throw new Error('Native input requires debugger permission')
          }
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                type: 'automation:native-input',
                capability: ${JSON.stringify(nativeInputCapability)},
                payload,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message || 'Native input failed'))
                  return
                }
                if (response?.ok) resolve(true)
                else reject(new Error(response?.error || 'Native input failed'))
              }
            )
          })
        }

        const sendArtifactRpc = (action, payload) => {
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              { source: 'summarize-artifacts', type: 'automation:artifacts', action, payload },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message || 'Artifact operation failed'))
                  return
                }
                if (response?.ok) resolve(response.result)
                else reject(new Error(response?.error || 'Artifact operation failed'))
              }
            )
          })
        }

        const attachNativeHelpers = () => {
          const resolveElement = (selector) => {
            const el = document.querySelector(selector)
            if (!el) throw new Error(\`Element not found: \${selector}\`)
            return el
          }

          window.nativeClick = async (selector) => {
            const el = resolveElement(selector)
            const rect = el.getBoundingClientRect()
            await sendNativeInput({ action: 'click', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
          }

          window.nativeType = async (selector, text) => {
            const el = resolveElement(selector)
            el.focus()
            await sendNativeInput({ action: 'type', text })
          }

          window.nativePress = async (key) => {
            await sendNativeInput({ action: 'press', key })
          }

          window.nativeKeyDown = async (key) => {
            await sendNativeInput({ action: 'keydown', key })
          }

          window.nativeKeyUp = async (key) => {
            await sendNativeInput({ action: 'keyup', key })
          }
        }

        const attachArtifactHelpers = () => {
          window.listArtifacts = async () => sendArtifactRpc('listArtifacts', {})
          window.getArtifact = async (fileName, options) =>
            sendArtifactRpc('getArtifact', { fileName, ...(options || {}) })
          window.createOrUpdateArtifact = async (fileName, content, mimeType) =>
            sendArtifactRpc('createOrUpdateArtifact', { fileName, content, mimeType })
          window.deleteArtifact = async (fileName) =>
            sendArtifactRpc('deleteArtifact', { fileName })
        }

        try {
          attachNativeHelpers()
          attachArtifactHelpers()
          ${libs}
          const fn = (${fnSource})
          const args = ${argsJson}
          const value = await fn(...args)
          return { ok: true, value, logs }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { ok: false, error: message, logs }
        } finally {
          console.log = originalLog
        }
      })()
    `;
}
