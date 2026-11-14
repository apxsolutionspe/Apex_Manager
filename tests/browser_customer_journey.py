"""E2E sintético y reproducible: cliente móvil -> cotización -> seguimiento -> panel.

Nunca prueba cobros ni usa datos personales reales. Solo se ejecuta sobre localhost.
QA_BROWSER=chromium|firefox|webkit python tests/browser_customer_journey.py
"""
from __future__ import annotations

import json
import os
import re
import statistics
import time
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE_URL = os.environ.get("QA_BASE_URL", "http://127.0.0.1:8765").rstrip("/")
BROWSER_NAME = os.environ.get("QA_BROWSER", "chromium").lower()
QA_PASSWORD = os.environ.get("QA_ADMIN_PASSWORD", "QA-only-not-a-real-secret-2026")
VIEWPORTS = [
    ("small", 320, 640),
    ("mobile", 390, 844),
    ("tablet", 768, 1024),
    ("desktop", 1440, 900),
]


def main():
    parts = urlsplit(BASE_URL)
    if parts.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise SystemExit("Este E2E utiliza datos sintéticos y solo puede ejecutarse en localhost")
    if BROWSER_NAME not in ("chromium", "firefox", "webkit"):
        raise SystemExit("QA_BROWSER debe ser chromium, firefox o webkit")
    output = ROOT / "qa-artifacts"
    output.mkdir(exist_ok=True)
    report = {"browser": BROWSER_NAME, "base": BASE_URL,
              "viewports": [], "customer_flow": {}, "requests": {}}

    with sync_playwright() as playwright:
        browser_type = getattr(playwright, BROWSER_NAME)
        browser = browser_type.launch(headless=True)
        try:
            for label, width, height in VIEWPORTS:
                context = browser.new_context(viewport={"width": width, "height": height},
                                              device_scale_factor=1)
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                response = page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                assert response and response.status == 200
                expect(page.locator("#catalog-grid .product-card")).to_have_count(8, timeout=20000)
                assert page.locator("html").get_attribute("lang") == "es"
                assert page.locator("h1").count() == 1
                document_width = page.evaluate("document.documentElement.scrollWidth")
                viewport_width = page.evaluate("window.innerWidth")
                if document_width > viewport_width + 2:
                    offenders = page.evaluate("""() => Array.from(document.querySelectorAll('body *')).map(el => {
                      const r = el.getBoundingClientRect();
                      return {tag: el.tagName, cls: String(el.className).slice(0,70),
                              id: el.id, left: Math.round(r.left), right: Math.round(r.right),
                              scrollWidth: el.scrollWidth, clientWidth: el.clientWidth};
                    }).filter(x => x.right > innerWidth + 2 && x.left >= 0).slice(0, 20)""")
                    print("OVERFLOW", BROWSER_NAME, label, json.dumps(offenders), flush=True)
                assert document_width <= viewport_width + 2, (
                    f"{BROWSER_NAME}/{label}: desborde horizontal {document_width} > {viewport_width}")
                navigation_ms = page.evaluate(
                    "() => Math.round(performance.getEntriesByType('navigation')[0]?.duration || 0)")
                page.screenshot(path=str(output / f"customer-{BROWSER_NAME}-{label}.png"),
                                full_page=True)
                assert not errors, f"Errores JS en {BROWSER_NAME}/{label}: {errors}"
                report["viewports"].append(
                    {"name": label, "width": width, "height": height,
                     "scroll_width": document_width, "navigation_ms": navigation_ms,
                     "js_errors": 0})
                page.close()
                context.close()

            context = browser.new_context(viewport={"width": 390, "height": 844})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            assert response and response.headers.get("x-frame-options") == "DENY"
            assert "content-security-policy" in response.headers
            expect(page.locator("#catalog-grid .product-card")).to_have_count(8, timeout=20000)
            expect(page.locator("#intake-banner")).to_be_hidden()
            page.locator("[data-add]").first.click()
            page.locator("#open-cart").click()
            expect(page.locator("#quote-form")).to_be_visible()
            page.locator("#customer-name").fill("Cliente QA Sintético")
            page.locator("#customer-phone").fill("987654321")
            page.locator('input[name="consent"]').check()
            page.locator("#send-quote").click()
            expect(page.locator("#quote-success")).to_be_visible(timeout=20000)
            code_text = page.locator("#quote-code").inner_text()
            match = re.search(r"COT-\d{8}-[A-F0-9]{6}", code_text)
            assert match, f"Falta código de seguimiento: {code_text}"
            code = match.group(0)
            page.locator("#close-cart").click()
            page.locator("#track-code").fill(code)
            page.locator("#track-phone").fill("987654321")
            page.locator('#track-form button[type="submit"]').click()
            expect(page.locator("#track-result")).to_contain_text("Recibida", timeout=15000)

            # API admin real de la instancia efímera. Contraseña sintética de CI.
            unauth = page.request.get(BASE_URL + "/api/admin/quotes")
            assert unauth.status == 401, "El panel permite acceso sin credenciales"
            login = page.request.post(BASE_URL + "/api/admin/login",
                                      data={"password": QA_PASSWORD})
            assert login.status == 200, f"Login admin QA falló: {login.status}"
            token = login.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            quotes_response = page.request.get(BASE_URL + "/api/admin/quotes", headers=headers)
            assert quotes_response.status == 200
            matches = [q for q in quotes_response.json() if q["code"] == code]
            assert len(matches) == 1, "Cotización duplicada o no persistida"
            quote_id = matches[0]["id"]
            changed = page.request.patch(
                BASE_URL + f"/api/admin/quotes/{quote_id}/status",
                headers=headers, data={"status": "aprobado"})
            assert changed.status == 200, "No se puede actualizar estado desde admin"
            page.locator('#track-form button[type="submit"]').click()
            expect(page.locator("#track-result")).to_contain_text("Aprobada", timeout=15000)
            assert not errors, f"Error JS durante el flujo de cliente: {errors}"
            report["customer_flow"] = {
                "catalog": "ok", "cart": "ok", "quote_created": "ok",
                "public_tracking": "ok", "admin_auth": "ok",
                "admin_status_update": "ok", "tracking_after_update": "ok",
                "payment": "NO PROBADO: no existe pasarela habilitada",
                "registration": "NO IMPLEMENTADO: requiere diseño y privacidad",
                "promotions": "NO IMPLEMENTADO: reglas comerciales pendientes",
            }
            page.screenshot(path=str(output / f"customer-{BROWSER_NAME}-tracking.png"),
                            full_page=True)

            # Latencias secuenciales en backend local: no equivalen a prueba de carga pública.
            for endpoint in ("/api/health", "/api/products", "/api/config"):
                measurements = []
                for _ in range(35):
                    started = time.perf_counter()
                    r = page.request.get(BASE_URL + endpoint, timeout=15000)
                    measurements.append(round((time.perf_counter() - started) * 1000, 2))
                    assert r.status == 200, f"{endpoint}: HTTP {r.status}"
                sorted_ms = sorted(measurements)
                p95 = sorted_ms[max(0, (95 * len(sorted_ms) + 99) // 100 - 1)]
                report["requests"][endpoint] = {
                    "count": len(measurements),
                    "median_ms": round(statistics.median(measurements), 2),
                    "p95_ms": p95, "max_ms": max(measurements), "errors": 0,
                }
            context.close()
        finally:
            browser.close()
    path = output / f"customer-qa-{BROWSER_NAME}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("E2E COMPLETADO (datos sintéticos; SIN pagos):", path)
    print(json.dumps(report["requests"], ensure_ascii=False))


if __name__ == "__main__":
    main()
