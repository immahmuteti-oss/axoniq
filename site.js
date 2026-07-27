/* ============================================================
   AXONIQ CYBER — shared behaviour
   Rule for this file: a site that sells lead capture is not
   allowed to lose a lead. Every capture path degrades into
   another one rather than failing.
   ============================================================ */
(function () {
  "use strict";

  var WA = "254740562812";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. reveal on scroll ---------- */
  var rv = document.querySelectorAll(".rv");
  if (!("IntersectionObserver" in window) || reduce) {
    Array.prototype.forEach.call(rv, function (el) { el.classList.add("in"); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(rv, function (el) { ro.observe(el); });
  }

  /* ---------- 2. event tracking -------------------------------
     Works with GA4 when a measurement ID is configured, and keeps
     a local record either way so the funnel is never invisible.
     ------------------------------------------------------------ */
  function track(name, params) {
    params = params || {};
    params.page = document.title;
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params);
      var log = JSON.parse(localStorage.getItem("axq_events") || "[]");
      log.push({ t: new Date().toISOString(), e: name, p: params });
      localStorage.setItem("axq_events", JSON.stringify(log.slice(-80)));
    } catch (err) { /* private mode — tracking is never allowed to break a CTA */ }
  }
  window.axqTrack = track;

  /* ---------- 3. WhatsApp links: prefill + attribute -----------
     A bare wa.me link opens an empty thread and the visitor has to
     compose. Prefilling both raises reply rate and tells us which
     page and section produced the message.
     ------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll("a[data-wa]"), function (a) {
    var msg = a.getAttribute("data-wa");
    if (!a.getAttribute("href") || a.getAttribute("href") === "#") {
      a.setAttribute("href", "https://wa.me/" + WA + "?text=" + encodeURIComponent(msg));
    }
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
    a.addEventListener("click", function () {
      track("whatsapp_click", { label: a.getAttribute("data-wa-label") || "unlabelled" });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('a[href^="tel:"]'), function (a) {
    a.addEventListener("click", function () { track("phone_click", {}); });
  });

  /* ---------- 4. the enquiry form -----------------------------
     Posts to the host's form handler. If that fails for ANY
     reason, the submission is handed to WhatsApp with the message
     already written, then mailto. The visitor never hits a dead end.
     ------------------------------------------------------------ */
  var form = document.querySelector("form[data-enquiry]");
  if (form) {
    var statusEl = form.querySelector(".form-status");

    function say(text, ok) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.add("show");
      statusEl.classList.toggle("ok", !!ok);
    }

    function compose(data) {
      return (
        "Hi Emmanuel — enquiry from your site.\n\n" +
        "Name: " + (data.name || "-") + "\n" +
        "Business: " + (data.business || "-") + "\n" +
        "Website: " + (data.website || "-") + "\n" +
        "What I need: " + (data.need || "-") + "\n\n" +
        (data.message || "")
      );
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();

      if (form.querySelector('input[name="_hp"]') &&
          form.querySelector('input[name="_hp"]').value) return;   // bot

      var fd = new FormData(form);
      var data = {};
      fd.forEach(function (v, k) { if (k.charAt(0) !== "_") data[k] = v; });

      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      say("Sending…");
      track("form_submit", { need: data.need || "unspecified" });

      var body = new URLSearchParams();
      fd.forEach(function (v, k) { body.append(k, v); });

      var timeout = new Promise(function (_, rej) { setTimeout(rej, 8000); });

      Promise.race([
        fetch(form.getAttribute("action") || window.location.pathname, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString()
        }),
        timeout
      ])
        .then(function (res) {
          if (!res || !res.ok) throw new Error("bad response");
          form.reset();
          say("Got it. I reply to everything within a few hours — usually much sooner. " +
              "If it's urgent, WhatsApp is faster.", true);
          track("form_success", {});
          if (btn) { btn.disabled = false; btn.textContent = "Send it"; }
        })
        .catch(function () {
          /* The whole point of the business: capture must not fail. */
          track("form_fallback_whatsapp", {});
          say("The form couldn't send from here, so I've opened WhatsApp with your message " +
              "already written — just press send. Or email sirfrancisrealty@gmail.com.");
          if (btn) { btn.disabled = false; btn.textContent = "Send it"; }
          window.open(
            "https://wa.me/" + WA + "?text=" + encodeURIComponent(compose(data)),
            "_blank", "noopener"
          );
        });
    });
  }

  /* ---------- 5. the conversion-gap bars ----------------------
     Not decoration: these are the numbers the pitch is built on.
     ------------------------------------------------------------ */
  var fig = document.querySelector(".gap-figure");
  if (fig) {
    var fill = function () {
      Array.prototype.forEach.call(fig.querySelectorAll(".gap-row"), function (row, i) {
        var pct = parseFloat(row.getAttribute("data-pct")) || 0;
        var bar = row.querySelector(".gap-fill");
        setTimeout(function () { bar.style.width = Math.min(pct * 10, 100) + "%"; },
                   reduce ? 0 : 180 * i);
      });
    };
    if ("IntersectionObserver" in window && !reduce) {
      var fo = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) { fill(); fo.disconnect(); } });
      }, { threshold: 0.35 });
      fo.observe(fig);
    } else { fill(); }
  }

  /* ---------- 6. the signature: leak / capture flow -----------
     Signals arrive from the left. Some are intercepted by the
     capture line and routed; the rest fall away. It is a diagram
     of the offer, running live.
     ------------------------------------------------------------ */
  var cv = document.getElementById("flow");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, dpr = 1, parts = [], captureX = 0, running = true, raf = null;
  var captured = 0, leaked = 0;
  var nCap = document.getElementById("n-cap"),
      nLeak = document.getElementById("n-leak"),
      nRate = document.getElementById("n-rate");

  var CAPTURE_RATE = parseFloat(cv.getAttribute("data-capture") || "0.68");
  var COL_SIGNAL = "232,163,61", COL_LEAK = "66,86,110";

  function size() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    captureX = W * 0.60;
  }

  function spawn() {
    var band = H * 0.52, top = H * 0.24;
    return {
      x: -20 - Math.random() * 140,
      y: top + Math.random() * band,
      vx: 0.42 + Math.random() * 0.62,
      vy: (Math.random() - 0.5) * 0.12,
      r: 1.1 + Math.random() * 1.7,
      a: 0.18 + Math.random() * 0.42,
      caught: Math.random() < CAPTURE_RATE,
      state: 0, counted: false, seed: Math.random() * 6.28
    };
  }

  function init() {
    var n = W < 700 ? 40 : (W < 1200 ? 74 : 100);
    parts = [];
    for (var i = 0; i < n; i++) { var p = spawn(); p.x = Math.random() * W; parts.push(p); }
  }

  function channelY() { return H * 0.505; }

  function step(t) {
    ctx.clearRect(0, 0, W, H);
    var cy = channelY();

    var g = ctx.createLinearGradient(captureX, 0, captureX, H);
    g.addColorStop(0, "rgba(232,163,61,0)");
    g.addColorStop(0.5, "rgba(232,163,61,.42)");
    g.addColorStop(1, "rgba(232,163,61,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(captureX, H * 0.16); ctx.lineTo(captureX, H * 0.86); ctx.stroke();

    ctx.strokeStyle = "rgba(232,163,61,.16)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(captureX, cy); ctx.lineTo(W, cy); ctx.stroke();

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.state === 0) {
        p.x += p.vx; p.y += p.vy + Math.sin(t / 1400 + p.seed) * 0.09;
        if (p.x >= captureX) {
          p.state = p.caught ? 1 : 2;
          if (!p.counted) { p.counted = true; if (p.caught) captured++; else leaked++; }
        }
      } else if (p.state === 1) {
        p.x += p.vx * 1.9; p.y += (cy - p.y) * 0.10; p.a += (0.85 - p.a) * 0.05;
      } else {
        p.x += p.vx * 0.42; p.y += 0.72; p.a *= 0.977;
      }

      var col = p.state === 1 ? COL_SIGNAL : (p.state === 2 ? COL_LEAK : "133,147,166");
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fillStyle = "rgba(" + col + "," + p.a.toFixed(3) + ")"; ctx.fill();

      if (p.state === 1) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 16, p.y);
        ctx.strokeStyle = "rgba(" + COL_SIGNAL + "," + (p.a * 0.28).toFixed(3) + ")";
        ctx.lineWidth = 1; ctx.stroke();
      }
      if (p.x > W + 40 || p.y > H + 40 || p.a < 0.02) parts[i] = spawn();
    }

    if (nCap) {
      nCap.textContent = captured;
      nLeak.textContent = leaked;
      var tot = captured + leaked;
      nRate.textContent = tot > 8 ? Math.round(captured / tot * 100) + "%" : "—";
    }
    raf = requestAnimationFrame(step);
  }

  function start() { if (!running) { running = true; raf = requestAnimationFrame(step); } }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  size(); init();

  if (reduce) {
    for (var k = 0; k < parts.length; k++) {
      var q = parts[k];
      if (q.x > captureX) { q.state = q.caught ? 1 : 2; if (q.state === 1) q.y = channelY(); }
    }
    step(0); stop();
  } else {
    raf = requestAnimationFrame(step);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0 }).observe(cv);
    }
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { size(); init(); if (reduce) step(0); }, 160);
  });
})();
