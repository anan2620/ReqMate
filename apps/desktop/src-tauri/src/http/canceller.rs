use std::collections::HashMap;
use std::sync::Mutex;

use tokio::sync::watch;

/// Tracks in-flight HTTP requests so the UI can abort them instead of waiting
/// for the full timeout.
///
/// The frontend owns the id (one per tab), so a second send from the same tab
/// supersedes the previous one instead of leaving two requests racing for the
/// same response area.
#[derive(Default)]
pub struct RequestCanceller {
    entries: Mutex<HashMap<String, watch::Sender<bool>>>,
}

impl RequestCanceller {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register an in-flight request and return the receiver it should watch.
    ///
    /// Re-using an id aborts whatever was registered under it before, which is
    /// what a "send again while loading" should do.
    pub fn register(&self, id: &str) -> watch::Receiver<bool> {
        let (tx, rx) = watch::channel(false);
        if let Ok(mut entries) = self.entries.lock() {
            if let Some(previous) = entries.insert(id.to_string(), tx) {
                let _ = previous.send(true);
            }
        }
        rx
    }

    /// Ask the request registered under `id` to stop.
    ///
    /// Returns `false` when nothing is in flight any more, so the caller can
    /// tell the user "too late" instead of pretending the request was aborted.
    pub fn cancel(&self, id: &str) -> bool {
        let Ok(entries) = self.entries.lock() else {
            return false;
        };
        match entries.get(id) {
            Some(tx) => tx.send(true).is_ok(),
            None => false,
        }
    }

    /// Forget the registration once the request settled (success, error or cancel).
    pub fn finish(&self, id: &str) {
        if let Ok(mut entries) = self.entries.lock() {
            entries.remove(id);
        }
    }

    /// Number of requests currently in flight — used by tests.
    #[cfg(test)]
    pub fn in_flight(&self) -> usize {
        self.entries.lock().map(|e| e.len()).unwrap_or(0)
    }
}

/// Removes the registration when the request future is dropped for any reason,
/// including early `?` returns.
pub struct CancelGuard<'a> {
    canceller: &'a RequestCanceller,
    id: String,
}

impl<'a> CancelGuard<'a> {
    pub fn new(canceller: &'a RequestCanceller, id: &str) -> Self {
        Self {
            canceller,
            id: id.to_string(),
        }
    }
}

impl Drop for CancelGuard<'_> {
    fn drop(&mut self) {
        self.canceller.finish(&self.id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_cancel_finish_roundtrip() {
        let canceller = RequestCanceller::new();
        let rx = canceller.register("tab-1");

        assert!(!*rx.borrow());
        assert_eq!(canceller.in_flight(), 1);
        assert!(canceller.cancel("tab-1"));

        // The signal lands in the channel; the request future sees it on next poll.
        assert!(*rx.borrow());
    }

    #[test]
    fn cancelling_an_unknown_request_reports_false() {
        let canceller = RequestCanceller::new();
        assert!(!canceller.cancel("nope"));
    }

    #[test]
    fn finishing_removes_the_registration() {
        let canceller = RequestCanceller::new();
        let _rx = canceller.register("tab-1");
        canceller.finish("tab-1");
        assert_eq!(canceller.in_flight(), 0);
        assert!(!canceller.cancel("tab-1"));
    }

    #[test]
    fn guard_cleans_up_after_itself() {
        let canceller = RequestCanceller::new();
        {
            let _rx = canceller.register("tab-1");
            let _guard = CancelGuard::new(&canceller, "tab-1");
            assert_eq!(canceller.in_flight(), 1);
        }
        assert_eq!(canceller.in_flight(), 0);
    }

    #[test]
    fn re_registering_the_same_id_supersedes_the_old_request() {
        let canceller = RequestCanceller::new();
        let first = canceller.register("tab-1");
        let _second = canceller.register("tab-1");

        // Dropping the replaced sender wakes the stale request up as cancelled.
        assert!(first.has_changed().is_err());
        assert_eq!(canceller.in_flight(), 1);
    }
}
