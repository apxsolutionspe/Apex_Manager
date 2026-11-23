"""Arranque local portable: no ejecutar contenido del .env ni habilitar producción por error."""
from pathlib import Path

import pytest

from scripts import start_local


GOOD_CONFIG = {
    'APP_ENV': 'development',
    'DEMO_MODE': 'true',
    'QUOTE_INTAKE_ENABLED': 'false',
    'ADMIN_PASSWORD_HASH': 'pbkdf2_sha256$500000$abc$def',
    'SESSION_SECRET': '12345678901234567890123456789012',
}


def test_parsing_quotes_preserves_literal_dollars_and_comments(tmp_path):
    path = tmp_path / '.env'
    path.write_text("# comentario\nexport APP_ENV=development\n"
                    "ADMIN_PASSWORD_HASH='pbkdf2_sha256$500000$abc$def'\n"
                    'SESSION_SECRET="12345678901234567890123456789012"\n'
                    'PORT=8123\n', encoding='utf-8')
    values = start_local.parse_env_file(path)
    assert values['ADMIN_PASSWORD_HASH'] == GOOD_CONFIG['ADMIN_PASSWORD_HASH']
    assert start_local.validate_local_settings(values) == 8123


@pytest.mark.parametrize('line', [
    'NOT_ALLOWED=hello',
    'PATH=/tmp/other',
    'APP_ENV=development\nAPP_ENV=production',
    'SESSION_SECRET="unclosed',
    'bad line',
])
def test_parser_rejects_invalid_or_duplicate_entries(tmp_path, line):
    path = tmp_path / '.env'
    path.write_text(line, encoding='utf-8')
    with pytest.raises(ValueError):
        start_local.parse_env_file(path)


@pytest.mark.parametrize('patch', [
    {'APP_ENV': 'production'},
    {'APP_ENV': 'staging'},
    {'ADMIN_PASSWORD_HASH': ''},
    {'SESSION_SECRET': 'short'},
    {'QUOTE_INTAKE_ENABLED': 'yes'},
    {'PORT': '0'},
    {'PORT': '65536'},
    {'PORT': 'not-a-port'},
])
def test_startup_blocks_invalid_local_configuration(patch):
    with pytest.raises(ValueError):
        start_local.validate_local_settings({**GOOD_CONFIG, **patch})


def test_check_mode_is_read_only_and_does_not_print_secrets(tmp_path, monkeypatch, capsys):
    (tmp_path / '.env').write_text('\n'.join(f'{key}={value}' for key, value in GOOD_CONFIG.items()))
    monkeypatch.setattr(start_local, 'ROOT', tmp_path)
    monkeypatch.setattr(start_local.subprocess, 'call', lambda *args, **kwargs: pytest.fail('No debe iniciar el servidor'))
    assert start_local.main(['--check']) == 0
    assert not (tmp_path / 'data').exists()
    output = capsys.readouterr().out
    assert 'Configuración local' in output
    assert GOOD_CONFIG['SESSION_SECRET'] not in output


def test_main_requires_env_without_creating_files(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(start_local, 'ROOT', tmp_path)
    assert start_local.main([]) == 2
    assert not (tmp_path / '.env').exists()
    assert 'Falta .env' in capsys.readouterr().err


def test_launch_binds_loopback_and_passes_literal_env(tmp_path, monkeypatch):
    values = {**GOOD_CONFIG, 'PORT': '8124'}
    (tmp_path / '.env').write_text('\n'.join(f"{key}='{value}'" for key, value in values.items()))
    monkeypatch.setattr(start_local, 'ROOT', tmp_path)
    monkeypatch.setattr(start_local.importlib.util, 'find_spec', lambda name: object())
    observed = {}

    def fake_call(args, *, cwd, env):
        observed.update(args=args, cwd=cwd, env=env)
        return 0

    monkeypatch.setattr(start_local.subprocess, 'call', fake_call)
    monkeypatch.setenv('APP_ENV', 'production')  # No heredar settings peligrosos
    monkeypatch.setenv('PRIVACY_NOTICE_APPROVED', 'true')
    assert start_local.main([]) == 0
    assert observed['cwd'] == tmp_path
    assert observed['args'][-4:] == ['--host', '127.0.0.1', '--port', '8124']
    assert observed['env']['ADMIN_PASSWORD_HASH'] == GOOD_CONFIG['ADMIN_PASSWORD_HASH']
    assert observed['env']['APP_ENV'] == 'development'
    assert observed['env']['PRIVACY_NOTICE_APPROVED'] == 'false'
    assert 'PORT' not in observed['env'] or observed['env']['PORT'] != '8124'
