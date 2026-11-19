use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub method: String,
    pub url: String,
    pub status: Option<i32>,
    pub status_text: Option<String>,
    pub time_ms: Option<i64>,
    pub size_bytes: Option<i64>,
    pub timestamp: String,
    pub collection_path: Option<String>,
    pub request_name: Option<String>,
    pub request_json: String,
}

pub struct HistoryDb {
    conn: Mutex<Connection>,
}

impl HistoryDb {
    /// Open (or create) the history database at the given path.
    pub fn open(db_path: &Path) -> Result<Self, String> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create data directory: {e}"))?;
        }

        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open database: {e}"))?;

        // Enable WAL mode for crash resilience
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Failed to set WAL mode: {e}"))?;

        // Integrity check
        let integrity: String = conn
            .query_row("PRAGMA integrity_check;", [], |row| row.get(0))
            .map_err(|e| format!("Integrity check failed: {e}"))?;

        if integrity != "ok" {
            tracing::error!("Database integrity check failed: {integrity}");
            return Err(format!("Database corruption detected: {integrity}"));
        }

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    /// Run database migrations.
    fn migrate(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                method TEXT NOT NULL,
                url TEXT NOT NULL,
                status INTEGER,
                status_text TEXT,
                time_ms INTEGER,
                size_bytes INTEGER,
                timestamp TEXT NOT NULL,
                collection_path TEXT,
                request_name TEXT,
                request_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
            CREATE INDEX IF NOT EXISTS idx_history_method ON history(method);

            CREATE TABLE IF NOT EXISTS monitor_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monitor_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                total_requests INTEGER NOT NULL,
                total_passed INTEGER NOT NULL,
                total_failed INTEGER NOT NULL,
                total_time_ms INTEGER NOT NULL,
                status TEXT NOT NULL,
                error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_monitor_results_monitor ON monitor_results(monitor_id, timestamp DESC);",
        )
        .map_err(|e| format!("Migration failed: {e}"))?;
        Ok(())
    }

    /// Insert a new history entry.
    pub fn insert(&self, entry: &HistoryEntry) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "INSERT INTO history (method, url, status, status_text, time_ms, size_bytes, timestamp, collection_path, request_name, request_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                entry.method,
                entry.url,
                entry.status,
                entry.status_text,
                entry.time_ms,
                entry.size_bytes,
                entry.timestamp,
                entry.collection_path,
                entry.request_name,
                entry.request_json,
            ],
        )
        .map_err(|e| format!("Failed to insert history: {e}"))?;
        Ok(conn.last_insert_rowid())
    }

    /// List recent history entries (most recent first).
    pub fn list(&self, limit: i64, offset: i64) -> Result<Vec<HistoryEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, method, url, status, status_text, time_ms, size_bytes, timestamp, collection_path, request_name, request_json
                 FROM history ORDER BY timestamp DESC LIMIT ?1 OFFSET ?2",
            )
            .map_err(|e| format!("Query prepare failed: {e}"))?;

        let entries = stmt
            .query_map(params![limit, offset], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    method: row.get(1)?,
                    url: row.get(2)?,
                    status: row.get(3)?,
                    status_text: row.get(4)?,
                    time_ms: row.get(5)?,
                    size_bytes: row.get(6)?,
                    timestamp: row.get(7)?,
                    collection_path: row.get(8)?,
                    request_name: row.get(9)?,
                    request_json: row.get(10)?,
                })
            })
            .map_err(|e| format!("Query failed: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Row mapping failed: {e}"))?;

        Ok(entries)
    }

    /// Search history by URL substring.
    pub fn search(&self, query: &str, limit: i64) -> Result<Vec<HistoryEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let pattern = format!("%{query}%");
        let mut stmt = conn
            .prepare(
                "SELECT id, method, url, status, status_text, time_ms, size_bytes, timestamp, collection_path, request_name, request_json
                 FROM history WHERE url LIKE ?1 OR method LIKE ?1 OR request_name LIKE ?1
                 ORDER BY timestamp DESC LIMIT ?2",
            )
            .map_err(|e| format!("Query prepare failed: {e}"))?;

        let entries = stmt
            .query_map(params![pattern, limit], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    method: row.get(1)?,
                    url: row.get(2)?,
                    status: row.get(3)?,
                    status_text: row.get(4)?,
                    time_ms: row.get(5)?,
                    size_bytes: row.get(6)?,
                    timestamp: row.get(7)?,
                    collection_path: row.get(8)?,
                    request_name: row.get(9)?,
                    request_json: row.get(10)?,
                })
            })
            .map_err(|e| format!("Query failed: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Row mapping failed: {e}"))?;

        Ok(entries)
    }

    /// Get a single history entry by ID.
    pub fn get(&self, id: i64) -> Result<HistoryEntry, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.query_row(
            "SELECT id, method, url, status, status_text, time_ms, size_bytes, timestamp, collection_path, request_name, request_json
             FROM history WHERE id = ?1",
            params![id],
            |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    method: row.get(1)?,
                    url: row.get(2)?,
                    status: row.get(3)?,
                    status_text: row.get(4)?,
                    time_ms: row.get(5)?,
                    size_bytes: row.get(6)?,
                    timestamp: row.get(7)?,
                    collection_path: row.get(8)?,
                    request_name: row.get(9)?,
                    request_json: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("History entry not found: {e}"))
    }

    /// Clear all history.
    pub fn clear(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute("DELETE FROM history", [])
            .map_err(|e| format!("Failed to clear history: {e}"))?;
        Ok(())
    }

    /// Write a self-consistent snapshot of the live database to `dest`.
    ///
    /// The file is produced by `VACUUM INTO`, so rows still sitting in the WAL
    /// (not yet checkpointed) are included. Copying `data.db` byte-for-byte
    /// would miss them.
    pub fn export_snapshot(&self, dest: &Path) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        // VACUUM INTO refuses to overwrite an existing file.
        let _ = std::fs::remove_file(dest);
        let quoted = dest.to_string_lossy().replace('\'', "''");
        conn.execute(&format!("VACUUM INTO '{quoted}'"), [])
            .map_err(|e| format!("Failed to snapshot history DB: {e}"))?;
        Ok(())
    }

    /// Replace the contents of the live database with another database file.
    ///
    /// Overwriting `data.db` while a connection is open truncates the file
    /// under it and leaves a stale `-wal` behind, which SQLite may then report
    /// as corruption on next open. Attaching the source and copying tables in
    /// a single transaction keeps the existing connection (and its WAL) valid.
    pub fn replace_from(&self, source: &Path) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let quoted = source.to_string_lossy().replace('\'', "''");
        conn.execute_batch(&format!("ATTACH DATABASE '{quoted}' AS incoming"))
            .map_err(|e| format!("Failed to attach imported history DB: {e}"))?;

        let result = conn.execute_batch(
            "BEGIN IMMEDIATE;
             DELETE FROM history;
             INSERT INTO history (id, method, url, status, status_text, time_ms,
                                  size_bytes, timestamp, collection_path,
                                  request_name, request_json)
                SELECT id, method, url, status, status_text, time_ms,
                       size_bytes, timestamp, collection_path,
                       request_name, request_json
                FROM incoming.history;
             DELETE FROM monitor_results;
             INSERT INTO monitor_results (id, monitor_id, timestamp, total_requests,
                                          total_passed, total_failed, total_time_ms,
                                          status, error)
                SELECT id, monitor_id, timestamp, total_requests, total_passed,
                       total_failed, total_time_ms, status, error
                FROM incoming.monitor_results;
             COMMIT;",
        );

        // Detach regardless of outcome; a failure here must not mask the copy error.
        let detach = conn.execute_batch("DETACH DATABASE incoming");
        result.map_err(|e| format!("Failed to import history DB: {e}"))?;
        detach.map_err(|e| format!("Failed to detach imported history DB: {e}"))?;
        Ok(())
    }

    /// Delete a single history entry.
    pub fn delete(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute("DELETE FROM history WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete history entry: {e}"))?;
        Ok(())
    }

    /// Insert a monitor result.
    pub fn insert_monitor_result(
        &self,
        result: &crate::scheduler::MonitorResult,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "INSERT INTO monitor_results (monitor_id, timestamp, total_requests, total_passed, total_failed, total_time_ms, status, error)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                result.monitor_id,
                result.timestamp,
                result.total_requests as i64,
                result.total_passed as i64,
                result.total_failed as i64,
                result.total_time_ms as i64,
                result.status,
                result.error,
            ],
        )
        .map_err(|e| format!("Failed to insert monitor result: {e}"))?;
        Ok(())
    }

    /// Get monitor results for a specific monitor.
    pub fn get_monitor_results(
        &self,
        monitor_id: &str,
        limit: usize,
    ) -> Result<Vec<crate::scheduler::MonitorResult>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, monitor_id, timestamp, total_requests, total_passed, total_failed, total_time_ms, status, error
                 FROM monitor_results WHERE monitor_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
            )
            .map_err(|e| format!("Prepare failed: {e}"))?;

        let results = stmt
            .query_map(params![monitor_id, limit as i64], |row| {
                Ok(crate::scheduler::MonitorResult {
                    id: row.get(0)?,
                    monitor_id: row.get(1)?,
                    timestamp: row.get(2)?,
                    total_requests: row.get::<_, i64>(3)? as usize,
                    total_passed: row.get::<_, i64>(4)? as usize,
                    total_failed: row.get::<_, i64>(5)? as usize,
                    total_time_ms: row.get::<_, i64>(6)? as u64,
                    status: row.get(7)?,
                    error: row.get(8)?,
                })
            })
            .map_err(|e| format!("Query failed: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Row error: {e}"))?;

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(url: &str) -> HistoryEntry {
        HistoryEntry {
            id: 0,
            method: "GET".to_string(),
            url: url.to_string(),
            status: Some(200),
            status_text: Some("OK".to_string()),
            time_ms: Some(5),
            size_bytes: Some(12),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            collection_path: None,
            request_name: None,
            request_json: "{}".to_string(),
        }
    }

    #[test]
    fn snapshot_contains_rows_still_in_the_wal() {
        let dir = tempfile::tempdir().unwrap();
        let db = HistoryDb::open(&dir.path().join("data.db")).unwrap();
        db.insert(&entry("https://api.test/a")).unwrap();

        let snapshot = dir.path().join("snapshot.db");
        db.export_snapshot(&snapshot).unwrap();

        let copy = HistoryDb::open(&snapshot).unwrap();
        let rows = copy.list(10, 0).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].url, "https://api.test/a");
    }

    #[test]
    fn replace_from_swaps_contents_without_breaking_the_connection() {
        let dir = tempfile::tempdir().unwrap();
        let live = HistoryDb::open(&dir.path().join("data.db")).unwrap();
        live.insert(&entry("https://api.test/old")).unwrap();

        // Build a second database holding different rows.
        let other_path = dir.path().join("incoming.db");
        let other = HistoryDb::open(&other_path).unwrap();
        other.insert(&entry("https://api.test/new-1")).unwrap();
        other.insert(&entry("https://api.test/new-2")).unwrap();
        // Close it so the file can be attached cleanly.
        drop(other);

        live.replace_from(&other_path).unwrap();

        // The same handle must still work afterwards.
        let rows = live.list(10, 0).unwrap();
        assert_eq!(rows.len(), 2);
        assert!(rows.iter().any(|r| r.url == "https://api.test/new-2"));
        live.insert(&entry("https://api.test/after")).unwrap();
        assert_eq!(live.list(10, 0).unwrap().len(), 3);
    }
}
