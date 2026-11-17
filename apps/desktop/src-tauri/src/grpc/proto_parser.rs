use std::path::Path;

use prost_reflect::DescriptorPool;
use protox::Compiler;

use super::{GrpcCallType, GrpcMethodInfo, GrpcServiceInfo};

/// Parse .proto files from a path (file or directory) and return service info.
pub fn parse_proto_file(
    proto_path: &str,
) -> Result<(Vec<GrpcServiceInfo>, DescriptorPool), String> {
    let path = Path::new(proto_path);

    if !path.exists() {
        return Err(format!("Proto file not found: {proto_path}"));
    }

    // Collect proto files
    let proto_files = if path.is_dir() {
        collect_proto_files(path)?
    } else {
        vec![path.to_path_buf()]
    };

    if proto_files.is_empty() {
        return Err("No .proto files found".to_string());
    }

    // Use protox to compile protos into FileDescriptorSet.
    // When given a directory, that directory is the include path; for a single
    // file it is the containing directory.
    let include_dir = if path.is_dir() {
        path.to_path_buf()
    } else {
        path.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    let mut compiler = Compiler::new(vec![include_dir])
        .map_err(|e| format!("Failed to create proto compiler: {e}"))?;

    for proto in &proto_files {
        let name = proto
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        compiler
            .open_file(name.as_str())
            .map_err(|e| format!("Failed to open proto {name}: {e}"))?;
    }

    let fds = compiler.file_descriptor_set();

    let pool = DescriptorPool::from_file_descriptor_set(fds)
        .map_err(|e| format!("Failed to build descriptor pool: {e}"))?;

    let services = extract_services(&pool);

    Ok((services, pool))
}

fn extract_services(pool: &DescriptorPool) -> Vec<GrpcServiceInfo> {
    pool.services()
        .map(|svc| {
            let methods = svc
                .methods()
                .map(|m| {
                    let call_type = match (m.is_client_streaming(), m.is_server_streaming()) {
                        (false, false) => GrpcCallType::Unary,
                        (false, true) => GrpcCallType::ServerStreaming,
                        (true, false) => GrpcCallType::ClientStreaming,
                        (true, true) => GrpcCallType::BidiStreaming,
                    };
                    GrpcMethodInfo {
                        name: m.name().to_string(),
                        full_name: m.full_name().to_string(),
                        input_type: m.input().full_name().to_string(),
                        output_type: m.output().full_name().to_string(),
                        call_type,
                    }
                })
                .collect();

            GrpcServiceInfo {
                name: svc.name().to_string(),
                full_name: svc.full_name().to_string(),
                methods,
            }
        })
        .collect()
}

fn collect_proto_files(dir: &Path) -> Result<Vec<std::path::PathBuf>, String> {
    let mut files = vec![];
    for entry in std::fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {e}"))? {
        let entry = entry.map_err(|e| format!("Dir entry error: {e}"))?;
        let path = entry.path();
        if path.is_file() && path.extension().map(|e| e == "proto").unwrap_or(false) {
            files.push(path);
        }
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::parse_proto_file;
    use crate::grpc::GrpcCallType;

    const ECHO_PROTO: &str = r#"
syntax = "proto3";

package test.v1;

message EchoRequest {
  string message = 1;
}

message EchoReply {
  string message = 1;
}

service EchoService {
  rpc Unary (EchoRequest) returns (EchoReply);
  rpc ServerStream (EchoRequest) returns (stream EchoReply);
  rpc ClientStream (stream EchoRequest) returns (EchoReply);
  rpc BidiStream (stream EchoRequest) returns (stream EchoReply);
}
"#;

    fn write_proto(dir: &std::path::Path) -> String {
        let path = dir.join("echo.proto");
        std::fs::write(&path, ECHO_PROTO).expect("write proto");
        path.to_string_lossy().to_string()
    }

    #[test]
    fn parses_services_and_all_four_call_types() {
        let dir = tempfile::tempdir().expect("tempdir");
        let (services, pool) =
            parse_proto_file(&write_proto(dir.path())).expect("proto should parse");

        assert_eq!(services.len(), 1);
        let service = &services[0];
        assert_eq!(service.name, "EchoService");
        assert_eq!(service.full_name, "test.v1.EchoService");
        assert_eq!(service.methods.len(), 4);

        let method = |name: &str| {
            service
                .methods
                .iter()
                .find(|m| m.name == name)
                .unwrap_or_else(|| panic!("method {name} missing"))
        };

        assert!(matches!(method("Unary").call_type, GrpcCallType::Unary));
        assert!(matches!(
            method("ServerStream").call_type,
            GrpcCallType::ServerStreaming
        ));
        assert!(matches!(
            method("ClientStream").call_type,
            GrpcCallType::ClientStreaming
        ));
        assert!(matches!(
            method("BidiStream").call_type,
            GrpcCallType::BidiStreaming
        ));

        assert_eq!(method("Unary").input_type, "test.v1.EchoRequest");
        assert_eq!(method("Unary").output_type, "test.v1.EchoReply");

        // The descriptor pool is handed to the client for message encoding
        assert!(pool.get_message_by_name("test.v1.EchoReply").is_some());
    }

    #[test]
    fn parses_a_directory_of_protos() {
        let dir = tempfile::tempdir().expect("tempdir");
        write_proto(dir.path());

        let (services, _) =
            parse_proto_file(&dir.path().to_string_lossy()).expect("directory should parse");
        assert_eq!(services.len(), 1);
    }

    #[test]
    fn missing_proto_path_is_an_error() {
        let err = parse_proto_file("/definitely/not/here.proto").expect_err("should fail");
        assert!(err.contains("not found"), "unexpected error: {err}");
    }

    #[test]
    fn empty_directory_is_an_error() {
        let dir = tempfile::tempdir().expect("tempdir");
        let err = parse_proto_file(&dir.path().to_string_lossy()).expect_err("should fail");
        assert!(err.contains("No .proto files"), "unexpected error: {err}");
    }
}
