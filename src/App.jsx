import React, { useEffect, useMemo, useState } from 'react';

const STORE = 'acl-foundboard-v3';
const CLAIM_STORE = 'acl-foundboard-claims-v1';

// A found report can exist before the item has been received by staff.
const seed = [
  { id: 'f1', title: 'Black backpack', category: 'accessories', status: 'lost', location: 'Library - second floor', description: 'Black backpack with a small red keychain. Left near the study desks.', owner: 'you', created: 'Oct 23', emoji: '🎒' },
  { id: 'f2', title: 'Dark backpack', category: 'accessories', status: 'found', location: 'Library - main stairwell', description: 'Found a dark backpack with a small red keychain near the library stairs.', owner: 'other', created: 'Oct 24', emoji: '🎒', collectionPoint: 'Campus Security Desk', handoverStatus: 'received' },
  { id: 'f3', title: 'Student ID card', category: 'documents', status: 'found', location: 'Near Gate 3', description: 'A student card was turned in. No personal details are published.', owner: 'other', created: 'Oct 24', emoji: '🪪', collectionPoint: 'Student Services Office', handoverStatus: 'received' },
  { id: 'f4', title: 'Wireless earbuds', category: 'electronics', status: 'lost', location: 'Main cafeteria', description: 'White earbuds in a distinctive blue case. Lost on Monday.', owner: 'other', created: 'Oct 24', emoji: '🎧' },
  { id: 'f5', title: 'Earbuds in blue case', category: 'electronics', status: 'found', location: 'Cafeteria entrance', description: 'White earbuds in a blue charging case found near the coffee counter.', owner: 'other', created: 'Oct 25', emoji: '🎧', collectionPoint: '', handoverStatus: 'reported' },
  { id: 'f6', title: 'Blue sports bottle', category: 'other', status: 'lost', location: 'Sports Hall - lockers', description: 'Tall blue metal water bottle, possibly left after practice.', owner: 'other', created: 'Oct 25', emoji: '🥤' },
  { id: 'f7', title: 'Metal water bottle', category: 'other', status: 'found', location: 'Sports Hall - benches', description: 'Blue reusable metal bottle found after a basketball session.', owner: 'other', created: 'Oct 25', emoji: '🥤', collectionPoint: 'Campus Security Desk', handoverStatus: 'received' },
  { id: 'f8', title: 'Engineering lab coat', category: 'clothing', status: 'claimed', location: 'Building C', description: 'Owner verified the item and collected it from the reception desk.', owner: 'you', created: 'Oct 22', emoji: '🥼', collectionPoint: 'Library Reception', handoverStatus: 'released' },
  { id: 'f9', title: 'Small notebook', category: 'other', status: 'lost', location: 'C7 lecture room', description: 'Brown cover with handwritten engineering notes.', owner: 'other', created: 'Oct 25', emoji: '📒' },
  { id: 'f10', title: 'Scientific calculator', category: 'electronics', status: 'lost', location: 'B2 lecture hall', description: 'Black scientific calculator with a protective cover.', owner: 'other', created: 'Oct 26', emoji: '🧮' },
  { id: 'f11', title: 'Calculator', category: 'electronics', status: 'found', location: 'B2 study area', description: 'Scientific calculator with a black cover, found on a desk.', owner: 'you', created: 'Oct 26', emoji: '🧮', collectionPoint: 'Library Reception', handoverStatus: 'received' },
  { id: 'f12', title: 'Canvas tote bag', category: 'accessories', status: 'lost', location: 'Main campus bus stop', description: 'Beige tote with green writing on one side.', owner: 'other', created: 'Oct 26', emoji: '👜' },
  { id: 'f13', title: 'USB flash drive', category: 'electronics', status: 'found', location: 'Building A computer lab', description: 'A small black flash drive was found beside a workstation.', owner: 'other', created: 'Oct 27', emoji: '💾', collectionPoint: '', handoverStatus: 'reported' },
];

