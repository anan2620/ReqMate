//! Incremental `text/event-stream` frame parser.
//!
//! Kept separate from the transport so the framing rules (multi-line `data`,
//! default event type, comments, CRLF) can be unit tested without a live
//! connection.

/// A single dispatched server-sent event.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseFrame {
    pub event_type: String,
    pub data: String,
    pub id: Option<String>,
}

/// Accumulates stream chunks and yields complete events.
pub struct SseParser {
    buffer: String,
    event_type: String,
    data: String,
    id: Option<String>,
}

impl Default for SseParser {
    fn default() -> Self {
        Self::new()
    }
}

impl SseParser {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            event_type: String::from("message"),
            data: String::new(),
            id: None,
        }
    }

    /// Feed a chunk of text; returns every event completed by it.
    pub fn push(&mut self, chunk: &str) -> Vec<SseFrame> {
        self.buffer.push_str(chunk);
        let mut frames = Vec::new();

        while let Some(newline_pos) = self.buffer.find('\n') {
            let line = self.buffer[..newline_pos].to_string();
            self.buffer = self.buffer[newline_pos + 1..].to_string();

            if let Some(frame) = self.handle_line(&line) {
                frames.push(frame);
            }
        }

        frames
    }

    /// Flush an event that was never terminated by a blank line (stream end).
    ///
    /// Also consumes a final line that has no trailing newline, which happens
    /// when a server closes the stream mid-line.
    pub fn finish(&mut self) -> Option<SseFrame> {
        if !self.buffer.is_empty() {
            let line = std::mem::take(&mut self.buffer);
            self.handle_line(&line);
        }

        let frame = self.dispatch();
        self.reset();
        frame
    }

    /// Apply one SSE line; returns a frame when the line dispatches an event.
    fn handle_line(&mut self, raw_line: &str) -> Option<SseFrame> {
        let line = raw_line.trim_end_matches('\r');

        if line.is_empty() {
            // Empty line dispatches the accumulated event
            let frame = self.dispatch();
            self.reset();
            return frame;
        }

        if let Some(value) = line.strip_prefix("data:") {
            let value = value.strip_prefix(' ').unwrap_or(value);
            self.data.push_str(value);
            self.data.push('\n');
        } else if let Some(value) = line.strip_prefix("event:") {
            self.event_type = value.strip_prefix(' ').unwrap_or(value).to_string();
        } else if let Some(value) = line.strip_prefix("id:") {
            self.id = Some(value.strip_prefix(' ').unwrap_or(value).to_string());
        }
        // Ignore "retry:" and comment lines (starting with ':')

        None
    }

    fn dispatch(&mut self) -> Option<SseFrame> {
        if self.data.is_empty() {
            return None;
        }

        // Remove the trailing newline added after the last data line
        if self.data.ends_with('\n') {
            self.data.pop();
        }

        Some(SseFrame {
            event_type: self.event_type.clone(),
            data: self.data.clone(),
            id: self.id.clone(),
        })
    }

    fn reset(&mut self) {
        self.event_type = String::from("message");
        self.data.clear();
        self.id = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frames(parser: &mut SseParser, chunk: &str) -> Vec<SseFrame> {
        parser.push(chunk)
    }

    #[test]
    fn parses_a_single_event() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "data: hello\n\n");

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].data, "hello");
        assert_eq!(out[0].event_type, "message");
        assert_eq!(out[0].id, None);
    }

    #[test]
    fn joins_multi_line_data_with_newlines() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "data: line1\ndata: line2\n\n");

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].data, "line1\nline2");
    }

    #[test]
    fn reads_event_type_and_id() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "event: update\nid: 42\ndata: payload\n\n");

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].event_type, "update");
        assert_eq!(out[0].id.as_deref(), Some("42"));
    }

    #[test]
    fn waits_for_the_blank_line_before_dispatching() {
        let mut parser = SseParser::new();

        assert!(frames(&mut parser, "data: partial\n").is_empty());
        let out = frames(&mut parser, "\n");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].data, "partial");
    }

    #[test]
    fn handles_events_split_across_chunks() {
        let mut parser = SseParser::new();

        assert!(frames(&mut parser, "da").is_empty());
        assert!(frames(&mut parser, "ta: split").is_empty());
        let out = frames(&mut parser, " across\n\n");

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].data, "split across");
    }

    #[test]
    fn parses_multiple_events_in_one_chunk() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "data: one\n\ndata: two\n\n");

        assert_eq!(out.len(), 2);
        assert_eq!(out[0].data, "one");
        assert_eq!(out[1].data, "two");
    }

    #[test]
    fn resets_event_type_between_events() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "event: custom\ndata: a\n\ndata: b\n\n");

        assert_eq!(out.len(), 2);
        assert_eq!(out[0].event_type, "custom");
        assert_eq!(out[1].event_type, "message");
    }

    #[test]
    fn ignores_comments_and_retry() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, ": keep-alive\nretry: 3000\ndata: real\n\n");

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].data, "real");
    }

    #[test]
    fn handles_crlf_line_endings() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "data: windows\r\n\r\n");

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].data, "windows");
    }

    #[test]
    fn empty_data_line_does_not_dispatch() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "data:\n\n");

        assert_eq!(out.len(), 1);
        assert_eq!(out[0].data, "");
    }

    #[test]
    fn no_data_means_no_event() {
        let mut parser = SseParser::new();
        let out = frames(&mut parser, "event: ping\n\n");

        assert!(out.is_empty());
    }

    #[test]
    fn finish_flushes_an_unterminated_event() {
        let mut parser = SseParser::new();
        assert!(frames(&mut parser, "data: last").is_empty());

        let frame = parser.finish().expect("trailing event should flush");
        assert_eq!(frame.data, "last");
        // After flushing, nothing is pending
        assert!(parser.finish().is_none());
    }
}
