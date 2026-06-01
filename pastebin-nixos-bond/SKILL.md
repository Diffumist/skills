---
name: pastebin-nixos-bond
version: 1.0.0
description: Use nixos.bond as a pastebin/file-sharing and URL-shortening service. Trigger when the user mentions nixos.bond, pastebin-nixos-bond, asks to upload/share a file or stdin paste through nixos.bond, create one-shot/一次性 links, set upload expiry, override filenames, shorten URLs, or upload from a remote URL.
---

# nixos.bond Pastebin Skill

Use `https://nixos.bond` for quick pastebin-style uploads, temporary file sharing, one-shot/一次性 links, URL shortening, and remote URL uploads.

## Source facts

From `https://nixos.bond`:

- Files expire after **7 days** by default.
- Total service storage is capped at **15 GB**.
- Custom expiry must be **30 days or less**.
- Interactions are plain `curl -F ... https://nixos.bond` uploads.

## Safety defaults

- Do **not** upload secrets, API keys, private documents, personal identifiers, or credentials unless the user explicitly confirms after being warned.
- Treat generated links as shareable/public unless the user provides stronger evidence otherwise.
- Prefer short custom expiries for sensitive-but-approved material; use one-shot/一次性 links when the user wants a link that should only be consumed once.
- If uploading a local file, verify the intended path under `/var/minis/` or a user-mounted folder; do not scan the whole filesystem.

## Commands

Upload a file:

```sh
curl -F "file=@example.txt" https://nixos.bond
```

Paste from stdin:

```sh
echo "hello" | curl -F "file=@-" https://nixos.bond
```

Set a custom expiry:

```sh
curl -F "file=@example.txt" -H "expire:1h" https://nixos.bond
```

Override filename:

```sh
curl -F "file=@example.txt" -H "filename: note.txt" https://nixos.bond
```

Create a one-shot/一次性 file link:

```sh
curl -F "oneshot=@secret.txt" https://nixos.bond
```

Shorten a URL:

```sh
curl -F "url=https://example.com" https://nixos.bond
```

Shorten a one-shot/一次性 URL:

```sh
curl -F "oneshot_url=https://example.com" https://nixos.bond
```

Upload from a remote URL:

```sh
curl -F "remote=https://example.com/file.png" https://nixos.bond
```

## Workflow

1. Identify the requested action: file upload, stdin paste, URL shortener, one-shot/一次性 link, remote upload, expiry/filename customization.
2. Apply safety check if content may be sensitive.
3. Run the appropriate `curl` command.
4. Return the resulting link exactly as printed by the service, plus expiry/one-shot caveats when relevant.

## Examples

Upload a Minis workspace file for 1 hour with a readable filename:

```sh
curl -F "file=@/var/minis/workspace/report.txt" \
  -H "expire:1h" \
  -H "filename: report.txt" \
  https://nixos.bond
```

Paste generated text for 10 minutes:

```sh
printf '%s' "$TEXT" | curl -F "file=@-" -H "expire:10m" https://nixos.bond
```
