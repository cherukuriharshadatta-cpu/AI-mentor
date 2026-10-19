// Makes the OpenRouter request (so the chat site's security rules can't block it)
// and streams the answer back to the bubble.
const URL = "https://openrouter.ai/api/v1/chat/completions";

chrome.runtime.onConnect.addListener((port) => {
  const send = (m) => { try { port.postMessage(m); } catch (e) {} };

  port.onMessage.addListener(async ({ models, messages, key }) => {
    let lastErr = "No model responded.";
    for (const model of models) {
      try {
        if (!key) throw Object.assign(new Error("Add your OpenRouter key in ⚙ settings first."), { fatal: true });
        const res = await fetch(URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
            "X-Title": "Bob",
          },
          body: JSON.stringify({ model, messages, stream: true }),
        });
        if (res.status === 401 || res.status === 403)
          throw Object.assign(new Error("OpenRouter rejected the key. Check it in ⚙ settings."), { fatal: true });
        if (!res.ok) { lastErr = `${model}: HTTP ${res.status}`; continue; }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", got = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const ln of lines) {
            if (!ln.startsWith("data:")) continue;
            const data = ln.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content;
              if (delta) { got = true; send({ chunk: delta }); }
            } catch (e) {}
          }
        }
        if (got) { send({ done: true }); return; }
        lastErr = `${model}: empty response`;
      } catch (e) {
        if (e.fatal) { send({ error: { message: e.message, fatal: true } }); return; }
        lastErr = e.message;
      }
    }
    send({ error: { message: lastErr + " (free models can be busy - try again in a moment)" } });
  });
});
