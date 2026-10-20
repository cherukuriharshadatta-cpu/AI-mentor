/* Consent-gated DOM adapter. Only reads recognised messages, never whole-page text. */
(function (root) {
  'use strict';
  class Reader {
    constructor() { this.cache = new WeakMap(); this.version = ''; this.route = ''; this.totalParsed = 0; }
    read(container, { enabled, paused, route, userSelectors, assistantSelectors }) {
      if (!enabled || paused) return { messages: [], changed: false, blocked: true, streaming: false };
      if (this.route !== route) { this.cache = new WeakMap(); this.version = ''; this.route = route; }
      const streaming = !!container.querySelector?.('[data-is-streaming="true"], [data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="Stop response"], .result-streaming');
      if (streaming) return { messages: [], changed: false, streaming: true };
      const records = [];
      for (const [role, selectors] of [['user', userSelectors], ['assistant', assistantSelectors]]) {
        for (const selector of selectors) {
          const nodes = [...container.querySelectorAll(selector)];
          if (!nodes.length) continue;
          nodes.slice(-80).forEach((node, index) => {
            const text = String(node.textContent || '').slice(-16000).trim();
            const old = this.cache.get(node);
            let record = old?.text === text ? old : null;
            if (!record) {
              record = { id: node.getAttribute?.('data-message-id') || role + ':' + index,
                role, text, code: [...(node.querySelectorAll?.("pre") || [])].slice(0,10).map(p=>String(p.textContent||"").slice(0,50000)), timestamp: new Date().toISOString() };
              this.cache.set(node, record); this.totalParsed++;
            }
            if (text) records.push({ node, record });
          });
          break;
        }
      }
      records.sort((a,b) => {
        const position = a.node.compareDocumentPosition?.(b.node) || 0;
        return position & 4 ? -1 : position & 2 ? 1 : 0;
      });
      const messages = records.map(x => x.record);
      const version = JSON.stringify(messages.map(m => [m.id, m.role, m.text]));
      const changed = version !== this.version; this.version = version;
      return { messages, changed, streaming: false, blocked: false };
    }
    clear() { this.cache = new WeakMap(); this.version = ''; }
  }
  root.BobConversation = { Reader };
  if (typeof module !== 'undefined') module.exports = root.BobConversation;
})(typeof window !== 'undefined' ? window : globalThis);
