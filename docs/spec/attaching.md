# Attaching a file, which is three requests and one line of text

A screenshot is how most people say what went wrong. Their own box takes one on paste, on drop
and from a file picker, and posts it to routes that are not in any API they publish. This is
what those routes are, measured off their own box on a scratch repository, and what this
interface writes into the words once a file is up.

The rule for the text is in `domain/attaching.ts` and tested there. The three requests are in
`GitHubGateway.upload`. The box that starts them is `Writing.tsx`.

## The three requests

### 1. Ask for a policy

```
POST /upload/policies/assets
GitHub-Verified-Fetch: true
X-Fetch-Nonce: <the page's meta[name="fetch-nonce"]>
X-Requested-With: XMLHttpRequest
```

A multipart form of four fields, and no more: `repository_id`, `name`, `size`, `content_type`.
No `authenticity_token`: `GitHub-Verified-Fetch` is what stands in for one here, as it does on
every other write in this interface. Without that header the route answers 422, whatever else is
sent.

201 with the whole of the rest of the job:

```json
{
  "upload_url": "https://github-production-user-asset-6210df.s3.amazonaws.com",
  "header": {},
  "form": { "key": "…", "acl": "private", "policy": "…", "X-Amz-Signature": "…", "…": "…" },
  "asset": { "id": 632059734, "name": "shot.png", "href": "https://github.com/user-attachments/assets/…" },
  "same_origin": false,
  "asset_upload_url": "/upload/assets/632059734",
  "upload_authenticity_token": "…",
  "asset_upload_authenticity_token": "…"
}
```

### 2. Post the bytes

```
POST <upload_url>
```

Every field of `form`, in the order it came, and then `file` last. Their bucket, so no cookies:
the signature in the form is the whole of the permission. 204, with no body.

### 3. Say the bytes landed

```
PUT <asset_upload_url>
X-Requested-With: XMLHttpRequest
```

A form of one field, `authenticity_token`, which is `asset_upload_authenticity_token` from the
first answer. 200 with the asset again, address and all. This is the call that turns a file in a
bucket into an attachment; the address works for a while without it and then does not.

Their own box makes a fourth call, `GET /owner/repo/attachment_accessibility_check?guids[]=…`,
which answers `{"inaccessible":[]}`. Nothing on this screen depends on it and it is not made.

## The number their route wants

`repository_id` is the old numeric id, not the node id every other write here is addressed by,
and no payload on the page carries it. It is in a meta tag: `octolytics-dimension-repository_id`
on an issue page, `hovercard-subject-tag` as `repository:1316442384` on the page for a new issue.

A meta tag does not say which repository it belongs to, and their app navigates without loading,
so the tag can be the one served for wherever the reader was a moment ago. The number is only
used where a payload on the same document says the document is about this repository. See
`uploading.ts`, and `scoped.ts`, which does the same for the node id.

## What goes in the box

While the bytes are going up, a comment stands where the file will be:

```
<!-- Uploading "shot.png"... -->
```

Their own box writes `Uploading shot.png…` as words. A draft posted halfway through then arrives
as a sentence nobody wrote. A comment renders as nothing, and gives the swap something exact to
find: the reader goes on typing around it, so the swap is by find and replace rather than by a
caret position that is stale by the time it lands.

Once it is up, a picture is written as their own box now writes one, at the size it really is:

```html
<img width="1600" height="900" alt="login error" src="https://github.com/user-attachments/assets/…" />
```

Anything else is written as a link: `[trace.zip](https://github.com/user-attachments/files/…)`.

Two differences from theirs, both deliberate:

- The alt text is the file name, tidied. Theirs is the word `Image`, every time, which tells a
  screen reader nothing and is the one description that was already available. It sits in the
  box in plain sight, so anybody can type a better one over it.
- An SVG is written as a link rather than an `img`. GitHub does not render one in a comment, so
  a tag pointing at it shows nothing at all where a link at least opens.

Each file gets its own mark and its own upload, so three screenshots dropped together land as
they finish, and one refused takes only its own mark out. What GitHub said about a file it would
not take is repeated under the box, in their words: they know their own limits and this file
does not.

## Reading one back

A comment that is one screenshot is one `img` tag, so the folded line for it read as the tag.
`summarise.ts` now says the alt text there, and `Image` where there is none.
