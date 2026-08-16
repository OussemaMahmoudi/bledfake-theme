/**
 * BLED FAKE — bled.js  v2.0
 * Expert-grade storefront JavaScript
 * All Shopify API interactions, UI state, and animations.
 */

'use strict';

/* ================================================================
   UTILITIES
   ================================================================ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatMoney(cents, currency) {
  if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
  const cur = currency || (window.BF && window.BF.shopCurrency) || 'TND';
  return (cents / 100).toFixed(2) + ' ' + cur;
}

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================
   1. CUSTOM CURSOR
   ================================================================ */

(function initCursor() {
  const cursorEl = $('#bf-cursor');
  if (!cursorEl || isTouchDevice) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let curX   = mouseX;
  let curY   = mouseY;
  let rafId  = null;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!rafId) rafId = requestAnimationFrame(moveCursor);
  });

  function moveCursor() {
    curX += (mouseX - curX) * 0.18;
    curY += (mouseY - curY) * 0.18;
    cursorEl.style.left = curX + 'px';
    cursorEl.style.top  = curY + 'px';
    if (Math.abs(mouseX - curX) > 0.5 || Math.abs(mouseY - curY) > 0.5) {
      rafId = requestAnimationFrame(moveCursor);
    } else {
      rafId = null;
    }
  }

  document.addEventListener('mousedown', () => cursorEl.classList.add('is-pressing'));
  document.addEventListener('mouseup',   () => cursorEl.classList.remove('is-pressing'));

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, [data-hover], label')) cursorEl.classList.add('is-hovering');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, [data-hover], label')) cursorEl.classList.remove('is-hovering');
  });
})();

/* ================================================================
   2. PARALLAX
   ================================================================ */

(function initParallax() {
  if (prefersReducedMotion || isTouchDevice) return;
  let tX = 0, tY = 0, cX = 0, cY = 0, raf = null;

  function apply() {
    cX += (tX - cX) * 0.055;
    cY += (tY - cY) * 0.055;
    document.documentElement.style.setProperty('--px', cX.toFixed(4));
    document.documentElement.style.setProperty('--py', cY.toFixed(4));
    if (Math.abs(tX - cX) > 0.002 || Math.abs(tY - cY) > 0.002) {
      raf = requestAnimationFrame(apply);
    } else {
      raf = null;
    }
  }

  document.addEventListener('mousemove', (e) => {
    tX = (e.clientX / window.innerWidth  - 0.5) * 2;
    tY = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(apply);
  });
})();

/* ================================================================
   3. MENU OVERLAY
   ================================================================ */

function getMenuEl() {
  return $('#bf-main-menu') || $('#bf-menu') || $('.bf-menu');
}

function getBackdropEl() {
  return $('#bf-overlay-backdrop') || $('#bf-backdrop') || $('.bf-overlay-backdrop');
}

function getCartDrawerEl() {
  return $('#bf-cart-drawer') || $('.bf-cart-drawer');
}

function openMenu() {
  const menu = getMenuEl();
  const backdrop = getBackdropEl();
  if (menu) menu.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-active');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  const menu = getMenuEl();
  const backdrop = getBackdropEl();
  const cart = getCartDrawerEl();
  if (menu) menu.classList.remove('is-open');
  if (backdrop && (!cart || !cart.classList.contains('is-open'))) {
    backdrop.classList.remove('is-active');
  }
  document.body.style.overflow = '';
}

/* ================================================================
   4. AJAX CART (Shopify: /cart.js, /cart/add.js, /cart/change.js)
   ================================================================ */

function openCart() {
  const cart = getCartDrawerEl();
  const backdrop = getBackdropEl();
  if (!cart) {
    window.location.href = '/cart';
    return;
  }
  cart.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-active');
  document.body.style.overflow = 'hidden';
  fetchAndRenderCart();
}

function closeCart() {
  const cart = getCartDrawerEl();
  const backdrop = getBackdropEl();
  const menu = getMenuEl();
  if (cart) cart.classList.remove('is-open');
  if (backdrop && (!menu || !menu.classList.contains('is-open'))) {
    backdrop.classList.remove('is-active');
  }
  document.body.style.overflow = '';
}

