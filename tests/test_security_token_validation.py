"""Reject malformed signed session tokens without raising server exceptions."""

import base64
import hashlib
import hmac
import json
import time

import pytest

from backend.security import issue_token, verify_token


SECRET = "isolated-test-secret-with-at-least-32-characters"


def signed_body(body: str) -> str:
    """Construct a correctly MACed token to exercise payload validation."""
    digest = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest()
    signature = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return f"{body}.{signature}"


def signed_json(value: object) -> str:
    raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
    body = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
    return signed_body(body)


@pytest.mark.parametrize("payload", [None, [], ["admin"], "admin", 123, True])
def test_signed_non_object_payloads_are_rejected(payload):
    assert verify_token(signed_json(payload), SECRET) is False


@pytest.mark.parametrize("body", ["a", "____", "eyJzdWIiOiAiYWRtaW4i", "_w"])
def test_signed_malformed_base64_or_json_is_rejected(body):
    assert verify_token(signed_body(body), SECRET) is False


def test_expiry_subject_and_signature_are_validated():
    future = int(time.time()) + 3600
    assert verify_token(signed_json({"sub": "admin", "exp": future}), SECRET)
    assert not verify_token(signed_json({"sub": "other", "exp": future}), SECRET)
    assert not verify_token(signed_json({"sub": "admin", "exp": future - 7200}), SECRET)
    assert not verify_token(signed_json({"sub": "admin", "exp": str(future)}), SECRET)
    assert not verify_token(signed_json({"sub": "admin"}), SECRET)
    assert not verify_token(issue_token(SECRET), SECRET + "-wrong")
