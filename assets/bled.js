/**
 * BLED FAKE — bled.js
 * Custom storefront JavaScript
 * Covers: cursor, parallax, page transition, menu, cart AJAX, multi-image switcher, variant selection & product navigation
 */

'use strict';

/* ================================================================
   UTILITIES
   ================================================================ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatMoney(cents, currency = 'TND') {
  if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
  return (cents / 100).toFixed(2) + ' ' + currency;
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
    const el = e.target.closest('a, button, [data-hover]');
    if (el) cursorEl.classList.add('is-hovering');
  });

  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('a, button, [data-hover]');
    if (el) cursorEl.classList.remove('is-hovering');
  });
})();

/* ================================================================
   2. PARALLAX
   =============================================================== */

(function initParallax() {
  if (prefersReducedMotion || isTouchDevice) return;

  let targetPX = 0, targetPY = 0;
  let currentPX = 0, currentPY = 0;
  let rafId = null;

  function applyParallax() {
    currentPX += (targetPX - currentPX) * 0.055;
    currentPY += (targetPY - currentPY) * 0.055;

    document.documentElement.style.setProperty('--px', currentPX.toFixed(4));
    document.documentElement.style.setProperty('--py', currentPY.toFixed(4));

    if (Math.abs(targetPX - currentPX) > 0.002 || Math.abs(targetPY - currentPY) > 0.002) {
      rafId = requestAnimationFrame(applyParallax);
    } else {
      rafId = null;
    }
  }

  document.addEventListener('mousemove', (e) => {
    targetPX = (e.clientX / window.innerWidth  - 0.5) * 2;
    targetPY = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!rafId) rafId = requestAnimationFrame(applyParallax);
  });
})();

/* ================================================================
   3. MENU OVERLAY & BACKDROP
   ================================================================ */

const menuEl   = $('#bf-main-menu');
const backdrop = $('#bf-backdrop') || $('.bf-overlay-backdrop');

function openMenu() {
  if (!menuEl) return;
  menuEl.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-active');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  if (!menuEl) return;
  menuEl.classList.remove('is-open');
  const cartDrawer = $('#bf-cart-drawer') || $('.bf-cart-drawer');
  if (backdrop && (!cartDrawer || !cartDrawer.classList.contains('is-open'))) {
    backdrop.classList.remove('is-active');
  }
  document.body.style.overflow = '';
}

/* ================================================================
   4. AJAX CART (Shopify API: /cart.js, /cart/add.js, /cart/change.js)
   ================================================================ */

const cartDrawer = $('#bf-cart-drawer') || $('.bf-cart-drawer');

function openCart() {
  if (!cartDrawer) return;
  cartDrawer.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-active');
  document.body.style.overflow = 'hidden';
  fetchAndRenderCart();
}

function closeCart() {
  if (!cartDrawer) return;
  cartDrawer.classList.remove('is-open');
  if (backdrop && (!menuEl || !menuEl.classList.contains('is-open'))) {
    backdrop.classList.remove('is-active');
  }
  document.body.style.overflow = '';
}

async function fetchCart() {
  try {
    const res = await fetch('/cart.js');
    return await res.json();
  } catch (err) {
    console.error('[BLED Cart] Error fetching cart:', err);
    return null;
  }
}