async function fetchCart() {
  try {
    const res = await fetch('/cart.js', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    return await res.json();
  } catch (err) {
    console.error('[BLED Cart] Fetch error:', err);
    return null;
  }
}

function renderCart(cart) {
  const bodyEl = $('#bf-cart-body');
  if (!bodyEl) return;

  // Update count badge everywhere
  updateCartCountBadge(cart ? cart.item_count : 0);

  // Update count label in drawer header
  const countLabel = $('#bf-cart-count-label');
  if (countLabel && cart) {
    countLabel.textContent = `${cart.item_count} ITEM${cart.item_count !== 1 ? 'S' : ''}`;
  }

  // Update total
  const totalEl = $('#bf-cart-total');
  if (totalEl && cart) totalEl.textContent = formatMoney(cart.total_price);

  if (!cart || cart.item_count === 0) {
    bodyEl.innerHTML = '<div class="bf-cart-empty">YOUR BAG IS EMPTY</div>';
    return;
  }

  bodyEl.innerHTML = cart.items.map(item => `
    <div class="bf-cart-item" data-key="${item.key}">
      <img
        class="bf-cart-item__img"
        src="${item.image || ''}"
        alt="${(item.product_title || '').replace(/"/g, '')}"
        loading="lazy"
        onerror="this.style.display='none'"
      >
      <div class="bf-cart-item__info">
        <p class="bf-cart-item__title">${(item.product_title || '').toUpperCase()}</p>
        ${item.variant_title && item.variant_title !== 'Default Title'
          ? `<p class="bf-cart-item__variant">SIZE: ${item.variant_title}</p>` : ''}
        <div class="bf-cart-item__row">
          <div class="bf-qty-controls">
            <button type="button" class="bf-qty-btn" data-key="${item.key}" data-qty="${item.quantity - 1}" aria-label="Decrease">−</button>
            <span class="bf-qty-num">${item.quantity}</span>
            <button type="button" class="bf-qty-btn" data-key="${item.key}" data-qty="${item.quantity + 1}" aria-label="Increase">+</button>
          </div>
          <span class="bf-cart-item__price">${formatMoney(item.final_price)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Wire qty buttons
  $$('.bf-qty-btn', bodyEl).forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const qty = parseInt(btn.dataset.qty, 10);
      await cartChange(key, Math.max(0, qty));
    });
  });
}

function updateCartCountBadge(count) {
  $$('.bf-cart-count, .bf-cart-badge-count').forEach(el => {
    el.textContent = count > 0 ? String(count) : '0';
  });
}

async function fetchAndRenderCart() {
  const cart = await fetchCart();
  renderCart(cart);
}

async function cartAdd(variantId, quantity = 1) {
  try {
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: parseInt(variantId, 10), quantity })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.description || 'Could not add to cart');
    }
    await fetchAndRenderCart();
    openCart();
    return true;
  } catch (err) {
    console.error('[BLED Cart] Add error:', err.message);
    // Show user-friendly error
    const errBox = document.createElement('div');
    errBox.className = 'bf-cart-error-toast';
    errBox.textContent = err.message;
    document.body.appendChild(errBox);
    setTimeout(() => errBox.remove(), 3500);
    return false;
  }
}

async function cartChange(key, quantity) {
  try {
    const res = await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: key, quantity })
    });
    const cart = await res.json();
    renderCart(cart);
  } catch (err) {
    console.error('[BLED Cart] Change error:', err);
  }
}

/* ================================================================
   5. PRODUCT MEDIA NAVIGATION (Smooth Scroll & Wheel Snap)
   ================================================================ */

let currentMediaIndex = 0;

function updateMediaDots(activeIndex) {
  currentMediaIndex = activeIndex;
  $$('#bf-media-dots .bf-media-dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === activeIndex);
  });
}

function initMediaNavigation() {
  // Sync dots when user scrolls horizontally on the garment track
  document.addEventListener('scroll', (e) => {
    const track = e.target.closest('#product-media-track, .bf-garment-scroll-track');
    if (!track) return;
    const scrollLeft = track.scrollLeft;
    const slideWidth = track.clientWidth || 1;
    const activeIndex = Math.round(scrollLeft / slideWidth);
    updateMediaDots(activeIndex);
  }, true);

  // Allow standard mouse wheel to scroll horizontally across garment images
  document.addEventListener('wheel', (e) => {
    const track = e.target.closest('#product-media-track, .bf-garment-scroll-track');
    if (!track) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      track.scrollBy({ left: e.deltaY * 1.5, behavior: 'smooth' });
    }
  }, { passive: false });

  // Direct dot click support: smooth scroll to slide
  document.addEventListener('click', (e) => {
    const dot = e.target.closest('.bf-media-dot');
    if (!dot) return;
    const track = $('#product-media-track, .bf-garment-scroll-track');
    const allDots = $$('#bf-media-dots .bf-media-dot');
    const dotIdx = allDots.indexOf(dot);
    if (track && dotIdx !== -1) {
      track.scrollTo({ left: dotIdx * track.clientWidth, behavior: 'smooth' });
    }
  });
}

/* ================================================================
   6. VARIANT SELECTION — Fully synced to Shopify IDs
   ================================================================ */

function initVariantSelection() {
  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.bf-size-pill');
    if (!pill) return;
    if (pill.disabled || pill.classList.contains('is-disabled')) return;

    // Deselect siblings
    const group = pill.closest('.bf-size-pills');
    if (group) $$('.bf-size-pill', group).forEach(p => p.classList.remove('is-selected'));
    pill.classList.add('is-selected');

    // Sync hidden variant ID input
    const variantId = pill.dataset.variantId;
    const input = $('#selected-variant-id');
    if (input && variantId) input.value = variantId;

    // Update price display
    const price = parseInt(pill.dataset.price || '0', 10);
    const comparePrice = parseInt(pill.dataset.comparePrice || '0', 10);
    const priceEl = $('#product-price');
    if (priceEl) priceEl.textContent = formatMoney(price);

    const compareEl = $('#product-compare-price');
    if (compareEl) {
      if (comparePrice > price) {
        compareEl.textContent = formatMoney(comparePrice);
        compareEl.style.display = '';
      } else {
        compareEl.style.display = 'none';
      }
    }

    // Update availability for both buttons
    const isAvail = pill.dataset.available !== 'false';
    const atcBtn  = $('#add-to-cart-btn');
    const atcText = $('#btn-text');
    const buyBtn  = $('#buy-now-btn');
    const buyText = $('#buy-now-text');

    if (atcBtn) {
      atcBtn.disabled = !isAvail;
      atcBtn.setAttribute('aria-disabled', String(!isAvail));
    }
    if (atcText) atcText.textContent = isAvail ? 'ADD TO CART' : 'SOLD OUT';
    if (buyBtn) {
      buyBtn.disabled = !isAvail;
      buyBtn.setAttribute('aria-disabled', String(!isAvail));
    }
    if (buyText) buyText.textContent = isAvail ? 'BUY IT NOW' : 'SOLD OUT';
  });
}

/* ================================================================
   7. PRODUCT CAROUSEL NAVIGATION
   ================================================================ */

function initProductNavigation() {
  const prevBtn   = $('#prev-btn');
  const nextBtn   = $('#next-btn');
  const displayEl = $('#product-display');
  const products  = (window.bfProducts || []);

  if (!prevBtn || !nextBtn || !displayEl || products.length === 0) return;

  let currentIndex = parseInt(displayEl.dataset.currentIndex || '0', 10);
  const productCount = products.length;

  function setProduct(index) {
    const product = products[index];
    if (!product) return;

    displayEl.classList.add('is-changing');

    setTimeout(() => {
      // Title
      const nameEl = $('#product-name');
      if (nameEl) nameEl.textContent = (product.title || '').toUpperCase();

      // Reset media index
      currentMediaIndex = 0;

      // Rebuild media track slides
      const track = $('#product-media-track, .bf-garment-scroll-track');
      if (track && product.images && product.images.length > 0) {
        track.innerHTML = product.images.map((src, i) => `
          <div class="bf-garment-slide" data-media-index="${i}">
            <img
              class="bf-product-image"
              src="${src}"
              alt="${product.title || ''}"
              loading="${i === 0 ? 'eager' : 'lazy'}"
              decoding="async"
            >
          </div>
        `).join('');
        track.scrollTo({ left: 0, behavior: 'instant' });
      }

      // Update media dots
      const dotsEl = $('#bf-media-dots');
      if (dotsEl) {
        if (product.images && product.images.length > 1) {
          dotsEl.innerHTML = product.images.map((_, i) =>
            `<button type="button" class="bf-media-dot${i === 0 ? ' is-active' : ''}" data-slide-index="${i}" aria-label="View slide ${i + 1}"></button>`
          ).join('');
          dotsEl.style.display = '';
        } else {
          dotsEl.style.display = 'none';
        }
      }
            `<span class="bf-media-dot${i === 0 ? ' is-active' : ''}"></span>`
          ).join('');
          dotsEl.style.display = '';
        } else {
          dotsEl.style.display = 'none';
        }
      }

      // Description
      const descEl = $('#product-description');
      if (descEl) {
        descEl.innerHTML = product.description || '';
        descEl.style.display = product.description ? '' : 'none';
      }

      // Variant & Price — use first available variant
      const firstAvail = (product.variants || []).find(v => v.available) || (product.variants && product.variants[0]);
      const priceEl = $('#product-price');
      if (priceEl && firstAvail) priceEl.textContent = formatMoney(firstAvail.price);

      const compareEl = $('#product-compare-price');
      if (compareEl) {
        if (firstAvail && firstAvail.compare_at_price > firstAvail.price) {
          compareEl.textContent = formatMoney(firstAvail.compare_at_price);
          compareEl.style.display = '';
        } else {
          compareEl.style.display = 'none';
        }
      }

      const varInput = $('#selected-variant-id');
      if (varInput && firstAvail) varInput.value = firstAvail.id;

      // Rebuild size pills
      const pillsContainer = $('#bf-size-pills');
      if (pillsContainer && product.variants) {
        if (product.variants.length > 1) {
          pillsContainer.innerHTML = product.variants.map((v, i) => {
            const isFirst = i === 0;
            return `<button
              type="button"
              class="bf-size-pill${isFirst ? ' is-selected' : ''}${!v.available ? ' is-disabled' : ''}"
              data-variant-id="${v.id}"
              data-price="${v.price}"
              data-compare-price="${v.compare_at_price || 0}"
              data-available="${v.available}"
              ${!v.available ? 'disabled aria-disabled="true"' : ''}
            >${v.title}</button>`;
          }).join('');
        } else if (firstAvail) {
          pillsContainer.innerHTML = `<button
            type="button"
            class="bf-size-pill is-selected"
            data-variant-id="${firstAvail.id}"
            data-price="${firstAvail.price}"
            data-compare-price="${firstAvail.compare_at_price || 0}"
            data-available="${firstAvail.available}"
          >${firstAvail.title !== 'Default Title' ? firstAvail.title : 'ONE SIZE'}</button>`;
        }
      }

      // Update ATC + Buy Now button state
      const isAvail = firstAvail ? firstAvail.available : false;
      const atcBtn  = $('#add-to-cart-btn');
      const atcText = $('#btn-text');
      const buyBtn  = $('#buy-now-btn');
      const buyText = $('#buy-now-text');

      if (atcBtn) { atcBtn.disabled = !isAvail; }
      if (atcText) atcText.textContent = isAvail ? 'ADD TO CART' : 'SOLD OUT';
      if (buyBtn) { buyBtn.disabled = !isAvail; }
      if (buyText) buyText.textContent = isAvail ? 'BUY IT NOW' : 'SOLD OUT';

      // Product counter
      const numEl = $('#bf-product-num');
      if (numEl) numEl.textContent = String(index + 1).padStart(2, '0');

      // Update URL silently (pushState for browser history)
      if (product.url) history.replaceState(null, '', product.url);

      displayEl.classList.remove('is-changing');
    }, 220);

    currentIndex = index;
    displayEl.dataset.currentIndex = index;
  }

  prevBtn.addEventListener('click', () => {
    setProduct((currentIndex - 1 + productCount) % productCount);
  });
  nextBtn.addEventListener('click', () => {
    setProduct((currentIndex + 1) % productCount);
  });

  // Keyboard navigation
  if ($('.bf-store')) {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft')  prevBtn.click();
      if (e.key === 'ArrowRight') nextBtn.click();
    });
  }
}

/* ================================================================
   INITIALIZATION
   ================================================================ */

window.addEventListener('DOMContentLoaded', () => {

  // ── Initialize badge from Shopify Liquid (no flash) ──
  if (window.BF && typeof window.BF.cartCount === 'number') {
    updateCartCountBadge(window.BF.cartCount);
  }

  // ── Global click delegations (Menu, Cart, Backdrop, Buy Now) ──
  document.addEventListener('click', async (e) => {
    // Menu open / close
    if (e.target.closest('[data-menu-open], #menu-open-btn, #menu-open-btn-store')) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (e.target.closest('[data-menu-close], #menu-close-btn')) {
      e.preventDefault();
      closeMenu();
      return;
    }

    // Cart drawer open / close
    if (e.target.closest('[data-cart-open], #cart-open-btn')) {
      e.preventDefault();
      openCart();
      return;
    }
    if (e.target.closest('[data-cart-close], #cart-close-btn')) {
      e.preventDefault();
      closeCart();
      return;
    }

    // Backdrop click
    if (e.target.closest('#bf-overlay-backdrop, #bf-backdrop, .bf-overlay-backdrop')) {
      closeMenu();
      closeCart();
      return;
    }

    // Buy It Now CTA
    const buyBtn = e.target.closest('#buy-now-btn, .bf-buy-now-btn');
    if (buyBtn) {
      e.preventDefault();
      const form = buyBtn.closest('form') || $('#bf-add-form') || $('.bf-add-cart-form');
      const idInput = form ? form.querySelector('[name="id"]') : $('#selected-variant-id');
      const variantId = idInput ? idInput.value : null;

      const textSpan = buyBtn.querySelector('#buy-now-text') || buyBtn;

      try {
        if (textSpan) textSpan.textContent = 'PROCEEDING...';
        buyBtn.disabled = true;

        if (variantId) {
          await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ id: parseInt(variantId, 10), quantity: 1 })
          });
        }

        const checkoutUrl = (window.BF && window.BF.checkoutUrl) || '/checkout';
        window.location.href = checkoutUrl;

      } catch (err) {
        console.error('[BLED Buy Now]', err);
        if (textSpan) textSpan.textContent = 'BUY IT NOW';
        buyBtn.disabled = false;
        window.location.href = '/checkout';
      }
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeMenu(); closeCart(); }
  });

  // ── Add to Cart form submit ──
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.bf-add-cart-form');
    if (!form) return;
    e.preventDefault();

    const idInput = form.querySelector('[name="id"]');
    if (!idInput || !idInput.value) return;

    const btn      = form.querySelector('#add-to-cart-btn');
    const textSpan = form.querySelector('#btn-text');

    try {
      if (textSpan) textSpan.textContent = 'ADDING...';
      if (btn) btn.disabled = true;
      await cartAdd(idInput.value, 1);
    } finally {
      if (textSpan) textSpan.textContent = 'ADD TO CART';
      if (btn) btn.disabled = false;
    }
  });

  // ── Payment option toggle (checkout page) ──
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('.bf-payment-option');
    if (!opt) return;
    $$('.bf-payment-option').forEach(o => o.classList.remove('is-selected'));
    opt.classList.add('is-selected');
  });

  // ── Feature initializers ──
  initMediaNavigation();
  initVariantSelection();
  initProductNavigation();

  // ── Sync cart badge via API (background, no flicker) ──
  fetchCart().then(cart => {
    if (cart) {
      updateCartCountBadge(cart.item_count);
      // Also sync total on checkout page if present
      const totalEl = $('#co-subtotal, #pv-co-subtotal');
      if (totalEl) totalEl.textContent = formatMoney(cart.total_price);
    }
  });
});
