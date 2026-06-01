"""Parquet writer: data/parquet/<source>/<entity>/season=<season>/part-*.parquet."""

import os
import uuid
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq


def _default_data_root() -> Path:
    env = os.environ.get("METIS_DATA_ROOT")
    if env:
        return Path(env) / "parquet"
    # Two levels up from python/ingest/ reaches the project root.
    return Path(__file__).parents[2] / "data" / "parquet"


def write_parquet(
    records: list[dict[str, Any]],
    *,
    source: str,
    entity: str,
    season: int,
    data_root: Path | None = None,
) -> Path:
    """Write records to a partitioned Parquet file and return the file path.

    Output path: <data_root>/<source>/<entity>/season=<season>/part-<uuid8>.parquet
    """
    root = data_root if data_root is not None else _default_data_root()
    dest = root / source / entity / f"season={season}"
    dest.mkdir(parents=True, exist_ok=True)

    part = dest / f"part-{uuid.uuid4().hex[:8]}.parquet"
    table = pa.Table.from_pylist(records)
    pq.write_table(table, part)  # type: ignore[no-untyped-call]
    return part