function renderCart(cart) {
  const cartBodyEl = $('#bf-cart-body') || $('.bf-cart-drawer__body');
  if (!cartBodyEl) return;

  if (!cart || cart.item_count === 0) {
    cartBodyEl.innerHTML = '<div class="bf-cart-empty">CART IS EMPTY</div>';
  } else {
    cartBodyEl.innerHTML = cart.items.map(item => `
      <div class="bf-cart-item" data-key="${item.key}">
        <img class="bf-cart-item__img"
             src="${item.image ? item.image : ''}"
             alt="${item.product_title || ''}"
             loading="lazy"
             onerror="this.style.display='none'">
        <div class="bf-cart-item__info">
          <p class="bf-cart-item__title">${item.product_title || ''}</p>
          ${item.variant_title && item.variant_title !== 'Default Title'
            ? `<p class="bf-cart-item__variant">SIZE: ${item.variant_title}</p>` : ''}
          <div class="bf-cart-item__row">
            <div class="bf-qty-controls">
              <button type="button" class="bf-qty-btn" aria-label="Decrease quantity"
                      data-key="${item.key}" data-action="decrease">−</button>
              <span class="bf-qty-num">${item.quantity}</span>
              <button type="button" class="bf-qty-btn" aria-label="Increase quantity"
                      data-key="${item.key}" data-action="increase">+</button>
            </div>
            <span class="bf-cart-item__price">${formatMoney(item.final_price)}</span>
          </div>
        </div>
      </div>
    `).join('');

    $$('.bf-qty-btn', cartBodyEl).forEach(btn => {
      btn.addEventListener('click', async () => {
        const key    = btn.dataset.key;
        const action = btn.dataset.action;
        const found  = cart.items.find(i => i.key === key);
        if (!found) return;
        const newQty = action === 'increase' ? found.quantity + 1 : found.quantity - 1;
        await cartChange(key, newQty);
      });
    });
  }

  // Update subtotal
  const totalEl = $('#bf-cart-total') || $('.bf-cart-total__price');
  if (totalEl && cart) totalEl.textContent = formatMoney(cart.total_price);

  // Update count badge everywhere
  updateCartCountBadge(cart ? cart.item_count : 0);

  // Update drawer count label
  const drawerCount = $('#bf-cart-count-label') || $('.bf-cart-drawer__count');
  if (drawerCount && cart) {
    drawerCount.textContent = `${cart.item_count} ITEM${cart.item_count !== 1 ? 'S' : ''}`;
  }
}

function updateCartCountBadge(count) {
  $$('.bf-cart-count, #cart-badge').forEach(el => {
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
      body: JSON.stringify({ id: variantId, quantity })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.description || 'Could not add to cart');
    }
    await fetchAndRenderCart();
    openCart();
  } catch (err) {
    console.error('[BLED Cart] Add error:', err.message);
    alert(err.message);
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
   5. PRODUCT MEDIA NAVIGATION (LEFT / RIGHT ARROWS ON GARMENT STAGE)
   ================================================================ */

let currentMediaIndex = 0;

function updateMediaArrows(images) {
  const prevMediaBtn = $('#media-prev-btn');
  const nextMediaBtn = $('#media-next-btn');

  if (!images || images.length <= 1) {
    if (prevMediaBtn) prevMediaBtn.style.display = 'none';
    if (nextMediaBtn) nextMediaBtn.style.display = 'none';
  } else {
    if (prevMediaBtn) prevMediaBtn.style.display = 'flex';
    if (nextMediaBtn) nextMediaBtn.style.display = 'flex';
  }
}

function setMediaAngle(index, images) {
  if (!images || images.length === 0) return;
  currentMediaIndex = (index + images.length) % images.length;
  const newSrc = images[currentMediaIndex];
  const mainImg = $('#main-product-img');
  if (mainImg && newSrc) {
    mainImg.style.opacity = '0.35';
    mainImg.src = newSrc;
    mainImg.onload = () => { mainImg.style.opacity = '1'; };
  }
}

function initMediaNavigation() {
  // Build a lookup: map featured_image URL -> full images array
  // so we can find the current product's images from the visible <img> src
  const products = (window.bfProducts || []);

  function getCurrentImages() {
    const mainImg = $('#main-product-img');
    if (!mainImg) return null;
    // Try to match current img src to a product's image list
    const src = (mainImg.src || '').split('?')[0];
    for (const prod of products) {
      if (!prod.images || prod.images.length === 0) continue;
      const match = prod.images.some(img => (img || '').split('?')[0] === src);
      if (match) return prod.images;
      // also check featured_image
      if (prod.featured_image && (prod.featured_image || '').split('?')[0] === src) {
        return prod.images;
      }
    }
    // Fallback: return first product with multiple images
    const firstMulti = products.find(p => p.images && p.images.length > 1);
    return firstMulti ? firstMulti.images : null;
  }

  document.addEventListener('click', (e) => {
    const isNext = !!e.target.closest('#media-next-btn');
    const isPrev = !!e.target.closest('#media-prev-btn');
    if (!isPrev && !isNext) return;

    const images = getCurrentImages();
    if (!images || images.length <= 1) return;

    if (isPrev) {
      setMediaAngle(currentMediaIndex - 1, images);
    } else {
      setMediaAngle(currentMediaIndex + 1, images);
    }
  });
}

/* ================================================================
   6. SIZE / VARIANT SELECTION
   ================================================================ */

function initVariantSelection() {
  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.bf-size-pill');
    if (!pill || pill.disabled || pill.classList.contains('is-disabled')) return;

    const group = pill.closest('.bf-size-pills');
    if (group) {
      $$('.bf-size-pill', group).forEach(p => p.classList.remove('is-selected'));
      pill.classList.add('is-selected');
    }

    // Update variant ID in hidden input
    const variantId = pill.dataset.variantId;
    const input = $('#selected-variant-id');
    if (input && variantId) input.value = variantId;

    // Update price display
    const priceVal = pill.dataset.price;
    const priceEl = $('#product-price');
    if (priceEl && priceVal) priceEl.textContent = formatMoney(priceVal);

    // Update compare price
    const compVal = pill.dataset.comparePrice;
    const compEl = $('#product-compare-price');
    if (compEl) {
      if (compVal && parseInt(compVal, 10) > parseInt(priceVal, 10)) {
        compEl.textContent = formatMoney(compVal);
        compEl.style.display = '';
      } else {
        compEl.style.display = 'none';
      }
    }

    // Check availability
    const isAvail = pill.dataset.available !== 'false';
    const atcBtn = $('#add-to-cart-btn');
    const atcText = $('#btn-text');
    if (atcBtn) {
      atcBtn.disabled = !isAvail;
      if (atcText) atcText.textContent = isAvail ? 'ADD TO CART' : 'SOLD OUT';
    }
  });
}

