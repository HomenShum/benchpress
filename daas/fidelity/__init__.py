"""Fidelity — transfer-judgment measurement for externalized distillation.

The singular problem this module solves:

    "Transfer tacit judgment from model inference (runtime) into
     externalized structure (compile-time) without losing fidelity —
     and know when you can't."

Every form of distillation reduces to externalization:
    - Prompt distillation:   reasoning pattern -> system prompt string
    - Tool/harness:          choice discipline  -> tool allowlist + schema
    - Full scaffold:         decomposition      -> agent graph

All three are compile-time artifacts that substitute for the big model's
tacit runtime judgment. The universal question::

    Can a small model + externalized artifact produce output a deterministic
    judge cannot distinguish from the big model's output on the same input?

The 3-measurement template answers it::

    baseline   = small_model(task)                    # no scaffold
    ceiling    = large_model(task)                    # scaffold-free reference
    distilled  = small_model(task, scaffold=artifact) # the claim under test

Then::

    gap        = ceiling  - baseline        (what's to transfer)
    transfer   = distilled - baseline       (what actually transferred)
    fidelity   = transfer / gap             (fraction of gap closed)

Verdicts are bounded enumerations the schema will accept; no free-form
scores. See verdict.py for the classification rules and Wilson-CI based
significance checks.
"""

from daas.fidelity.types import (
    Externalization,
    ExternalizationForm,
    FidelityTrial,
    FidelityVerdict,
    Measurement,
    TransferVerdict,
    VERDICT_VALUES,
)
from daas.fidelity.verdict import (
    classify,
    newcombe_diff_ci,
    wilson_ci,
)

__all__ = [
    "Externalization",
    "ExternalizationForm",
    "FidelityTrial",
    "FidelityVerdict",
    "Measurement",
    "TransferVerdict",
    "VERDICT_VALUES",
    "classify",
    "newcombe_diff_ci",
    "wilson_ci",
]
