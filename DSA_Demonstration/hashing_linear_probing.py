"""
=============================================================================
DSA Demonstration: Custom Hash Table with Linear Probing
=============================================================================
Course: 23AID204-A Data Structures and Algorithms
Purpose: Demonstrates open addressing collision resolution using linear probing,
         including insertion, searching, deletion with tombstones, and slot reuse.

Key Algorithmic Concepts:
  1. Hash Function:
     Computes a base index using Python's polynomial rolling hash modulo table capacity.
     h(key) = sum(ord(char) * 31^i) % capacity

  2. Collision Resolution (Linear Probing):
     When slot h(key) is occupied, probe sequentially:
     index_i = (h(key) + i) % capacity, for i = 1, 2, 3, ...

  3. Tombstone Mechanism (Deleted Slot Handling):
     When a key is deleted, setting its slot to None would break the probe chain
     for subsequent colliding keys. Instead, the slot is marked with a special
     Tombstone sentinel (_DELETED).
     - Search continues past _DELETED.
     - Insertion can reuse _DELETED slots.

Time Complexities:
  - Average Case:
      * Insertion : O(1)
      * Search    : O(1)
      * Deletion  : O(1)
  - Worst Case (high load factor / severe clustering):
      * Insertion : O(N)
      * Search    : O(N)
      * Deletion  : O(N)
  - Space Complexity: O(Capacity)
=============================================================================
"""

from typing import Any, Optional, Tuple


class _DeletedSentinel:
    """Sentinel class representing a deleted slot (Tombstone)."""

    def __repr__(self) -> str:
        return "<TOMBSTONE: DELETED>"


# Singleton sentinel instance to represent deleted slots
_DELETED = _DeletedSentinel()


class HashTableLinearProbing:
    """
    Custom Hash Table implemented from scratch using Open Addressing with Linear Probing.
    Stores key-value pairs without using Python's built-in dictionary storage.
    """

    def __init__(self, capacity: int = 7):
        """
        Initialize the hash table with a fixed capacity.
        A small prime capacity (like 7) is chosen by default to clearly demonstrate collisions.
        """
        if capacity <= 0:
            raise ValueError("Capacity must be a positive integer.")

        self.capacity: int = capacity
        # Table holds tuples: (key, value) or None (empty) or _DELETED (tombstone)
        self.table: list[Optional[Tuple[Any, Any] | _DeletedSentinel]] = [None] * capacity
        self.count: int = 0  # Number of active key-value pairs

    def _hash(self, key: Any) -> int:
        """
        Custom hash function for strings and integers.
        Uses polynomial accumulation with prime multiplier 31.
        Time Complexity: O(L) where L is key length, or O(1) for integers.
        """
        if isinstance(key, int):
            return abs(key) % self.capacity

        key_str = str(key)
        hash_val = 0
        for char in key_str:
            hash_val = (hash_val * 31 + ord(char)) % self.capacity
        return hash_val

    @property
    def load_factor(self) -> float:
        """Computes current load factor: alpha = count / capacity."""
        return self.count / self.capacity

    def insert(self, key: Any, value: Any) -> bool:
        """
        Inserts or updates a key-value pair using linear probing.
        Reuses tombstone slots if the key is not already present in the probe chain.

        Time Complexity:
          - Average: O(1)
          - Worst: O(N) when table is nearly full or suffers clustering.
        """
        if key is None:
            raise ValueError("Key cannot be None.")

        if self.count >= self.capacity:
            print(f"[REJECTED] Cannot insert '{key}': Hash table is completely full (Capacity: {self.capacity}).")
            return False

        home_index = self._hash(key)
        first_tombstone_index = -1
        probes = 0

        # Step 1: Probe to find if key already exists, or locate an insertion slot
        for step in range(self.capacity):
            curr_index = (home_index + step) % self.capacity
            entry = self.table[curr_index]

            if entry is None:
                # Reached an empty slot: key does not exist further in probe sequence.
                # If we passed a tombstone earlier, reuse that earlier slot.
                target_index = first_tombstone_index if first_tombstone_index != -1 else curr_index
                self.table[target_index] = (key, value)
                self.count += 1
                if step > 0:
                    print(f"[COLLISION RESOLVED] '{key}' hashed to index {home_index}, "
                          f"probed {step} step(s) -> placed at index {target_index}.")
                else:
                    print(f"[INSERTED] '{key}' placed directly at home index {home_index}.")
                return True

            elif entry is _DELETED:
                # Found a tombstone: record the first one seen for potential reuse
                if first_tombstone_index == -1:
                    first_tombstone_index = curr_index

            else:
                # Occupied slot: check if key is identical (update operation)
                existing_key, _ = entry
                if existing_key == key:
                    self.table[curr_index] = (key, value)
                    print(f"[UPDATED] Key '{key}' already exists at index {curr_index}. Value updated.")
                    return True

        # If table wrapped around and only tombstones were found
        if first_tombstone_index != -1:
            self.table[first_tombstone_index] = (key, value)
            self.count += 1
            print(f"[REUSED TOMBSTONE] '{key}' inserted into deleted slot at index {first_tombstone_index}.")
            return True

        print(f"[ERROR] Could not find an insertion slot for '{key}'.")
        return False

    def search(self, key: Any) -> Optional[Any]:
        """
        Searches for a key using linear probing.
        Continues past tombstones and stops only at None or when key is found.

        Time Complexity:
          - Average: O(1)
          - Worst: O(N)
        """
        home_index = self._hash(key)

        for step in range(self.capacity):
            curr_index = (home_index + step) % self.capacity
            entry = self.table[curr_index]

            if entry is None:
                # Key cannot exist past an unallocated (None) slot
                return None

            if entry is not _DELETED:
                existing_key, value = entry
                if existing_key == key:
                    return value

        return None

    def delete(self, key: Any) -> bool:
        """
        Deletes a key by placing a Tombstone (_DELETED) in its slot.
        This preserves the probe sequence for keys that collided past this position.

        Time Complexity:
          - Average: O(1)
          - Worst: O(N)
        """
        home_index = self._hash(key)

        for step in range(self.capacity):
            curr_index = (home_index + step) % self.capacity
            entry = self.table[curr_index]

            if entry is None:
                # Key not found
                return False

            if entry is not _DELETED:
                existing_key, _ = entry
                if existing_key == key:
                    # Mark slot with tombstone sentinel
                    self.table[curr_index] = _DELETED
                    self.count -= 1
                    print(f"[DELETED] Key '{key}' removed from index {curr_index}. Slot marked with TOMBSTONE.")
                    return True

        return False

    def display(self, title: str = "Hash Table State") -> None:
        """Prints formatted view of all slots in the hash table."""
        print(f"\n--- {title} (Items: {self.count}/{self.capacity}, Load Factor: {self.load_factor:.2f}) ---")
        for i, entry in enumerate(self.table):
            if entry is None:
                status = "<EMPTY>"
            elif entry is _DELETED:
                status = "<TOMBSTONE: DELETED>"
            else:
                k, v = entry
                status = f"Key: '{k}' => Value: {v}"
            print(f"  Slot [{i:2d}]: {status}")
        print("-" * 60)


