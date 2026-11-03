/* Netguava site behaviour (vanilla JS, no dependencies) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Navigation dropdowns */
  var nav = $('.navigation-header');
  if (nav) {
    $$('a.nav-toggle, li.dropdown > a', nav).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var li = a.parentElement;
        var open = li.classList.toggle('open');
        a.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    document.addEventListener('click', function (e) {
      $$('li.dropdown.open', nav).forEach(function (li) {
        if (!li.contains(e.target)) {
          li.classList.remove('open');
          var a = $('a', li);
          if (a) a.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* Accordions */
  $$('.fl-accordion').forEach(function (acc) {
    var collapse = acc.classList.contains('fl-accordion-collapse');
    function setState(item, open) {
      var btn = $('.fl-accordion-button', item);
      var content = $('.fl-accordion-content', item);
      var icon = $('i.fl-accordion-button-icon', item);
      item.classList.toggle('fl-accordion-item-active', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      content.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (icon && icon.dataset.activeIcon && icon.dataset.labelIcon) {
        icon.className = 'fl-accordion-button-icon ' + (open ? icon.dataset.activeIcon : icon.dataset.labelIcon);
      }
    }
    $$('.fl-accordion-item', acc).forEach(function (item) {
      var btn = $('.fl-accordion-button', item);
      function toggle() {
        var open = !item.classList.contains('fl-accordion-item-active');
        if (open && collapse) {
          $$('.fl-accordion-item-active', acc).forEach(function (o) { setState(o, false); });
        }
        setState(item, open);
      }
      btn.addEventListener('click', toggle);
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  });

  /* Entrance animations */
  var animated = $$('.fl-animation');
  if (animated.length) {
    var reveal = function (el) {
      var delay = parseFloat(el.getAttribute('data-animation-delay') || '0');
      setTimeout(function () { el.classList.add('fl-animated'); }, delay * 1000);
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
        });
      }, { threshold: 0.1 });
      animated.forEach(function (el) { io.observe(el); });
    } else {
      animated.forEach(reveal);
    }
  }

  /* Client logo slideshows */
  $$('.ng-slideshow').forEach(function (show) {
    var imgs = $$('img', show);
    if (imgs.length < 2) return;
    var i = 0;
    setInterval(function () {
      imgs[i].classList.remove('active');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('active');
    }, 3000);
  });

  /* Portfolio filters + detail modals */
  $$('.fl-module-isotope').forEach(function (mod) {
    var filters = $$('.filters li', mod);
    var items = $$('.grid .grid-item', mod);
    filters.forEach(function (f) {
      f.addEventListener('click', function () {
        var sel = f.dataset.filter;
        items.forEach(function (it) {
          it.classList.toggle('is-hidden', sel !== '*' && !it.classList.contains(sel.replace(/^\./, '')));
        });
        filters.forEach(function (o) { o.classList.remove('active'); });
        f.classList.add('active');
      });
    });
    if (filters[0]) filters[0].click();
    items.forEach(function (it) {
      it.addEventListener('click', function () {
        var modal = $('.ngm-p-item', it);
        if (modal && getComputedStyle(modal).display === 'none') {
          modal.style.display = 'block';
          document.documentElement.style.overflowY = 'hidden';
        }
      });
    });
    $$('.ngm-p-close', mod).forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        c.closest('.ngm-p-item').style.display = 'none';
        document.documentElement.style.overflowY = 'auto';
      });
    });
  });

  /* Billing frequency toggle (support plans) */
  $$('.ng-frequency-toggle').forEach(function (t) {
    var tag = t.dataset.tag;
    function update() {
      document.body.classList.toggle(tag + '-r', t.classList.contains('on'));
      document.body.classList.toggle(tag + '-l', !t.classList.contains('on'));
    }
    var first = t.querySelector(':scope > .toggle-button:first-child');
    var last = t.querySelector(':scope > .toggle-button:last-child');
    var ui = t.querySelector(':scope > .toggle-ui');
    if (first) first.addEventListener('click', function () { t.classList.remove('on'); update(); });
    if (last) last.addEventListener('click', function () { t.classList.add('on'); update(); });
    if (ui) ui.addEventListener('click', function () { t.classList.toggle('on'); update(); });
    update();
  });

  /* Plan selection text inside forms */
  $$('.gform_wrapper .radio-plans').forEach(function (el) {
    var text = document.createElement('div');
    text.className = 'plan-text';
    text.innerHTML = '&nbsp;';
    el.appendChild(text);
    el.addEventListener('change', function (e) {
      text.innerHTML = 'Plan Selected: <strong></strong>';
      text.querySelector('strong').textContent = e.target.value;
    });
  });

  /* Support plan lightbox form */
  var plansForm = $('.support-plans-form');
  if (plansForm) {
    var close = function () {
      plansForm.classList.remove('lightbox');
      document.documentElement.style.overflowY = '';
    };
    var closeBtn = $('.form-close', plansForm);
    if (closeBtn) closeBtn.addEventListener('click', close);
    $$('.support-plan-open a.fl-button').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var wrap = a.closest('.support-plan-open');
        plansForm.classList.add('lightbox');
        document.documentElement.style.overflowY = 'hidden';
        ['Essentials', 'Professional', 'Premium'].forEach(function (plan) {
          if (wrap.classList.contains('select-' + plan.toLowerCase())) {
            var r = $("input[value='" + plan + "']", plansForm);
            if (r) r.click();
          }
        });
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* Sticky plan heading (plan comparison page) */
  var fixedHeader = $('.support-plan-heading.fixed-heading');
  if (fixedHeader) {
    var bottom = $('.support-plan-bottom');
    var wrapper = document.createElement('div');
    var spacer = document.createElement('div');
    spacer.className = 'fixed-spacer';
    spacer.style.display = 'none';
    fixedHeader.parentNode.insertBefore(spacer, fixedHeader);
    fixedHeader.parentNode.insertBefore(wrapper, fixedHeader);
    wrapper.appendChild(fixedHeader);
    var top = wrapper.getBoundingClientRect().top + window.scrollY;
    var isFixed = false;
    var atBottom = false;
    var update = function () {
      var should = window.scrollY > top;
      if (should !== isFixed) {
        isFixed = should;
        fixedHeader.classList.toggle('fixed', should);
        spacer.style.display = should ? 'block' : 'none';
      }
    };
    var resize = function () {
      spacer.style.height = fixedHeader.offsetHeight + 'px';
      if (bottom) {
        if (atBottom && window.innerWidth > 991) { wrapper.appendChild(fixedHeader); atBottom = false; }
        else if (!atBottom && window.innerWidth <= 991) { bottom.appendChild(fixedHeader); atBottom = true; }
      }
    };
    window.addEventListener('scroll', update);
    window.addEventListener('resize', function () { update(); resize(); });
    update();
    resize();
  }

  /* Placeholder forms: no endpoint yet, so show a notice instead of submitting */
  $$('form[data-placeholder-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('.form-placeholder-note', form);
      if (note) note.hidden = false;
    });
  });
})();
