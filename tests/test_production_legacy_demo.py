"""Production must not publish DEMO records left in a migrated database.

The test models a realistic deployment: a database first used in demo mode
is later reused in production after a real product is created. All customer
identities and product details are synthetic; no external calls are made.
"""

from fastapi.testclient import TestClient

from backend.database import connect
from backend.main import Settings, create_app
from backend.security import hash_password


def test_production_hides_legacy_demo_products_and_rejects_demo_quotes(tmp_path):
    db_path = str(tmp_path / "legacy-catalog.sqlite3")
    with TestClient(create_app(Settings(db_path=db_path, demo_mode=True))) as demo:
        seeded = demo.get("/api/products")
        assert seeded.status_code == 200
        assert len(seeded.json()) == 8
        demo_id = seeded.json()[0]["id"]

    settings = Settings(
        db_path=db_path,
        admin_hash=hash_password("SyntheticTestPassword2026!", salt=b"0123456789abcdef"),
        session_secret="synthetic-production-test-secret-long-enough-2026",
        whatsapp_number="51987654321",
        demo_mode=False,
        environment="production",
        privacy_approved=True,
        privacy_policy_url="https://privacy.apex.pe/approved-test-privacy",
        privacy_notice_version="2026-10-approved-test",
        quote_intake_enabled=True,
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/ready").status_code == 503
        login = client.post("/api/admin/login", json={"password": "SyntheticTestPassword2026!"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        # Existing DEMO records must not inflate the production dashboard.
        assert client.get("/api/admin/summary", headers=headers).json()["active_products"] == 0
        assert len(client.get("/api/admin/products", headers=headers).json()) == 8
        real = client.post(
            "/api/admin/products",
            headers=headers,
            json={
                "sku": "LIVE-001",
                "name": "Synthetic real service",
                "category": "Test services",
                "kind": "servicio",
                "price_cents": 1000,
                "active": True,
            },
        )
        assert real.status_code == 201
        assert client.get("/api/admin/summary", headers=headers).json()["active_products"] == 1
        assert len(client.get("/api/admin/products", headers=headers).json()) == 9
        assert client.get("/api/ready").status_code == 200

        catalog = client.get("/api/products")
        assert catalog.status_code == 200
        assert [row["sku"] for row in catalog.json()] == ["LIVE-001"]
        assert [row["sku"] for row in client.get("/api/products?kind=servicio").json()] == ["LIVE-001"]

        def quote(product_id):
            return client.post(
                "/api/quotes",
                json={
                    "customer_name": "Synthetic Customer",
                    "phone": "987654321",
                    "consent": True,
                    "items": [{"product_id": product_id, "quantity": 1}],
                },
            )

        assert quote(demo_id).status_code == 422
        with connect(db_path) as db:
            assert db.execute("SELECT COUNT(*) FROM quotes").fetchone()[0] == 0

        accepted = quote(real.json()["id"])
        assert accepted.status_code == 201
        assert accepted.json()["total_cents"] == 1000
        with connect(db_path) as db:
            assert db.execute("SELECT COUNT(*) FROM quotes").fetchone()[0] == 1
            assert db.execute("SELECT COUNT(*) FROM products WHERE sku LIKE 'DEMO-%'").fetchone()[0] == 8
