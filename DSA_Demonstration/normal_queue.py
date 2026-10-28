"""
=============================================================================
DSA Demonstration: Standard FIFO Queue Using collections.deque
=============================================================================
Course: 23AID204-A Data Structures and Algorithms
Purpose: Demonstrates a First-In, First-Out (FIFO) linear data structure
         implemented via collections.deque to guarantee true O(1) enqueue
         and dequeue operations.

Key Algorithmic Concepts:
  1. FIFO Principle (First-In, First-Out):
     The first element added to the queue is the first one removed.
     Simulates real-world waiting lines (e.g., student submission review,
     printer queues, breadcrumb audit dispatch).

  2. Why collections.deque instead of standard Python list:
     - Python list is a dynamic contiguous array.
       * `list.append(x)` is O(1) amortized.
       * `list.pop(0)` is O(N) because every remaining element must shift
         one position to the left in memory.
     - `collections.deque` (double-ended queue) is implemented in C as a
       doubly-linked list of fixed-size blocks (typically 64 elements each).
       * `deque.append(x)` is guaranteed O(1) without reallocation.
       * `deque.popleft()` is guaranteed O(1) without shifting elements.

Time Complexities:
  - Enqueue (append to rear) : O(1)
  - Dequeue (pop from front) : O(1)
  - Front / Peek (inspect)   : O(1)
  - Size / is_empty          : O(1)
  - Display / Traversal      : O(N)
  - Space Complexity         : O(N)
=============================================================================
"""

from collections import deque
from typing import Any, List, Optional


class FIFOQueue:
    """
    Standard FIFO Queue implemented using collections.deque.
    Provides strict queue interface semantics (enqueue, dequeue, peek).
    """

    def __init__(self):
        """Initializes an empty FIFO queue."""
        self._items: deque = deque()

    def __len__(self) -> int:
        """Returns the number of elements in the queue."""
        return len(self._items)

    def is_empty(self) -> bool:
        """Returns True if the queue contains no elements, False otherwise."""
        return len(self._items) == 0

    def enqueue(self, item: Any) -> None:
        """
        Adds an item to the rear (tail) of the queue.

        Time Complexity: O(1)
        """
        if item is None:
            raise ValueError("Queue cannot accept None as a valid payload.")

        self._items.append(item)
        print(f"[ENQUEUED] Added to rear: '{item}' (Queue size now: {len(self._items)})")

    def dequeue(self) -> Any:
        """
        Removes and returns the item from the front (head) of the queue.

        Time Complexity: O(1)
        Raises: IndexError if queue is empty.
        """
        if self.is_empty():
            raise IndexError("Cannot dequeue from an empty FIFOQueue.")

        item = self._items.popleft()
        print(f"[DEQUEUED] Removed from front: '{item}' (Remaining size: {len(self._items)})")
        return item

    def peek(self) -> Optional[Any]:
        """
        Inspects the front item without removing it.

        Time Complexity: O(1)
        """
        if self.is_empty():
            return None
        return self._items[0]

    def rear(self) -> Optional[Any]:
        """
        Inspects the most recently enqueued item at the back.

        Time Complexity: O(1)
        """
        if self.is_empty():
            return None
        return self._items[-1]

    def display(self, title: str = "Queue State (Front -> Rear)") -> None:
        """Prints elements from front to rear."""
        print(f"\n--- {title} (Length: {len(self._items)}) ---")
        if self.is_empty():
            print("  [FRONT] <EMPTY> [REAR]")
        else:
            items_str = " -> ".join([str(x) for x in self._items])
            print(f"  [FRONT] {items_str} [REAR]")
        print("-" * 60)


# =============================================================================
# Demonstration Script
# =============================================================================
if __name__ == "__main__":
    print("=" * 70)
    print(" DEMONSTRATION: Standard FIFO Queue with collections.deque ")
    print("=" * 70)

    queue = FIFOQueue()
    queue.display("Initial Empty Queue")

    # Scenario: Student Lab Session / Demo Presentation Order
    # Demonstrating First-Come, First-Served (FCFS) behavior
    print("\n>>> STEP 1: Enqueueing Student Presentation Requests")
    student_arrivals = [
        "Roll #CS2026-001 (Aarav - Distributed Storage Demo)",
        "Roll #CS2026-015 (Bhavna - Cloud Vault Encryption Demo)",
        "Roll #CS2026-032 (Chetan - Audit Log Hash Verification)",
        "Roll #CS2026-048 (Divya - RBAC Access Control Demo)",
    ]

    for student in student_arrivals:
        queue.enqueue(student)

    queue.display("Queue After All Arrivals")

    print("\n>>> STEP 2: Front and Rear Inspection (O(1))")
    print(f"Front student waiting to present next: {queue.peek()}")
    print(f"Most recent student to join the line: {queue.rear()}")

    print("\n>>> STEP 3: Servicing Students in Strict FIFO Order")
    step = 1
    while not queue.is_empty():
        print(f"\nSlot #{step}:")
        student = queue.dequeue()
        print(f"  Now evaluating: {student}")
        step += 1

    print("\n>>> STEP 4: Demonstrating Empty State Safety Handling")
    queue.display("Queue After All Students Evaluated")
    print(f"Is queue empty? {queue.is_empty()}")
    print("Attempting to dequeue from empty queue:")
    try:
        queue.dequeue()
    except IndexError as e:
        print(f"  [CAUGHT EXPECTED ERROR]: {e}")

    print("\n" + "=" * 70)
    print(" FIFO QUEUE DEMONSTRATION COMPLETE ")
    print("=" * 70)