const categories = ['all', 'electronics', 'clothing', 'documents', 'accessories', 'other'];
const categoryEmoji = { electronics: '🔌', clothing: '🧥', documents: '📄', accessories: '👜', other: '📦' };
const statuses = [
  { key: 'lost', label: 'Lost', title: 'Lost items', description: 'Help a student find something they left behind.', icon: '↗' },
  { key: 'found', label: 'Found', title: 'Found items', description: 'See what classmates have picked up around campus.', icon: '⌖' },
  { key: 'claimed', label: 'Claimed', title: 'Claimed items', description: 'Items that have made their way back to their owners.', icon: '✓' },
];
const clean = { title: '', category: '', status: '', location: '', lastSeenDate: '', description: '', imageData: '' };

function getSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    return Array.isArray(saved) ? saved : seed;
  } catch {
    return seed;
  }
}

function getSavedClaims() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLAIM_STORE));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function dateForItem(item) {
  if (item.lastSeenDate) return new Date(`${item.lastSeenDate}T12:00:00`);
  if (item.createdAt) return new Date(item.createdAt);
  if (item.created === 'Today') return new Date();
  const now = new Date();
  const parsed = new Date(`${item.created} ${now.getFullYear()} 12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() > now.getTime() + 86400000) parsed.setFullYear(parsed.getFullYear() - 1);
  return parsed;
}

function possibleMatches(item, allItems) {
  const oppositeStatus = item.status === 'lost' ? 'found' : item.status === 'found' ? 'lost' : null;
  if (!oppositeStatus) return [];
  const stopWords = new Set(['the', 'and', 'with', 'near', 'from', 'this', 'that', 'item', 'found', 'lost', 'left']);
  const tokens = value => new Set((value || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 2 && !stopWords.has(word)) || []);
  const itemWords = tokens(`${item.title} ${item.description}`);
  const itemPlaces = tokens(item.location);
  return allItems
    .filter(candidate => candidate.id !== item.id && candidate.status === oppositeStatus)
    .map(candidate => {
      const candidateWords = tokens(`${candidate.title} ${candidate.description}`);
      const candidatePlaces = tokens(candidate.location);
      const sharedWords = [...itemWords].filter(word => candidateWords.has(word)).length;
      const sharedPlaces = [...itemPlaces].filter(word => candidatePlaces.has(word)).length;
      const categoryMatch = item.category === candidate.category ? 1 : 0;
      return { item: candidate, score: sharedWords * 2 + sharedPlaces * 2 + categoryMatch };
    })
    .filter(match => match.score >= 3)
    .sort((first, second) => second.score - first.score)
    .slice(0, 3)
    .map(match => match.item);
}

function prepareImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file, such as JPG or PNG.'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Choose an image smaller than 12 MB.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('This image could not be prepared. Try another one.'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('This image could not be saved. Try another one.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('This image could not be read. Try another one.'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.82);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This image could not be opened. Try another one.'));
    };
    image.src = objectUrl;
  });
}

const cap = value => value.charAt(0).toUpperCase() + value.slice(1);

function validate(form, items, id) {
  if (!form.title.trim() || form.title.trim().length < 2) return 'Enter an item name with at least 2 characters.';
  if (!categories.slice(1).includes(form.category)) return 'Choose an item category.';
  if (!statuses.some(status => status.key === form.status)) return 'Choose whether the item is lost, found, or claimed.';
  const duplicate = items.some(item => item.id !== id
    && item.title.toLowerCase() === form.title.trim().toLowerCase()
    && (item.location || '').toLowerCase() === (form.location || '').trim().toLowerCase());
  if (duplicate) return 'A report with this item name already exists at this location.';
  return '';
}

function handoverText(item) {
  if (item.handoverStatus === 'received' && item.collectionPoint) return `Dropped off at ${item.collectionPoint}`;
  if (item.handoverStatus === 'released') return 'Collected by its owner';
  return 'Reported found · not yet at a collection point';
}

export default function App() {
  const [items, setItems] = useState(getSaved);
  const [claimRequests, setClaimRequests] = useState(getSavedClaims);
  const [page, setPage] = useState('board');
  const [reportScope, setReportScope] = useState('community');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('lost');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [claimMode, setClaimMode] = useState(false);
  const [claimProof, setClaimProof] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimNotice, setClaimNotice] = useState('');
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(clean);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(CLAIM_STORE, JSON.stringify(claimRequests));
  }, [claimRequests]);

  useEffect(() => {
    if (!selectedItem) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') setSelectedItem(null);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedItem]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const place = locationFilter.trim().toLowerCase();
    const now = new Date();
    return items.filter(item => (reportScope !== 'mine' || item.owner === 'you')
      && (category === 'all' || item.category === category)
      && (!place || (item.location || '').toLowerCase().includes(place))
      && (dateFilter === 'all' || (() => {
        const itemDate = dateForItem(item);
        return itemDate && now.getTime() - itemDate.getTime() <= Number(dateFilter) * 86400000;
      })())
      && `${item.title} ${item.location} ${item.description}`.toLowerCase().includes(term));
  }, [items, query, category, locationFilter, dateFilter, reportScope]);
  const visibleItems = reportScope === 'mine' ? filtered : filtered.filter(item => item.status === activeStatus);
  const activeSection = statuses.find(status => status.key === activeStatus) || statuses[0];
  const selectedClaim = selectedItem ? claimRequests.find(request => request.itemId === selectedItem.id) : null;
  const matches = selectedItem ? possibleMatches(selectedItem, items) : [];
  const hasActiveFilters = Boolean(query || category !== 'all' || locationFilter || dateFilter !== 'all');

  function showCommunity() {
    setPage('board');
    setReportScope('community');
    setActiveStatus('lost');
    clearFilters();
    setBrowseOpen(false);
  }

  function showStatus(status) {
    setPage('board');
    setReportScope('community');
    setActiveStatus(status);
    clearFilters();
    setBrowseOpen(false);
  }

  function showMyReports() {
    setPage('board');
    setReportScope('mine');
    clearFilters();
    setBrowseOpen(false);
  }

  function openDetails(item) {
    setSelectedItem(item);
    setClaimMode(false);
    setClaimProof('');
    setClaimError('');
    setClaimNotice('');
  }

  function create() {
    setCurrent(null);
    setForm({ ...clean });
    setError('');
    setPhotoError('');
    setMessage('');
    setSelectedItem(null);
    setPage('form');
  }

  function edit(item) {
    if (item.owner !== 'you') return;
    setCurrent(item.id);
    setForm({ ...clean, ...item });
    setError('');
    setPhotoError('');
    setSelectedItem(null);
    setPage('form');
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imageData = await prepareImage(file);
      setForm(state => ({ ...state, imageData }));
      setPhotoError('');
    } catch (imageError) {
      setPhotoError(imageError.message);
    }
  }

  function submit(event) {
    event.preventDefault();
    const validationMessage = validate(form, items, current);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const existing = current ? items.find(item => item.id === current) : null;
    const previousDate = existing ? dateForItem(existing) : null;
    const report = {
      ...form,
      title: form.title.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      owner: 'you',
      created: existing?.created || 'Today',
      createdAt: existing?.createdAt || previousDate?.toISOString() || new Date().toISOString(),
      emoji: existing?.emoji || categoryEmoji[form.category] || '📦',
      ...(existing ? {} : { collectionPoint: '', handoverStatus: 'reported' }),
    };

    if (current) {
      setItems(items.map(item => item.id === current ? { ...item, ...report } : item));
      setMessage('Your report has been updated.');
    } else {
      setItems([{ id: `f-${Date.now()}`, ...report }, ...items]);
      setMessage('Your report is on the noticeboard.');
    }
    setActiveStatus(report.status);
    setReportScope('mine');
    setQuery('');
    setCategory('all');
    setLocationFilter('');
    setDateFilter('all');
    setBrowseOpen(false);
    setPage('board');
    setCurrent(null);
  }

  function sendClaimRequest(event) {
    event.preventDefault();
    if (claimProof.trim().length < 8) {
      setClaimError('Add one specific detail so the claim can be reviewed.');
      return;
    }
    if (!selectedItem || selectedClaim) return;
    setClaimRequests(previous => [{
      id: `claim-${Date.now()}`,
      itemId: selectedItem.id,
      itemTitle: selectedItem.title,
      proof: claimProof.trim(),
      created: 'Today',
      status: 'saved locally',
    }, ...previous]);
    setClaimError('');
    setClaimProof('');
    setClaimMode(false);
    setClaimNotice('Request saved in this browser. This demo does not notify campus staff.');
  }

  function clearFilters() {
    setQuery('');
    setCategory('all');
    setLocationFilter('');
    setDateFilter('all');
  }

  function reset() {
    setItems(seed);
    setPage('board');
    clearFilters();
    setActiveStatus('lost');
    setReportScope('community');
    setBrowseOpen(false);
    setMessage('Example reports are back.');
  }

  return (
    <div className="notice-app">
      <header className="header">
        <button onClick={showCommunity} className="brand" aria-label="Found on campus home">
          <span className="brand-mark" aria-hidden="true">✺</span>
          <span className="brand-name">FOUND<span>on campus</span></span>
        </button>
        <button className="report-button header-report" onClick={create}>＋ <span>Post a report</span></button>
      </header>

      <div className="ruleline"><span>SEARCH · DISCOVER · REUNITE</span><span>Helping lost things find their way back.</span></div>

      {page === 'board' ? (
        <main className="main-content">
          <section className="page-intro">
            <div>
              <p className="eyebrow">Campus lost &amp; found</p>
              <h1>Lost something?<br /><span>Let’s help it get home.</span></h1>
              <p className="intro-copy">Search student reports or switch sections to see what’s lost, found, and claimed.</p>
            </div>
            <div className="intro-note"><span aria-hidden="true">✳</span><p>Good descriptions make it easier for the right person to recognize an item.</p></div>
          </section>

          <section className="search-area" aria-label="Search and browse reports">
            <label className="search-field">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <span className="sr-only">Search items</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by item or place…" />
              {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
            </label>
            <div className={`browse-wrap ${browseOpen ? 'open' : ''}`}>
              <button className="browse-toggle" onClick={() => setBrowseOpen(open => !open)} aria-expanded={browseOpen} aria-controls="browse-options">
                <span className="browse-symbol" aria-hidden="true">☷</span>
                <span className="browse-copy"><strong>Browse reports</strong><small>{category === 'all' ? 'Filter by category' : `Showing ${cap(category)}`}</small></span>
                <span className="browse-chevron" aria-hidden="true">{browseOpen ? '−' : '+'}</span>
              </button>
              {browseOpen && (
                <div className="browse-options" id="browse-options">
                  <div className="category-filter">
                    <div className="category-filter-heading"><strong>Choose a category</strong><span>Results update as you choose</span></div>
                    <div className="category-chips" role="group" aria-label="Filter by item category">
                      {categories.map(itemCategory => (
                        <button key={itemCategory} className={category === itemCategory ? 'selected' : ''} onClick={() => setCategory(itemCategory)} aria-pressed={category === itemCategory}>
                          {itemCategory === 'all' ? 'All categories' : cap(itemCategory)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="browse-refinements">
                    <label>Location<input value={locationFilter} onChange={event => setLocationFilter(event.target.value)} placeholder="Building, room, or area" /></label>
                    <label>Date lost or found<select value={dateFilter} onChange={event => setDateFilter(event.target.value)}><option value="all">Any date</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option></select></label>
                  </div>
                  <div className="browse-footer">
                    {(query || category !== 'all' || locationFilter || dateFilter !== 'all') && <button className="text-button" onClick={clearFilters}>Clear filters</button>}
                    <button className="text-button reset-link" onClick={reset}>Reset example reports</button>
                  </div>
                </div>
              )}
            </div>
            {(query || category !== 'all' || locationFilter || dateFilter !== 'all') && <p className="result-summary">{filtered.length} {filtered.length === 1 ? 'matching report' : 'matching reports'} across all sections</p>}
          </section>

          <section className="reports-section" aria-label="Reports by status">
            <div className="section-heading">
              <div><p className="eyebrow">{reportScope === 'mine' ? 'Your activity' : 'The noticeboard'}</p><h2>{reportScope === 'mine' ? 'My reports' : 'Community reports'}</h2>{reportScope === 'community' && <p className="section-hint">You can edit your posts from My reports.</p>}</div>
              <span className="overall-count">{visibleItems.length} {visibleItems.length === 1 ? 'report' : 'reports'}</span>
            </div>

            <div className="status-switcher" aria-label="Choose a report section">
              {statuses.map(status => {
                const count = filtered.filter(item => item.status === status.key).length;
                return (
                  <button key={status.key} className={`status-option ${status.key} ${reportScope === 'community' && activeStatus === status.key ? 'active' : ''}`} onClick={() => showStatus(status.key)} aria-pressed={reportScope === 'community' && activeStatus === status.key}>
                    <span className="status-dot" aria-hidden="true" />
                    <span>{status.label}</span>
                    <span className="status-count">{count}</span>
                  </button>
                );
              })}
              <button className={`status-option my-reports ${reportScope === 'mine' ? 'active' : ''}`} onClick={showMyReports} aria-pressed={reportScope === 'mine'}>
                <span className="my-reports-mark" aria-hidden="true">✎</span>
                <span>My reports</span>
                <span className="status-count">{items.filter(item => item.owner === 'you').length}</span>
              </button>
            </div>

            <div className={`status-panel ${reportScope === 'mine' ? 'mine' : activeStatus}`} id="status-results" aria-live="polite">
              <div className="status-heading">
                <div className="status-heading-icon" aria-hidden="true">{reportScope === 'mine' ? '✎' : activeSection.icon}</div>
                <div><h3>{reportScope === 'mine' ? 'Things you’ve posted' : activeSection.title}</h3><p>{reportScope === 'mine' ? 'Only you can edit your reports.' : activeSection.description}</p></div>
                <span className="panel-count">{visibleItems.length} {visibleItems.length === 1 ? 'report' : 'reports'}</span>
              </div>

              {visibleItems.length ? (
                <div className="report-grid">
                  {visibleItems.map(item => (
                    <article className={`report-card ${item.status}`} key={item.id}>
                      <button className="card-open" onClick={() => openDetails(item)} aria-label={`View details for ${item.title}`} />
                      {reportScope === 'mine' && <span className={`report-status ${item.status}`}>{cap(item.status)}</span>}
                      <div className="card-meta"><span className="category-label">{cap(item.category)}</span><time>{item.created}</time></div>
                      {item.imageData ? <img className="card-image" src={item.imageData} alt={`Photo of ${item.title}`} /> : <div className="item-emoji" aria-hidden="true">{item.emoji}</div>}
                      <div className="card-content"><h4>{item.title}</h4><p>{item.description || 'No extra details were added.'}</p></div>
                      {item.status !== 'lost' && <div className={`handover-note ${item.handoverStatus === 'received' ? 'received' : ''}`}><span aria-hidden="true">{item.handoverStatus === 'received' ? '✓' : 'i'}</span>{handoverText(item)}</div>}
                      <div className="card-footer"><span className="item-location"><span aria-hidden="true">⌖</span>{item.location || 'Location not provided'}</span>{item.owner === 'you' && <button className="edit-button" onClick={() => edit(item)} aria-label={`Edit your report: ${item.title}`}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.8 2.2a1.4 1.4 0 0 1 2 2L6 12l-3.2.8L3.6 9.6l8.2-7.4Z"/><path d="m10.7 3.3 2 2"/></svg><span>Edit</span></button>}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-illustration" aria-hidden="true">⌕</span>
                  <h4>{hasActiveFilters ? 'No reports match those filters' : reportScope === 'mine' ? 'You haven’t posted a report yet' : `No ${activeSection.label.toLowerCase()} reports yet`}</h4>
                  <p>{hasActiveFilters ? 'Try a different search or clear your filters.' : reportScope === 'mine' ? 'Reports you post will be collected here so you can edit them.' : 'When someone posts one, it will show up here.'}</p>
                  {hasActiveFilters ? <button className="secondary-button" onClick={clearFilters}>Clear filters</button> : <button className="text-button empty-action" onClick={create}>Post a report</button>}
                </div>
              )}
              {reportScope === 'mine' && claimRequests.length > 0 && (
                <section className="claim-requests" aria-label="My claim requests">
                  <div className="claim-requests-heading"><div><p className="eyebrow">Private to this browser</p><h3>Claim requests</h3></div><span>{claimRequests.length}</span></div>
                  <div className="claim-request-list">
                    {claimRequests.map(request => <article className="claim-request" key={request.id}><div><strong>{request.itemTitle}</strong><p>Saved locally · not sent to campus staff</p></div><span>{request.created}</span></article>)}
                  </div>
                </section>
              )}
            </div>
          </section>
        </main>
      ) : (
        <main className="report-page">
          <button className="back-button" onClick={() => setPage('board')}>← <span>Back to reports</span></button>
          <div className="report-layout">
            <div className="report-intro">
              <p className="eyebrow">A little detail goes a long way</p>
              <h1>{current ? 'Update your report.' : 'Tell us what happened.'}</h1>
              <p>Share a few details so someone can recognize the item. Reports are visible on the campus noticeboard.</p>
              <div className="form-tip"><span aria-hidden="true">✳</span><span>For student IDs and valuables, leave personal details out of the public description.</span></div>
            </div>

            <section className="form-paper">
              <div className="form-heading"><p className="eyebrow">Community noticeboard</p><h2>{current ? 'Edit report' : 'New report'}</h2></div>
              <form onSubmit={submit}>
                <label htmlFor="item-title"><span className="label-line">Item name <b>*</b></span><input id="item-title" value={form.title} onChange={event => setForm(state => ({ ...state, title: event.target.value }))} placeholder="e.g. Black backpack" /></label>
                <div className="form-row">
                  <label htmlFor="item-status"><span className="label-line">Status <b>*</b></span><select id="item-status" value={form.status} onChange={event => setForm(state => ({ ...state, status: event.target.value }))}><option value="">Choose one</option>{statuses.map(status => <option key={status.key} value={status.key}>{status.label}</option>)}</select></label>
                  <label htmlFor="item-category"><span className="label-line">Category <b>*</b></span><select id="item-category" value={form.category} onChange={event => setForm(state => ({ ...state, category: event.target.value }))}><option value="">Choose a category</option>{categories.slice(1).map(itemCategory => <option key={itemCategory} value={itemCategory}>{cap(itemCategory)}</option>)}</select></label>
                </div>
                <div className="form-row">
                  <label htmlFor="item-location"><span className="label-line">Where was it lost or found?<span className="optional">Optional</span></span><input id="item-location" value={form.location} onChange={event => setForm(state => ({ ...state, location: event.target.value }))} placeholder="Building, room, or landmark" /></label>
                  <label htmlFor="item-last-seen"><span className="label-line">{form.status === 'found' ? 'When did you find it?' : form.status === 'claimed' ? 'When was it collected?' : 'When did you last see it?'}<span className="optional">Optional</span></span><input id="item-last-seen" type="date" value={form.lastSeenDate || ''} onChange={event => setForm(state => ({ ...state, lastSeenDate: event.target.value }))} /></label>
                </div>
                <label htmlFor="item-description"><span className="label-line">Description<span className="optional">Optional</span></span><textarea id="item-description" rows="5" value={form.description} onChange={event => setForm(state => ({ ...state, description: event.target.value }))} placeholder="Color, brand, markings, or another detail someone could recognize" /></label>
                <div className="photo-field">
                  <div className="label-line photo-label">Item photo<span className="optional">Optional</span></div>
                  {form.imageData && <div className="photo-preview"><img src={form.imageData} alt="Preview of the item" /><button type="button" className="remove-photo" onClick={() => setForm(state => ({ ...state, imageData: '' }))}>Remove photo</button></div>}
                  <label className="photo-picker"><input type="file" accept="image/*" onChange={handlePhotoChange} /><span className="photo-picker-icon" aria-hidden="true">＋</span><span><strong>{form.imageData ? 'Choose a different photo' : 'Add a photo'}</strong><small>JPG or PNG · up to 12 MB · resized for this demo</small></span></label>
                  {photoError && <p className="photo-error" role="alert">{photoError}</p>}
                </div>
                {error && <div className="form-error" role="alert">{error}</div>}
                <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setPage('board')}>Cancel</button><button className="report-button" type="submit">{current ? 'Save changes' : 'Post report'}</button></div>
              </form>
            </section>
          </div>
        </main>
      )}

      {page === 'board' && selectedItem && (
        <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <button className="modal-close" onClick={() => setSelectedItem(null)} aria-label="Close report details">×</button>
            {claimNotice && <div className="claim-success" role="status">{claimNotice}</div>}
            <div className="detail-overview">
              <div className="detail-visual">{selectedItem.imageData ? <img src={selectedItem.imageData} alt={`Photo of ${selectedItem.title}`} /> : <span aria-hidden="true">{selectedItem.emoji}</span>}</div>
              <div className="detail-heading">
                <div className="detail-badges"><span className={`report-status ${selectedItem.status}`}>{cap(selectedItem.status)}</span><span className="detail-category">{cap(selectedItem.category)}</span></div>
                <h2 id="detail-title">{selectedItem.title}</h2>
                <p className="detail-location"><span aria-hidden="true">⌖</span>{selectedItem.location || 'Location not provided'}</p>
                <p className="detail-date">{selectedItem.lastSeenDate ? `Date: ${new Date(`${selectedItem.lastSeenDate}T12:00:00`).toLocaleDateString()}` : `Reported ${selectedItem.created}`}</p>
              </div>
            </div>
            <section className="detail-description"><h3>More details</h3><p>{selectedItem.description || 'The person who posted this report did not add a description.'}</p></section>
            {selectedItem.status !== 'lost' && <section className="collection-info"><strong>Collection status</strong><p>{handoverText(selectedItem)}</p>{selectedItem.handoverStatus !== 'received' && selectedItem.status === 'found' && <small>This report does not confirm that campus staff are holding the item. Check with staff before making a trip.</small>}</section>}

            {matches.length > 0 && <section className="possible-matches"><div className="matches-heading"><div><h3>Possible matches</h3><p>Similar names, descriptions, or locations. Check details before assuming they’re the same item.</p></div><span>✳</span></div><div className="match-list">{matches.map(match => <button className="match-row" key={match.id} onClick={() => openDetails(match)}>{match.imageData ? <img className="match-photo" src={match.imageData} alt="" /> : <span className="match-emoji" aria-hidden="true">{match.emoji}</span>}<span className="match-copy"><strong>{match.title}</strong><small>{cap(match.status)} · {match.location || 'Location not provided'}</small></span><span className="match-arrow" aria-hidden="true">›</span></button>)}</div></section>}

            {claimMode && <form className="claim-form" onSubmit={sendClaimRequest}><h3>Request a claim review</h3><p>Share one identifying detail that isn’t in the public post. Don’t include your phone number, email, or student ID. This demo saves the request in this browser and does not send it to staff.</p><label htmlFor="claim-proof">What detail can help verify it’s yours?<textarea id="claim-proof" rows="4" value={claimProof} onChange={event => setClaimProof(event.target.value)} placeholder="For example, describe a mark or something inside the item" /></label>{claimError && <p className="claim-error" role="alert">{claimError}</p>}<div className="claim-form-actions"><button type="button" className="secondary-button" onClick={() => { setClaimMode(false); setClaimError(''); }}>Cancel</button><button type="submit" className="report-button">Save claim request</button></div></form>}

            {selectedClaim && <div className="existing-claim"><strong>You have a request saved for this item.</strong><span>It is stored in this browser only; campus staff have not been notified.</span></div>}
            <div className="detail-actions">
              {selectedItem.owner === 'you' && <button className="edit-button" onClick={() => edit(selectedItem)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.8 2.2a1.4 1.4 0 0 1 2 2L6 12l-3.2.8L3.6 9.6l8.2-7.4Z"/><path d="m10.7 3.3 2 2"/></svg><span>Edit your report</span></button>}
              {selectedItem.status === 'found' && selectedItem.owner !== 'you' && !selectedClaim && !claimMode && <button className="report-button" onClick={() => { setClaimMode(true); setClaimNotice(''); }}>I think this is mine</button>}
              <button className="secondary-button" onClick={() => setSelectedItem(null)}>Close details</button>
            </div>
          </section>
        </div>
      )}

      <footer className="page-footer"><span>found on campus</span><span>Community project · Demo only</span></footer>
      {page === 'board' && message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message">×</button></div>}
    </div>
  );
}
