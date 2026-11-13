from decimal import Decimal

from django.db import transaction as db_transaction
from django.utils import timezone

from api.models import (
    Dispute,
    DisputeStatus,
    Listing,
    ListingStatus,
    PaymentAttempt,
    Transaction,
    TransactionStatus,
)


class PaymentPayloadError(ValueError):
    pass


def validate_paystack_success(reference, amount_ngn, currency, data):
    if data.get('status') != 'success':
        raise PaymentPayloadError('Payment status is not successful.')
    if data.get('reference') != reference:
        raise PaymentPayloadError('Paystack reference does not match.')
    if data.get('currency') != 'NGN' or currency != 'NGN':
        raise PaymentPayloadError('Payment currency is not NGN.')
    try:
        received_kobo = int(data.get('amount'))
        expected_kobo = int(Decimal(amount_ngn) * 100)
    except (TypeError, ValueError, OverflowError) as error:
        raise PaymentPayloadError('Paystack returned an invalid payment amount.') from error
    if received_kobo != expected_kobo:
        raise PaymentPayloadError('Payment amount mismatch.')


def settle_payment_attempt(attempt_id, paystack_data):
    attempt_reference = PaymentAttempt.objects.only('transaction_id').get(pk=attempt_id)
    listing_id = Transaction.objects.values_list(
        'listing_id',
        flat=True,
    ).get(pk=attempt_reference.transaction_id)
    with db_transaction.atomic():
        listing = Listing.objects.select_for_update().get(pk=listing_id)
        txn = Transaction.objects.select_for_update().get(pk=attempt_reference.transaction_id)
        attempt = PaymentAttempt.objects.select_for_update().get(pk=attempt_id)
        if attempt.status == PaymentAttempt.Status.PAID:
            return txn, 'already_processed'
        if attempt.status in (
            PaymentAttempt.Status.RECONCILIATION,
            PaymentAttempt.Status.REFUNDED,
        ):
            return txn, 'reconciliation'

        validate_paystack_success(
            attempt.reference,
            attempt.amount_ngn,
            txn.currency,
            paystack_data,
        )

        if txn.paid_at is not None:
            attempt.status = PaymentAttempt.Status.RECONCILIATION
            attempt.save(update_fields=['status'])
            Dispute.objects.get_or_create(
                transaction=txn,
                status=DisputeStatus.OPEN,
                defaults={
                    'raised_by': txn.buyer,
                    'reason': (
                        f'Additional successful Paystack payment {attempt.reference} '
                        'requires refund reconciliation.'
                    ),
                },
            )
            return txn, 'reconciliation'

        conflicting_deal = Transaction.objects.filter(
            listing=listing,
            status__in=[TransactionStatus.RESERVED, TransactionStatus.COMPLETED],
        ).exclude(pk=txn.pk).exists()
        if conflicting_deal or listing.status == ListingStatus.SOLD:
            attempt.status = PaymentAttempt.Status.RECONCILIATION
            attempt.save(update_fields=['status'])
            Dispute.objects.get_or_create(
                transaction=txn,
                status=DisputeStatus.OPEN,
                defaults={
                    'raised_by': txn.buyer,
                    'reason': (
                        f'Late successful Paystack payment {attempt.reference} cannot be '
                        'fulfilled because the listing is no longer available. Refund reconciliation required.'
                    ),
                },
            )
            return txn, 'reconciliation'

        if txn.disputes.filter(status=DisputeStatus.OPEN).exists():
            attempt.status = PaymentAttempt.Status.RECONCILIATION
            attempt.save(update_fields=['status'])
            return txn, 'reconciliation'

        if listing.status not in (ListingStatus.LIVE, ListingStatus.RESERVED):
            attempt.status = PaymentAttempt.Status.RECONCILIATION
            attempt.save(update_fields=['status'])
            return txn, 'reconciliation'

        now = timezone.now()
        txn.status = TransactionStatus.COMPLETED
        txn.payment_ref = attempt.reference
        txn.amount_ngn = attempt.amount_ngn
        txn.currency = 'NGN'
        txn.paid_at = now
        txn.completed_at = now
        txn.hold_started_at = None
        txn.hold_expires_at = None
        txn.save(
            update_fields=[
                'status',
                'payment_ref',
                'amount_ngn',
                'currency',
                'paid_at',
                'completed_at',
                'hold_started_at',
                'hold_expires_at',
                'updated_at',
            ]
        )
        attempt.status = PaymentAttempt.Status.PAID
        attempt.save(update_fields=['status'])
        return txn, 'fulfilled'
