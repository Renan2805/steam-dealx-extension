(async function () {
  // ── Guard: evita injeção dupla em navegações suaves ───────────────────────
  if (document.getElementById('sdx-card-root')) return;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function parseSteamUrl(url) {
    const match = url.match(/store\.steampowered\.com\/(app|sub|bundle)\/(\d+)/);
    if (!match) return null;
    return { type: match[1], id: parseInt(match[2], 10) };
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { apiBaseUrl: 'https://steam-dealx.fly.dev', region: 'br', enabled: true },
        resolve,
      );
    });
  }

  function loadCollapsed() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ cardCollapsed: false }, (r) => resolve(r.cardCollapsed));
    });
  }

  function saveCollapsed(value) {
    chrome.storage.local.set({ cardCollapsed: value });
  }

  function safeUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' ? u.href : '#';
    } catch {
      return '#';
    }
  }

  function formatPrice(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${Number(amount).toFixed(2)}`;
    }
  }

  // ── API fetch ─────────────────────────────────────────────────────────────

  async function fetchDealData(settings, type, id) {
    const url = `${settings.apiBaseUrl}/steam/${type}/${id}?region=${settings.region}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (res.status === 404) return { notFound: true };
      if (res.status === 429) return { rateLimited: true };
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: body.detail || `HTTP ${res.status}`, code: body.code };
      }
      return { data: await res.json() };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') return { error: 'Request timed out (10s)', code: 'TIMEOUT' };
      return { error: 'Network error', code: 'NETWORK_ERROR' };
    }
  }

  // ── DOM injection point ───────────────────────────────────────────────────

  function findInjectionPoint() {
    const selectors = [
      { sel: '.leftcol.game_description_column', method: 'prepend' },
      { sel: '#game_description_column', method: 'prepend' },
      { sel: '.leftcol', method: 'prepend' },
    ];
    for (const { sel, method } of selectors) {
      const el = document.querySelector(sel);
      if (el) return { target: el, method };
    }
    return null;
  }

  function inject({ target, method }, card) {
    if (method === 'before') target.insertAdjacentElement('beforebegin', card);
    else if (method === 'after') target.insertAdjacentElement('afterend', card);
    else target.prepend(card);
  }

  // ── Card builders ─────────────────────────────────────────────────────────

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderLoading() {
    const root = el('div', 'sdx-card sdx-card--loading');
    root.id = 'sdx-card-root';
    const header = el('div', 'sdx-card__header');
    header.appendChild(el('span', 'sdx-card__logo', '♦ STEAMDEALX'));
    root.appendChild(header);
    const body = el('div', 'sdx-loading-body');
    const dots = el('div', 'sdx-loading-dots');
    dots.appendChild(el('span'));
    dots.appendChild(el('span'));
    dots.appendChild(el('span'));
    body.appendChild(dots);
    root.appendChild(body);
    return root;
  }

  function renderError(message, code) {
    const root = el('div', 'sdx-card sdx-card--error');
    root.id = 'sdx-card-root';
    const header = el('div', 'sdx-card__header');
    header.appendChild(el('span', 'sdx-card__logo', '♦ STEAMDEALX'));
    root.appendChild(header);
    const body = el('div', 'sdx-card__error-msg');
    body.appendChild(el('span', null, '⚠ ' + message));
    if (code) body.appendChild(el('div', 'sdx-card__error-code', code));
    root.appendChild(body);
    return root;
  }

  function renderNoDeals(ggDealsUrl) {
    const root = el('div', 'sdx-card sdx-card--no-deals');
    root.id = 'sdx-card-root';
    const header = el('div', 'sdx-card__header');
    header.appendChild(el('span', 'sdx-card__logo', '♦ STEAMDEALX'));
    root.appendChild(header);
    const body = el('div', 'sdx-card__no-deals');
    body.appendChild(el('span', null, 'Nenhuma oferta encontrada em lojas externas.'));
    if (ggDealsUrl) {
      const footer = el('div', 'sdx-card__footer');
      const link = el('a', 'sdx-card__ggdeals-link', 'Ver no gg.deals →');
      link.href = safeUrl(ggDealsUrl);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      footer.appendChild(link);
      root.appendChild(body);
      root.appendChild(footer);
    } else {
      root.appendChild(body);
    }
    return root;
  }

  function renderNotConfigured() {
    const root = el('div', 'sdx-card sdx-card--error');
    root.id = 'sdx-card-root';
    const header = el('div', 'sdx-card__header');
    header.appendChild(el('span', 'sdx-card__logo', '♦ STEAMDEALX'));
    root.appendChild(header);
    const body = el('div', 'sdx-card__error-msg');
    body.appendChild(el('span', null, 'Configure a URL da API no popup da extensão.'));
    root.appendChild(body);
    return root;
  }

  const MAX_OFFERS = 5;

  function buildOfferRow(offer, currency, index) {
    const isKeyshop = offer.type === 'Keyshop';
    const row = el('div', 'sdx-card__offer' + (index === 0 ? ' sdx-card__offer--best' : '') + (isKeyshop ? ' sdx-card__offer--keyshop' : ''));

    const link = el('a', 'sdx-card__offer-store', offer.store);
    link.href = safeUrl(offer.url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    row.appendChild(link);

    row.appendChild(el('span', 'sdx-card__offer-type', isKeyshop ? 'KEY' : 'RETAIL'));
    row.appendChild(el('span', 'sdx-card__offer-price', formatPrice(offer.price, currency)));

    if (offer.cutPercent > 0) {
      row.appendChild(el('span', 'sdx-card__offer-cut', `-${offer.cutPercent}%`));
    }
    return row;
  }

  function buildCard(data, collapsed) {
    const root = el('div', 'sdx-card' + (collapsed ? ' sdx-card--collapsed' : ''));
    root.id = 'sdx-card-root';
    const { offers = [], historicalLow, bundles = [], currency, region, ggDealsUrl } = data;

    // Header
    const header = el('div', 'sdx-card__header');
    header.appendChild(el('span', 'sdx-card__logo', '♦ STEAMDEALX'));

    const headerRight = el('div', 'sdx-card__header-right');
    headerRight.appendChild(el('span', 'sdx-card__region', region.toUpperCase()));
    const toggle = el('button', 'sdx-card__toggle', collapsed ? '▸' : '▾');
    toggle.title = collapsed ? 'Expandir' : 'Contrair';
    headerRight.appendChild(toggle);
    header.appendChild(headerRight);
    root.appendChild(header);

    // Body (collapsible)
    const body = el('div', 'sdx-card__body');

    // Historical low
    if (historicalLow != null) {
      const histRow = el('div', 'sdx-card__hist-low');
      histRow.appendChild(el('span', 'sdx-card__hist-label', 'Baixa histórica'));
      histRow.appendChild(el('span', 'sdx-card__hist-value', formatPrice(historicalLow, currency)));
      body.appendChild(histRow);
    }

    // Offers list: top N sorted by price ascending
    if (offers.length) {
      const sorted = [...offers].sort((a, b) => a.price - b.price).slice(0, MAX_OFFERS);
      const list = el('div', 'sdx-card__offers');
      sorted.forEach((o, i) => list.appendChild(buildOfferRow(o, currency, i)));
      body.appendChild(list);
    } else {
      const noDeals = el('div', 'sdx-card__no-deals');
      noDeals.appendChild(el('span', null, 'Nenhuma oferta encontrada em lojas externas.'));
      body.appendChild(noDeals);
    }

    // Active bundles
    if (bundles.length) {
      const bundleSection = el('div', 'sdx-card__bundles');
      bundleSection.appendChild(el('div', 'sdx-card__section-title', 'Bundles ativos'));
      bundles.forEach((b) => {
        const link = el('a', 'sdx-card__bundle');
        link.href = safeUrl(b.url);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.appendChild(el('span', 'sdx-card__bundle-title', b.title));
        link.appendChild(el('span', 'sdx-card__bundle-store', b.store));
        bundleSection.appendChild(link);
      });
      body.appendChild(bundleSection);
    }

    // Footer
    const footer = el('div', 'sdx-card__footer');
    if (ggDealsUrl) {
      const ggLink = el('a', 'sdx-card__ggdeals-link', 'Ver no gg.deals →');
      ggLink.href = safeUrl(ggDealsUrl);
      ggLink.target = '_blank';
      ggLink.rel = 'noopener noreferrer';
      footer.appendChild(ggLink);
    }
    body.appendChild(footer);
    root.appendChild(body);

    // Toggle collapse
    toggle.addEventListener('click', () => {
      const isNowCollapsed = !root.classList.toggle('sdx-card--collapsed');
      toggle.textContent = root.classList.contains('sdx-card--collapsed') ? '▸' : '▾';
      toggle.title = root.classList.contains('sdx-card--collapsed') ? 'Expandir' : 'Contrair';
      saveCollapsed(root.classList.contains('sdx-card--collapsed'));
    });

    return root;
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  const parsed = parseSteamUrl(location.href);
  if (!parsed) return;

  const [settings, collapsed] = await Promise.all([loadSettings(), loadCollapsed()]);
  if (!settings.enabled) return;

  const injectionPoint = findInjectionPoint();
  if (!injectionPoint) return;

  if (!settings.apiBaseUrl) {
    inject(injectionPoint, renderNotConfigured());
    return;
  }

  const loadingCard = renderLoading();
  inject(injectionPoint, loadingCard);

  const result = await fetchDealData(settings, parsed.type, parsed.id);

  let finalCard;
  if (result.notFound) {
    finalCard = renderNoDeals(null);
  } else if (result.rateLimited) {
    finalCard = renderError('Rate limit atingido. Tente recarregar em um minuto.', 'RATE_LIMITED');
  } else if (result.error) {
    finalCard = renderError(result.error, result.code ?? null);
  } else {
    finalCard = buildCard(result.data, collapsed);
  }

  loadingCard.replaceWith(finalCard);
})();
