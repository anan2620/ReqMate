use std::collections::HashMap;

use criterion::{black_box, criterion_group, criterion_main, Criterion};

use reqmate_lib::scripting::engine::execute_script;
use reqmate_lib::scripting::{RequestSnapshot, ResponseSnapshot, ScriptContext, ScriptPhase};

fn empty_context() -> ScriptContext {
    ScriptContext {
        request: RequestSnapshot {
            method: "GET".to_string(),
            url: "https://api.example.com/users".to_string(),
            headers: HashMap::new(),
            body: None,
        },
        response: None,
        env: HashMap::new(),
        globals: HashMap::new(),
        variables: HashMap::new(),
    }
}

fn context_with_response() -> ScriptContext {
    let mut ctx = empty_context();
    ctx.env
        .insert("baseUrl".to_string(), "https://api.example.com".to_string());
    ctx.env.insert("token".to_string(), "abc123".to_string());
    ctx.response = Some(ResponseSnapshot {
        status: 200,
        status_text: "OK".to_string(),
        headers: {
            let mut h = HashMap::new();
            h.insert("content-type".to_string(), "application/json".to_string());
            h.insert("x-request-id".to_string(), "req-123".to_string());
            h
        },
        body: r#"{"id": 1, "name": "Test User", "email": "test@example.com", "roles": ["admin", "user"]}"#.to_string(),
        time_ms: 150,
        size_bytes: 1024,
    });
    ctx
}

fn bench_scripting(c: &mut Criterion) {
    let mut group = c.benchmark_group("scripting");

    // Measure the overhead of just creating the runtime + injecting req API
    group.bench_function("empty_script_overhead", |b| {
        b.iter(|| {
            execute_script(
                black_box("var x = 1;"),
                empty_context(),
                ScriptPhase::PreRequest,
            )
            .unwrap()
        })
    });

    // Simple env mutation
    group.bench_function("env_set_single", |b| {
        b.iter(|| {
            execute_script(
                black_box(r#"req.env.set("token", "new-value");"#),
                empty_context(),
                ScriptPhase::PreRequest,
            )
            .unwrap()
        })
    });

    // Multiple env mutations
    group.bench_function("env_set_10_vars", |b| {
        let script = (0..10)
            .map(|i| format!(r#"req.env.set("var{i}", "value{i}");"#))
            .collect::<Vec<_>>()
            .join("\n");
        b.iter(|| {
            execute_script(black_box(&script), empty_context(), ScriptPhase::PreRequest).unwrap()
        })
    });

    // Test with assertion (post-response)
    group.bench_function("single_test_assertion", |b| {
        b.iter(|| {
            execute_script(
                black_box(
                    r#"
                    req.test("status is 200", function() {
                        req.expect(req.response.status).to.equal(200);
                    });
                    "#,
                ),
                context_with_response(),
                ScriptPhase::PostResponse,
            )
            .unwrap()
        })
    });

    // Multiple tests with JSON parsing
    group.bench_function("multiple_tests_with_json", |b| {
        b.iter(|| {
            execute_script(
                black_box(
                    r#"
                    var body = req.response.json();
                    req.test("has id", function() {
                        req.expect(body).to.have.property("id");
                    });
                    req.test("correct name", function() {
                        req.expect(body.name).to.equal("Test User");
                    });
                    req.test("has roles", function() {
                        req.expect(body.roles).to.include("admin");
                    });
                    req.test("response time ok", function() {
                        req.expect(req.response.time).to.be.below(1000);
                    });
                    "#,
                ),
                context_with_response(),
                ScriptPhase::PostResponse,
            )
            .unwrap()
        })
    });

    // Pre-request script modifying request
    group.bench_function("modify_request", |b| {
        b.iter(|| {
            execute_script(
                black_box(
                    r#"
                    req.request.setUrl("https://api.example.com/v2/users");
                    req.request.setHeader("X-Custom", "value");
                    req.request.setHeader("X-Timestamp", String(Date.now()));
                    req.env.set("lastRun", String(Date.now()));
                    "#,
                ),
                empty_context(),
                ScriptPhase::PreRequest,
            )
            .unwrap()
        })
    });

    group.finish();
}

criterion_group!(benches, bench_scripting);
criterion_main!(benches);
