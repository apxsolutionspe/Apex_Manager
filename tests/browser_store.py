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

        # Public quote submission is single-flight and remains retryable after an error.
        # Mock the write endpoint: no customer data reaches the backend.
        quote_page = browser.new_page(viewport={'width': 390, 'height': 844})
        quote_errors = []
        quote_page.on('pageerror', lambda error: quote_errors.append(str(error)))
        quote_writes = {'count': 0}

        def mock_quote(route):
            quote_writes['count'] += 1
            status = 503 if quote_writes['count'] == 1 else 201
            body = ('{"detail":"Fallo sintético de escritura"}' if status == 503 else
                    '{"code":"COT-20261026-ABCDEF","whatsapp_url":null,'
                    '"message":"Solicitud de prueba","state":"registrado"}')
            route.fulfill(status=status, content_type='application/json', body=body)

        quote_page.route('**/api/quotes', mock_quote)
        quote_page.goto(BASE, wait_until='domcontentloaded', timeout=20000)
        expect(quote_page.locator('#catalog-grid .product-card')).to_have_count(8)
        quote_page.locator('[data-add]').first.click()
        quote_page.locator('#open-cart').click()
        quote_page.locator('#customer-name').fill('Cliente QA Sintético')
        quote_page.locator('#customer-phone').fill('987654321')
        quote_page.locator('input[name="consent"]').check()
        submit_public_twice = """() => {
          const form = document.querySelector('#quote-form');
          for (let i = 0; i < 2; i++)
            form.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}));
        }"""
        quote_page.evaluate(submit_public_twice)
        expect(quote_page.locator('#quote-error')).to_contain_text('Fallo sintético')
        expect(quote_page.locator('#send-quote')).to_be_enabled()
        assert quote_writes['count'] == 1, f'Error: {quote_writes["count"]} cotizaciones duplicadas'
        expect(quote_page.locator('#customer-name')).to_have_value('Cliente QA Sintético')
        quote_page.evaluate(submit_public_twice)
        expect(quote_page.locator('#quote-success')).to_be_visible()
        assert quote_writes['count'] == 2, 'El reintento duplicó las escrituras'
        assert quote_errors == [], f'Errores JS en cotización: {quote_errors}'
        quote_page.close()

        # Admin forms must be single-flight: two submit events in one tick
        # produce one write, and a failed write must remain retryable.
        import json
        from urllib.parse import urlsplit

        admin = browser.new_page(viewport={'width': 1280, 'height': 800})
        admin_errors = []
        admin.on('pageerror', lambda error: admin_errors.append(str(error)))
        writes = {'jobs': 0, 'products': 0}

        def mock_admin(route):
            path = urlsplit(route.request.url).path
            method = route.request.method
            if path == '/api/admin/login' and method == 'POST':
                status, payload = 200, {'access_token': 'synthetic-qa-token'}
            elif path == '/api/admin/summary' and method == 'GET':
                status, payload = 200, {'total_quotes': 0, 'pending_quotes': 0,
                                        'active_jobs': 0, 'active_products': 0,
                                        'approved_quotes': 0}
            elif path == '/api/admin/jobs' and method == 'GET':
                status, payload = 200, []
            elif path == '/api/admin/jobs' and method == 'POST':
                writes['jobs'] += 1
                status = 503 if writes['jobs'] == 1 else 201
                payload = {'detail': 'Fallo simulado de escritura'} if status == 503 else {'id': 1}
            elif path == '/api/admin/products' and method == 'GET':
                status, payload = 200, []
            elif path == '/api/admin/products' and method == 'POST':
                writes['products'] += 1
                status, payload = 201, {'id': 1}
            else:
                raise AssertionError(f'Solicitud administrativa inesperada: {method} {path}')
            route.fulfill(status=status, content_type='application/json', body=json.dumps(payload))

        admin.route('**/api/admin/**', mock_admin)
        admin.goto(BASE + '/admin', wait_until='domcontentloaded', timeout=15000)
        admin.locator('#admin-password').fill('SyntheticQAOnly')
        admin.locator('#login-button').click()
        expect(admin.locator('#admin-shell')).to_be_visible()
        admin.locator('[data-tab="servicios"]').click()
        admin.locator('#open-new-job').click()
        admin.locator('#job-form input[name="title"]').fill('Mantenimiento QA')
        admin.locator('#job-form input[name="customer_name"]').fill('Cliente Sintético')
        submit_twice = """selector => {
          const form = document.querySelector(selector);
          for (let i = 0; i < 2; i++)
            form.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}));
        }"""
        admin.evaluate(submit_twice, '#job-form')
        expect(admin.locator('#admin-toast')).to_contain_text('Fallo simulado de escritura')
        expect(admin.locator('#job-form button[type="submit"]')).to_be_enabled()
        assert writes['jobs'] == 1, f'Error: {writes["jobs"]} órdenes duplicadas'
        admin.evaluate(submit_twice, '#job-form')
        expect(admin.locator('#job-form-wrap')).to_be_hidden()
        assert writes['jobs'] == 2, 'El reintento produjo escrituras duplicadas'

        admin.locator('[data-tab="productos"]').click()
        admin.locator('#open-new-product').click()
        admin.locator('#product-form input[name="sku"]').fill('QA-001')
        admin.locator('#product-form input[name="name"]').fill('Producto sintético')
        admin.locator('#product-form input[name="category"]').fill('Pruebas')
        admin.evaluate(submit_twice, '#product-form')
        expect(admin.locator('#product-form-wrap')).to_be_hidden()
        assert writes['products'] == 1, f'Error: {writes["products"]} artículos duplicados'
        assert admin_errors == [], f'Errores de JS en administración: {admin_errors}'
        admin.close()

        print('E2E OK: carrito, cotización y envíos únicos en administración; Chromium')
        browser.close()


if __name__ == '__main__':
    main()