/* ================================================================
   7. STORE — PRODUCT CAROUSEL NAVIGATION
   ================================================================ */

function initProductNavigation() {
  const prevBtn   = $('#prev-btn');
  const nextBtn   = $('#next-btn');
  const displayEl = $('#product-display');
  const products  = (window.bfProducts || []);

  if (!prevBtn || !nextBtn || !displayEl || products.length === 0) return;

  let currentIndex = parseInt(displayEl.dataset.currentIndex || '0', 10);

  function setProduct(index) {
    const product = products[index];
    if (!product) return;

    displayEl.classList.add('is-changing');

    setTimeout(() => {
      // Title
      const nameEl = $('#product-name');
      if (nameEl) nameEl.textContent = (product.title || '').toUpperCase();

      // Reset media angle & update Main Image
      currentMediaIndex = 0;
      const imgEl = $('#main-product-img');
      if (imgEl) {
        const firstSrc = (product.images && product.images[0]) ? product.images[0] : product.featured_image;
        if (firstSrc) {
          imgEl.style.opacity = '0.35';
          imgEl.src = firstSrc;
          imgEl.alt = product.title;
          imgEl.onload = () => { imgEl.style.opacity = '1'; };
        }
      }

      // Update Media Nav Arrows visibility
      updateMediaArrows(product.images);

      // Update Description & Details
      const descEl = $('#product-description');
      if (descEl) {
        descEl.innerHTML = product.description || '';
        descEl.style.display = product.description ? '' : 'none';
      }

      // First Variant & Price
      const firstVar = (product.variants && product.variants[0]) ? product.variants[0] : null;
      const priceEl = $('#product-price');
      if (priceEl && firstVar) priceEl.textContent = formatMoney(firstVar.price);

      const varInput = $('#selected-variant-id');
      if (varInput && firstVar) varInput.value = firstVar.id;

      // Update Size Pills
      const pillsContainer = $('#bf-size-pills');
      if (pillsContainer && product.variants) {
        if (product.variants.length > 1) {
          pillsContainer.innerHTML = product.variants.map((v, i) => `
            <button
              type="button"
              class="bf-size-pill${i === 0 ? ' is-selected' : ''}${!v.available ? ' is-disabled' : ''}"
              data-variant-id="${v.id}"
              data-price="${v.price}"
              data-compare-price="${v.compare_at_price || 0}"
              data-available="${v.available}"
              ${!v.available ? 'disabled' : ''}
            >
              ${v.title}
            </button>
          `).join('');
        } else if (firstVar) {
          pillsContainer.innerHTML = `
            <button
              type="button"
              class="bf-size-pill is-selected"
              data-variant-id="${firstVar.id}"
              data-price="${firstVar.price}"
              data-compare-price="${firstVar.compare_at_price || 0}"
              data-available="${firstVar.available}"
            >
              ${firstVar.title !== 'Default Title' ? firstVar.title : 'ONE SIZE'}
            </button>
          `;
        }
      }

      // Update ATC button availability
      const atcBtn = $('#add-to-cart-btn');
      const atcText = $('#btn-text');
      if (atcBtn && firstVar) {
        atcBtn.disabled = !firstVar.available;
        if (atcText) atcText.textContent = firstVar.available ? 'ADD TO CART' : 'SOLD OUT';
      }

      // Update URL silently
      if (product.url) {
        history.replaceState(null, '', product.url);
      }

      displayEl.classList.remove('is-changing');
    }, 220);

    currentIndex = index;
    displayEl.dataset.currentIndex = index;
  }

  prevBtn.addEventListener('click', () => {
    setProduct((currentIndex - 1 + products.length) % products.length);
  });

  nextBtn.addEventListener('click', () => {
    setProduct((currentIndex + 1) % products.length);
  });

  if ($('.bf-store')) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  prevBtn.click();
      if (e.key === 'ArrowRight') nextBtn.click();
    });
  }
}

