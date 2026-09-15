"""The card-payment verification logic must never trust a provider's status
string alone — it has to independently confirm the merchant reference,
amount, and currency all match our own transaction record before crediting
an invoice. These tests mock the Pesapal client (no real credentials
needed) and drive the exact security decision the router makes."""

from unittest.mock import patch

from app.core.crypto import encrypt_secret
from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.fees import FeeInvoice
from app.models.payment_config import SchoolPaymentConfig
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _setup_invoice_with_card(db_session, school):
    school_class = SchoolClass(school_id=school.id, name="Form 1A")
    db_session.add(school_class)
    db_session.flush()

    guardian = User(
        school_id=school.id, email="parent@test-academy.test", full_name="Test Parent",
        hashed_password=hash_password("TestPass123!"), role=UserRole.PARENT,
    )
    db_session.add(guardian)
    db_session.flush()

    student = Student(
        school_id=school.id, class_id=school_class.id, admission_number="TA-1",
        first_name="Test", last_name="Student", guardian_user_id=guardian.id,
    )
    db_session.add(student)
    db_session.flush()

    invoice = FeeInvoice(school_id=school.id, student_id=student.id, term="Term 1 2026", amount_due=10000, amount_paid=0)
    db_session.add(invoice)

    config = SchoolPaymentConfig(
        school_id=school.id,
        pesapal_consumer_key="test_key",
        pesapal_consumer_secret_encrypted=encrypt_secret("test_secret"),
        pesapal_ipn_id="test-ipn",
    )
    db_session.add(config)
    db_session.commit()

    return {"guardian": guardian, "student": student, "invoice": invoice}


def _login_parent(client, guardian):
    response = client.post("/auth/login", data={"username": guardian.email, "password": "TestPass123!"})
    return auth_headers(response.json()["access_token"])


def _initiate(client, headers, student_id, invoice_id):
    with patch(
        "app.routers.portal.submit_order",
        return_value={"order_tracking_id": "OT-TEST-1", "redirect_url": "https://pesapal.example/checkout"},
    ):
        response = client.post(f"/portal/students/{student_id}/fees/{invoice_id}/pay/card", headers=headers, json={})
    assert response.status_code == 201, response.text
    body = response.json()["transaction"]
    return body["id"], body["merchant_reference"]


def test_mismatched_merchant_reference_is_rejected(client, db_session, school):
    ctx = _setup_invoice_with_card(db_session, school)
    headers = _login_parent(client, ctx["guardian"])
    student_id, invoice_id = ctx["student"].id, ctx["invoice"].id

    tx_id, _ = _initiate(client, headers, student_id, invoice_id)
    with patch(
        "app.routers.portal.get_transaction_status",
        return_value={"payment_status_description": "Completed", "merchant_reference": "WRONG", "amount": 10000, "currency": "KES"},
    ):
        response = client.get(f"/portal/students/{student_id}/fees/{invoice_id}/pay/card/{tx_id}/status", headers=headers)

    assert response.json()["status"] == "failed"
    db_session.refresh(ctx["invoice"])
    assert float(ctx["invoice"].amount_paid) == 0


def test_underpaid_amount_is_rejected(client, db_session, school):
    ctx = _setup_invoice_with_card(db_session, school)
    headers = _login_parent(client, ctx["guardian"])
    student_id, invoice_id = ctx["student"].id, ctx["invoice"].id

    tx_id, ref = _initiate(client, headers, student_id, invoice_id)
    with patch(
        "app.routers.portal.get_transaction_status",
        return_value={"payment_status_description": "Completed", "merchant_reference": ref, "amount": 1, "currency": "KES"},
    ):
        response = client.get(f"/portal/students/{student_id}/fees/{invoice_id}/pay/card/{tx_id}/status", headers=headers)

    assert response.json()["status"] == "failed"
    db_session.refresh(ctx["invoice"])
    assert float(ctx["invoice"].amount_paid) == 0


def test_still_pending_does_not_credit_or_fail(client, db_session, school):
    ctx = _setup_invoice_with_card(db_session, school)
    headers = _login_parent(client, ctx["guardian"])
    student_id, invoice_id = ctx["student"].id, ctx["invoice"].id

    tx_id, ref = _initiate(client, headers, student_id, invoice_id)
    with patch(
        "app.routers.portal.get_transaction_status",
        return_value={"payment_status_description": "Pending", "merchant_reference": ref, "amount": 10000, "currency": "KES"},
    ):
        response = client.get(f"/portal/students/{student_id}/fees/{invoice_id}/pay/card/{tx_id}/status", headers=headers)

    assert response.json()["status"] == "pending"


def test_matching_reference_amount_and_currency_credits_the_invoice(client, db_session, school):
    ctx = _setup_invoice_with_card(db_session, school)
    headers = _login_parent(client, ctx["guardian"])
    student_id, invoice_id = ctx["student"].id, ctx["invoice"].id

    tx_id, ref = _initiate(client, headers, student_id, invoice_id)
    with patch(
        "app.routers.portal.get_transaction_status",
        return_value={"payment_status_description": "Completed", "merchant_reference": ref, "amount": 10000, "currency": "KES"},
    ):
        response = client.get(f"/portal/students/{student_id}/fees/{invoice_id}/pay/card/{tx_id}/status", headers=headers)

    assert response.json()["status"] == "completed"
    db_session.refresh(ctx["invoice"])
    assert float(ctx["invoice"].amount_paid) == 10000


def test_status_check_is_idempotent_once_completed(client, db_session, school):
    ctx = _setup_invoice_with_card(db_session, school)
    headers = _login_parent(client, ctx["guardian"])
    student_id, invoice_id = ctx["student"].id, ctx["invoice"].id

    tx_id, ref = _initiate(client, headers, student_id, invoice_id)
    with patch(
        "app.routers.portal.get_transaction_status",
        return_value={"payment_status_description": "Completed", "merchant_reference": ref, "amount": 10000, "currency": "KES"},
    ) as mocked:
        client.get(f"/portal/students/{student_id}/fees/{invoice_id}/pay/card/{tx_id}/status", headers=headers)
        client.get(f"/portal/students/{student_id}/fees/{invoice_id}/pay/card/{tx_id}/status", headers=headers)
        # a completed transaction short-circuits before ever calling Pesapal again
        assert mocked.call_count == 1

    db_session.refresh(ctx["invoice"])
    assert float(ctx["invoice"].amount_paid) == 10000  # not double-credited
