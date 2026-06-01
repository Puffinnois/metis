"""Adapter protocol — base contract for all ingestion adapters."""

from pathlib import Path
from typing import Any, Protocol

type RawRecord = dict[str, Any]
type NormalizedRecord = dict[str, Any]


class Adapter(Protocol):
    """Contract every ingestion adapter must satisfy.

    Implementations:
        fetch  — pull raw records from the source
        parse  — normalize one raw record to the Metis schema
        write  — persist normalized records to Parquet
    """

    source: str

    def fetch(self, entity: str, params: dict[str, Any]) -> list[RawRecord]: ...

    def parse(self, raw: RawRecord) -> NormalizedRecord: ...

    def write(self, records: list[NormalizedRecord], season: int) -> Path: ...
