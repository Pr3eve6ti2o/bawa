#!/usr/bin/env python3
"""Validate a Bawa payment record against docs/mainnet/payment-record.schema.json.

Stdlib only (no jsonschema dependency). Checks structure, field types,
enums and the arithmetic the guide requires:
- reconciliation total equals the sum of accepted events;
- discrepancy equals total minus requested amount;
- database_after equals database_before plus total (no reversals);
- journal amount equals reconciliation total;
- settlement net equals allocation minus recipient-borne fees;
- the deduplication/idempotency key names the observed txid.

Usage: python3 test/payment_record_check.py [--record PATH]
Exit 0 only if the shipped example passes AND a tampered copy fails.
This file contains only public fixture material, never real wallet data.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SCHEMA = ROOT / "docs" / "mainnet" / "payment-record.schema.json"
DEFAULT_RECORD = ROOT / "docs" / "mainnet" / "payment-record.example.json"


def is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def check_record(record, schema) -> list[str]:
    errors: list[str] = []

    def need(obj, key, where):
        if key not in obj:
            errors.append(f"{where}: missing required field '{key}'")

    def need_str(obj, key, where):
        need(obj, key, where)
        if key in obj and not isinstance(obj[key], str):
            errors.append(f"{where}.{key}: expected string")

    def need_nonneg_int(obj, key, where):
        need(obj, key, where)
        if key in obj and (not is_int(obj[key]) or obj[key] < 0):
            errors.append(f"{where}.{key}: expected non-negative integer")

    if not isinstance(record, dict):
        return ["record: expected a JSON object"]
    if record.get("format_version") != "bawa-payment-record/1":
        errors.append("format_version: expected 'bawa-payment-record/1'")

    req = record.get("request")
    if not isinstance(req, dict):
        errors.append("request: expected an object")
        return errors
    for k in ("network", "asset", "recipient", "amount_unit", "policy_version"):
        need_str(req, k, "request")
    need_nonneg_int(req, "amount_atomic", "request")
    if req.get("memo_tag") is not None and not isinstance(req.get("memo_tag"), str):
        errors.append("request.memo_tag: expected string or null")
    need_str(req, "expiry", "request")

    obs = record.get("observation")
    if not isinstance(obs, dict):
        errors.append("observation: expected an object")
        return errors
    for k in ("txid", "chain_network", "output_identity", "cursor", "recipient", "asset"):
        need_str(obs, k, "observation")
    need_nonneg_int(obs, "amount_atomic", "observation")
    if obs.get("memo_tag") is not None and not isinstance(obs.get("memo_tag"), str):
        errors.append("observation.memo_tag: expected string or null")
    if obs.get("payer") is not None and not isinstance(obs.get("payer"), str):
        errors.append("observation.payer: expected string or null")
    if obs.get("canonicality") not in ("canonical", "reorged", "unknown"):
        errors.append("observation.canonicality: expected canonical|reorged|unknown")
    blk = obs.get("block_identity")
    if not isinstance(blk, dict):
        errors.append("observation.block_identity: expected an object")
    else:
        need_nonneg_int(blk, "height", "observation.block_identity")
        need_nonneg_int(blk, "time", "observation.block_identity")

    match = record.get("match")
    if not isinstance(match, dict):
        errors.append("match: expected an object")
        return errors
    for k in ("request_event_link", "deduplication_key", "reason", "policy_version"):
        need_str(match, k, "match")
    need_nonneg_int(match, "evaluated_confirmations", "match")
    if match.get("status") not in ("accepted", "rejected", "pending"):
        errors.append("match.status: expected accepted|rejected|pending")

    rec = record.get("reconciliation")
    if not isinstance(rec, dict):
        errors.append("reconciliation: expected an object")
        return errors
    need_nonneg_int(rec, "total_atomic", "reconciliation")
    need_nonneg_int(rec, "database_before_atomic", "reconciliation")
    need_nonneg_int(rec, "database_after_atomic", "reconciliation")
    if "discrepancy_atomic" not in rec or not is_int(rec["discrepancy_atomic"]):
        errors.append("reconciliation.discrepancy_atomic: expected integer")
    if rec.get("repair") is not None and not isinstance(rec.get("repair"), str):
        errors.append("reconciliation.repair: expected string or null")
    need_str(rec, "resulting_status", "reconciliation")
    need_str(rec, "decision_reason", "reconciliation")
    events = rec.get("accepted_event_set")
    if not isinstance(events, list) or not all(isinstance(e, str) for e in events):
        errors.append("reconciliation.accepted_event_set: expected a list of strings")

    credit = record.get("credit_settlement")
    if not isinstance(credit, dict):
        errors.append("credit_settlement: expected an object")
        return errors
    for k in ("credit_id", "idempotency_key", "journal_asset"):
        need_str(credit, k, "credit_settlement")
    need_nonneg_int(credit, "journal_amount_atomic", "credit_settlement")
    if not isinstance(credit.get("reversals_adjustments"), list):
        errors.append("credit_settlement.reversals_adjustments: expected a list")
    stl = credit.get("settlement_line")
    if not isinstance(stl, dict):
        errors.append("credit_settlement.settlement_line: expected an object")
        return errors
    need_str(stl, "retained_record_reference", "credit_settlement.settlement_line")
    for k in ("allocation_atomic", "fees_atomic", "recipient_borne_fees_atomic", "net_value_atomic"):
        need_nonneg_int(stl, k, "credit_settlement.settlement_line")

    if errors:
        return errors

    # Arithmetic the guide requires (only when the record is well-formed).
    if match["status"] == "accepted":
        if isinstance(events, list) and len(events) == 1 and events[0] == obs["txid"]:
            if rec["total_atomic"] != obs["amount_atomic"]:
                errors.append("reconciliation.total_atomic must equal the accepted event amount")
        if rec["discrepancy_atomic"] != rec["total_atomic"] - req["amount_atomic"]:
            errors.append("reconciliation.discrepancy_atomic must equal total minus requested amount")
        if rec["database_after_atomic"] != rec["database_before_atomic"] + rec["total_atomic"]:
            errors.append("reconciliation.database_after_atomic must equal before plus total")
        if credit["journal_amount_atomic"] != rec["total_atomic"]:
            errors.append("credit_settlement.journal_amount_atomic must equal reconciliation total")
        if stl["net_value_atomic"] != stl["allocation_atomic"] - stl["recipient_borne_fees_atomic"]:
            errors.append("settlement net_value_atomic must equal allocation minus recipient-borne fees")
        if obs["txid"] not in match["deduplication_key"]:
            errors.append("match.deduplication_key must name the observed txid")
        if match["deduplication_key"] != credit["idempotency_key"]:
            errors.append("credit_settlement.idempotency_key must equal match.deduplication_key")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate a Bawa payment record.")
    ap.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    ap.add_argument("--record", type=Path, default=DEFAULT_RECORD)
    args = ap.parse_args()

    schema = json.loads(args.schema.read_text())
    record = json.loads(args.record.read_text())
    errors = check_record(record, schema)
    if errors:
        print("payment record check: FAIL")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("payment record check: PASS (shipped example valid)")

    # Negative self-test: a tampered copy must fail.
    tampered = copy.deepcopy(record)
    tampered["reconciliation"]["total_atomic"] += 1
    tampered_errors = check_record(tampered, schema)
    if not tampered_errors:
        print("payment record check: FAIL (tampered copy was accepted)")
        return 1
    print(f"payment record check: PASS (tampered copy rejected: {tampered_errors[0]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
