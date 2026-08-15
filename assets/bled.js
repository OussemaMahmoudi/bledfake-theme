/**
 * BLED FAKE — bled.js
 * Custom storefront JavaScript
 * Covers: cursor, parallax, page transition, menu, cart AJAX, product navigation
 */

'use strict';

/* ================================================================
   UTILITIES
   ================================================================ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatMoney(cents, currency = 'TND') {
  if (typeof cents !== 'number') cents = parseInt(cents, 10);
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
   2. PARALLAX (mouse & touch)
   ================================================================ */

(function initParallax() {
  if (prefersReducedMotion) return;

  let targetPX = 0, targetPY = 0;
  let currentPX = 0, currentPY = 0;
  let rafId = null;

  function applyParallax() {
    currentPX += (targetPX - currentPX) * 0.055;
    currentPY += (targetPY - currentPY) * 0.055;

    document.documentElement.style.setProperty('--px', currentPX.toFixed(4));
    document.documentElement.style.setProperty('--py', currentPY.toFixed(4));

    if (
      Math.abs(targetPX - currentPX) > 0.002 ||
      Math.abs(targetPY - currentPY) > 0.002
    ) {
      rafId = requestAnimationFrame(applyParallax);
    } else {
      rafId = null;
    }
  }

  function scheduleParallax(x, y) {
    targetPX = x;
    targetPY = y;
    if (!rafId) rafId = requestAnimationFrame(applyParallax);
  }

  if (!isTouchDevice) {
    document.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth  - 0.5) * 2; // -1 to 1
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      scheduleParallax(x, y);
    });
  } else {
    // Mobile: gentle auto-drift + touch response
    let driftAngle = 0;
    let driftRaf;

    function drift() {
      driftAngle += 0.0022;
      scheduleParallax(
        Math.sin(driftAngle) * 0.25,
        Math.cos(driftAngle * 0.7) * 0.18
      );
      driftRaf = requestAnimationFrame(drift);
    }
    driftRaf = requestAnimationFrame(drift);

    document.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const x = (touch.clientX / window.innerWidth  - 0.5) * 1.4;
      const y = (touch.clientY / window.innerHeight - 0.5) * 1.4;
      scheduleParallax(x, y);
    }, { passive: true });
  }
})();

/* ================================================================
   3. PAGE TRANSITION
   ================================================================ */

const overlay = $('#bf-transition-overlay');

function transitionTo(url) {
  if (!overlay || prefersReducedMotion) {
    window.location.href = url;
    return;
  }

  // Step 1 — curtain drops
  overlay.classList.add('is-entering');

  // Step 2 — animate city + mascot away
  setTimeout(() => {
    const city   = $('.bf-landing__city');
    const mascot = $('.bf-landing__mascot');
    if (city) {
      city.style.transition = 'transform 0.5s cubic-bezier(0.76, 0, 0.24, 1)';
      city.style.transform  = 'translate(-4%, 3%) scale(1.06)';
    }
    if (mascot) {
      mascot.style.transition = 'transform 0.4s cubic-bezier(0.76, 0, 0.24, 1)';
      mascot.style.transform  = 'translate(calc(var(--px,-0) * -9px), -30px) scale(1.12)';
    }
  }, 80);

  // Step 3 — navigate
  setTimeout(() => {
    window.location.href = url;
  }, 680);
}

// Page-load reveal animation
window.addEventListener('DOMContentLoaded', () => {
  if (!overlay || prefersReducedMotion) return;
  overlay.classList.add('is-exiting');
  overlay.addEventListener('animationend', () => {
    overlay.classList.remove('is-entering', 'is-exiting');
  }, { once: true });
});

/* ================================================================
   4. CTA CLICK (landing → store)
   ================================================================ */

window.addEventListener('DOMContentLoaded', () => {
  const cta = $('.bf-landing__cta');
  if (cta) {
    cta.addEventListener('click', (e) => {
      e.preventDefault();
      transitionTo(cta.getAttribute('href') || (window.BF && window.BF.collectionsUrl) || '/collections/all');
    });
  }

  // Also handle menu nav links for transition
  $$('.bf-menu__item').forEach(item => {
    item.addEventListener('click', (e) => {
      const href = item.getAttribute('href');
      if (href && href !== '#' && !href.startsWith('#')) {
        e.preventDefault();
        closeMenu();
        setTimeout(() => transitionTo(href), 50);
      }
    });
  });
});

/* ================================================================
   5. MENU
   ================================================================ */

const menuEl     = $('.bf-menu');
const backdropEl = $('#bf-overlay-backdrop');

