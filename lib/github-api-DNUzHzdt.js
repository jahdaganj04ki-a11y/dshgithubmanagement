//#region src/shared/github-api.ts
var GhError = class extends Error {
	status;
	body;
	headers;
	constructor(status, body, headers) {
		super(`GitHub ${status}: ${body.slice(0, 400)}`);
		this.name = "GhError";
		this.status = status;
		this.body = body;
		this.headers = headers;
	}
};
function buildUrl(baseUrl, path, query) {
	const base = (baseUrl ?? "https://api.github.com").replace(/\/$/, "");
	const url = new URL(path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`);
	if (query) {
		for (const [k, v] of Object.entries(query)) if (v !== void 0) url.searchParams.set(k, String(v));
	}
	return url.toString();
}
async function ghFetch(path, init) {
	const url = buildUrl(init.baseUrl, path, init.query);
	const headers = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		Authorization: `Bearer ${init.token}`,
		...init.headers
	};
	const res = await fetch(url, {
		method: init.method ?? "GET",
		headers,
		body: init.body === void 0 ? void 0 : JSON.stringify(init.body),
		signal: init.signal
	});
	const text = await res.text();
	if (!res.ok) throw new GhError(res.status, text, res.headers);
	let data;
	try {
		data = text ? JSON.parse(text) : void 0;
	} catch {
		throw new GhError(res.status, text, res.headers);
	}
	const rem = res.headers.get("x-ratelimit-remaining");
	const lim = res.headers.get("x-ratelimit-limit");
	const rst = res.headers.get("x-ratelimit-reset");
	const scopeHeader = res.headers.get("x-oauth-scopes") ?? res.headers.get("x-accepted-oauth-scopes") ?? "";
	return {
		data,
		headers: res.headers,
		rateRemaining: rem ? Number(rem) : null,
		rateLimit: lim ? Number(lim) : null,
		rateReset: rst ? Number(rst) : null,
		scopes: scopeHeader.split(",").map((s) => s.trim()).filter(Boolean)
	};
}
async function validateToken(token, baseUrl) {
	const r = await ghFetch("/user", {
		token,
		baseUrl
	});
	return {
		viewer: r.data,
		scopes: r.scopes,
		rate: r.rateRemaining !== null && r.rateLimit !== null && r.rateReset !== null ? {
			remaining: r.rateRemaining,
			limit: r.rateLimit,
			reset: r.rateReset
		} : null
	};
}

//#endregion
export { ghFetch as n, validateToken as r, GhError as t };
//# sourceMappingURL=github-api-DNUzHzdt.js.map