# Raising an issue

Status: recorded, and exercised against a live repository.

How an issue is created at GitHub, recovered off the wire on 2026-08-05 and verified
by driving the same call from outside their bundle. The worked example throughout is
[flazouh/stack-probe](https://github.com/flazouh/stack-probe), a scratch repository,
where the calls below really did raise issues 52, 53 and 54.

Apart from `github-write-api.md` because it is a different mechanism. Every write in
that document is a `page_data` route on a pull request, named by an action and taking a
JSON body. An issue is not created by one of those, and looking for it there is what
this document exists to stop.

## The route

```
POST https://github.com/_graphql
```

One persisted GraphQL mutation, which is the same route the issue read already uses
and the reason `src/github/persisted.ts` exists.

Headers, all five needed:

| Header | Value |
| --- | --- |
| `Accept` | `application/json` |
| `Content-Type` | `text/plain;charset=UTF-8` |
| `X-Requested-With` | `XMLHttpRequest` |
| `GitHub-Verified-Fetch` | `true` |
| `X-Fetch-Nonce` | the `fetch-nonce` meta on the page |

`Content-Type` is theirs, not a mistake here. Their own form sends `text/plain` for a
body that is JSON, and this is an undocumented route: the headers recorded are the
headers sent.

Body, as their form sends it:

```json
{
  "persistedQueryName": "createIssueMutation",
  "query": "59355b9ba02eb93a5090ead97e4236e9",
  "variables": {
    "fetchParent": false,
    "input": {
      "body": "…",
      "clientMutationId": "b4621d73-5c6a-447a-a263-b1c10b9f0fef",
      "isDuplicated": false,
      "issueFields": null,
      "issueTypeId": null,
      "parentIssueId": null,
      "repositoryId": "R_kgDOTndREA",
      "title": "…"
    }
  }
}
```

Seven of those ten fields are not needed. `{repositoryId, title, body}` alone answered
200 and raised issue 54, so that is what the gateway sends.

The answer carries the number, the title, the url, and node ids for the issue and its
repository:

```json
{"data":{"createIssue":{"issue":{
  "databaseId":5065384514,"number":54,"title":"gitquiet probe: minimal input",
  "id":"I_kwDOTndREM8AAAABLeuiQg","url":"https://github.com/flazouh/stack-probe/issues/54",
  "repository":{"databaseId":1316442384,"id":"R_kgDOTndREA","name":"stack-probe"}
},"errors":[]}}}
```

Only the number is kept. The reader typed the title, the screen knows the repository,
and nothing in this codebase addresses an issue by a node id.

## The hash cannot be harvested, and that is the whole difficulty

`persisted.ts` reads a query's hash off GitHub's own traffic:
`performance.getEntriesByType("resource")` hands back every URL the page requested, and
their reads are GETs carrying the body in the query string, so the hash is in the URL.

A mutation is a POST. The body is in the body, `performance` records the URL and nothing
else, and no amount of watching their traffic will ever say which hash they sent.
Measured: an issue page's timings hold their three read queries and never
`createIssueMutation`.

Nor will the route take the query instead of the hash. Both of these were answered 404
`{"type":"unknownQuery","message":"No query with given identifier known"}`:

| Sent as `query` | Answer |
| --- | --- |
| `00000000000000000000000000000000` | 404 `unknownQuery` |
| `mutation createIssueMutation($input: CreateIssueInput!) { … }` | 404 `unknownQuery` |

So the hash has to come out of their shipped JavaScript, which is the thing
`persisted.ts` rejects for queries. What made that a bad bargain there was the cost —
hundreds of files fetched to learn something the page was about to say out loud. Here
the page never says it, and the cost turns out to be small, because the chunks are
already in the browser's cache: their own app just loaded them.

Relay writes the hash beside the operation's name, and this is the shape:

```js
params:{id:"59355b9ba02eb93a5090ead97e4236e9",metadata:{},name:"createIssueMutation",operationKind:"mutation",text:null}
```

Measured on the new-issue form of `flazouh/stack-probe`, reading ten scripts at a time
and stopping at the first hit:

| | |
| --- | --- |
| Scripts on the page | 185 |
| The chunk holding it | 128th, `70943-02ac79a79291dd6f.js` |
| Read before the search stopped | 130 |
| Bytes read | 7 MB |
| Wall time | 71 ms |

Seventy-one milliseconds, once per deploy, kept under the release like every other
hash. The chunk id will be stale within the week; the shape is what survives.

## `repositoryId`, and why it is not computed

Their mutation addresses a repository by node id and by nothing else — there is no
`createIssue` taking an owner and a name. GitHub writes the id into the payload their
React roots are rendered from, beside the owner and the name:

```json
"scoped_repository":{"id":"R_kgDOTndREA","owner":"flazouh","name":"stack-probe","is_archived":false}
```

Present on `/{owner}/{repo}/issues/new` and on `/{owner}/{repo}/issues`, both checked.
The pair matters as much as the id: their app navigates without loading a document, so
a page can outlive the repository it was served for, and a write aimed by a stale id
raises an issue somewhere the reader never asked about with nothing on the screen
saying so. The gateway only uses an id whose payload agrees whose it is.

It could be computed instead. The new-style node ids pack the numeric id, and
`R_` with a packed 1316442384 really is `R_kgDOTndREA` — the same 1316442384 the answer
above reports as `repository.databaseId`. That is an encoding nobody published, in a
format they have already changed once, and being wrong about it means writing to
whatever repository the wrong id names. So it is read, not derived.

## The older Rails route is closed

`POST /{owner}/{repo}/issues` still exists and will not take a write from here. Both
shapes were answered 422 with GitHub's CSRF page:

| Sent | Answer |
| --- | --- |
| `application/json`, `{"issue":{"title":…,"body":…}}` | 422 |
| `application/x-www-form-urlencoded`, `issue[title]=…&issue[body]=…` | 422 |

`GitHub-Verified-Fetch: true` does not stand in for a token on this route, the way it
does on the `page_data` routes. The token it wants is an `authenticity_token` in the
form, and their new-issue page is React and carries no form to take one from — checked,
there is no `input[name="authenticity_token"]` in the document.

## A refusal arrives as 200

This route answers 200 for a refusal, and puts the sentence in one of two places: at the
top of the answer for a query it could not run at all, and in an `errors` array beside
the issue for one it declined to create. A caller reading `response.ok` alone would tell
the reader their issue was raised. Both places are read, GitHub's own words first.

## No dry run

As with every route in `github-write-api.md`: there is no validation-only mode, and a
request that looks like a probe performs the action. Everything above was exercised
against a scratch repository for that reason.