function openMenu() {
  if (!menuEl) return;
  menuEl.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if (backdropEl) backdropEl.classList.add('is-active');
  // Animate hamburger to X
  const trigger = $('[data-menu-open]');
  if (trigger) trigger.closest('.bf-menu-trigger, .bf-nav-right')?.classList.add('bf-menu--open');
  // Or global body class
  document.body.classList.add('bf-menu-is-open');
}

function closeMenu() {
  if (!menuEl) return;
  menuEl.classList.remove('is-open');
  document.body.style.overflow = '';
  if (backdropEl && !$('.bf-cart-drawer.is-open')) {
    backdropEl.classList.remove('is-active');
  }
  document.body.classList.remove('bf-menu-is-open');
}

window.addEventListener('DOMContentLoaded', () => {
  $$('[data-menu-open]').forEach(btn => btn.addEventListener('click', openMenu));
  $$('[data-menu-close]').forEach(btn => btn.addEventListener('click', closeMenu));

  // Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      closeCart();
    }
  });

  // Backdrop click
  if (backdropEl) {
    backdropEl.addEventListener('click', () => {
      closeMenu();
      closeCart();
    });
  }
});

/* ================================================================
   6. CART DRAWER (AJAX)
   ================================================================ */

const cartDrawerEl = $('.bf-cart-drawer');
const cartBodyEl   = $('.bf-cart-drawer__body');
const cartCountEls = $$('.bf-cart-count');

function openCart() {
  if (!cartDrawerEl) return;
  cartDrawerEl.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if (backdropEl) backdropEl.classList.add('is-active');
  fetchAndRenderCart();
}

function closeCart() {
  if (!cartDrawerEl) return;
  cartDrawerEl.classList.remove('is-open');
  document.body.style.overflow = '';
  if (backdropEl && !menuEl?.classList.contains('is-open')) {
    backdropEl.classList.remove('is-active');
  }
}

// Fetch cart JSON from Shopify
async function fetchCart() {
  try {
    const res = await fetch('/cart.js');
    if (!res.ok) throw new Error('Cart fetch failed');
    return res.json();
  } catch {
    return null;
  }
}

