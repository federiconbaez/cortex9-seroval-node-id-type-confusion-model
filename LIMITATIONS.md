# Limitations

- **Not seroval.** The node format (`seq`, `stream`, `iter`, ...) is this
  model's own; it does not use seroval's numeric node types or JSON layout.
  The upstream regression tests (50926b3 L118-185) were used for the
  *shape* of the graphs, not copied.
- **Assumptions not in the diffs:** that `StreamConstructor` records its
  node type the way `Sequence` does (only stated in a comment, 50926b3
  L56-58); that `guardIndexedValue` behaves the same in every modelled
  version; how plugins are registered and called.
- **`v163`** comes only from the advisory sentence "Versions up to 1.6.3
  accept any value as the source". 1.6.4 ("rejects the reported payload")
  is not modelled: its mechanism is not in the saved sources.
- **Not verified:** cross-reference / `crossSerialize` modes; other node
  kinds that call methods on deserialized values; the serializer output
  itself (the model only classifies identity, it never builds a string).
- The sink is a counter. Whether a real application is exposed depends on
  its plugins (advisory "Impact"); nothing here shows that any real
  application is.
- This is not a finding and not an exploit.
