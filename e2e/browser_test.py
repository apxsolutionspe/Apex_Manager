"""Pruebas smoke de navegador real. Solo datos sintéticos en servidor loopback."""
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import pytest
from playwright.sync_api import sync_playwright

from backend.security import hash_password

ROOT=Path(__file__).resolve().parent.parent
PASSWORD='APEX-TEST-PASSWORD-ONLY-2026'


@pytest.fixture(scope='module')
def server(tmp_path_factory):
    base=tmp_path_factory.mktemp('browser')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        port=sock.getsockname()[1]
    environ=os.environ.copy()
    environ.update(DB_PATH=str(base/'web.db'),DEMO_MODE='true',WHATSAPP_NUMBER='',
                   ADMIN_PASSWORD_HASH=hash_password(PASSWORD),
                   SESSION_SECRET='e2e-temporary-not-for-production-secret-2026')
    process=subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app',
                              '--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=environ,
                             stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
    base_url=f'http://127.0.0.1:{port}'
    try:
        for _ in range(100):
            if process.poll() is not None:
                pytest.fail('El servidor de prueba terminó antes de estar disponible')
            try:
                with urlopen(base_url+'/api/health',timeout=.5) as response:
                    if response.status==200:break
            except (URLError,TimeoutError):
                time.sleep(.2)
        else:pytest.fail('El servidor de prueba no respondió')
        yield base_url
    finally:
        process.terminate()
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill()


@pytest.fixture
def browser():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        try:yield browser
        finally:browser.close()


def test_mobile_buyer_catalog_cart_quote_tracking(server,browser):
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    page.goto(server)
    page.locator('#catalog-grid .product-card').first.wait_for()
    assert page.locator('#demo-banner').is_visible()
    page.locator('[data-add]').first.click()
    page.locator('#open-cart').click()
    page.locator('#customer-name').fill('Cliente de prueba')
    page.locator('#customer-phone').fill('987654321')
    responses=[]
    page.on('response',lambda r: responses.append((r.status,r.url)) if '/api/quotes' in r.url else None)
    page.locator('#send-quote').click()
    page.wait_for_timeout(800)
    error=page.locator('#quote-error').inner_text() if page.locator('#quote-error').is_visible() else ''
    assert not error, f'Error al cotizar: {error}; HTTP: {responses}'
    assert page.locator('#quote-form').evaluate('(form)=>form.checkValidity()'), 'Formulario HTML inválido'
    page.locator('#quote-success').wait_for(state='visible',timeout=10000)
    code=page.locator('#quote-code').inner_text().split(': ',1)[1]
    assert code.startswith('COT-')
    page.locator('#close-cart').click()
    page.locator('#track-code').fill(code)
    page.locator('#track-phone').fill('987654321')
    page.locator('#track-form button[type=submit]').click()
    page.locator('#track-result').wait_for(state='visible')
    assert 'Recibida' in page.locator('#track-result').inner_text()
    page.close()


def test_admin_and_team_ui_login(server,browser):
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.goto(server+'/admin')
    page.locator('#admin-password').fill(PASSWORD)
    page.locator('#login-button').click()
    page.locator('#admin-shell').wait_for(state='visible')
    page.locator('button[data-tab="equipo"]').click()
    page.locator('#team-form [name=name]').fill('Tecnico Demo')
    page.locator('#team-form [name=username]').fill('tecnico.demo')
    page.locator('#team-form [name=role]').select_option('tecnico')
    page.locator('#team-form [name=password]').fill('Equipo-demo-password-2026')
    page.locator('#team-form button[type=submit]').click()
    page.get_by_text('@tecnico.demo').wait_for()
    team=browser.new_page()
    team.goto(server+'/equipo')
    team.locator('#team-login-form [name=username]').fill('tecnico.demo')
    team.locator('#team-login-form [name=password]').fill('Equipo-demo-password-2026')
    team.locator('#team-login-form button').click()
    team.locator('#team-workspace').wait_for(state='visible')
    assert 'Tecnico Demo' in team.locator('#team-welcome').inner_text()
    team.close();page.close()
