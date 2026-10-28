# NexaVault — Academic DSA Demonstration Suite

This folder (`DSA_Demonstration/`) contains four self-contained, independent Python programs designed for faculty evaluation and classroom demonstrations in **23AID204-A Data Structures and Algorithms (DSA)**.

Every program is implemented in pure, object-oriented Python using only the Python standard library. They run completely standalone without requiring database connections, external pip packages, or NexaVault application servers.

---

## Suite Summary & Algorithmic Complexity

| File | Data Structure | Underlying Technique | Primary Operations | Time Complexity | Space Complexity |
|---|---|---|---|---|---|
| `hashing_linear_probing.py` | Custom Hash Table | Open Addressing with Linear Probing & Tombstones | `insert`, `search`, `delete`, `display` | Avg: $O(1)$<br>Worst: $O(N)$ | $O(\text{Capacity})$ |
| `priority_queue.py` | Priority Queue | Binary Min-Heap (`heapq`) + Monotonic FIFO Counter | `enqueue`, `dequeue`, `peek`, `display_pending` | Enqueue: $O(\log N)$<br>Dequeue: $O(\log N)$<br>Peek: $O(1)$ | $O(N)$ |
| `normal_queue.py` | FIFO Queue | Double-Ended Queue (`collections.deque`) | `enqueue`, `dequeue`, `peek`, `rear`, `display` | Enqueue: $O(1)$<br>Dequeue: $O(1)$<br>Peek: $O(1)$ | $O(N)$ |
| `trie_autocomplete.py` | Prefix Tree (Trie) | Multi-way Tree with `TrieNode` child dictionaries | `insert`, `search`, `starts_with`, `autocomplete` | Insert: $O(L)$<br>Search: $O(L)$<br>Autocomplete: $O(P + K)$ | $O(\Sigma \cdot L \cdot N)$ |

*Notation:*
- $N$: Number of stored elements.
- $L$: Length of the input word.
- $P$: Length of the search prefix.
- $K$: Number of nodes/characters in the prefix subtree.
- $\Sigma$: Alphabet size.

---

## Detailed Component Breakdown

### 1. Custom Hash Table with Linear Probing (`hashing_linear_probing.py`)
- **Purpose**: Demonstrates open addressing collision resolution when multiple keys hash to identical table indices.
- **Key Concepts**:
  - **Polynomial Rolling Hash**: Calculates initial index using prime multiplier 31 modulo table capacity.
  - **Linear Probing**: When slot $h(k)$ is occupied, searches sequentially via $(h(k) + i) \pmod{\text{capacity}}$ for $i = 1, 2, \dots$
  - **Tombstone Sentinel (`<TOMBSTONE: DELETED>`)**: When a key is deleted, setting its slot to `None` would break probe chains for subsequent colliding keys. A tombstone sentinel preserves the chain while allowing future insertions to reclaim the vacant slot.
- **Demonstration**:
  - Deliberate collisions with sample project IDs (`PRJ-101`, `PRJ-108`, `PRJ-115`).
  - Search verification across tombstones after middle element deletion.
  - Slot reuse on new insertions and full-table rejection safeguards.

### 2. Priority Queue Using Binary Min-Heap (`priority_queue.py`)
- **Purpose**: Demonstrates urgency-based scheduling where high-priority deliverables are serviced before normal tasks.
- **Key Concepts**:
  - **Binary Min-Heap Invariant**: Root is always the minimum value ($O(1)$ peek). Sift-up and sift-down maintain the heap property in $O(\log N)$ time.
  - **Stable FIFO Tie-Breaker**: Uses an internal sequence counter `(priority, counter, item)`. When two tasks share identical priority (e.g., both Priority 2), the counter guarantees that earlier arrivals are processed first, preventing unpredictable reordering.
- **Demonstration**:
  - Enqueuing academic review tasks with priorities: 1 (Urgent/Overdue), 2 (Milestone Due Today), 3 (Early Draft).
  - Verifying FIFO servicing for items with identical priority values.
  - Safe error handling on empty queue dequeue attempts.

### 3. Standard FIFO Queue (`normal_queue.py`)
- **Purpose**: Demonstrates pure First-In, First-Out (FIFO) linear order for standard submission and presentation queues.
- **Key Concepts**:
  - **Why `collections.deque` over Python `list`**: A standard Python list's `pop(0)` is $O(N)$ because every remaining element shifts left in memory. `collections.deque` uses a doubly-linked list of fixed-size memory blocks, guaranteeing true $O(1)$ enqueue (`append`) and $O(1)$ dequeue (`popleft`).
- **Demonstration**:
  - Student lab presentation sign-up and evaluation in arrival order.
  - Front and rear inspection without mutation.
  - Empty state inspection and exception handling.

### 4. Prefix Tree (Trie) for Autocomplete (`trie_autocomplete.py`)
- **Purpose**: Demonstrates character-by-character retrieval trees for instant search suggestions and prefix matching.
- **Key Concepts**:
  - **Prefix Sharing**: Shared character prefixes share ancestor nodes, avoiding redundant string allocations.
  - **Two-Phase Autocomplete**:
    1. Downward traversal along the prefix path ($O(P)$).
    2. Depth-First Search (DFS) from the prefix node to gather all completed descendant words ($O(K)$).
- **Demonstration**:
  - Indexing technical topic keywords (`blockchain`, `database`, `data structures`, `deep learning`, etc.).
  - Autocomplete queries for matching prefixes (`block`, `data`, `dist`).
  - Safe empty results for non-existent prefixes (`quantum`, `xyz`).

---

## How to Run the Demonstrations

All files are executable directly from the repository root or from within the `DSA_Demonstration/` directory using standard Python 3:

```bash
# 1. Run Hash Table Linear Probing Demo
python DSA_Demonstration/hashing_linear_probing.py

# 2. Run Priority Queue Demo
python DSA_Demonstration/priority_queue.py

# 3. Run Standard FIFO Queue Demo
python DSA_Demonstration/normal_queue.py

# 4. Run Trie Autocomplete Demo
python DSA_Demonstration/trie_autocomplete.py
```

---

## Strict Isolation Notice
These demonstration scripts are purely academic implementations created for faculty review. They are strictly decoupled from NexaVault's operational FastAPI backend, SQLAlchemy ORM models, Alembic migrations, and frontend UI.
