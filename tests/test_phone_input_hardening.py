"""Regression tests for dialable public quote and tracking phone formats.

Uses synthetic contacts and an isolated SQLite database; no outbound messages.
"""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.database import connect
from backend.main import QuoteIn, QuoteLookupIn, Settings, create_app


INVALID = (
    '987+654321',           # '+' must not appear in the middle
    '++51987654321',       # multiple '+' signs
    '+51\n987654321',     # embedded control characters
    '+51\t987654321',
    '٩٨٧٦٥٤٣٢١',          # Unicode numerals are not ASCII dial strings
    '123456',              # too few digits
    '1234567890123456',    # more than 15 digits
)
VALID = ('987654321', '+51 987 654 321', '(01) 234-5678')


@pytest.mark.parametrize('phone', INVALID)
def test_invalid_phone_is_rejected_for_quote_and_tracking(phone):
    with pytest.raises(ValidationError):
        QuoteIn(customer_name='Cliente Sintetico', phone=phone, consent=True,
                items=[{'product_id': 1, 'quantity': 1}])
    with pytest.raises(ValidationError):
        QuoteLookupIn(code='COT-20261024-ABCDEF', phone=phone)


@pytest.mark.parametrize('phone', VALID)
def test_common_dialable_formats_remain_accepted(phone):
    quote = QuoteIn(customer_name='Cliente Sintetico', phone=phone, consent=True,
                    items=[{'product_id': 1, 'quantity': 1}])
    assert quote.phone == phone
    lookup = QuoteLookupIn(code='COT-20261024-ABCDEF', phone=phone)
    assert lookup.phone == phone


def test_invalid_contacts_never_persist_and_valid_contact_can_track(tmp_path):
    path = str(tmp_path / 'synthetic-phone.sqlite3')
    settings = Settings(db_path=path, demo_mode=True, quote_intake_enabled=True)
    with TestClient(create_app(settings)) as client:
        base = {'customer_name': 'Cliente Sintetico', 'consent': True,
                'items': [{'product_id': 1, 'quantity': 1}]}
        for phone in INVALID:
            assert client.post('/api/quotes', json={**base, 'phone': phone}).status_code == 422
            assert client.post('/api/quote-status', json={
                'code': 'COT-20261024-ABCDEF', 'phone': phone,
            }).status_code == 422
        with connect(path) as db:
            assert db.execute('SELECT count(*) FROM quotes').fetchone()[0] == 0

        created = client.post('/api/quotes', json={
            **base, 'phone': '+51 987 654 321',
        })
        assert created.status_code == 201
        code = created.json()['code']
        tracked = client.post('/api/quote-status', json={
            'code': code, 'phone': '+51 987 654 321',
        })
        assert tracked.status_code == 200
        assert tracked.json()['code'] == code
