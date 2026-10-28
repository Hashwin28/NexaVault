"""
=============================================================================
DSA Demonstration: Prefix Tree (Trie) for Fast Autocomplete
=============================================================================
Course: 23AID204-A Data Structures and Algorithms
Purpose: Demonstrates a specialized retrieval tree (Trie) where nodes store
         characters along shared prefix paths, enabling ultra-fast prefix search
         and autocomplete query completion.

Key Algorithmic Concepts:
  1. Trie Node Representation:
     Each TrieNode consists of:
       - `children`: A dictionary mapping character -> child TrieNode.
       - `is_end_of_word`: Boolean flag indicating if node terminates a valid word.
       - Common prefixes share ancestral nodes, eliminating duplicate prefix storage.

  2. Autocomplete Algorithm:
     Step A: Traverse the Trie following the characters of the target prefix.
             If a character is missing, prefix does not exist -> return [] (O(P)).
     Step B: Once at the terminal prefix node, execute Depth-First Search (DFS)
             or Breadth-First Search (BFS) over all downstream branches to
             collect all descendant words (O(K)).

Time Complexities:
  - Insertion             : O(L) - where L is length of word being inserted
  - Exact Search          : O(L) - independent of total words in dictionary!
  - Prefix Existence Check: O(P) - where P is length of prefix
  - Autocomplete Search   : O(P + K) - where P = prefix length, K = number of nodes in prefix subtree
  - Space Complexity      : O(Alphabet_Size * Average_Word_Length * Total_Words)
=============================================================================
"""

from typing import Dict, List, Optional


class TrieNode:
    """
    Represents an individual node in the Prefix Tree (Trie).
    Each node stores branches to child nodes via a dictionary.
    """

    def __init__(self):
        # Maps single character string -> TrieNode
        self.children: Dict[str, "TrieNode"] = {}
        # True if this node marks the end of a complete word
        self.is_end_of_word: bool = False
        # Optional metadata: word usage frequency or description
        self.metadata: Optional[str] = None


class Trie:
    """
    Prefix Tree (Trie) providing fast insertion, prefix matching, and word suggestions.
    """

    def __init__(self):
        """Initializes an empty Trie with a root node."""
        self.root: TrieNode = TrieNode()
        self.word_count: int = 0

    def insert(self, word: str, metadata: Optional[str] = None) -> None:
        """
        Inserts a word into the Trie character-by-character.
        Normalizes input to lowercase for case-insensitive matching.

        Time Complexity: O(L) where L is length of the word.
        """
        if not word or not isinstance(word, str):
            return

        normalized = word.strip().lower()
        if not normalized:
            return

        current = self.root
        for char in normalized:
            # If the branch does not exist, create a new TrieNode
            if char not in current.children:
                current.children[char] = TrieNode()
            current = current.children[char]

        # Mark the last node as the termination of a complete word
        if not current.is_end_of_word:
            current.is_end_of_word = True
            current.metadata = metadata
            self.word_count += 1
            print(f"[INSERTED] Added word: '{normalized}' (Total words: {self.word_count})")
        else:
            print(f"[EXISTS] Word '{normalized}' was already present in the Trie.")

    def search(self, word: str) -> bool:
        """
        Checks whether an exact word exists in the Trie.

        Time Complexity: O(L) where L is length of word.
        """
        if not word or not isinstance(word, str):
            return False

        normalized = word.strip().lower()
        current = self.root

        for char in normalized:
            if char not in current.children:
                return False
            current = current.children[char]

        return current.is_end_of_word

    def starts_with(self, prefix: str) -> bool:
        """
        Returns True if there is any word in the Trie that starts with the given prefix.

        Time Complexity: O(P) where P is length of prefix.
        """
        if not prefix or not isinstance(prefix, str):
            return False

        normalized = prefix.strip().lower()
        current = self.root

        for char in normalized:
            if char not in current.children:
                return False
            current = current.children[char]

        return True

    def autocomplete(self, prefix: str, max_results: int = 10) -> List[str]:
        """
        Finds and returns all words in the Trie that begin with the specified prefix.
        Traverses to the prefix node, then uses DFS to gather descendant words.

        Time Complexity: O(P + K) where P is prefix length and K is nodes in subtree.
        """
        if not prefix or not isinstance(prefix, str):
            return []

        normalized = prefix.strip().lower()
        current = self.root

        # Phase 1: Traverse down the prefix path (O(P))
        for char in normalized:
            if char not in current.children:
                # Prefix does not exist in the Trie
                return []
            current = current.children[char]

        # Phase 2: DFS from the prefix terminal node to collect matching words (O(K))
        results: List[str] = []

        def _dfs(node: TrieNode, current_path: List[str]) -> None:
            if len(results) >= max_results:
                return

            if node.is_end_of_word:
                results.append("".join(current_path))

            # Alphabetically sorted exploration for deterministic, readable output
            for next_char in sorted(node.children.keys()):
                current_path.append(next_char)
                _dfs(node.children[next_char], current_path)
                current_path.pop()  # Backtrack

        _dfs(current, list(normalized))
        return results

    def get_all_words(self) -> List[str]:
        """Returns every word stored in the Trie in lexicographical order."""
        return self.autocomplete(prefix="", max_results=1000)


# =============================================================================
# Demonstration Script
# =============================================================================
if __name__ == "__main__":
    print("=" * 70)
    print(" DEMONSTRATION: Prefix Tree (Trie) for Fast Autocomplete ")
    print("=" * 70)

    trie = Trie()

    # Academic & Computer Science Project Topics
    topics = [
        "blockchain",
        "block cipher",
        "block storage",
        "database",
        "data mining",
        "data structures",
        "deep learning",
        "distributed computing",
        "distributed ledger",
        "distributed systems",
        "neural network",
        "network security",
    ]

    print("\n>>> STEP 1: Populating the Trie with Domain Keywords")
    for topic in topics:
        trie.insert(topic)

    print(f"\nTotal vocabulary size stored in Trie: {trie.word_count} words.")

    print("\n>>> STEP 2: Testing Exact Word Search (O(L))")
    queries = ["blockchain", "data structures", "quantum computing", "deep"]
    for q in queries:
        found = trie.search(q)
        status = "[EXACT MATCH FOUND]" if found else "[NOT FOUND]"
        print(f"  {status:20}: '{q}'")

    print("\n>>> STEP 3: Demonstrating Prefix Autocomplete (O(P + K))")
    test_prefixes = ["block", "data", "dist", "net", "neu"]
    for pref in test_prefixes:
        suggestions = trie.autocomplete(pref)
        print(f"\nPrefix '{pref}' -> {len(suggestions)} suggestion(s):")
        for idx, sug in enumerate(suggestions, 1):
            print(f"    {idx}. {sug}")

    print("\n>>> STEP 4: Demonstrating Non-Matching / Invalid Prefixes")
    non_matching = ["xyz", "quantum", "cloud", "123"]
    for pref in non_matching:
        suggestions = trie.autocomplete(pref)
        print(f"Prefix '{pref}': {suggestions} -> [NO MATCHES FOUND - Safe Empty Result]")

    print("\n>>> STEP 5: Testing Case-Insensitive Matching and Whitespace Stripping")
    print("Prefix '  BLoCK  ':", trie.autocomplete("  BLoCK  "))

    print("\n" + "=" * 70)
    print(" TRIE AUTOCOMPLETE DEMONSTRATION COMPLETE ")
    print("=" * 70)
