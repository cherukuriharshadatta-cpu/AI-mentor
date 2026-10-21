/* Consent-gated conversation reader. Never scans arbitrary page prose. */
(function (root) {
  'use strict';

  // These are role-bearing message nodes or explicit conversation-turn wrappers.
  // Page navigation, prompt composers and Bob's own shadow root are not messages.
  const TURN_SELECTOR = '[data-testid^="conversation-turn-"], [data-turn-id]';
  const STREAMING_SELECTOR = '[data-is-streaming="true"], [data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="Stop response"], .result-streaming';
  const ROLE_SELECTOR = '[data-message-author-role], [data-testid="user-message"], [data-testid="assistant-message"], user-query, model-response, [data-turn-role]';

  // Each adapter describes message boundaries, not whole-page text.
  // Add new integrations here and add their origins to manifest.json.
  const adapters = [
    { id: 'chatgpt', hosts: ['chatgpt.com', 'chat.openai.com'],
      user: ['[data-message-author-role="user"]', '[data-turn="user"]', '[data-testid="user-message"]'],
      assistant: ['[data-message-author-role="assistant"]', '[data-turn="assistant"]', '[data-testid="assistant-message"]'],
      streaming: '[data-is-streaming="true"], [data-testid="stop-button"]' },
    { id: 'claude', hosts: ['claude.ai'],
      user: ['[data-testid="user-message"]', '[data-testid="user-message-content"]', '[data-message-author-role="user"]'],
      assistant: ['[data-testid="assistant-message"]', '.font-claude-message', '[data-message-author-role="assistant"]'],
      streaming: '[data-is-streaming="true"], button[aria-label="Stop response"], button[aria-label="Stop generating"]' },
    { id: 'gemini', hosts: ['gemini.google.com'],
      user: ['user-query', '[data-message-author-role="user"]'],
      assistant: ['model-response', '[data-message-author-role="assistant"]'],
      streaming: '.result-streaming, [data-is-streaming="true"], button[aria-label="Stop response"]' }
  ];
  const generic = { id: 'generic', user: ['[data-message-author-role="user"]', '[data-testid="user-message"]', '[data-turn="user"]'], assistant: ['[data-message-author-role="assistant"]', '[data-testid="assistant-message"]', '[data-turn="assistant"]'], streaming: STREAMING_SELECTOR };
  function adapterFor(route) {
    let hostname = '';
    try { hostname = new URL(route).hostname; } catch { /* Test/custom adapter. */ }
    return adapters.find(adapter => adapter.hosts.includes(hostname)) || generic;
  }

  function roleOf(node) {
    const attr = (node.getAttribute?.('data-message-author-role') || node.getAttribute?.('data-turn-role') || node.getAttribute?.('data-turn') || '').toLowerCase();
    if (attr === 'user' || attr === 'human') return 'user';
    if (attr === 'assistant' || attr === 'model') return 'assistant';
    const testId = node.getAttribute?.('data-testid') || '';
    if (testId === 'user-message' || node.localName === 'user-query') return 'user';
    if (testId === 'assistant-message' || node.localName === 'model-response') return 'assistant';
    return null;
  }

  function labelledTurnRole(turn) {
    const direct = roleOf(turn);
    if (direct) return direct;
    const nested = turn.querySelector?.(ROLE_SELECTOR);
    if (nested && roleOf(nested)) return roleOf(nested);
    const heading = turn.querySelector?.('h5.sr-only, h6.sr-only, [data-testid="conversation-turn-label"]');
    const label = String(heading?.textContent || '').trim().toLowerCase();
    if (/^(you said|user said|you):?$/.test(label)) return 'user';
    if (/^(chatgpt said|assistant said|claude said|gemini said|assistant):?$/.test(label)) return 'assistant';
    return null; // Never infer roles from arbitrary page content.
  }

  function messageContent(node, role) {
    // Take only message content when a labelled turn contains UI actions.
    const selectors = role === 'user'
      ? ['[data-testid="user-message"]', '[data-message-author-role="user"]', '[data-testid="user-message-content"]', '.query-text', '.whitespace-pre-wrap', 'user-query']
      : ['[data-testid="assistant-message"]', '[data-message-author-role="assistant"]', '.markdown', '.prose', '.model-response-text', 'message-content', 'model-response'];
    for (const selector of selectors) {
      const element = node.querySelector?.(selector);
      if (element && String(element.textContent || '').trim()) return element;
    }
    return node;
  }

  function isInsideBob(node) {
    return !!node.closest?.('#bob-host');
  }

  class Reader {
    constructor() { this.cache = new WeakMap(); this.version = ''; this.route = ''; this.totalParsed = 0; }

    read(container, { enabled, paused, route, userSelectors = [], assistantSelectors = [] }) {
      if (!enabled || paused) return { messages: [], changed: false, blocked: true, streaming: false };
      if (this.route !== route) { this.cache = new WeakMap(); this.version = ''; this.route = route; }
      const adapter = adapterFor(route);
      const streaming = !!container.querySelector?.(adapter.streaming);
      if (streaming) return { messages: [], changed: false, streaming: true };

      const entries = [];
      const seen = new Set();
      const add = (node, role, wrapper = null) => {
        if (!node || !role || isInsideBob(node)) return;
        const parentTurn = wrapper || node.closest?.(TURN_SELECTOR);
        const identity = parentTurn || node;
        if (seen.has(identity)) return;
        // Multiple selectors can match a message and its parent wrapper.
        // Prefer the outer labelled message, never count both copies.
        for (let i = entries.length - 1; i >= 0; i--) {
          const existing = entries[i];
          if (existing.role !== role) continue;
          const outer = existing.wrapper || existing.node;
          if (outer.contains?.(identity)) return;
          if (identity.contains?.(outer)) {
            seen.delete(outer);
            entries.splice(i, 1);
          }
        }
        seen.add(identity);
        entries.push({ node, role, wrapper: parentTurn });
      };

      // Explicit turn containers survive ChatGPT's changing inner message markup.
      for (const turn of [...container.querySelectorAll(TURN_SELECTOR)].slice(-180)) {
        if (turn.parentElement?.closest(TURN_SELECTOR)) continue;
        const role = labelledTurnRole(turn);
        if (role) add(turn, role, turn);
      }

      // Older ChatGPT, Claude, Gemini and custom supported role adapters.
      for (const [role, selectors] of [
        ['user', [...userSelectors, ...adapter.user]],
        ['assistant', [...assistantSelectors, ...adapter.assistant]]
      ]) {
        for (const selector of new Set(selectors)) {
          let nodes;
          try { nodes = container.querySelectorAll(selector); } catch { continue; }
          for (const node of [...nodes].slice(-80)) {
            if (node.closest?.(TURN_SELECTOR) && seen.has(node.closest(TURN_SELECTOR))) continue;
            add(node, role);
          }
        }
      }

      const records = entries.map(({node,role,wrapper}, index) => {
        const body = messageContent(node, role);
        const text = String(body.textContent || '').trim().slice(-16000);
        if (!text) return null;
        const cached = this.cache.get(node);
        if (cached?.text === text && cached?.role === role) return {node,record:cached};
        const id = wrapper?.getAttribute('data-turn-id') || wrapper?.getAttribute('data-testid') ||
          node.getAttribute?.('data-message-id') || node.getAttribute?.('data-message-id') ||
          role + ':' + index;
        const code = [...(body.querySelectorAll?.('pre') || [])].slice(0,10)
          .map(el => String(el.textContent || '').slice(0,50000));
        const record = { id, role, text, code, timestamp: new Date().toISOString() };
        this.cache.set(node, record); this.totalParsed++;
        return {node,record};
      }).filter(Boolean);

      records.sort((a,b) => {
        const position = a.node.compareDocumentPosition?.(b.node) || 0;
        return position & 4 ? -1 : position & 2 ? 1 : 0;
      });
      const messages = records.map(x=>x.record);
      const version = JSON.stringify(messages.map(m=>[m.id,m.role,m.text]));
      const changed = version !== this.version;
      this.version = version;
      return { messages, changed, blocked: false, streaming: false, platform: adapter.id };
    }

    clear() { this.cache = new WeakMap(); this.version = ''; this.route = ''; }
  }

  root.BobConversation = { Reader, adapterFor, adapters };
  if (typeof module !== 'undefined') module.exports = root.BobConversation;
})(typeof window !== 'undefined' ? window : globalThis);
