"""
=============================================================================
DSA Demonstration: Priority Queue Using Binary Min-Heap (heapq)
=============================================================================
Course: 23AID204-A Data Structures and Algorithms
Purpose: Demonstrates a priority-based scheduling queue where elements are
         serviced in order of urgency rather than arrival order, with a
         counter-based tie-breaker to preserve strict FIFO order for equal priorities.

Key Algorithmic Concepts:
  1. Binary Min-Heap:
     A complete binary tree satisfying the heap invariant:
     parent_value <= child_value for all nodes.
     Represented efficiently in a 1D array where for node at index i:
       - Left child  = 2 * i + 1
       - Right child = 2 * i + 2
       - Parent      = (i - 1) // 2

  2. Stable Priority Queue via Monotonic Sequence Counter:
     When storing tuples (priority, counter, item) in heapq:
       - 1st comparison: priority (lowest integer = highest urgency)
       - 2nd comparison: counter (breaks ties using arrival sequence)
       - 3rd comparison: item is never compared, preventing TypeError
         if items are complex objects or dictionaries.

Time Complexities:
  - Enqueue (Heap Push) : O(log N) - Sift up to restore heap invariant
  - Dequeue (Heap Pop)  : O(log N) - Sift down root replacement to leaf
  - Peek (Front item)   : O(1)     - Root element is always at index 0
  - Heapify (Bulk build): O(N)     - Bottom-up heap construction
  - Space Complexity    : O(N)
=============================================================================
"""

import heapq
from typing import Any, List, Optional, Tuple


class PriorityQueue:
    """
    Min-Heap Priority Queue.
    Priority convention: Lower integer values represent higher urgency
    (e.g., Priority 1 = Critical/Urgent, Priority 2 = High, Priority 3 = Normal).
    """

    def __init__(self):
        """Initializes an empty binary heap and monotonic arrival sequence counter."""
        self._heap: List[Tuple[int, int, Any]] = []
        self._counter: int = 0  # Monotonically increasing tie-breaker counter

    def __len__(self) -> int:
        """Returns the number of elements currently in the priority queue."""
        return len(self._heap)

    def is_empty(self) -> bool:
        """Checks if the priority queue has no pending items."""
        return len(self._heap) == 0

    def enqueue(self, item: Any, priority: int) -> None:
        """
        Inserts an item with a given priority into the min-heap.
        Uses self._counter as the tie-breaker to preserve FIFO order for equal priorities.

        Time Complexity: O(log N)
        """
        if not isinstance(priority, int):
            raise TypeError(f"Priority must be an integer, received: {type(priority).__name__}")

        # Tuple structure: (priority, counter, item)
        # heapq sorts first by priority, then by counter
        entry = (priority, self._counter, item)
        heapq.heappush(self._heap, entry)
        self._counter += 1
        print(f"[ENQUEUED] Item: '{item}' | Priority: {priority} (Seq #{self._counter - 1})")

    def dequeue(self) -> Any:
        """
        Removes and returns the item with the highest priority (lowest priority number).
        If multiple items share the same priority, the oldest one (FIFO) is returned.

        Time Complexity: O(log N)
        Raises: IndexError if the queue is empty.
        """
        if self.is_empty():
            raise IndexError("Cannot dequeue from an empty PriorityQueue.")

        priority, seq, item = heapq.heappop(self._heap)
        print(f"[DEQUEUED] Serviced item: '{item}' (Priority: {priority}, Enqueued as Seq #{seq})")
        return item

    def peek(self) -> Optional[Any]:
        """
        Inspects the highest priority item without removing it.

        Time Complexity: O(1)
        """
        if self.is_empty():
            return None
        # Root of binary min-heap is always at index 0
        return self._heap[0][2]

    def peek_priority(self) -> Optional[int]:
        """Returns priority value of next item to be serviced."""
        if self.is_empty():
            return None
        return self._heap[0][0]

    def display_pending(self, title: str = "Pending Items in Priority Queue") -> None:
        """
        Displays all pending items ordered by processing sequence without mutating the heap.
        Creates a sorted snapshot of the underlying list.
        """
        print(f"\n--- {title} (Total: {len(self._heap)}) ---")
        if self.is_empty():
            print("  <QUEUE IS EMPTY>")
        else:
            # Sort a copy by (priority, counter) to show true processing order
            sorted_snapshot = sorted(self._heap, key=lambda x: (x[0], x[1]))
            for rank, (prio, seq, item) in enumerate(sorted_snapshot, 1):
                print(f"  #{rank}: Priority {prio} (Seq #{seq}) -> {item}")
        print("-" * 60)


# =============================================================================
# Demonstration Script
# =============================================================================
if __name__ == "__main__":
    print("=" * 70)
    print(" DEMONSTRATION: Priority Queue with Binary Min-Heap & FIFO Tie-Breaker ")
    print("=" * 70)

    pq = PriorityQueue()

    # Scenario: Faculty Review Evaluation Queue
    # Priorities:
    #   1 = Critical (Overdue Sprint Submission / Resubmission)
    #   2 = High (Regular Milestone Due Today)
    #   3 = Normal (Early Draft Submission)
    print("\n>>> STEP 1: Enqueueing Tasks with Varied Priorities")
    pq.enqueue("Team Lambda: Final Project Report (Overdue)", priority=1)
    pq.enqueue("Team Alpha: Sprint 1 Architecture (Due Today)", priority=2)
    pq.enqueue("Team Zeta: Early Draft Review", priority=3)

    # Insert items with the SAME priority to verify FIFO tie-breaker behavior
    print("\n>>> STEP 2: Enqueueing Multiple Items with IDENTICAL Priority (Testing FIFO)")
    pq.enqueue("Team Beta: Milestone 2 Deliverable (First priority-2 arrival)", priority=2)
    pq.enqueue("Team Gamma: Milestone 2 Deliverable (Second priority-2 arrival)", priority=2)
    pq.enqueue("Team Omega: Emergency Plagiarism Flag", priority=1)

    pq.display_pending("Current Evaluation Queue State")

    print("\n>>> STEP 3: Peeking at the Next Item to be Serviced (O(1))")
    top_item = pq.peek()
    top_prio = pq.peek_priority()
    print(f"Next item to service: '{top_item}' with Priority {top_prio}")

    print("\n>>> STEP 4: Processing (Dequeuing) Items in Priority Order")
    print("Notice how Priority 1 items are processed before Priority 2,")
    print("and items with identical priorities follow their exact arrival sequence (FIFO):\n")

    processing_step = 1
    while not pq.is_empty():
        print(f"Step {processing_step}:")
        serviced = pq.dequeue()
        processing_step += 1

    print("\n>>> STEP 5: Testing Safe Empty Queue Handling")
    pq.display_pending("Queue After All Items Processed")
    print(f"Is queue empty? {pq.is_empty()}")
    print("Attempting to dequeue from empty queue:")
    try:
        pq.dequeue()
    except IndexError as e:
        print(f"  [CAUGHT EXPECTED ERROR]: {e}")

    print("\n" + "=" * 70)
    print(" PRIORITY QUEUE DEMONSTRATION COMPLETE ")
    print("=" * 70)
