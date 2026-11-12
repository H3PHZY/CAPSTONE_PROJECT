import requests
from decimal import Decimal
from typing import Dict, Any, Tuple
from urllib.parse import quote
from django.conf import settings
from rest_framework.exceptions import ValidationError, APIException

class PaymentVerificationError(APIException):
    status_code = 402
    default_detail = "Payment could not be verified."
    default_code = "payment_verification_failed"

class AmountMismatchError(APIException):
    status_code = 422
    default_detail = "Payment amount mismatch."
    default_code = "amount_mismatch"

def verify_paystack_transaction(reference: str, expected_ngn: Decimal) -> Tuple[bool, Dict[str, Any]]:
    """
    Verifies a Paystack transaction reference directly against the Paystack REST API.
    Enforces amount integrity guard (in kobo: 1 NGN = 100 kobo).
    """
    secret_key = settings.PAYSTACK_SECRET_KEY
    if not secret_key:
        raise ValidationError("PAYSTACK_SECRET_KEY is not configured on the server.")

    normalized_reference = reference.strip()
    url = (
        "https://api.paystack.co/transaction/verify/"
        f"{quote(normalized_reference, safe='')}"
    )
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.get(url, headers=headers, timeout=20)
        data = response.json()
    except ValueError as exc:
        raise PaymentVerificationError(
            "Paystack returned an invalid verification response."
        ) from exc
    except requests.RequestException as exc:
        raise PaymentVerificationError(
            "Network error contacting Paystack."
        ) from exc

    if not isinstance(data, dict):
        raise PaymentVerificationError(
            "Paystack returned an invalid verification response."
        )
    if not response.ok or not data.get("status"):
        msg = data.get("message", "Paystack verification failed.")
        raise PaymentVerificationError(msg)

    txn_data = data.get("data", {})
    if not isinstance(txn_data, dict):
        raise PaymentVerificationError("Paystack returned invalid transaction data.")
    txn_status = txn_data.get("status")

    if txn_status != "success":
        raise PaymentVerificationError(
            f"Payment not successful. Paystack status: '{txn_status}'"
        )

    # Amount guard: Paystack reports amounts in kobo (NGN * 100)
    expected_kobo = int(expected_ngn * 100)
    try:
        received_kobo = int(txn_data.get("amount", 0))
    except (TypeError, ValueError, OverflowError) as exc:
        raise PaymentVerificationError(
            "Paystack returned an invalid payment amount."
        ) from exc

    if received_kobo != expected_kobo:
        received_ngn = received_kobo / 100
        raise AmountMismatchError(
            f"Payment amount mismatch. Expected ₦{expected_ngn:,.2f} but Paystack confirmed ₦{received_ngn:,.2f}."
        )

    if txn_data.get("currency") != "NGN":
        raise PaymentVerificationError("Payment currency is not NGN.")

    if txn_data.get("reference") != normalized_reference:
        raise PaymentVerificationError("Paystack reference does not match.")

    return True, txn_data