// Render cart items into drawer
function renderCart(cart) {
  if (!cartBodyEl) return;

  if (!cart || cart.item_count === 0) {
    cartBodyEl.innerHTML = `
      <div class="bf-cart-empty">
        <p class="bf-display bf-display-sm" style="opacity:0.35;text-align:center;padding-top:2rem">
          CART IS EMPTY
        </p>
      </div>`;
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
            ? `<p class="bf-cart-item__variant">${item.variant_title}</p>` : ''}
          <div class="bf-cart-item__row">
            <div class="bf-qty-controls">
              <button class="bf-qty-btn" aria-label="Decrease quantity"
                      data-key="${item.key}" data-action="decrease">−</button>
              <span class="bf-qty-num">${item.quantity}</span>
              <button class="bf-qty-btn" aria-label="Increase quantity"
                      data-key="${item.key}" data-action="increase">+</button>
            </div>
            <span class="bf-cart-item__price">${formatMoney(item.final_price)}</span>
          </div>
        </div>
      </div>
    `).join('');

    // Attach qty button events
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

  // Update total
  const totalEl = $('.bf-cart-total__price');
  if (totalEl && cart) totalEl.textContent = formatMoney(cart.total_price);

  // Update count badge everywhere
  updateCartCountBadge(cart ? cart.item_count : 0);

  // Update drawer item count label
  const drawerCount = $('.bf-cart-drawer__count');
  if (drawerCount && cart) {
    drawerCount.textContent = `${cart.item_count} ITEM${cart.item_count !== 1 ? 'S' : ''}`;
  }
}

function updateCartCountBadge(count) {
  $$('.bf-cart-count').forEach(el => {
    el.textContent = count > 0 ? `(${count})` : '';
  });
}

async function fetchAndRenderCart() {
  const cart = await fetchCart();
  renderCart(cart);
}

// Add to cart
async function cartAdd(variantId, quantity = 1, properties = {}) {
  try {
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: variantId, quantity, properties })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.description || 'Could not add to cart');
    }
    await fetchAndRenderCart();
    openCart();
  } catch (err) {
    console.error('[BLED] Add to cart error:', err.message);
    alert(err.message); // Simple fallback — replace with custom notification if desired
  }
}

// Change cart item quantity (0 = remove)
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
    console.error('[BLED] Cart change error:', err);
  }
}

// Wire up cart triggers & add-to-cart forms
window.addEventListener('DOMContentLoaded', () => {
  $$('[data-cart-open]').forEach(btn => btn.addEventListener('click', openCart));
  $$('[data-cart-close]').forEach(btn => btn.addEventListener('click', closeCart));

  // Add-to-cart form submissions
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.bf-add-cart-form');
    if (!form) return;
    e.preventDefault();

    const idInput = form.querySelector('[name="id"]:checked, [name="id"]');
    if (!idInput) return;

    const btn = form.querySelector('.bf-add-cart-btn');
    if (btn) {
      btn.textContent = 'ADDING...';
      btn.disabled = true;
    }

    await cartAdd(idInput.value, 1);

    if (btn) {
      btn.textContent = 'ADD TO CART';
      btn.disabled = false;
    }
  });

  // Size radio toggle (visual selection)
  document.addEventListener('change', (e) => {
    const radio = e.target;
    if (!radio.matches('[name="id"]')) return;
    const group = radio.closest('.bf-size-selector');
    if (!group) return;
    $$('.bf-size-option', group).forEach(opt => opt.classList.remove('selected'));
    radio.closest('.bf-size-option')?.classList.add('selected');
  });

  // Initial cart count on every page
  fetchCart().then(cart => {
    if (cart) updateCartCountBadge(cart.item_count);
  });
});

/* ================================================================
   7. STORE — PRODUCT NAVIGATION
   ================================================================ */

(function initProductNavigation() {
  const prevBtn       = $('.bf-arrow--prev');
  const nextBtn       = $('.bf-arrow--next');
  const displayEl     = $('.bf-product-display');
  const counterNumEl  = $('.bf-counter__num');
  const counterNameEl = $('.bf-counter__name');

  // Products passed from Liquid via window.bfProducts
  const products = (window.bfProducts || []);
  if (!prevBtn || !nextBtn || !displayEl || products.length === 0) return;

  let currentIndex = parseInt(displayEl.dataset.currentIndex || '0', 10);

  function setProduct(index) {
    const product = products[index];
    if (!product) return;

    const padded = String(index + 1).padStart(3, '0');

    // Animate out
    displayEl.classList.add('is-changing');

    setTimeout(() => {
      // Update counter
      if (counterNumEl)  counterNumEl.textContent  = padded;
      if (counterNameEl) counterNameEl.textContent = product.title;

      // Update image
      const imgEl = displayEl.querySelector('.bf-product-image');
      const phEl  = displayEl.querySelector('.bf-product-image-placeholder');
      if (imgEl) {
        if (product.featured_image) {
          imgEl.src = product.featured_image;
          imgEl.alt = product.title;
          if (phEl) phEl.style.display = 'none';
          imgEl.style.display = 'block';
        } else {
          if (phEl) phEl.style.display = 'flex';
          imgEl.style.display = 'none';
        }
      }

      // Update price
      const priceEl = displayEl.querySelector('.bf-product-price');
      if (priceEl) priceEl.textContent = formatMoney(product.price);

      // Update ATC form variant id
      const variantInput = displayEl.querySelector('[name="id"]');
      if (variantInput && product.variants && product.variants[0]) {
        variantInput.value = product.variants[0].id;
      }

      // Update URL without reload
      if (product.url) {
        history.replaceState(null, '', product.url);
      }

      // Animate in
      displayEl.classList.remove('is-changing');
    }, 230);

    currentIndex = index;
    displayEl.dataset.currentIndex = index;
  }

  prevBtn.addEventListener('click', () => {
    setProduct((currentIndex - 1 + products.length) % products.length);
  });

  nextBtn.addEventListener('click', () => {
    setProduct((currentIndex + 1) % products.length);
  });

  // Keyboard navigation on store page
  if ($('.bf-store')) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  prevBtn.click();
      if (e.key === 'ArrowRight') nextBtn.click();
    });
  }

  // Rail category items — active state
  $$('.bf-rail-item').forEach(item => {
    item.addEventListener('click', (e) => {
      $$('.bf-rail-item').forEach(r => r.classList.remove('is-active'));
      item.classList.add('is-active');
    });
  });
})();

/* ================================================================
   8. LANDING SHAPES — subtle entrance animation
   ================================================================ */

window.addEventListener('DOMContentLoaded', () => {
  if (prefersReducedMotion) return;

  const statement = $('.bf-landing__statement');
  const cta       = $('.bf-landing__cta');
  const mascot    = $('.bf-landing__mascot');

  [statement, cta, mascot].forEach((el, i) => {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = (el === cta ? el.style.transform || '' : '') + ' translateY(12px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
      el.style.opacity    = '1';
      el.style.transform  = '';
    }, 400 + i * 120);
  });
});
