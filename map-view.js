'use strict';
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');
  const labels = { birth:'Rođenje', activity:'Djelovanje', death:'Smrt', study:'Školovanje', formation:'Redovnička formacija', imprisonment:'Zatočenje', burial:'Počivalište / relikvije', origin:'Podrijetlo', ordination:'Ređenje', other:'Druga veza' };
  const roles = { all:'Sve veze', birth:'Rođenje', activity:'Djelovanje', death:'Smrt', other:'Ostalo' };
  const bucket = kind => ['birth','activity','death'].includes(kind) ? kind : 'other';
  const countryNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['hr'], {type:'region'}) : null;
  class SaintMapView {
    constructor(host, saints, options) {
      this.host=host; this.options=options; this.saints=new Map(saints.map(s=>[s.id,s]));
      this.data=window.SAINT_PLACES || {places:[],associations:[]};
      this.places=new Map(this.data.places.map(p=>[p.id,p]));
      this.role='all'; this.query=''; this.selected=null; this.focused=null; this.mobileMode='map'; this.visible=[]; this.markers=new Map();
      host.innerHTML=`<div class="map-intro"><div><p class="section-label">Zemljopis duhovne baštine</p><h3>Mjesta iz životopisa</h3><p>Od rodnoga mjesta do dalekih misija. Otkrijte gdje su se susreli njihovi putovi.</p></div><p class="map-count" role="status" aria-live="polite"></p></div>
        <div class="map-toolbar"><div class="map-roles" role="group" aria-label="Vrsta veze s mjestom">${Object.entries(roles).map(([id,label])=>`<button type="button" data-map-role="${id}" aria-pressed="${id==='all'}"><i class="map-dot ${id}" aria-hidden="true"></i>${label}</button>`).join('')}</div><label class="map-search"><span class="visually-hidden">Pretraži mjesta ili države na karti</span><input type="search" placeholder="Mjesto ili država…" maxlength="100" autocomplete="off"><span aria-hidden="true">⌕</span></label></div>
        <div class="map-person-focus" hidden></div><div class="map-mobile-switch" role="group" aria-label="Prikaz mjesta"><button type="button" data-map-mode="map" aria-pressed="true">Karta</button><button type="button" data-map-mode="list" aria-pressed="false">Popis mjesta</button></div>
        <div class="map-layout"><aside class="map-sidebar" aria-label="Mjesta i povezani životopisi"><div class="map-sidebar-heading"><h4>Odaberite mjesto</h4><button type="button" class="text-button" data-map-back hidden>Sva mjesta ←</button></div><div class="map-place-list"></div><div class="map-place-detail"></div></aside><div class="map-stage"><div class="saints-map-canvas" role="region" aria-label="Karta mjesta iz životopisa. Ista su mjesta dostupna u popisu."></div><button type="button" class="map-fit" data-map-fit>Prikaži sva mjesta ↗</button><p class="map-fallback" hidden>Karta trenutačno nije dostupna. Sva mjesta i životopisi dostupni su u popisu.</p><p class="map-hint">Brojevi označuju mjesta u skupini. Odaberite oznaku za životopise.</p></div></div>
        <div class="map-coverage"></div><details class="map-about"><summary>O mjestima i izvorima</summary><p>Mjesta su povezana prema životopisima i provjerenim biografskim podacima. Oznaka predstavlja naselje ili približno područje povijesnoga grada, a ne točnu kuću, crkvu ili stratište. Nejasni povijesni nazivi, široke regije i neostvarena putovanja nisu označeni. Današnje granice služe za orijentaciju.</p><p>Podloga: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> (javno dobro). Koordinate: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>); Stara Goa: <a href="https://whc.unesco.org/en/list/234/maps/" target="_blank" rel="noopener noreferrer">UNESCO</a>. <a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a> i MarkerCluster. Karta i koordinate pohranjene su uz zbirku te rade i bez interneta.</p></details>`;
      this.q=selector=>host.querySelector(selector);
      host.addEventListener('click',event=>this.click(event));
      this.q('.map-search input').addEventListener('input',event=>{this.query=event.target.value;this.refresh();});
      this.initMap();
    }
    country(p) { return countryNames?.of(p.countryCode) || p.countryCode; }
    name(s) { return this.options.personTitle(s); }
    link(s) { return `<a href="${esc(this.options.profileHref(s))}" data-open="${esc(s.id)}">${esc(this.name(s))} <span aria-hidden="true">↗</span></a>`; }
    initMap() {
      try {
        const L=window.L; if(!L || !this.data.world) throw new Error('Map resources unavailable');
        this.map=L.map(this.q('.saints-map-canvas'),{scrollWheelZoom:false,minZoom:1,maxZoom:8,attributionControl:true,worldCopyJump:false,maxBounds:[[-85,-220],[85,220]],maxBoundsViscosity:0.8,zoomControl:true});
        this.map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
        this.map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/">Natural Earth</a> · <a href="https://www.geonames.org/">GeoNames</a>');
        L.geoJSON(this.data.world,{style:{fillColor:'#ded8c7',fillOpacity:1,color:'#f5f1e8',weight:0.7},interactive:false}).addTo(this.map);
        this.layer=L.markerClusterGroup ? L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:38,animate:false,iconCreateFunction:cluster=>L.divIcon({className:'saint-map-cluster',html:`<span aria-label="${cluster.getChildCount()} mjesta u skupini">${cluster.getChildCount()}</span>`,iconSize:[38,38]})}) : L.layerGroup();
        this.layer.addTo(this.map); this.map.setView([25,15],2);
        this.resizeObserver=typeof ResizeObserver==='function' ? new ResizeObserver(()=>{if(!this.host.hidden)this.map.invalidateSize({pan:false});}) : null;
        this.resizeObserver?.observe(this.q('.map-stage'));
      } catch(error) {
        this.map?.remove(); this.map=null; this.q('.map-fallback').hidden=false; this.host.classList.add('map-unavailable');
      }
    }
    update(visible) {
      this.visible=visible;
      if(this.focused && !visible.some(s=>s.id===this.focused))this.focused=null;
      this.refresh();
      requestAnimationFrame(()=>{this.map?.invalidateSize({pan:false});if(!this.fitted){this.fit();this.fitted=true;}});
    }
    focusPerson(id) {
      this.focused=id;this.role='all';this.query='';this.selected=null;this.q('.map-search input').value='';this.refresh();this.fit();
    }
    refresh() {
      const visibleIds=new Set(this.visible.map(s=>s.id));
      const published=this.data.associations.filter(a=>visibleIds.has(a.saintId));
      const mappedIds=new Set(published.map(a=>a.saintId));
      const filtered=published.filter(a=>(!this.focused||a.saintId===this.focused) && (this.role==='all'||bucket(a.kind)===this.role));
      const groups=new Map();
      for(const a of filtered){const p=this.places.get(a.placeId);if(!p)continue;
        if(this.query && !fold([p.name,...p.aliases,this.country(p)].join(' ')).includes(fold(this.query).trim()))continue;
        if(!groups.has(p.id))groups.set(p.id,{place:p,associations:[]});groups.get(p.id).associations.push(a);
      }
      this.groups=[...groups.values()].sort((a,b)=>new Set(b.associations.map(a=>a.saintId)).size-new Set(a.associations.map(a=>a.saintId)).size||a.place.name.localeCompare(b.place.name,'hr'));
      if(this.selected&&!groups.has(this.selected))this.selected=null;
      const people=new Set(this.groups.flatMap(g=>g.associations.map(a=>a.saintId)));
      this.q('.map-count').innerHTML=`<strong>${this.groups.length}</strong> mjesta <span>· ${people.size} životopisa</span>`;
      for(const b of this.host.querySelectorAll('[data-map-role]'))b.setAttribute('aria-pressed',String(b.dataset.mapRole===this.role));
      this.q('.map-person-focus').hidden=!this.focused;
      this.q('.map-person-focus').innerHTML=this.focused?`Putovi: <strong>${esc(this.name(this.saints.get(this.focused)))}</strong><button type="button" data-map-clear-person>Prikaži sve osobe ×</button>`:'';
      this.drawPlaces();this.drawMarkers();
      const unmapped=this.visible.filter(s=>!mappedIds.has(s.id));
      this.q('.map-coverage').innerHTML=`<p><strong>${mappedIds.size} od ${this.visible.length}</strong> životopisa u trenutačnom odabiru ima označena mjesta.</p>${unmapped.length?`<details><summary>Bez potvrđenih oznaka na karti (${unmapped.length})</summary><p>Za ove životopise još nije potvrđeno dovoljno precizno mjesto. Njihove priče možete pročitati ovdje.</p><ul>${unmapped.map(s=>`<li>${this.link(s)}</li>`).join('')}</ul></details>`:''}`;
    }
    drawPlaces() {
      const current=this.groups.find(g=>g.place.id===this.selected);
      this.q('[data-map-back]').hidden=!current;
      this.q('.map-sidebar-heading h4').textContent=current?'Povezani životopisi':`Mjesta (${this.groups.length})`;
      this.q('.map-place-list').hidden=Boolean(current);
      this.q('.map-place-detail').hidden=!current;
      this.q('.map-place-list').innerHTML=this.groups.length?this.groups.map(g=>{
        const people=new Set(g.associations.map(a=>a.saintId));const kinds=[...new Set(g.associations.map(a=>a.kind))];
        return `<button type="button" class="map-place-row" data-map-place="${esc(g.place.id)}"><span><strong>${esc(g.place.name)}</strong><small>${esc(this.country(g.place))}</small><span class="map-row-roles">${kinds.map(k=>`<span><i aria-hidden="true" class="map-dot ${bucket(k)}"></i>${labels[k]}</span>`).join('')}</span></span><span class="map-place-number" aria-label="${people.size} povezanih životopisa">${people.size}<span aria-hidden="true"> ↗</span></span></button>`;
      }).join(''):`<div class="map-local-empty"><h4>Nema mjesta za ovaj odabir.</h4><p>Pokušajte drugu vrstu veze ili širu pretragu mjesta.</p><button type="button" class="text-button" data-map-reset>Očisti odabir karte</button></div>`;
      if(!current){this.q('.map-place-detail').innerHTML='';return;}
      const byPerson=new Map();for(const a of current.associations){if(!byPerson.has(a.saintId))byPerson.set(a.saintId,[]);byPerson.get(a.saintId).push(a);}
      this.q('.map-place-detail').innerHTML=`<div class="map-selected-place"><p class="section-label">${esc(this.country(current.place))}</p><h4 tabindex="-1">${esc(current.place.name)}</h4><p>Približna oznaka naselja · ${byPerson.size} životopisa</p></div>${[...byPerson].sort(([a],[b])=>this.saints.get(a).name.localeCompare(this.saints.get(b).name,'hr')).map(([id,rows])=>{
        const s=this.saints.get(id);return `<article class="map-person-card"><h5>${this.link(s)}</h5><p class="map-person-life">${esc(s.life)}</p><div class="map-person-kinds">${rows.map(a=>`<span><i aria-hidden="true" class="map-dot ${bucket(a.kind)}"></i>${labels[a.kind]}</span>`).join('')}</div><button type="button" class="text-button" data-map-person="${esc(id)}">Sva mjesta ove osobe ↗</button><details><summary>Podaci o mjestu</summary>${rows.map(a=>`<div class="map-evidence"><strong>${labels[a.kind]}</strong><p>${esc(a.evidence.text)}</p><a href="${esc(a.evidence.sourceUrl)}" target="_blank" rel="noopener noreferrer">Izvor podataka ↗</a></div>`).join('')}</details></article>`;
      }).join('')}<p class="map-coordinate-credit">Koordinate: <a href="${esc(current.place.coordinateSource.url)}" target="_blank" rel="noopener noreferrer">${esc(current.place.coordinateSource.publisher)}</a></p>`;
    }
    drawMarkers() {
      if(!this.map)return;
      const L=window.L;this.layer.clearLayers();this.markers.clear();
      for(const g of this.groups){
        const kinds=new Set(g.associations.map(a=>bucket(a.kind)));const kind=kinds.size===1?[...kinds][0]:'mixed';
        const marker=L.marker([g.place.lat,g.place.lng],{title:g.place.name,alt:`${g.place.name}: ${new Set(g.associations.map(a=>a.saintId)).size} životopisa`,keyboard:true,icon:L.divIcon({className:`saint-map-pin ${kind}${this.selected===g.place.id?' selected':''}`,html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]})});
        marker.bindTooltip(esc(g.place.name),{direction:'top',offset:[0,-10]});marker.on('click',()=>this.select(g.place.id,true));
        this.markers.set(g.place.id,marker);this.layer.addLayer(marker);
      }
    }
    select(id,fromMap=false) {
      this.selected=id;this.drawPlaces();
      for(const [key,marker] of this.markers)marker.getElement()?.classList.toggle('selected',key===id);
      const marker=this.markers.get(id);
      if(marker){this.map?.setView(marker.getLatLng(), Math.max(this.map.getZoom(),6), {animate:false});marker.openTooltip();}
      this.setMode('map');
      // A map selection moves keyboard focus to its corresponding accessible detail.
      if(fromMap){const heading=this.q('.map-selected-place h4');heading?.focus({preventScroll:true});if(window.matchMedia('(max-width: 700px)').matches)heading?.scrollIntoView({block:'center',behavior:'instant'});}
      else this.q('.map-selected-place h4')?.focus({preventScroll:true});
    }
    setMode(mode) {
      this.mobileMode=mode;this.host.dataset.mobileMode=mode;
      for(const b of this.host.querySelectorAll('[data-map-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mapMode===mode));
      requestAnimationFrame(()=>this.map?.invalidateSize({pan:false}));
    }
    fit(){if(!this.map)return;const points=this.groups.map(g=>[g.place.lat,g.place.lng]);if(points.length)this.map.fitBounds(points,{padding:[35,35],maxZoom:6,animate:false});else this.map.setView([25,15],2);}
    click(event) {
      const b=event.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-map-role')){this.role=b.dataset.mapRole;this.refresh();}
      if(b.hasAttribute('data-map-place'))this.select(b.dataset.mapPlace);
      if(b.hasAttribute('data-map-person'))this.focusPerson(b.dataset.mapPerson);
      if(b.hasAttribute('data-map-back')){this.selected=null;this.drawPlaces();this.drawMarkers();this.q('.map-place-row')?.focus({preventScroll:true});}
      if(b.hasAttribute('data-map-clear-person')){this.focused=null;this.selected=null;this.refresh();this.fit();}
      if(b.hasAttribute('data-map-reset')){this.focused=null;this.selected=null;this.role='all';this.query='';this.q('.map-search input').value='';this.refresh();this.fit();}
      if(b.hasAttribute('data-map-fit'))this.fit();
      if(b.hasAttribute('data-map-mode'))this.setMode(b.dataset.mapMode);
    }
  }
  class SaintProfileMap {
    constructor(host) {
      this.host = host;
      this.data = window.SAINT_PLACES || { places: [], associations: [] };
      this.places = new Map(this.data.places.map(place => [place.id, place]));
      this.groups = [];
      this.markers = new Map();
      host.innerHTML = `<div class="profile-map-heading"><h3 id="profile-map-title">Mjesta iz života</h3><button type="button" data-profile-map-fit>Prikaži sva mjesta ↗</button></div><div class="profile-map-canvas" role="region" aria-label="Karta mjesta povezanih s ovom osobom"></div><p class="profile-map-empty" hidden></p><div class="profile-map-places" role="group" aria-label="Odaberi mjesto"></div><p class="profile-map-note">Oznake prikazuju naselje ili približno područje, a ne točnu kuću ili stratište.</p><details class="profile-map-evidence"><summary>O mjestima i izvorima</summary><div></div></details>`;
      this.q = selector => host.querySelector(selector);
      host.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (button?.hasAttribute('data-profile-map-place')) this.select(button.dataset.profileMapPlace);
        if (button?.hasAttribute('data-profile-map-fit')) { this.selected = null; this.fit(); this.updateSelection(); }
      });
    }
    update(person) {
      this.person = person;
      this.selected = null;
      this.q('details').open = false;
      const grouped = new Map();
      for (const association of this.data.associations.filter(a => a.saintId === person.id)) {
        const place = this.places.get(association.placeId);
        if (!place) continue;
        if (!grouped.has(place.id)) grouped.set(place.id, { place, associations: [] });
        grouped.get(place.id).associations.push(association);
      }
      const order = {birth:0,origin:1,formation:2,study:3,ordination:4,activity:5,imprisonment:6,death:7,burial:8,other:9};
      this.groups = [...grouped.values()].sort((a,b) => Math.min(...a.associations.map(x=>order[x.kind])) - Math.min(...b.associations.map(x=>order[x.kind])) || a.place.name.localeCompare(b.place.name,'hr'));
      this.q('.profile-map-places').innerHTML = this.groups.map(({place,associations}) => `<button type="button" data-profile-map-place="${esc(place.id)}" aria-pressed="false"><strong>${esc(place.name)}</strong><span>${[...new Set(associations.map(a=>a.kind))].map(kind=>`<span><i class="map-dot ${bucket(kind)}" aria-hidden="true"></i>${esc(labels[kind])}</span>`).join('')}</span></button>`).join('');
      this.q('.profile-map-evidence div').innerHTML = this.groups.map(({place,associations}) => `<section><h4>${esc(place.name)}</h4>${associations.map(a=>`<p><strong>${esc(labels[a.kind])}.</strong> ${esc(a.evidence.text)} <a href="${esc(a.evidence.sourceUrl)}" target="_blank" rel="noopener noreferrer">Izvor ↗</a></p>`).join('')}<p class="profile-map-coordinate">Koordinate: <a href="${esc(place.coordinateSource.url)}" target="_blank" rel="noopener noreferrer">${esc(place.coordinateSource.publisher)}</a></p></section>`).join('') + '<p>Podloga: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a> (javno dobro). Koordinate: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> (CC BY 4.0). Karta je dostupna i bez interneta.</p>';
      const empty = !this.groups.length;
      this.q('[data-profile-map-fit]').hidden = empty;
      this.q('.profile-map-places').hidden = empty;
      this.q('.profile-map-note').hidden = empty;
      this.q('.profile-map-evidence').hidden = empty;
      this.q('.profile-map-canvas').hidden = empty;
      this.q('.profile-map-empty').hidden = !empty;
      this.q('.profile-map-empty').textContent = 'Za ovu osobu još nisu potvrđene dovoljno precizne oznake na karti. Poznata mjesta navedena su u podacima i životopisu.';
      this.host.dataset.personId = person.id;
      this.host.dataset.placeCount = String(this.groups.length);
      // Open-profile layout is measurable on the next frame, including direct links.
      requestAnimationFrame(() => {
        if (this.person.id !== person.id || !this.host.offsetWidth || empty) return;
        this.initMap(); this.drawMarkers(); this.map?.invalidateSize({pan:false}); this.fit();
      });
    }
    initMap() {
      if (this.map) return;
      try {
        const L = window.L;
        if (!L || !this.data.world) throw new Error('Map unavailable');
        this.map = L.map(this.q('.profile-map-canvas'), {scrollWheelZoom:false,minZoom:1,maxZoom:8,attributionControl:true,zoomControl:false});
        L.control.zoom({zoomInTitle:'Povećaj kartu',zoomOutTitle:'Smanji kartu'}).addTo(this.map);
        this.map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
        this.map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/">Natural Earth</a> · <a href="https://www.geonames.org/">GeoNames</a>');
        L.geoJSON(this.data.world,{style:{fillColor:'#ded8c7',fillOpacity:1,color:'#f5f1e8',weight:0.7},interactive:false}).addTo(this.map);
        this.layer = L.layerGroup().addTo(this.map);
        this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
          if (this.host.offsetWidth && !this.host.hidden) { this.map.invalidateSize({pan:false}); if (!this.selected) this.fit(); }
        }) : null;
        this.resizeObserver?.observe(this.q('.profile-map-canvas'));
        this.q('.profile-map-canvas').hidden = false;
      } catch (error) {
        this.map?.remove(); this.map = null;
        this.q('.profile-map-canvas').hidden = true;
        this.q('.profile-map-empty').hidden = false;
        this.q('.profile-map-empty').textContent = 'Karta trenutačno nije dostupna. Mjesta i njihovi izvori dostupni su u popisu.';
      }
    }
    drawMarkers() {
      if (!this.map) return;
      this.layer.clearLayers(); this.markers.clear();
      const L = window.L;
      for (const {place,associations} of this.groups) {
        const kinds = new Set(associations.map(a=>bucket(a.kind)));
        const kind = kinds.size === 1 ? [...kinds][0] : 'mixed';
        const description = [...new Set(associations.map(a=>labels[a.kind]))].join(', ');
        const marker = L.marker([place.lat,place.lng], {title:place.name,alt:place.name+': '+description,keyboard:true,icon:L.divIcon({className:'saint-map-pin '+kind,html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(this.layer);
        marker.bindTooltip(esc(place.name)+': '+esc(description),{direction:'top',offset:[0,-10]});
        marker.on('click',()=>this.select(place.id,true)); this.markers.set(place.id,marker);
      }
    }
    select(id, fromMap=false) {
      const marker = this.markers.get(id);
      this.selected = id; this.updateSelection();
      if (marker) { this.map.setView(marker.getLatLng(),6,{animate:false}); marker.openTooltip(); }
      if (fromMap) this.host.querySelector(`[data-profile-map-place="${id}"]`)?.focus({preventScroll:true});
    }
    updateSelection() {
      for (const button of this.host.querySelectorAll('[data-profile-map-place]')) button.setAttribute('aria-pressed',String(button.dataset.profileMapPlace===this.selected));
      for (const [id,marker] of this.markers) marker.getElement()?.classList.toggle('selected',id===this.selected);
    }
    fit() {
      if (!this.map || !this.groups.length) return;
      this.map.fitBounds(this.groups.map(g=>[g.place.lat,g.place.lng]),{padding:[28,28],maxZoom:6,animate:false});
    }
  }
  window.SaintProfileMap = SaintProfileMap;

  window.SaintMapView=SaintMapView;
})();
