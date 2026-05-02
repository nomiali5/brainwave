"""
Verify the generated sample_data.brw and sample_data.bxr files.

Prints a full summary of all datasets, their shapes, dtypes, and attribute
values so the user can confirm validity before uploading to the website.

Usage:
    python verify_files.py
"""

import sys

import h5py
import numpy as np


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _print_attrs(obj, indent: int = 4) -> None:
    pad = " " * indent
    if not obj.attrs:
        print(f"{pad}(no attributes)")
        return
    for key, val in obj.attrs.items():
        print(f"{pad}{key} = {val!r}")


def _visit_item(name, obj) -> None:
    """h5py visitor callback."""
    indent = "  " * (name.count("/") + 1)
    if isinstance(obj, h5py.Dataset):
        print(f"{indent}[Dataset] {name}")
        print(f"{indent}  shape  : {obj.shape}")
        print(f"{indent}  dtype  : {obj.dtype}")
        if obj.shape == () or (len(obj.shape) == 1 and obj.shape[0] <= 20):
            data = obj[()]
            if isinstance(data, bytes):
                data = data.decode("utf-8", errors="replace")
            print(f"{indent}  data   : {data}")
        elif len(obj.shape) == 2 and obj.shape[0] <= 10:
            print(f"{indent}  data   : {obj[()]}")
        else:
            arr = obj[()]
            if np.issubdtype(obj.dtype, np.number):
                print(f"{indent}  min    : {arr.min()}")
                print(f"{indent}  max    : {arr.max()}")
                print(f"{indent}  mean   : {arr.mean():.4f}")
            print(f"{indent}  first4 : {arr.flat[:4].__array__()}")
        if obj.attrs:
            print(f"{indent}  attrs  :")
            _print_attrs(obj, indent=len(indent) + 4)
    elif isinstance(obj, h5py.Group):
        print(f"{indent}[Group] {name}")
        if obj.attrs:
            print(f"{indent}  attrs  :")
            _print_attrs(obj, indent=len(indent) + 4)


def summarise(path: str) -> None:
    print("=" * 70)
    print(f"FILE: {path}")
    print("=" * 70)

    with h5py.File(path, "r") as f:
        print("\n--- Root Attributes ---")
        _print_attrs(f, indent=2)

        print("\n--- Contents ---")
        f.visititems(_visit_item)

    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    files = ["sample_data.brw", "sample_data.bxr"]
    missing = [p for p in files if not __import__("os").path.exists(p)]
    if missing:
        print(
            f"ERROR: File(s) not found: {', '.join(missing)}\n"
            "Run `python generate_test_files.py` first.",
            file=sys.stderr,
        )
        sys.exit(1)

    for path in files:
        summarise(path)


if __name__ == "__main__":
    main()