/* ================================================================
   INITIALIZATION
   ================================================================ */

window.addEventListener('DOMContentLoaded', () => {
  // Menu triggers
  $$('[data-menu-open]').forEach(btn => btn.addEventListener('click', openMenu));
  $$('[data-menu-close]').forEach(btn => btn.addEventListener('click', closeMenu));

  // Cart triggers
  $$('[data-cart-open]').forEach(btn => btn.addEventListener('click', openCart));
  $$('[data-cart-close]').forEach(btn => btn.addEventListener('click', closeCart));
  // Add to Cart Form
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.bf-add-cart-form');
    if (!form) return;
    e.preventDefault();

    const idInput = form.querySelector('[name="id"]');
    if (!idInput || !idInput.value) return;

    const btn = form.querySelector('.bf-cart-submit-btn, .bf-add-cart-btn');
    const textSpan = btn ? (btn.querySelector('#btn-text') || btn) : null;
    if (textSpan) textSpan.textContent = 'ADDING...';
    if (btn) btn.disabled = true;

    await cartAdd(idInput.value, 1);

    if (textSpan) textSpan.textContent = 'ADD TO CART';
    if (btn) btn.disabled = false;
  });

  // Buy It Now Handler
  document.addEventListener('click', async (e) => {
    const buyBtn = e.target.closest('#buy-now-btn, .bf-buy-now-btn');
    if (!buyBtn) return;
    e.preventDefault();

    const form = buyBtn.closest('form') || $('#bf-add-form');
    const idInput = form ? form.querySelector('[name="id"]') : $('#selected-variant-id');
    if (!idInput || !idInput.value) return;

    buyBtn.innerHTML = '<span>PROCEEDING...</span>';
    buyBtn.disabled = true;

    try {
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ id: idInput.value, quantity: 1 })
      });
      // Redirect to styled checkout page, not native Shopify checkout
      window.location.href = '/pages/checkout';
    } catch (err) {
      console.error('[BLED Checkout] Error:', err);
      window.location.href = '/checkout';
    }
  });

  // Feature initializers
  initMediaNavigation();
  initVariantSelection();
  initProductNavigation();

  // Initial media arrows check on current product
  const products = (window.bfProducts || []);
  if (products.length > 0 && products[0]) {
    updateMediaArrows(products[0].images);
  }

  // Initial cart fetch
  fetchCart().then(cart => {
    if (cart) updateCartCountBadge(cart.item_count);
  });
});
