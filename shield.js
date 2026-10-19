// Runs at document_start, BEFORE the chat site's own scripts, so it sees every
// keystroke/paste/focus event first. Anything that happens inside Bob is stopped
// here so claude.ai / chatgpt.com can't grab it into their own message box.
// Enter and Escape are relayed to Bob as custom events (we stop the originals).
(function () {
  const HOST_ID = "bob-host";
  const EVENTS = ["keydown", "keyup", "keypress", "beforeinput", "input", "paste", "cut", "copy",
    "compositionstart", "compositionupdate", "compositionend", "focusin", "focusout", "focus", "blur"];
  const ours = (e) => (e.composedPath ? e.composedPath() : []).some((n) => n && n.id === HOST_ID);

  EVENTS.forEach((type) =>
    window.addEventListener(type, (e) => {
      if (!ours(e)) return;
      if (type === "keydown") {
        const host = document.getElementById(HOST_ID);
        const first = e.composedPath()[0];
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && first && first.id === "input") {
          e.preventDefault();
          host && host.dispatchEvent(new CustomEvent("bob-send"));
        } else if (e.key === "Escape") {
          host && host.dispatchEvent(new CustomEvent("bob-esc"));
        }
      }
      e.stopImmediatePropagation();
      e.stopPropagation();
    }, true)
  );
})();
