---
name: export-to-nowledge
description: Export Minis chat sessions to Nowledge Mem as searchable threads, with incremental sync support. Use when the user says "导入对话", "导出到nowledge", "save conversation to nowledge", "export session", "增量导出", "同步对话", or wants to persist chat history into their Nowledge knowledge base.
---

# Export Minis Session to Nowledge Mem

> Bridge: Minis conversations → Nowledge Mem searchable threads, with incremental sync.

## When to Use

- User wants to save/export a conversation to Nowledge Mem
- User says "导入到nowledge", "导出对话", "记住这段对话", "save this to nowledge"
- User wants incremental sync: "增量导出", "同步新消息", "更新对话"
- End-of-session archiving

## Prerequisites

1. `nmem` CLI installed and connected (`nmem --json status` → `"status": "ok"`)
2. If not connected, run the `nowledge-check-integration` skill first
3. `minis-sessions-cli` available (built-in on Minis)

## Key Facts

- **`minis-sessions-cli list`** returns `message_count` that includes ALL internal messages (tool calls, system messages, etc.). This number is much larger than the user-visible conversation.
- **`minis-sessions-cli messages`** only returns user-visible messages (role: `user` or `assistant`). This is the actual exportable content.
- The `messages` API does NOT return all messages in a single call — pagination is required.
- **Title sync**: the `messages` API has no title field. Always get the session title from the `list` API and use it as the Nowledge thread title.
- **Message merging**: Minis may emit multiple consecutive assistant messages in a single turn (e.g. narration → tool call → result → summary). Since the user didn't reply between them, they MUST be merged into one message before exporting to Nowledge, separated by `\n\n`.

## State File

Incremental export is tracked via `/var/minis/workspace/nowledge-export-state.json`:

```json
{
  "sessions": {
    "<minis_session_id>": {
      "thread_id": "cli-xxx",
      "last_message_id": "UUID-of-last-exported-message",
      "last_export_at": "2026-05-28T19:00:00+08:00",
      "message_count": 15,
      "title": "Session Title from Minis"
    }
  }
}
```

## Pagination

The `messages` API returns a variable number of messages per call. Must paginate with `--offset` and `--limit 100`.

**Critical**: `total` may grow during an active conversation. Termination: keep paginating until a page returns 0 messages, OR offset ≥ total AND no new unique messages. Deduplicate by `message_id` across pages.

## Implementation

Write a Python helper script to `/tmp/nowledge_export.py`:

