'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const icons = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    diagonal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="1"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15M15 6v15"/></svg>',
    patron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM12 8v8M8.5 11.5h7"/></svg>',
    cards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/></svg>',
  };
  const groupNames = {};
  const config = window.SAINT_UI_CONFIG;
  const months = config.months;
  const views = { cards: { label: 'Kartice', target: 'saint-grid', note: 'Portreti i životopisi' }, list: { label: 'Popis', target: 'saint-list', note: 'Popis po kategorijama' }, calendar: { label: 'Kalendar', target: 'saint-calendar', note: 'Godišnji kalendar' }, map: { label: 'Karte', target: 'saint-map', note: 'Mjesta iz životopisa' } };
  const stored = readStorage('localStorage', 'saints-library:preferences', {});
  const session = readStorage('sessionStorage', 'saints-library:browsing', {});
  const state = { saints: [], byId: new Map(), visible: [], view: Object.hasOwn(views, stored.view) ? stored.view : 'cards', search: typeof session.search === 'string' ? session.search.slice(0, 200) : '', groups: new Set(), categories: new Set(), themes: new Set(), centuries: new Set(), saved: new Set(Array.isArray(stored.saved) ? stored.saved.filter(id => typeof id === 'string') : []), savedOnly: false, readingSize: [17, 19, 21].includes(stored.readingSize) ? stored.readingSize : 17, active: null, opener: null, originScroll: 0, data: null };
  const feastFeature = { people: [], index: 0, isToday: false };
  let storageNotice = false;
  let focusGeneration = 0;
  let calendarMonth = null;
  let mapView = null;
  function readStorage(kind, key, fallback) {
    try { const value = JSON.parse(window[kind]?.getItem(key) || 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; } catch { return fallback; }
  }
  function persist() {
    try { window.localStorage?.setItem('saints-library:preferences', JSON.stringify({ view: state.view, saved: [...state.saved], readingSize: state.readingSize })); }
    catch { if (!storageNotice) { storageNotice = true; showToast('Preglednik ne dopušta spremanje postavki. Odabiri vrijede dok je stranica otvorena.'); } }
  }
  function rememberPosition() {
    try { window.sessionStorage?.setItem('saints-library:browsing', JSON.stringify({ search: state.search, view: state.view, groups: [...state.groups], categories: [...state.categories], themes: [...state.themes], centuries: [...state.centuries], y: window.scrollY || 0, savedOnly: state.savedOnly })); } catch { /* Browsing also works without storage. */ }
  }
  const frame = callback => typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(callback) : callback();
  const documentURL = new URL(location.href);
  const libraryURL = new URL(window.SAINT_LIBRARY_URL || './', documentURL);
  const hostedProfiles = !window.SAINT_STANDALONE && location.protocol !== 'file:';
  $('#site-base').setAttribute('href', hostedProfiles ? libraryURL.href : documentURL.href);
  const dialog = $('#profile-dialog');
  const grid = $('#saint-grid');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hr').replace(/đ/g, 'd');
  const initials = name => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
  const sourceName = saint => saint.source?.publisher || (saint.source?.url?.includes('jesuits.global') ? 'Družba Isusova · jesuits.global' : 'Molitvenik · Zrno gorušice');
  const imageCredit = image => (image?.credit || 'Podaci o autoru slike nisu navedeni.').replace(/^Opći prikaz;\s*slika ovoga sveca nije dostupna\.\s*/i, '');
  const titlePrefixes = config.prefixes;
  const personTitle = saint => `${saint.honorific || titlePrefixes[saint.venerationStatus] || ''} ${saint.name}`.trim();
  const translationNote = saint => saint.venerationStatus === 'blessed' ? `<p class="translation-note">${saint.textProcessing === 'croatian-summary' ? 'Tekst je sažet i prilagođen uz pomoć umjetne inteligencije.' : 'Tekst je preveden i prilagođen uz pomoć umjetne inteligencije.'}</p>` : '';
  const matchesSelection = (saint, selection) => { const filter = config.filters.find(item => item.id === selection); return Boolean(filter && (filter.id === 'all' || filter.statuses?.includes(saint.venerationStatus) || (filter.groupId && filter.groupId === saint.groupId) || (filter.id === 'laity' && saint.isLayCompanion))); };
  const profileHash = saint => {
    const prefix = saint.venerationStatus === 'saint' ? 'sv' : saint.venerationStatus === 'blessed' ? 'bl' : 'sb';
    const slug = saint.venerationStatus === 'blessed' ? saint.id.replace(/^bl-/, '') : saint.id;
    return `#${prefix}-${encodeURIComponent(slug)}`;
  };
  const profileHref = saint => hostedProfiles ? new URL(`osoba/${profileHash(saint).slice(1)}/`, libraryURL).href : new URL(profileHash(saint), documentURL).href;
  const feastsOf = saint => [...(saint.feast ? [saint.feast] : []), ...(saint.additionalFeasts || [])];
  const feastOrder = saint => Math.min(9999, ...feastsOf(saint).map(feast => feast.month * 100 + feast.day));
  const feastScope = saint => saint.feast?.kind === 'anniversary' ? 'Spomendan' : feastsOf(saint).length > 1 ? 'Spomendani' : saint.feast?.scope === 'group' ? 'Spomendan skupine' : 'Spomendan';
  const feastText = saint => feastsOf(saint).map(feast => feast.label + (feast.groupLabel ? ` (${feast.groupLabel})` : '')).join(' · ') || 'Datum nije naveden u izvoru';
  let toastTimer;

  function placeholder(saint) {
    return `<div class="card-placeholder"><strong aria-hidden="true">${esc(initials(saint.name))}</strong><span>Portret nije dostupan</span></div>`;
  }

  function imageHTML(saint, large = false, compact = false) {
    const image = saint.portrait;
    if (!image?.src) return placeholder(saint);
    const src = !large && image.thumbSrc ? image.thumbSrc : image.src;
    const alt = image.isGroup ? (image.caption || image.alt || 'Zajednički prikaz mučenika') : (image.alt || personTitle(saint));
    const thumbWidth = image.thumbWidth || 600;
    const fullWidth = image.width || 1200;
    const sizes = compact ? '60px' : large ? '(max-width: 700px) 90vw, 360px' : '(max-width: 700px) 90px, (max-height: 500px) and (pointer: coarse) 90px, (max-width: 850px) 44vw, 30vw';
    const srcset = image.thumbSrc && thumbWidth !== fullWidth ? ` srcset="${esc(image.thumbSrc)} ${thumbWidth}w, ${esc(image.src)} ${fullWidth}w" sizes="${sizes}"` : '';
    return `<img src="${esc(src)}"${srcset} alt="${esc(alt)}" ${large ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" data-portrait="${esc(saint.id)}">`;
  }

  function saveButton(saint, compact = false) {
    const saved = state.saved.has(saint.id);
    return `<button type="button" class="save-button ${saved ? 'is-saved' : ''} ${compact ? 'save-compact' : ''}" data-save="${esc(saint.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Ukloni spremljeni profil' : 'Spremi profil'}: ${esc(personTitle(saint))}" title="${saved ? 'Ukloni iz spremljenih' : 'Spremi profil'}">${icons.bookmark}<span>${saved ? 'Spremljeno' : 'Spremi'}</span></button>`;
  }

  function cardHTML(saint) {
    return `<article class="saint-card" data-card="${esc(saint.id)}">
      <a class="card-art-button" href="${profileHref(saint)}" data-open="${esc(saint.id)}" aria-label="Otvori životopis: ${esc(personTitle(saint))}">${imageHTML(saint)}</a>
      <div class="card-body"><div class="card-heading"><p class="card-kicker">${esc(saint.groupLabel || groupNames[saint.groupId] || 'Iz zbirke')}</p>
      <h3 class="card-name"><a href="${profileHref(saint)}" data-open="${esc(saint.id)}">${esc(personTitle(saint))}</a></h3><p class="card-life">${esc(saint.life || (saint.roles || []).slice(0, 2).join(' · '))}</p></div>
      <p class="card-summary">${esc(saint.summary)}</p>${translationNote(saint)}<div class="card-facts">
      <div class="card-fact">${icons.calendar}<div><span class="card-fact-label">${feastScope(saint)}</span><span class="card-fact-value ${saint.feast ? '' : 'missing'}">${esc(feastText(saint))}</span></div></div>
      ${saint.patronage?.length ? `<div class="card-fact">${icons.patron}<div><span class="card-fact-label">Zaštitništvo</span><span class="card-fact-value">${esc(saint.patronage.join(' · '))}</span></div></div>` : ''}
      </div><div class="card-actions"><button class="card-open" type="button" data-open="${esc(saint.id)}">Pročitaj životopis ${icons.arrow}</button>${saveButton(saint, true)}</div></div>
    </article>`;
  }

  function filterDefinitions() {
    return [
      { key: 'theme', title: 'Djelovanje', container: 'theme-filters', summary: 'theme-selection', selected: state.themes,
        options: (state.data?.lifeThemes || []).map(theme => ({ id: theme.id, label: theme.name })), matches: (saint, id) => saint.lifeThemes.includes(id) },
      { key: 'century', title: 'Razdoblje', container: 'century-filters', summary: 'century-selection', selected: state.centuries,
        options: (state.data?.centuries || []).map(century => ({ id: century, label: `${century}. stoljeće` })), matches: (saint, id) => saint.centuries.includes(id) },
      { key: 'veneration', title: 'Status', container: 'veneration-filters', summary: 'group-selection', selected: state.groups,
        options: config.filters.filter(filter => filter.id !== 'all'), matches: matchesSelection },
      { key: 'category', title: 'Skupine', container: 'category-filters', summary: 'category-selection', selected: state.categories,
        options: (state.data?.categories || []).map(category => ({ id: category.id, label: category.name })), matches: (saint, id) => saint.groupId === id },
    ];
  }

  const matchesFilter = (saint, filter) => !filter.selected.size || [...filter.selected].some(id => filter.matches(saint, id));
  const matchesThemes = saint => !state.themes.size || saint.lifeThemes.some(id => state.themes.has(id));
  const matchesCenturies = saint => !state.centuries.size || saint.centuries.some(century => state.centuries.has(century));
  const matchesName = (saint, terms) => saint.searchNames.some(name => terms.every(term => name.includes(term)));
  const matchesBase = (saint, terms) => (!state.categories.size || state.categories.has(saint.groupId)) && (!state.groups.size || [...state.groups].some(id => matchesSelection(saint, id))) && (!state.savedOnly || state.saved.has(saint.id)) && matchesName(saint, terms);

  function buildDiscoveryFilters() {
    for (const filter of filterDefinitions()) {
      $(`#${filter.container}`).innerHTML = [{ id: 'all', label: 'Sve' }, ...filter.options].map(option => `<button type="button" class="discovery-option" data-${filter.key}="${esc(option.id)}" aria-pressed="false">${esc(option.label)}<span></span></button>`).join('');
    }
  }

  function renderDiscoveryFilters(terms) {
    const filters = filterDefinitions();
    const base = state.saints.filter(saint => (!state.savedOnly || state.saved.has(saint.id)) && matchesName(saint, terms));
    for (const filter of filters) {
      const candidates = base.filter(saint => filters.every(other => other.key === filter.key || matchesFilter(saint, other)));
      for (const button of $(`#${filter.container}`).querySelectorAll('button')) {
        const raw = button.dataset[filter.key];
        const option = filter.options.find(option => String(option.id) === raw);
        const all = raw === 'all';
        const label = all ? 'Sve' : option.label;
        const count = all ? candidates.length : candidates.filter(saint => filter.matches(saint, option.id)).length;
        button.setAttribute('aria-pressed', String(all ? !filter.selected.size : filter.selected.has(option.id)));
        button.setAttribute('aria-label', `${label} · ${count} u zbirci`);
        const counter = $('span', button); if (counter) counter.textContent = count;
      }
      $(`#${filter.summary}`).textContent = filter.selected.size ? `Odabrano: ${filter.selected.size}` : 'Sve';
    }
    const selectedCount = filters.reduce((sum, filter) => sum + filter.selected.size, 0);
    $('#filter-selection').hidden = !selectedCount;
    $('#filter-selection').textContent = selectedCount;
    $('#filter-selection').setAttribute('aria-label', `Broj odabranih stavki: ${selectedCount}`);
    $('#apply-filters').textContent = `Prikaži rezultate · ${state.visible.length}`;
    $('#active-filters').hidden = !selectedCount;
    $('#active-filters').innerHTML = filters.flatMap(filter => filter.options.filter(option => filter.selected.has(option.id)).map(option => `<button type="button" class="active-filter" data-remove-${filter.key}="${esc(option.id)}" aria-label="Ukloni filtar ${filter.title}: ${esc(option.label)}">${esc(option.label)}<span aria-hidden="true">×</span></button>`)).join('');
  }

  function resetFilters() {
    state.groups.clear(); state.categories.clear(); state.savedOnly = false;
    state.themes.clear(); state.centuries.clear();
    clearSearch();
    $('#saint-search').focus({ preventScroll: true });
  }

  function buildViewSwitch() {
    $('#collection-views').innerHTML = Object.entries(views).map(([key, view]) => `<button type="button" data-view="${key}" aria-controls="${view.target}" aria-pressed="${key === state.view}">${icons[key === 'calendar' ? 'calendar' : key]}<span>${view.label}</span></button>`).join('');
  }

  function listRowHTML(saint) {
    return `<li data-list-item="${esc(saint.id)}"><button class="saint-list-open" type="button" data-open="${esc(saint.id)}">
      <span class="list-portrait">${imageHTML(saint, false, true)}</span>
      <span class="list-person"><strong>${esc(personTitle(saint))}</strong><span>${esc(saint.life || (saint.roles || []).join(' · '))}</span></span>
      <span class="list-fact"><span class="list-fact-label">${feastScope(saint)}</span>${esc(feastText(saint))}</span>
      ${saint.patronage?.length ? `<span class="list-fact list-patronage"><span class="list-fact-label">Zaštitništvo</span>${esc(saint.patronage.join(' · '))}</span>` : ''}
      <span class="list-arrow">${icons.diagonal}</span></button></li>`;
  }

  function renderList() {
    const groups = Object.keys(groupNames).map(key => ({ key, saints: state.visible.filter(saint => saint.groupId === key) })).filter(group => group.saints.length);
    state.visible = groups.flatMap(group => group.saints);

    $('#saint-list').innerHTML = groups.map(group => `<section class="list-category" aria-labelledby="list-group-${group.key}" data-list-group="${group.key}"><div class="list-category-heading"><h3 id="list-group-${group.key}" tabindex="-1">${esc(groupNames[group.key])}</h3><span>${group.saints.length} u zbirci</span></div><ul class="saint-list">${group.saints.map(listRowHTML).join('')}</ul></section>`).join('');
  }

  function renderCalendar() {
    const now = new Date();
    const todayMonth = now.getMonth() + 1, todayDay = now.getDate();
    state.visible.sort((a, b) => {
      return feastOrder(a) - feastOrder(b) || a.name.localeCompare(b.name, 'hr');
    });
    const monthSections = months.map((name, index) => {
      const month = index + 1;
      const entries = state.visible.flatMap(saint => feastsOf(saint).filter(feast => feast.month === month).map(feast => ({ saint, feast }))).sort((a, b) => a.feast.day - b.feast.day || a.saint.name.localeCompare(b.saint.name, 'hr'));
      const days = new Map();
      for (const entry of entries) {
        if (!days.has(entry.feast.day)) days.set(entry.feast.day, []);
        days.get(entry.feast.day).push(entry);
      }
      if (month === todayMonth && !days.has(todayDay)) days.set(todayDay, []);
      const eventHTML = ({ saint, feast }) => `<button class="calendar-event" type="button" data-calendar-item="${esc(saint.id)}" data-open="${esc(saint.id)}"><span>${esc(personTitle(saint))}</span>${feast.kind === 'anniversary' ? '<small>Spomendan</small>' : feast.scope === 'group' ? `<small>${esc(feast.groupLabel || 'Spomendan skupine')}</small>` : ''}</button>`;
      const events = [...days].sort(([a], [b]) => a - b).map(([day, people]) => {
        const isToday = month === todayMonth && day === todayDay;
        const label = people[0]?.feast.label || now.toLocaleDateString('hr-HR', { day: 'numeric', month: 'long' });
        return `<li class="feast-day${isToday ? ' is-today' : ''}" data-calendar-date="${month}-${day}"${people.length ? ` data-feast-day="${month}-${day}"` : ''}${isToday ? ' aria-current="date" tabindex="-1"' : ''}><span class="feast-day-number" aria-label="${esc(label)}">${day}.</span><div class="feast-day-people">${isToday ? '<span class="today-label">Danas</span>' : ''}${people.length > 1 ? `<span class="day-count">${people.length} u zbirci</span>` : ''}${people.map(eventHTML).join('')}${!people.length ? '<p class="calendar-day-empty">Za ovaj datum nema zapisa u odabranom prikazu.</p>' : ''}</div></li>`;
      }).join('');
      return `<section class="calendar-month" data-calendar-month="${month}" aria-labelledby="calendar-month-${month}"><div class="calendar-month-heading"><h3 id="calendar-month-${month}" tabindex="-1">${name}</h3><span class="calendar-month-count">${entries.length} zapisa</span></div>${events ? `<ol class="feast-days">${events}</ol>` : '<p class="calendar-month-empty">Nema navedenih spomendana.</p>'}</section>`;
    }).join('');
    const unknown = state.visible.filter(saint => !feastsOf(saint).length);
    const unknownSection = unknown.length ? `<section class="calendar-undated" aria-labelledby="calendar-undated-title"><h3 id="calendar-undated-title">Datum nije naveden u izvoru</h3><div>${unknown.map(saint => `<button class="calendar-event" type="button" data-calendar-item="${esc(saint.id)}" data-open="${esc(saint.id)}">${esc(personTitle(saint))}</button>`).join('')}</div></section>` : '';
    $('#saint-calendar').innerHTML = state.visible.length ? `<nav class="calendar-navigation" aria-label="Prijeđi na mjesec"><button type="button" data-calendar-today>Danas</button><div class="calendar-month-links">${months.map((name, index) => `<button type="button" data-jump-month="${index + 1}" aria-label="${name}">${name.slice(0, 3)}.</button>`).join('')}</div><label class="calendar-month-picker" for="calendar-month-picker"><span class="visually-hidden">Prijeđi na mjesec</span><select id="calendar-month-picker"><option value="" disabled${calendarMonth ? '' : ' selected'}>Odaberite mjesec</option>${months.map((name, index) => `<option value="${index + 1}"${calendarMonth === index + 1 ? ' selected' : ''}>${name}</option>`).join('')}</select></label></nav><p class="calendar-note">Godišnji pregled spomendana. Datum proslave može se razlikovati od datuma smrti; godišnjice su posebno označene.</p><div class="calendar-months">${monthSections}</div>${unknownSection}` : '';
  }

  function renderCollection() {
    const query = fold(state.search).trim();
    const terms = query.split(/\s+/).filter(Boolean);
    state.visible = state.saints.filter(saint => matchesBase(saint, terms) && matchesThemes(saint) && matchesCenturies(saint));
    state.visible.sort((a, b) => (query ? searchScore(b, query, terms) - searchScore(a, query, terms) : 0) || a.name.localeCompare(b.name, 'hr'));
    for (const [key, view] of Object.entries(views)) {
      const container = $(`#${view.target}`);
      container.hidden = state.view !== key;
      if (container.hidden && key !== 'map') container.innerHTML = '';
    }
    if (state.view === 'list') renderList();
    else if (state.view === 'calendar') renderCalendar();
    else if (state.view === 'map') {
      if (!mapView && window.SaintMapView) mapView = new window.SaintMapView($('#saint-map'), state.saints, { personTitle, profileHref });
      mapView?.update(state.visible);
    }
    else grid.innerHTML = state.visible.map(cardHTML).join('');
    grid.setAttribute('aria-busy', 'false');
    $('#empty-state').hidden = state.visible.length > 0;
    const filtered = Boolean(state.search) || state.groups.size > 0 || state.categories.size > 0 || state.savedOnly || state.themes.size > 0 || state.centuries.size > 0;
    $('#results-count').innerHTML = filtered ? `Prikazano <strong>${state.visible.length}</strong> od ${state.saints.length}` : `<strong>${state.saints.length}</strong> u zbirci`;
    $('#clear-search').hidden = !state.search;
    $('#reset-filters').hidden = !filtered;
    renderDiscoveryFilters(terms);
    for (const button of $('#collection-views').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    $('#view-description').textContent = views[state.view].note;
    $('#saved-count').textContent = state.saved.size;
    $('#saved-filter').setAttribute('aria-pressed', String(state.savedOnly));
    $('#empty-state h3')?.replaceChildren?.(document.createTextNode(state.savedOnly && !state.saved.size ? 'Još nema spremljenih profila.' : 'Nema rezultata.'));
    persist();
    rememberPosition();
  }

  function clearSearch() {
    state.search = '';
    $('#saint-search').value = '';
    renderCollection();
  }

  function searchScore(saint, query, terms) {
    const names = saint.searchNames;
    if (names.includes(query)) return 1000;
    if (names.some(name => name.startsWith(query))) return 900;
    if (names.some(name => terms.every(term => name.split(/[\s-]+/).some(word => word.startsWith(term))))) return 800;
    if (names.some(name => terms.every(term => name.includes(term)))) return 700;
    return 100;
  }

  function jumpTo(selector, focusSelector) {
    const target = $(selector);
    if (!target) return;
    focusGeneration++;
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    const focus = focusSelector ? $(focusSelector, target) : target;
    if (focus?.focus) focus.focus({ preventScroll: true });
  }

  function showCalendarDay(month, day, reset = false) {
    if (reset) { state.groups.clear(); state.categories.clear(); state.savedOnly = false; state.search = ''; state.themes.clear(); state.centuries.clear(); $('#saint-search').value = ''; }
    calendarMonth = month;
    state.view = 'calendar'; renderCollection();
    const today = $(`[data-calendar-date="${month}-${day}"]`);
    if (today) {
      const more = $('details', today); if (more) more.open = true;
      today.scrollIntoView({ block: 'start', behavior: 'instant' });
      ($('button', today) || today).focus({ preventScroll: true });
    } else {
      jumpTo(`[data-calendar-month="${month}"]`, 'h3');
      showToast('Za današnji dan nema zapisa u odabranom prikazu.');
    }
  }

  function jumpToMonth(month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) return;
    calendarMonth = month;
    const picker = $('#calendar-month-picker');
    if (picker) picker.value = String(month);
    jumpTo(`[data-calendar-month="${month}"]`, 'h3');
  }

  function renderFeastPerson(index = 0) {
    const people = feastFeature.people;
    if (!people.length) return;
    feastFeature.index = (index + people.length) % people.length;
    const { saint, feast } = people[feastFeature.index];
    $('#feast-banner-label').textContent = feastFeature.isToday
      ? `Spomendan (${feast.label})`
      : 'Nadolazeći spomendan u zbirci';
    $('#feast-upcoming-note').hidden = feastFeature.isToday;
    $('#feast-banner-name').textContent = personTitle(saint);
    $('#feast-life').textContent = saint.life || '';
    $('#feast-life').hidden = !saint.life;
    $('#feast-roles').textContent = (saint.roles || []).join(' · ');
    $('#feast-summary').textContent = saint.summary;
    $('#feast-banner-date').textContent = feast.label;
    $('#feast-portrait').innerHTML = imageHTML(saint, true);
    for (const id of ['feast-portrait', 'feast-biography']) {
      const link = $(`#${id}`);
      link.setAttribute('href', profileHref(saint));
      link.dataset.open = saint.id;
      link.setAttribute('aria-label', `Pročitaj životopis: ${personTitle(saint)}`);
    }
    const sharedImage = saint.portrait?.isGroup || /skupin|zajednički|suputni/i.test(saint.portrait?.alt || '');
    $('#feast-image-caption').textContent = sharedImage ? (saint.portrait.caption || 'Prikaz skupine mučenika') : '';
    $('#feast-image-caption').hidden = !sharedImage;
    $('#feast-calendar').dataset.day = `${feast.month}-${feast.day}`;
    $('#feast-position').textContent = `${feastFeature.index + 1} od ${people.length}`;
    $('#feast-select').value = String(feastFeature.index);
    for (const button of $('#feast-choices').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.feastPerson) === feastFeature.index));
    }
    $('#feast-announcement').textContent = `${personTitle(saint)}, ${feastFeature.index + 1} od ${people.length}`;
  }

  function prepareFeastBanner() {
    const today = new Date();
    const month = today.getMonth() + 1, day = today.getDate();
    const entries = state.saints.flatMap(saint => feastsOf(saint).map(feast => ({ saint, feast })));
    const current = entries.filter(entry => entry.feast.month === month && entry.feast.day === day);
    feastFeature.isToday = current.length > 0;
    const entry = current[0] || entries.map(item => {
      const date = new Date(today.getFullYear(), item.feast.month - 1, item.feast.day);
      if (date < new Date(today.getFullYear(), month - 1, day)) date.setFullYear(date.getFullYear() + 1);
      return { ...item, date };
    }).sort((a, b) => a.date - b.date)[0];
    if (!entry) return;
    // A person can have both an individual and a group observance on one date.
    feastFeature.people = [...new Map(entries.filter(item => item.feast.month === entry.feast.month && item.feast.day === entry.feast.day).map(item => [item.saint.id, item])).values()];
    const people = feastFeature.people;
    const many = people.length > 6;
    $('#feast-people-count').textContent = `${people.length} u zbirci`;
    $('#feast-navigation').hidden = people.length < 2;
    $('#feast-selector').hidden = people.length < 2;
    $('#feast-choices').hidden = many;
    $('#feast-choices').innerHTML = many || people.length < 2 ? '' : people.map(({ saint }, index) => `<button type="button" class="feast-choice" data-feast-person="${index}" aria-pressed="false"><span class="feast-thumbnail">${imageHTML(saint, false, true)}</span><span>${esc(personTitle(saint))}</span></button>`).join('');
    $('#feast-select-wrap').hidden = !many;
    $('#feast-select').innerHTML = many ? people.map(({ saint }, index) => `<option value="${index}">${esc(personTitle(saint))}</option>`).join('') : '';
    renderFeastPerson();
    $('#feast-banner').hidden = false;
  }

  function prepareCredits() {
    const artworks = new Map();
    for (const saint of state.saints) {
      if (!saint.portrait?.src) continue;
      const key = saint.portrait.sourceUrl || saint.portrait.src;
      if (!artworks.has(key)) artworks.set(key, { image: saint.portrait, names: [] });
      artworks.get(key).names.push(personTitle(saint));
    }
    $('#image-credits-list').innerHTML = Array.from(artworks.values()).map(({ image, names }) => `<li><strong>${esc(names.join(' · '))}</strong>${esc(imageCredit(image))}<br><a href="${esc(image.sourceUrl || image.sourcePage || '')}" target="_blank" rel="noopener noreferrer">Izvor slike ↗</a></li>`).join('');
    if (state.data.collectedAt) {
      const date = new Intl.DateTimeFormat('hr', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(state.data.collectedAt));
      $('#source-date').textContent = `Izvori prikupljeni ${date}`;
    }
  }

  function factsHTML(saint) {
    const facts = [
      { label: feastScope(saint), value: feastText(saint), missing: !feastsOf(saint).length },
      { label: 'Zaštitništvo', value: saint.patronage?.length ? saint.patronage.join(' · ') : 'Nije navedeno u izvoru', missing: !saint.patronage?.length },
    ];
    if (saint.life) facts.push({ label: 'Životni vijek', value: saint.life });
    if (saint.lifeThemes.length) facts.push({ label: 'Djelovanje', value: state.data.lifeThemes.filter(theme => saint.lifeThemes.includes(theme.id)).map(theme => theme.name).join(' · ') });
    if (saint.centuries.length) facts.push({ label: 'Razdoblje', value: saint.centuries.map(century => `${century}.`).join(', ') + ' stoljeće' });
    if (saint.lifePeriod?.limitations && !saint.workbook) facts.push({ label: 'Podaci o razdoblju', value: saint.lifePeriod.limitations });
    const seen = new Set(facts.map(fact => fold(fact.label)));
    for (const fact of saint.details || []) {
      const label = fold(fact.label);
      if (label === 'slavi se' || label === 'zastitnik / zastitnica' || seen.has(label)) continue;
      if (saint.source?.isShared && !saint.life && /zivotni vijek/.test(label)) continue;
      seen.add(label);
      facts.push(fact);
    }
    return facts.map(fact => `<div><dt>${esc(fact.label)}</dt><dd${fact.missing ? ' class="missing"' : ''}>${esc(fact.value)}</dd></div>`).join('');
  }

  function renderProfile(saint) {
    state.active = saint.id;
    $('#profile-name').textContent = personTitle(saint);
    $('#profile-group').textContent = saint.groupLabel || '';
    $('#profile-index').textContent = `${String(saint.number).padStart(2, '0')} / ${state.saints.length}`;
    $('#profile-roles').textContent = (saint.roles || []).join(' · ');
    $('#profile-life').textContent = saint.life || '';
    $('#profile-life').hidden = !saint.life;
    $('#profile-summary').textContent = saint.summary;
    $('#profile-portrait').innerHTML = imageHTML(saint, true);
    $('#profile-save').innerHTML = saveButton(saint);
    $('#profile-toast').hidden = true;
    updateReadingSize();
    $('#profile-image-caption').innerHTML = `${esc(imageCredit(saint.portrait))}${saint.portrait?.sourceUrl ? `<br><a href="${esc(saint.portrait.sourceUrl)}" target="_blank" rel="noopener noreferrer">Pogledaj izvornu sliku ↗</a>` : ''}`;
    $('#profile-facts').innerHTML = factsHTML(saint);
    const isShared = saint.biographyScope === 'group';
    const notice = isShared ? `<p class="shared-notice">Ovaj je svetac dio zajedničkog izvora „${esc(saint.source.title)}”. U nastavku je prikazan životopis skupine ili zajednički prikaz mučeništva; podaci iz zajedničkog izvora posebno su označeni.</p>` : '';
    const heading = isShared ? 'Zajednički životopis' : 'Život i svjedočanstvo';
    const language = saint.biographyLanguage === 'en' && !saint.biographyHtml.includes('Izvorni životopis') ? '<p class="source-language">Izvorni životopis na engleskom jeziku</p>' : '';
    $('#profile-biography').innerHTML = `${notice}<section class="source-prose"><h3>${heading}</h3>${language}${saint.biographyHtml || `<p>${esc(saint.summary)}</p>`}</section>${translationNote(saint)}<p class="biography-read-more"><a href="${esc(saint.source.url)}" target="_blank" rel="noopener noreferrer">Pročitaj više na izvornoj stranici ↗</a></p>`;
    $('#profile-devotions').innerHTML = saint.devotionsHtml ? `<section class="source-prose devotions" aria-label="Molitve, misli i dodatni sadržaji">${saint.devotionsHtml}</section>` : '';
    const relatedIds = new Set([...(saint.relatedSaints || []), ...state.saints.filter(other => other.id !== saint.id && other.source.url === saint.source.url).map(other => other.id)]);
    const related = [...relatedIds].map(id => state.byId.get(id)).filter(Boolean);
    $('#profile-related').hidden = !related.length;
    $('#profile-related').innerHTML = related.length ? `<p class="section-label">Povezane priče u zbirci</p><div class="related-items">${related.map(person => `<button class="related-saint" type="button" data-open="${esc(person.id)}">${esc(personTitle(person))} ↗</button>`).join('')}</div>` : '';
    $('#profile-source').innerHTML = `<span>Izvori podataka i životopisa</span><a href="${esc(saint.source.url)}" target="_blank" rel="noopener noreferrer">${esc(saint.source.title)} ↗</a><span>${esc(sourceName(saint))}${saint.source.isShared ? ' · zajednički izvor' : ''}</span>`;
    for (const source of saint.supplementalSources || []) $('#profile-source').innerHTML += source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>` : `<span>${esc(source.title)}</span>`;
    $('#profile-scroll').scrollTop = 0;
    dialog.scrollTop = 0;
    document.title = `${personTitle(saint)} — Isusovački sveci i blaženici`;
  }

  function openProfile(id, push = true, opener = null) {
    const saint = state.byId.get(id);
    if (!saint) return;
    if (!dialog.open) {
      state.opener = opener && typeof opener.focus === 'function' ? opener : document.activeElement;
      if (state.opener === document.body) state.opener = $(`[data-open="${saint.id}"]`) || state.opener;
      state.originScroll = !push && Number.isFinite(session.y) ? session.y : window.scrollY || 0;
      rememberPosition();
    }
    renderProfile(saint);
    if (push) {
      const method = dialog.open ? 'replaceState' : 'pushState';
      history[method]({ saintProfile: true }, '', profileHref(saint));
    }
    if (!dialog.open) {
      dialog.showModal();
      document.body.classList.add('dialog-open');
      $('#close-profile').focus({ preventScroll: true });
    }
  }

  function closeProfile() {
    if (!dialog.open) return;
    dialog.close();
    document.body.classList.remove('dialog-open');
    state.active = null;
    document.title = 'Isusovački sveci i blaženici';
    const opener = state.opener, originScroll = state.originScroll;
    const generation = ++focusGeneration;
    // Restore after Back has finished its fragment navigation and focus changes.
    frame(() => {
      if (dialog.open || generation !== focusGeneration) return;
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
      else $('#saint-search').focus({ preventScroll: true });
      window.scrollTo?.({ top: originScroll, behavior: 'instant' });
    });
  }

  function requestClose() {
    if (history.state?.saintProfile) history.back();
    else {
      history.replaceState(null, '', new URL('#zbirka', hostedProfiles ? libraryURL : documentURL).href);
      closeProfile();
    }
  }

  function syncHash() {
    const fromHash = /^#(?:sv|bl|sb)-.+$/.test(location.hash);
    const saint = state.saints.find(person => fromHash
      ? profileHash(person) === location.hash
      : hostedProfiles && new URL(profileHref(person)).pathname === location.pathname);
    if (saint) {
      if (hostedProfiles && fromHash) history.replaceState(history.state, '', profileHref(saint));
      openProfile(saint.id, false);
    } else closeProfile();
  }

  function adjacentProfile(offset) {
    const list = state.visible.some(saint => saint.id === state.active) ? state.visible : state.saints;
    const index = list.findIndex(saint => saint.id === state.active);
    const next = list[(index + offset + list.length) % list.length];
    if (next) openProfile(next.id);
  }

  function showToast(message) {
    const toast = $(dialog.open ? '#profile-toast' : '#toast');
    toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  async function copyLink() {
    try {
      const saint = state.byId.get(state.active);
      const url = !window.SAINT_STANDALONE && location.protocol !== 'file:' && saint ? new URL(profileHref(saint), libraryURL).href : location.href;
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const input = document.createElement('textarea'); input.value = url;
        input.style.position = 'fixed'; input.style.opacity = '0'; dialog.append(input);
        input.select(); const success = document.execCommand('copy'); input.remove();
        if (!success) throw new Error('Copy unavailable');
      }
      showToast('Poveznica na životopis je kopirana.');
    } catch { showToast('Poveznicu možete kopirati iz adresne trake preglednika.'); }
  }

  function updateReadingSize() {
    dialog.style.setProperty?.('--reading-size', `${state.readingSize}px`);
    $('#reading-size-value').textContent = `${state.readingSize}`;
    $('#reading-smaller').disabled = state.readingSize === 17;
    $('#reading-larger').disabled = state.readingSize === 21;
  }

  function toggleSaved(id) {
    if (!state.byId.has(id)) return;
    if (state.saved.has(id)) state.saved.delete(id); else state.saved.add(id);
    persist();
    const saved = state.saved.has(id);
    for (const button of document.querySelectorAll?.('[data-save]') || []) {
      if (button.dataset.save !== id) continue;
      button.setAttribute('aria-pressed', String(saved));
      button.classList.toggle('is-saved', saved);
      button.setAttribute('aria-label', `${saved ? 'Ukloni spremljeni profil' : 'Spremi profil'}: ${personTitle(state.byId.get(id))}`);
      const label = $('span', button); if (label) label.textContent = saved ? 'Spremljeno' : 'Spremi';
    }
    $('#saved-count').textContent = state.saved.size;
    if (state.savedOnly) { renderCollection(); if (!dialog.open) $('#saved-filter').focus({ preventScroll: true }); }
    showToast(saved ? 'Profil je spremljen na ovom uređaju.' : 'Profil je uklonjen iz spremljenih.');
  }

  function prepareOffline() {
    if (window.SAINT_STANDALONE || location.protocol === 'file:' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(new URL('sw.js', libraryURL).href).catch(() => {});
  }

  function attachEvents() {
    document.addEventListener('click', event => {
      const save = event.target.closest('[data-save]');
      if (save) { toggleSaved(save.dataset.save); return; }
      const month = event.target.closest('[data-jump-month]');
      if (month) { jumpToMonth(Number(month.dataset.jumpMonth)); return; }
      if (event.target.closest('[data-calendar-today]')) { const now = new Date(); showCalendarDay(now.getMonth() + 1, now.getDate()); return; }
      const opener = event.target.closest('[data-open]');
      if (opener && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !(event.button > 0)) { event.preventDefault(); openProfile(opener.dataset.open, true, opener); }
    });
    $('#saint-search').addEventListener('input', event => { state.search = event.target.value.slice(0, 200); renderCollection(); });
    $('#saint-calendar').addEventListener('change', event => {
      if (event.target.id === 'calendar-month-picker') jumpToMonth(Number(event.target.value));
    });
    $('#saved-filter').addEventListener('click', () => { state.savedOnly = !state.savedOnly; renderCollection(); });
    $('#feast-calendar').addEventListener('click', () => { const [month, day] = $('#feast-calendar').dataset.day.split('-').map(Number); showCalendarDay(month, day, true); });
    $('#feast-previous').addEventListener('click', () => renderFeastPerson(feastFeature.index - 1));
    $('#feast-next').addEventListener('click', () => renderFeastPerson(feastFeature.index + 1));
    $('#feast-choices').addEventListener('click', event => {
      const choice = event.target.closest('[data-feast-person]');
      if (choice) renderFeastPerson(Number(choice.dataset.feastPerson));
    });
    $('#feast-select').addEventListener('change', event => renderFeastPerson(Number(event.target.value)));
    $('#reading-smaller').addEventListener('click', () => { state.readingSize = Math.max(17, state.readingSize - 2); updateReadingSize(); persist(); });
    $('#reading-larger').addEventListener('click', () => { state.readingSize = Math.min(21, state.readingSize + 2); updateReadingSize(); persist(); });
    for (const key of ['theme', 'century', 'veneration', 'category']) {
      const container = { theme: 'theme-filters', century: 'century-filters', veneration: 'veneration-filters', category: 'category-filters' }[key];
      $(`#${container}`).addEventListener('click', event => {
        const button = event.target.closest(`[data-${key}]`);
        if (!button || !state.data) return;
        const filter = filterDefinitions().find(filter => filter.key === key);
        const raw = button.dataset[key];
        if (raw === 'all') filter.selected.clear();
        else {
          const option = filter.options.find(option => String(option.id) === raw);
          if (!option) return;
          if (filter.selected.has(option.id)) filter.selected.delete(option.id); else filter.selected.add(option.id);
        }
        renderCollection();
      });
    }
    $('#active-filters').addEventListener('click', event => {
      let removed = false;
      for (const filter of filterDefinitions()) {
        const button = event.target.closest(`[data-remove-${filter.key}]`);
        if (!button) continue;
        const raw = button.dataset[`remove${filter.key[0].toUpperCase()}${filter.key.slice(1)}`];
        const option = filter.options.find(option => String(option.id) === raw);
        if (option) { filter.selected.delete(option.id); removed = true; }
      }
      if (!removed) return;
      renderCollection();
      const remaining = $('#active-filters').querySelector('button');
      (remaining || $('#saint-search')).focus({ preventScroll: true });
    });
    $('#collection-views').addEventListener('click', event => {
      const button = event.target.closest('[data-view]');
      if (button && views[button.dataset.view]) {
        state.view = button.dataset.view;
        renderCollection();
        $('#zbirka').scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    });
    $('#clear-search').addEventListener('click', clearSearch);
    $('#empty-reset').addEventListener('click', resetFilters);
    $('#reset-filters').addEventListener('click', resetFilters);
    $('#apply-filters').addEventListener('click', () => {
      $('#filters-panel').open = false;
      jumpTo('#results-count');
    });
    $('#reveal-developer-contact').addEventListener('click', () => {
      const address = String.fromCharCode(107, 97, 114, 108, 111, 46, 103, 114, 108, 105, 99, 104, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109);
      const link = $('#developer-email');
      link.textContent = address;
      link.setAttribute('href', `mailto:${address}`);
      link.hidden = false;
      $('#reveal-developer-contact').hidden = true;
      link.focus();
    });
    $('#hero-collection').addEventListener('click', event => {
      // Preserve native modified-click navigation on this real anchor.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
      event.preventDefault();
      history.replaceState(null, '', `${location.pathname}${location.search}#zbirka`);
      jumpTo('#zbirka', '#collection-title');
    });
    $('#random-saint').addEventListener('click', event => { if (state.saints.length) openProfile(state.saints[Math.floor(Math.random() * state.saints.length)].id, true, event.currentTarget); });
    $('#close-profile').addEventListener('click', requestClose);
    dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose(); } });
    $('#previous-profile').addEventListener('click', () => adjacentProfile(-1));
    $('#next-profile').addEventListener('click', () => adjacentProfile(1));
    $('#share-profile').addEventListener('click', copyLink);
    $('#share-profile-top').addEventListener('click', copyLink);
    $('#print-profile').addEventListener('click', () => window.print());
    window.addEventListener('popstate', syncHash);
    window.addEventListener('hashchange', syncHash);
    window.addEventListener('pagehide', rememberPosition);
    let positionTimer;
    window.addEventListener('scroll', () => { if (dialog.open) return; clearTimeout(positionTimer); positionTimer = setTimeout(rememberPosition, 250); }, { passive: true });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !dialog.open && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable]')) { event.preventDefault(); $('#saint-search').focus(); }
    });
    document.addEventListener('error', event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.dataset.portrait) return;
      const saint = state.byId.get(image.dataset.portrait);
      if (!saint) return;
      const parent = image.parentElement;
      image.remove();
      if (parent && !parent.querySelector('.card-placeholder')) parent.insertAdjacentHTML('afterbegin', placeholder(saint));
    }, true);
  }

  async function init() {
    attachEvents();
    try {
      let data = window.SAINT_COLLECTION;
      if (!data) {
        const response = await fetch('data/saints.json');
        if (!response.ok) throw new Error(`Collection ${response.status}`);
        data = await response.json();
      }
      if (!Array.isArray(data.saints) || !data.saints.length) throw new Error('Empty collection');
      // Cached collections from before discovery metadata remain readable.
      data.lifeThemes = Array.isArray(data.lifeThemes) ? data.lifeThemes : [];
      data.centuries = Array.isArray(data.centuries) ? data.centuries : [];
      $('#theme-panel').hidden = !data.lifeThemes.length;
      $('#century-panel').hidden = !data.centuries.length;
      state.data = data;
      state.saints = data.saints;
      const savedGroups = Array.isArray(session.groups) ? session.groups : Array.isArray(stored.groups) ? stored.groups : [session.veneration || stored.veneration];
      state.categories = new Set((Array.isArray(session.categories) ? session.categories : []).filter(id => data.categories.some(category => category.id === id)));
      state.groups = new Set(savedGroups.filter(id => id !== 'all' && config.filters.some(filter => filter.id === id)));
      state.themes = new Set((Array.isArray(session.themes) ? session.themes : []).filter(id => data.lifeThemes.some(theme => theme.id === id)));
      state.centuries = new Set((Array.isArray(session.centuries) ? session.centuries : []).filter(century => data.centuries.includes(century)));
      for (const category of data.categories) {
        groupNames[category.id] = category.name;
      }
      state.saved = new Set([...state.saved].filter(id => state.saints.some(saint => saint.id === id)));
      state.savedOnly = Boolean(session.savedOnly);
      $('#saint-search').value = state.search;
      for (const saint of state.saints) {
        saint.lifeThemes = Array.isArray(saint.lifeThemes) ? saint.lifeThemes : [];
        saint.centuries = Array.isArray(saint.centuries) ? saint.centuries : [];
        saint.searchNames = [fold(saint.name), ...(saint.aliases || []).map(fold), fold(personTitle(saint))];

        state.byId.set(saint.id, saint);
      }
      buildDiscoveryFilters();
      $('#collection-total').textContent = `${state.saints.length} u zbirci`;
      buildViewSwitch();
      renderCollection();
      prepareFeastBanner();
      prepareCredits();
      syncHash();
      if (!dialog.open && session.view === state.view && JSON.stringify(session.groups || []) === JSON.stringify([...state.groups]) && Number.isFinite(session.y)) frame(() => window.scrollTo?.({ top: Math.max(0, session.y), behavior: 'instant' }));
      prepareOffline();
    } catch (error) {
      grid.innerHTML = '<div class="load-error"><h3>Zbirka se nije mogla učitati.</h3><p>Osvježite stranicu i pokušajte ponovno.</p><button class="button-primary" type="button" id="retry-load">Pokušaj ponovno</button></div>';
      grid.setAttribute('aria-busy', 'false');
      $('#results-count').textContent = 'Učitavanje nije uspjelo';
      $('#retry-load').addEventListener('click', () => location.reload());
      console.error('Saint collection could not load:', error);
    }
  }

  init();
})();
