# Immutable revisions with per-Review-Type fingerprints

Content Items and Learning Layers are stored as a parent row pointing at its current draft and current published Revision, with every save appending an immutable Revision holding a full snapshot (segments, annotations and activities included). Each Revision stores one hash per Review Type over the fields that type covers, so carrying an approval forward (ADR-0003) is a hash comparison rather than a diff. Segments, annotations and activities keep stable IDs across Revisions so saved vocabulary and learner progress can follow them. We rejected mutable rows plus an audit log because exact-revision approval, rollback to a valid approved Revision (VCMS-05) and reconstructable exports (VAC-09) all become reconstruction problems instead of lookups.

## Consequences

The same fingerprints drive learner-progress migration when a new Revision publishes: an activity completion carries over only if that activity's fingerprint is unchanged (otherwise it is kept but labelled "completed on an earlier version"); watch position carries over if its segment still exists; saved vocabulary keeps its source Revision and shows an "updated" note when the expression changed.

Revision rows are write-once, enforced by a database trigger that refuses any UPDATE (1a-04). Anything that belongs to a Revision but is only known later, such as its review state and Review Approvals, is therefore stored in its own rows referencing the Revision, never as columns updated on it. The per-Review-Type fingerprints are computed when the Revision is written. Deleting Revisions is left to the deletion ledger (ADR-0009).