# =============================================================================
# Demonstration Script
# =============================================================================
if __name__ == "__main__":
    print("=" * 70)
    print(" DEMONSTRATION: Custom Hash Table with Linear Probing & Tombstones ")
    print("=" * 70)

    # Initialize a small table of capacity 7 to clearly demonstrate collisions
    ht = HashTableLinearProbing(capacity=7)
    ht.display("Initial Empty Table")

    # Sample dataset: NexaVault Project Identifiers and Topics
    projects = [
        ("PRJ-101", "Secure Cloud Vault"),
        ("PRJ-108", "Distributed Ledger"),    # Hashes to same index as PRJ-101 in base-7 modulo
        ("PRJ-115", "Biometric Access Control"), # Hashes to same index again (cascading collision)
        ("PRJ-202", "Smart Contract Auditor"),
        ("PRJ-305", "Zero Trust Gateway"),
    ]

    print("\n>>> STEP 1: Inserting Projects and Observing Collisions")
    for pid, topic in projects:
        home = ht._hash(pid)
        print(f"Attempting insertion: '{pid}' (Home index: {home})")
        ht.insert(pid, topic)

    ht.display("Table After Collisions Resolved via Linear Probing")

    print("\n>>> STEP 2: Searching for Elements")
    search_keys = ["PRJ-101", "PRJ-108", "PRJ-115", "PRJ-999"]
    for k in search_keys:
        res = ht.search(k)
        if res:
            print(f"  [FOUND] Key '{k}' -> '{res}'")
        else:
            print(f"  [NOT FOUND] Key '{k}' does not exist.")

    print("\n>>> STEP 3: Deleting a Collision Key and Testing Tombstone Integrity")
    print("Deleting 'PRJ-108' (which sits in the middle of the probe chain between 101 and 115)...")
    ht.delete("PRJ-108")
    ht.display("Table After Deletion (Tombstone in Slot)")

    print("\n>>> STEP 4: Verifying Search Still Works Across the Tombstone")
    # Without tombstones, searching PRJ-115 would stop at the empty slot and erroneously report NOT FOUND
    res_115 = ht.search("PRJ-115")
    print(f"Search for 'PRJ-115' after deleting 'PRJ-108': {res_115}")
    assert res_115 == "Biometric Access Control", "Probe chain broken by deletion!"
    print("  [SUCCESS] Probe chain unbroken! Linear probing correctly skipped tombstone.")

    print("\n>>> STEP 5: Reusing the Tombstone Slot on Next Insertion")
    print("Inserting new project 'PRJ-404'...")
    ht.insert("PRJ-404", "Quantum Resistant Encryption")
    ht.display("Table After Inserting into Tombstone Slot")

    print("\n>>> STEP 6: Edge Case - Table Full Rejection")
    ht.insert("PRJ-501", "AI Threat Intelligence")
    ht.insert("PRJ-601", "Automated Penetration Tester")
    ht.display("Table at Maximum Capacity")
    print("Attempting to insert an additional item into full table:")
    ht.insert("PRJ-777", "Overflow Project")

    print("\n" + "=" * 70)
    print(" HASHING WITH LINEAR PROBING DEMONSTRATION COMPLETE ")
    print("=" * 70)
