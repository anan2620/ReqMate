use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub is_clean: bool,
    pub ahead: i32,
    pub behind: i32,
    pub remote: Option<String>,
    pub changes: Vec<GitChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLogEntry {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

fn run_git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(stderr.trim().to_string())
    }
}

#[tauri::command]
pub async fn git_status(collection_path: String) -> Result<GitStatus, String> {
    let path = Path::new(&collection_path);

    if !path.join(".git").exists() {
        return Ok(GitStatus {
            is_repo: false,
            branch: String::new(),
            is_clean: true,
            ahead: 0,
            behind: 0,
            remote: None,
            changes: vec![],
        });
    }

    // Remote of the default remote, shown in the Git config section
    let remote = run_git(path, &["remote", "get-url", "origin"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    // Check if there are any commits
    let has_commits = run_git(path, &["rev-parse", "HEAD"]).is_ok();

    // Get branch
    let branch = if has_commits {
        run_git(path, &["rev-parse", "--abbrev-ref", "HEAD"])
            .unwrap_or_default()
            .trim()
            .to_string()
    } else {
        "main".to_string()
    };

    // Get ahead/behind (only if there are commits and a remote)
    let (ahead, behind) = if has_commits {
        get_ahead_behind(path)
    } else {
        (0, 0)
    };

    // Get status
    let status_output = run_git(path, &["status", "--porcelain"])?;
    let changes: Vec<GitChange> = status_output
        .lines()
        .filter(|l| l.len() >= 3)
        .map(|line| {
            let staged_char = line.chars().next().unwrap_or(' ');
            let unstaged_char = line.chars().nth(1).unwrap_or(' ');
            let file_path = line[3..].trim().to_string();

            let status = match (staged_char, unstaged_char) {
                ('?', '?') => "untracked",
                ('A', _) => "added",
                ('D', _) | (_, 'D') => "deleted",
                ('R', _) => "renamed",
                ('M', _) | (_, 'M') => "modified",
                _ => "modified",
            };

            let staged = staged_char != ' ' && staged_char != '?';

            GitChange {
                path: file_path,
                status: status.to_string(),
                staged,
            }
        })
        .collect();

    Ok(GitStatus {
        is_repo: true,
        branch,
        is_clean: changes.is_empty(),
        ahead,
        behind,
        remote,
        changes,
    })
}

#[tauri::command]
pub async fn git_stage(collection_path: String, paths: Vec<String>) -> Result<(), String> {
    let dir = Path::new(&collection_path);
    for p in &paths {
        run_git(dir, &["add", p])?;
    }
    Ok(())
}

#[tauri::command]
pub async fn git_unstage(collection_path: String, paths: Vec<String>) -> Result<(), String> {
    let dir = Path::new(&collection_path);
    let has_commits = run_git(dir, &["rev-parse", "HEAD"]).is_ok();
    for p in &paths {
        if has_commits {
            run_git(dir, &["reset", "HEAD", p])?;
        } else {
            run_git(dir, &["rm", "--cached", p])?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn git_commit(collection_path: String, message: String) -> Result<String, String> {
    let dir = Path::new(&collection_path);
    run_git(dir, &["commit", "-m", &message])
}

#[tauri::command]
pub async fn git_push(collection_path: String) -> Result<String, String> {
    let dir = Path::new(&collection_path);

    // Freshly initialised repos have no upstream yet — bind it on first push so
    // configuring a remote is enough to get the branch published.
    let has_upstream = run_git(
        dir,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    )
    .is_ok();
    let has_origin = run_git(dir, &["remote", "get-url", "origin"]).is_ok();

    if !has_upstream && has_origin {
        run_git(dir, &["push", "-u", "origin", "HEAD"])
    } else {
        run_git(dir, &["push"])
    }
}

/// Points `origin` at the given URL, adding the remote when it does not exist.
#[tauri::command]
pub async fn git_set_remote(collection_path: String, url: String) -> Result<(), String> {
    let dir = Path::new(&collection_path);
    if !dir.join(".git").exists() {
        return Err("Not a git repository".to_string());
    }

    let url = url.trim();
    if url.is_empty() {
        return Err("Remote URL is empty".to_string());
    }

    if run_git(dir, &["remote", "get-url", "origin"]).is_ok() {
        run_git(dir, &["remote", "set-url", "origin", url])?;
    } else {
        run_git(dir, &["remote", "add", "origin", url])?;
    }

    Ok(())
}

#[tauri::command]
pub async fn git_pull(collection_path: String) -> Result<String, String> {
    let dir = Path::new(&collection_path);
    run_git(dir, &["pull"])
}

#[tauri::command]
pub async fn git_diff(
    collection_path: String,
    file_path: Option<String>,
) -> Result<String, String> {
    let dir = Path::new(&collection_path);
    match file_path {
        Some(ref fp) => run_git(dir, &["diff", "--", fp]),
        None => run_git(dir, &["diff"]),
    }
}

#[tauri::command]
pub async fn git_log(
    collection_path: String,
    limit: Option<u32>,
) -> Result<Vec<GitLogEntry>, String> {
    let dir = Path::new(&collection_path);
    let limit_str = format!("-{}", limit.unwrap_or(50));
    let output = run_git(
        dir,
        &["log", &limit_str, "--pretty=format:%h\t%s\t%an\t%ai"],
    )?;

    let entries = output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.splitn(4, '\t').collect();
            GitLogEntry {
                hash: parts.first().unwrap_or(&"").to_string(),
                message: parts.get(1).unwrap_or(&"").to_string(),
                author: parts.get(2).unwrap_or(&"").to_string(),
                date: parts.get(3).unwrap_or(&"").to_string(),
            }
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub async fn git_init(collection_path: String) -> Result<String, String> {
    let dir = Path::new(&collection_path);
    run_git(dir, &["init"])
}

/// Removes the Git configuration of a collection by deleting its `.git`
/// entry. Files inside the collection are left untouched — only the local
/// repository (and with it the commit history) is dropped.
#[tauri::command]
pub async fn git_remove_config(collection_path: String) -> Result<(), String> {
    let git_entry = Path::new(&collection_path).join(".git");

    if !git_entry.exists() && !git_entry.is_symlink() {
        return Ok(());
    }

    let result = if git_entry.is_dir() {
        std::fs::remove_dir_all(&git_entry)
    } else {
        // Worktrees keep `.git` as a pointer file
        std::fs::remove_file(&git_entry)
    };

    result.map_err(|e| format!("Failed to remove git config: {e}"))
}

fn get_ahead_behind(dir: &Path) -> (i32, i32) {
    let output = run_git(
        dir,
        &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    );
    match output {
        Ok(s) => {
            let parts: Vec<&str> = s.trim().split('\t').collect();
            let behind = parts.first().and_then(|p| p.parse().ok()).unwrap_or(0);
            let ahead = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0);
            (ahead, behind)
        }
        Err(_) => (0, 0),
    }
}
