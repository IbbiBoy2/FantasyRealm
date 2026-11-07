/*
 * FANTASYREALM - COMPACT EMPLOYEE TABLES
 *
 * Presents the five existing employee lists as accessible data tables.
 * Reuses the original action buttons and their event listeners, so no
 * moderation, deletion, or CSRF workflow is duplicated or changed.
 *
 * Existing controllers fetch and refresh their own lists asynchronously.
 * A MutationObserver updates the table after each original render.
 */
(() => {
  'use strict';

  const configurations = [
    {
      id: 'pending-characters-list',
      label: 'Pending character names',
      headers: ['Character', 'ID', 'Creator', 'Submitted', 'Actions'],
      cells: [
        { selector: 'h3' },
        { meta: 0 },
        { meta: 1 },
        { meta: 2 },
        { actions: true }
      ]
    },
    {
      id: 'pending-reviews-list',
      label: 'Pending character reviews',
      headers: ['Review', 'Character', 'Reviewer', 'Rating', 'Comment', 'Actions'],
      cells: [
        { selector: 'h3' },
        { meta: 0 },
        { meta: 1 },
        { meta: 2 },
        { comment: true },
        { actions: true }
      ]
    },
    {
      id: 'accessories-list',
      label: 'Accessory library',
      headers: ['Accessory', 'ID', 'Type', 'In use', 'Status', 'Actions'],
      cells: [
        { selector: 'h3' },
        { meta: 0 },
        { meta: 1 },
        { meta: 2 },
        { selector: '.employee-status' },
        { actions: true }
      ]
    },
    {
      id: 'managed-users-list',
      label: 'Player accounts',
      headers: ['Player', 'ID', 'Email', 'Joined', 'Status', 'Actions'],
      cells: [
        { selector: 'h3' },
        { meta: 0 },
        { meta: 1 },
        { meta: 2 },
        { selector: '.employee-status' },
        { actions: true }
      ]
    },
    {
      id: 'staff-character-list',
      label: 'Existing characters',
      headers: ['Character', 'ID', 'Creator', 'Status', 'Created', 'Actions'],
      cells: [
        { selector: 'h3' },
        { meta: 0 },
        { meta: 1 },
        { meta: 2 },
        { meta: 3 },
        { actions: true }
      ]
    }
  ];

  /* Remove only the fixed, locally defined label from a metadata line. */
  function metadataValue(paragraph) {
    if (!paragraph) return '—';
    const value = paragraph.textContent || '';
    const colon = value.indexOf(':');
    return (colon < 0 ? value : value.slice(colon + 1)).trim() || '—';
  }

  /* Move the original action container rather than cloning buttons. */
  function makeCell(card, definition, metadata) {
    const td = document.createElement('td');

    if (definition.actions) {
      td.className = 'employee-table-actions';
      const existingActions = card.querySelector('.employee-card-actions');
      if (existingActions) td.appendChild(existingActions);
      return td;
    }

    if (definition.meta !== undefined) {
      td.textContent = metadataValue(metadata[definition.meta]);
      return td;
    }

    if (definition.comment) {
      const comment = Array.from(card.children).find((child) =>
        child.matches('p:not(.employee-meta)')
      );
      td.className = 'employee-table-comment';
      const text = comment ? comment.textContent.trim() : '—';
      td.textContent = text;
      td.title = text;
      return td;
    }

    const original = card.querySelector(definition.selector);
    if (original) {
      td.appendChild(original);
    } else {
      td.textContent = '—';
    }
    return td;
  }

  /* Build semantic table markup with header associations for screen readers. */
  function convertList(root, config) {
    const cards = Array.from(root.children).filter((child) =>
      child.matches('article.employee-card')
    );

    // Empty-state feedback remains unchanged.
    if (!cards.length) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'employee-table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', `${config.label} table, scroll horizontally if necessary`);

    const table = document.createElement('table');
    table.className = 'employee-data-table';
    const caption = document.createElement('caption');
    caption.className = 'employee-visually-hidden';
    caption.textContent = config.label;
    table.appendChild(caption);

    const thead = document.createElement('thead');
    const headingRow = document.createElement('tr');
    for (const label of config.headers) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headingRow.appendChild(th);
    }
    thead.appendChild(headingRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const card of cards) {
      const tr = document.createElement('tr');
      const metadata = Array.from(card.querySelectorAll('.employee-meta'));
      for (const definition of config.cells) {
        tr.appendChild(makeCell(card, definition, metadata));
      }
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
    root.replaceChildren(wrapper);
    root.classList.add('employee-table-host');
  }

  /* Observe only the five list roots; a re-render rebuilds their table. */
  function attach(root, config) {
    const observer = new MutationObserver(() => {
      if (root.querySelector(':scope > .employee-table-scroll')) return;
      convertList(root, config);
    });
    observer.observe(root, { childList: true });
    convertList(root, config);
  }

  /* The character-deletion section is inserted dynamically by its module. */
  const pending = new Map(configurations.map((config) => [config.id, config]));

  function attachAvailable() {
    for (const [id, config] of pending) {
      const root = document.getElementById(id);
      if (!root) continue;
      attach(root, config);
      pending.delete(id);
    }
    return pending.size === 0;
  }

  if (!attachAvailable()) {
    const pageObserver = new MutationObserver(() => {
      if (attachAvailable()) pageObserver.disconnect();
    });
    pageObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
