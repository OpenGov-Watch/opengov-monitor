#!/usr/bin/env python3
"""
Script to create default CSV files from exploration data.
Extracts id, category, subcategory, notes, and hide_in_spends columns.
"""

import csv
import os

def process_referenda():
    """Process exploration/categories-referenda.csv"""
    input_path = "exploration/categories-referenda.csv"
    output_path = "data/defaults/referenda-categories.csv"

    rows = []
    with open(input_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Map from exploration columns to our simplified format
            id_val = row.get("#", "").strip()
            category = row.get("Category", "").strip()
            subcategory = row.get("Subcategory", "").strip()
            hide_col = row.get("hide from income statement (represented via child bounties and/or via the balance sheet)", "").strip()
            notes = row.get("Notes", "").strip()

            # Skip rows without valid ID
            if not id_val or not id_val.isdigit():
                continue

            # Convert hide to 0/1
            hide_in_spends = 1 if hide_col.lower() in ("true", "1", "x", "yes") else 0

            # Only include rows that have at least category or subcategory or notes or hide
            if category or subcategory or notes or hide_in_spends:
                rows.append({
                    "id": int(id_val),
                    "category": category,
                    "subcategory": subcategory,
                    "notes": notes,
                    "hide_in_spends": hide_in_spends
                })

    # Write output
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "category", "subcategory", "notes", "hide_in_spends"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path}")

def process_child_bounties():
    """Process exploration/categories-child-counties.csv"""
    input_path = "exploration/categories-child-counties.csv"
    output_path = "data/defaults/child-bounties-categories.csv"

    rows = []
    with open(input_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Map from exploration columns to our simplified format
            # Child bounties CSV uses "#" or "index" for the ID and uses parent bounty + index as identifier
            id_val = row.get("#", row.get("index", "")).strip()
            parent_bounty_id = row.get("parentBountyID", "").strip()
            category = row.get("Category", "").strip()
            subcategory = row.get("Subcategory", "").strip()
            hide_col = row.get("hide from income statement", "").strip()
            notes = row.get("NOTE", "").strip()

            # Skip rows without valid IDs
            if not id_val or not parent_bounty_id:
                continue

            # Create identifier in format "parentBountyId-index"
            try:
                identifier = f"{int(parent_bounty_id)}-{int(id_val)}"
            except ValueError:
                continue

            # Convert hide to 0/1
            hide_in_spends = 1 if hide_col.lower() in ("true", "1", "x", "yes") else 0

            # Only include rows that have at least category or subcategory or notes or hide
            if category or subcategory or notes or hide_in_spends:
                rows.append({
                    "identifier": identifier,
                    "category": category,
                    "subcategory": subcategory,
                    "notes": notes,
                    "hide_in_spends": hide_in_spends
                })

    # Write output
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["identifier", "category", "subcategory", "notes", "hide_in_spends"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path}")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.makedirs("data/defaults", exist_ok=True)
    process_referenda()
    process_child_bounties()
