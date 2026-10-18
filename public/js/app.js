/**
 * Progressive enhancement for Mosaic Tile Studio Orders.
 * Everything here is additive: every form and link works with JavaScript disabled.
 */
(function () {
  'use strict';

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  ready(function () {
    setupPasswordToggles();
    setupSubmitGuards();
    setupCommandPalette();
  });

  function setupPasswordToggles() {
    var toggles = document.querySelectorAll('[data-password-toggle]');
    Array.prototype.forEach.call(toggles, function (button) {
      var input = document.getElementById(button.getAttribute('data-password-toggle'));
      if (!input) return;

      button.addEventListener('click', function () {
        var isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
        button.textContent = isHidden ? 'Hide' : 'Show';
        input.focus();
      });
    });
  }

  /**
   * Three jobs per form: confirm destructive posts, block a double submit from
   * creating two records, and show the busy label while the request is in flight.
   */
  function setupSubmitGuards() {
    var forms = document.querySelectorAll('form');
    Array.prototype.forEach.call(forms, function (form) {
      // <form method="dialog"> closes a dialog; it never leaves the page.
      if (form.getAttribute('method') === 'dialog') return;

      form.addEventListener('submit', function (event) {
        if (form.dataset.submitting === 'true') {
          event.preventDefault();
          return;
        }

        var confirmation = form.getAttribute('data-confirm');
        if (confirmation && !window.confirm(confirmation)) {
          event.preventDefault();
          return;
        }

        form.dataset.submitting = 'true';

        var button = form.querySelector('button[type="submit"]');
        if (!button) return;

        var busyLabel = button.getAttribute('data-busy-label');
        if (busyLabel) button.textContent = busyLabel;
        button.setAttribute('aria-busy', 'true');
        // Disable after the submit has been queued so the request still leaves.
        window.setTimeout(function () {
          button.disabled = true;
        }, 0);
      });
    });
  }

  function setupCommandPalette() {
    var dialog = document.getElementById('cmd-palette');
    var openButton = document.querySelector('[data-cmd-open]');
    if (!dialog || !openButton || typeof dialog.showModal !== 'function') return;

    var input = document.getElementById('cmd-input');
    var empty = document.getElementById('cmd-empty');
    var links = Array.prototype.slice.call(dialog.querySelectorAll('#cmd-list a'));
    var lastFocused = null;

    function filterList() {
      var term = input.value.trim().toLowerCase();
      var shown = 0;

      links.forEach(function (link) {
        var matches = !term || link.textContent.toLowerCase().indexOf(term) !== -1;
        link.parentElement.hidden = !matches;
        if (matches) shown += 1;
      });

      if (empty) empty.hidden = shown !== 0;
    }

    function openPalette() {
      lastFocused = document.activeElement;
      input.value = '';
      filterList();
      dialog.showModal();
      input.focus();
    }

    openButton.addEventListener('click', openPalette);

    dialog.addEventListener('close', function () {
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    });

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });

    input.addEventListener('input', filterList);

    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var first = links.filter(function (link) {
        return !link.parentElement.hidden;
      })[0];
      if (!first) return;
      event.preventDefault();
      window.location.assign(first.getAttribute('href'));
    });

    document.addEventListener('keydown', function (event) {
      var isShortcut = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
      if (!isShortcut) return;
      event.preventDefault();
      if (dialog.open) {
        dialog.close();
      } else {
        openPalette();
      }
    });
  }
})();
