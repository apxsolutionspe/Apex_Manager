"""Prueba E2E real sobre servidor local efímero, con usuarios y datos ficticios.

Requiere: pip install playwright && python -m playwright install chromium.
No utiliza credenciales ni teléfonos comerciales reales.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('QA_BASE_URL', 'http://127.0.0.1:8765')
ROOT = Path(__file__).resolve().parent.parent


def main():
    output = ROOT / 'qa-artifacts'
    output.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=os.getenv('QA_CHROMIUM_PATH') or None)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until='domcontentloaded', timeout=20000)
        expect(page.locator('#catalog-grid .product-card')).to_have_count(8, timeout=15000)
        expect(page.locator('#intake-banner')).to_be_hidden()
        page.locator('[data-add]').first.click()
        page.locator('#open-cart').click()
        expect(page.locator('#quote-form')).to_be_visible()
        page.locator('#customer-name').fill('Cliente QA Sintético')
        page.locator('#customer-phone').fill('987654321')
        page.locator('input[name="consent"]').check()
        page.locator('#send-quote').click()
        expect(page.locator('#quote-success')).to_be_visible(timeout=12000)
        code = page.locator('#quote-code').inner_text()
        assert 'COT-' in code
        page.locator('#close-cart').click()
        page.screenshot(path=str(output/'store-mobile-390.png'), full_page=True)
        desktop = browser.new_page(viewport={'width': 1440, 'height': 900})
        desktop.goto(BASE+'/admin', wait_until='domcontentloaded', timeout=15000)
        expect(desktop.locator('#login-screen')).to_be_visible()
        desktop.screenshot(path=str(output/'admin-login-desktop.png'), full_page=True)
        assert errors == [], f'Errores de JS: {errors}'

        # A browser may deny Web Storage (privacy policy or sandbox).
        # The catalog and cart must remain functional in-memory.
        blocked = browser.new_context(viewport={'width': 390, 'height': 844})
        blocked.add_init_script("""Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() { throw new DOMException('Storage blocked', 'SecurityError'); }
        });""")
        blocked_page = blocked.new_page()
        blocked_errors = []
        blocked_page.on('pageerror', lambda error: blocked_errors.append(str(error)))
        blocked_page.goto(BASE, wait_until='domcontentloaded', timeout=20000)
        expect(blocked_page.locator('#catalog-grid .product-card')).to_have_count(8, timeout=15000)
        blocked_page.locator('[data-add]').first.click()
        blocked_page.locator('#open-cart').click()
        expect(blocked_page.locator('#cart-items .cart-item')).to_have_count(1)
        assert blocked_errors == [], f'Errores con almacenamiento bloqueado: {blocked_errors}'
        blocked.close()

        print('E2E OK: cotización y carrito (incluido almacenamiento bloqueado); navegador Chromium')
        browser.close()


if __name__ == '__main__':
    main()