```python
import json, subprocess, sys, os
from datetime import datetime

STATE_FILE = "/var/minis/workspace/nowledge-export-state.json"
SESSION_ID = sys.argv[1]
SPACE = sys.argv[2] if len(sys.argv) > 2 else None

def fetch_all_messages(session_id):
    """Paginate through minis-sessions-cli to get ALL visible messages."""
    all_msgs = []
    seen_ids = set()
    offset = 0
    empty_pages = 0

    while empty_pages < 3:
        r = subprocess.run(
            ["minis-sessions-cli", "messages", "--id", session_id,
             "--full", "--compact", "--offset", str(offset), "--limit", "100"],
            capture_output=True, text=True
        )
        data = json.loads(r.stdout)["data"]
        msgs = data["messages"]

        if not msgs:
            empty_pages += 1
            if offset >= data.get("total", 0):
                break
            continue

        empty_pages = 0
        for m in msgs:
            if m["message_id"] not in seen_ids:
                seen_ids.add(m["message_id"])
                all_msgs.append(m)
        offset += len(msgs)
        if offset >= data.get("total", 0):
            break

    all_msgs.sort(key=lambda m: m["created_at"])
    return all_msgs

def merge_consecutive_messages(msgs):
    """Merge consecutive messages with the same role into one.

    In Minis, a single assistant turn may produce multiple messages
    (e.g. narration + tool call + result). Since the user didn't
    reply between them, they should be merged into one message in Nowledge.
    """
    if not msgs:
        return []
    merged = [{"role": msgs[0]["role"], "content": msgs[0]["text"],
               "last_message_id": msgs[0]["message_id"]}]
    for m in msgs[1:]:
        if m["role"] == merged[-1]["role"]:
            merged[-1]["content"] += "\n\n" + m["text"]
            merged[-1]["last_message_id"] = m["message_id"]
        else:
            merged.append({"role": m["role"], "content": m["text"],
                           "last_message_id": m["message_id"]})
    return merged

# Load state
state = {"sessions": {}}
if os.path.exists(STATE_FILE):
    with open(STATE_FILE) as f:
        state = json.load(f)

# Get session title from Minis list API (NOT from messages)
r_list = subprocess.run(
    ["minis-sessions-cli", "list", "--ids", SESSION_ID, "--compact"],
    capture_output=True, text=True
)
list_data = json.loads(r_list.stdout)["data"]
session_title = SESSION_ID
for s in list_data["sessions"]:
    if s["session_id"] == SESSION_ID:
        session_title = s["title"]
        break

# Fetch ALL messages with pagination
all_msgs = fetch_all_messages(SESSION_ID)

if not all_msgs:
    print(json.dumps({"error": "No messages found"}, ensure_ascii=False))
    sys.exit(1)

session_info = state["sessions"].get(SESSION_ID)

if session_info:
    # INCREMENTAL
    last_mid = session_info["last_message_id"]
    idx = next((i for i, m in enumerate(all_msgs) if m["message_id"] == last_mid), -1)
    new_msgs = all_msgs[idx + 1:] if idx >= 0 else all_msgs
    if not new_msgs:
        print(json.dumps({"mode": "incremental", "new": 0}, ensure_ascii=False))
        sys.exit(0)
    merged = merge_consecutive_messages(new_msgs)
    nmem_msgs = [{"role": m["role"], "content": m["content"]} for m in merged]
    thread_id = session_info["thread_id"]
    cmd = ["nmem", "--json", "t", "append", thread_id,
           "-m", json.dumps(nmem_msgs, ensure_ascii=False),
           "--idempotency-key", f"minis-{SESSION_ID}-{merged[-1]['last_message_id']}"]
    if SPACE:
        cmd.extend(["--space", SPACE])
    r2 = subprocess.run(cmd, capture_output=True, text=True)
    result = json.loads(r2.stdout)
    session_info["last_message_id"] = merged[-1]["last_message_id"]
    session_info["last_export_at"] = datetime.now().isoformat()
    session_info["message_count"] += len(merged)
else:
    # FULL — merge, then create with Minis session title
    merged = merge_consecutive_messages(all_msgs)
    nmem_msgs = [{"role": m["role"], "content": m["content"]} for m in merged]
    cmd = ["nmem", "--json", "t", "create", "-t", session_title,
           "-m", json.dumps(nmem_msgs, ensure_ascii=False), "-s", "minis"]
    if SPACE:
        cmd.extend(["--space", SPACE])
    r2 = subprocess.run(cmd, capture_output=True, text=True)
    result = json.loads(r2.stdout)
    state["sessions"][SESSION_ID] = {
        "thread_id": result["id"],
        "last_message_id": merged[-1]["last_message_id"],
        "last_export_at": datetime.now().isoformat(),
        "message_count": len(merged),
        "title": session_title
    }

with open(STATE_FILE, "w") as f:
    json.dump(state, f, indent=2, ensure_ascii=False)

result["mode"] = "incremental" if session_info else "full"
result["session_id"] = SESSION_ID
result["title"] = session_title
result["exported_messages"] = len(all_msgs)
result["merged_messages"] = len(merged)
print(json.dumps(result, ensure_ascii=False))
```

Run: `python3 /tmp/nowledge_export.py <session_id> [space_name]`

## Batch Export

```bash
minis-sessions-cli list --limit 20 --compact
```
Loop over each `session_id` with the Python script.

## Error Handling

| Error | Fix |
|-------|-----|
| `nmem: not found` | `pip3 install nmem-cli` |
| `connection_failed` | Check server; verify URL/key: `nmem config client show` |
| Fewer messages than expected | `message_count` ≠ visible messages; only user+assistant messages are exportable |
| `append` on deleted thread | Remove session from state file, re-export full |
| State file corrupted | Delete state file, re-export full |
