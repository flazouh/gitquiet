//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (e, t, n) => () => {
	if (n) throw n[0];
	try {
		return e && (t = e(e = 0)), t;
	} catch (e) {
		throw n = [e], e;
	}
}, n = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
}, r = class extends Error {
	constructor(e) {
		super(e), this.name = "ShikiError";
	}
};
//#endregion
//#region node_modules/@shikijs/vscode-textmate/dist/index.js
function i(e) {
	return a(e);
}
function a(e) {
	return Array.isArray(e) ? o(e) : e instanceof RegExp ? e : typeof e == "object" ? s(e) : e;
}
function o(e) {
	let t = [];
	for (let n = 0, r = e.length; n < r; n++) t[n] = a(e[n]);
	return t;
}
function s(e) {
	let t = {};
	for (let n in e) t[n] = a(e[n]);
	return t;
}
function c(e, ...t) {
	return t.forEach((t) => {
		for (let n in t) e[n] = t[n];
	}), e;
}
function l(e) {
	let t = ~e.lastIndexOf("/") || ~e.lastIndexOf("\\");
	return t === 0 ? e : ~t === e.length - 1 ? l(e.substring(0, e.length - 1)) : e.substr(~t + 1);
}
var u = /\$(\d+)|\${(\d+):\/(downcase|upcase)}/g, d = class {
	static hasCaptures(e) {
		return e !== null && (u.lastIndex = 0, u.test(e));
	}
	static replaceCaptures(e, t, n) {
		return e.replace(u, (e, r, i, a) => {
			let o = n[parseInt(r || i, 10)];
			if (o) {
				let e = t.substring(o.start, o.end);
				for (; e[0] === ".";) e = e.substring(1);
				switch (a) {
					case "downcase": return e.toLowerCase();
					case "upcase": return e.toUpperCase();
					default: return e;
				}
			} else return e;
		});
	}
};
function f(e, t) {
	return e < t ? -1 : +(e > t);
}
function p(e, t) {
	if (e === null && t === null) return 0;
	if (!e) return -1;
	if (!t) return 1;
	let n = e.length, r = t.length;
	if (n === r) {
		for (let r = 0; r < n; r++) {
			let n = f(e[r], t[r]);
			if (n !== 0) return n;
		}
		return 0;
	}
	return n - r;
}
function m(e) {
	return !!(/^#[0-9a-f]{6}$/i.test(e) || /^#[0-9a-f]{8}$/i.test(e) || /^#[0-9a-f]{3}$/i.test(e) || /^#[0-9a-f]{4}$/i.test(e));
}
function h(e) {
	return e.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, "\\$&");
}
var g = class {
	constructor(e) {
		this.fn = e;
	}
	cache = /* @__PURE__ */ new Map();
	get(e) {
		if (this.cache.has(e)) return this.cache.get(e);
		let t = this.fn(e);
		return this.cache.set(e, t), t;
	}
}, _ = class {
	constructor(e, t, n) {
		this._colorMap = e, this._defaults = t, this._root = n;
	}
	static createFromRawTheme(e, t) {
		return this.createFromParsedTheme(S(e), t);
	}
	static createFromParsedTheme(e, t) {
		return te(e, t);
	}
	_cachedMatchRoot = new g((e) => this._root.match(e));
	getColorMap() {
		return this._colorMap.getColorMap();
	}
	getDefaults() {
		return this._defaults;
	}
	match(e) {
		if (e === null) return this._defaults;
		let t = e.scopeName, n = this._cachedMatchRoot.get(t).find((t) => y(e.parent, t.parentScopes));
		return n ? new x(n.fontStyle, n.foreground, n.background) : null;
	}
}, v = class e {
	constructor(e, t) {
		this.parent = e, this.scopeName = t;
	}
	static push(t, n) {
		for (let r of n) t = new e(t, r);
		return t;
	}
	static from(...t) {
		let n = null;
		for (let r = 0; r < t.length; r++) n = new e(n, t[r]);
		return n;
	}
	push(t) {
		return new e(this, t);
	}
	getSegments() {
		let e = this, t = [];
		for (; e;) t.push(e.scopeName), e = e.parent;
		return t.reverse(), t;
	}
	toString() {
		return this.getSegments().join(" ");
	}
	extends(e) {
		return this === e || this.parent !== null && this.parent.extends(e);
	}
	getExtensionIfDefined(e) {
		let t = [], n = this;
		for (; n && n !== e;) t.push(n.scopeName), n = n.parent;
		return n === e ? t.reverse() : void 0;
	}
};
function y(e, t) {
	if (t.length === 0) return !0;
	for (let n = 0; n < t.length; n++) {
		let r = t[n], i = !1;
		if (r === ">") {
			if (n === t.length - 1) return !1;
			r = t[++n], i = !0;
		}
		for (; e && !b(e.scopeName, r);) {
			if (i) return !1;
			e = e.parent;
		}
		if (!e) return !1;
		e = e.parent;
	}
	return !0;
}
function b(e, t) {
	return t === e || e.startsWith(t) && e[t.length] === ".";
}
var x = class {
	constructor(e, t, n) {
		this.fontStyle = e, this.foregroundId = t, this.backgroundId = n;
	}
};
function S(e) {
	if (!e || !e.settings || !Array.isArray(e.settings)) return [];
	let t = e.settings, n = [], r = 0;
	for (let e = 0, i = t.length; e < i; e++) {
		let i = t[e];
		if (!i.settings) continue;
		let a;
		if (typeof i.scope == "string") {
			let e = i.scope;
			e = e.replace(/^[,]+/, ""), e = e.replace(/[,]+$/, ""), a = e.split(",");
		} else a = Array.isArray(i.scope) ? i.scope : [""];
		let o = -1;
		if (typeof i.settings.fontStyle == "string") {
			o = 0;
			let e = i.settings.fontStyle.split(" ");
			for (let t = 0, n = e.length; t < n; t++) switch (e[t]) {
				case "italic":
					o |= 1;
					break;
				case "bold":
					o |= 2;
					break;
				case "underline":
					o |= 4;
					break;
				case "strikethrough": o |= 8;
			}
		}
		let s = null;
		typeof i.settings.foreground == "string" && m(i.settings.foreground) && (s = i.settings.foreground);
		let c = null;
		typeof i.settings.background == "string" && m(i.settings.background) && (c = i.settings.background);
		for (let t = 0, i = a.length; t < i; t++) {
			let i = a[t].trim().split(" "), l = i[i.length - 1], u = null;
			i.length > 1 && (u = i.slice(0, i.length - 1), u.reverse()), n[r++] = new ee(l, u, e, o, s, c);
		}
	}
	return n;
}
var ee = class {
	constructor(e, t, n, r, i, a) {
		this.scope = e, this.parentScopes = t, this.index = n, this.fontStyle = r, this.foreground = i, this.background = a;
	}
}, C = /* @__PURE__ */ ((e) => (e[e.NotSet = -1] = "NotSet", e[e.None = 0] = "None", e[e.Italic = 1] = "Italic", e[e.Bold = 2] = "Bold", e[e.Underline = 4] = "Underline", e[e.Strikethrough = 8] = "Strikethrough", e))(C || {});
function te(e, t) {
	e.sort((e, t) => {
		let n = f(e.scope, t.scope);
		return n !== 0 || (n = p(e.parentScopes, t.parentScopes), n !== 0) ? n : e.index - t.index;
	});
	let n = 0, r = "#000000", i = "#ffffff";
	for (; e.length >= 1 && e[0].scope === "";) {
		let t = e.shift();
		t.fontStyle !== -1 && (n = t.fontStyle), t.foreground !== null && (r = t.foreground), t.background !== null && (i = t.background);
	}
	let a = new ne(t), o = new x(n, a.getId(r), a.getId(i)), s = new ae(new ie(0, null, -1, 0, 0), []);
	for (let t = 0, n = e.length; t < n; t++) {
		let n = e[t];
		s.insert(0, n.scope, n.parentScopes, n.fontStyle, a.getId(n.foreground), a.getId(n.background));
	}
	return new _(a, o, s);
}
var ne = class {
	_isFrozen;
	_lastColorId;
	_id2color;
	_color2id;
	constructor(e) {
		if (this._lastColorId = 0, this._id2color = [], this._color2id = /* @__PURE__ */ Object.create(null), Array.isArray(e)) {
			this._isFrozen = !0;
			for (let t = 0, n = e.length; t < n; t++) this._color2id[e[t]] = t, this._id2color[t] = e[t];
		} else this._isFrozen = !1;
	}
	getId(e) {
		if (e === null) return 0;
		e = e.toUpperCase();
		let t = this._color2id[e];
		if (t) return t;
		if (this._isFrozen) throw Error(`Missing color in color map - ${e}`);
		return t = ++this._lastColorId, this._color2id[e] = t, this._id2color[t] = e, t;
	}
	getColorMap() {
		return this._id2color.slice(0);
	}
}, re = Object.freeze([]), ie = class e {
	scopeDepth;
	parentScopes;
	fontStyle;
	foreground;
	background;
	constructor(e, t, n, r, i) {
		this.scopeDepth = e, this.parentScopes = t || re, this.fontStyle = n, this.foreground = r, this.background = i;
	}
	clone() {
		return new e(this.scopeDepth, this.parentScopes, this.fontStyle, this.foreground, this.background);
	}
	static cloneArr(e) {
		let t = [];
		for (let n = 0, r = e.length; n < r; n++) t[n] = e[n].clone();
		return t;
	}
	acceptOverwrite(e, t, n, r) {
		this.scopeDepth > e ? console.log("how did this happen?") : this.scopeDepth = e, t !== -1 && (this.fontStyle = t), n !== 0 && (this.foreground = n), r !== 0 && (this.background = r);
	}
}, ae = class e {
	constructor(e, t = [], n = {}) {
		this._mainRule = e, this._children = n, this._rulesWithParentScopes = t;
	}
	_rulesWithParentScopes;
	static _cmpBySpecificity(e, t) {
		if (e.scopeDepth !== t.scopeDepth) return t.scopeDepth - e.scopeDepth;
		let n = 0, r = 0;
		for (; e.parentScopes[n] === ">" && n++, t.parentScopes[r] === ">" && r++, !(n >= e.parentScopes.length || r >= t.parentScopes.length);) {
			let i = t.parentScopes[r].length - e.parentScopes[n].length;
			if (i !== 0) return i;
			n++, r++;
		}
		return t.parentScopes.length - e.parentScopes.length;
	}
	match(t) {
		if (t !== "") {
			let e = t.indexOf("."), n, r;
			if (e === -1 ? (n = t, r = "") : (n = t.substring(0, e), r = t.substring(e + 1)), this._children.hasOwnProperty(n)) return this._children[n].match(r);
		}
		let n = this._rulesWithParentScopes.concat(this._mainRule);
		return n.sort(e._cmpBySpecificity), n;
	}
	insert(t, n, r, i, a, o) {
		if (n === "") {
			this._doInsertHere(t, r, i, a, o);
			return;
		}
		let s = n.indexOf("."), c, l;
		s === -1 ? (c = n, l = "") : (c = n.substring(0, s), l = n.substring(s + 1));
		let u;
		this._children.hasOwnProperty(c) ? u = this._children[c] : (u = new e(this._mainRule.clone(), ie.cloneArr(this._rulesWithParentScopes)), this._children[c] = u), u.insert(t + 1, l, r, i, a, o);
	}
	_doInsertHere(e, t, n, r, i) {
		if (t === null) {
			this._mainRule.acceptOverwrite(e, n, r, i);
			return;
		}
		for (let a = 0, o = this._rulesWithParentScopes.length; a < o; a++) {
			let o = this._rulesWithParentScopes[a];
			if (p(o.parentScopes, t) === 0) {
				o.acceptOverwrite(e, n, r, i);
				return;
			}
		}
		n === -1 && (n = this._mainRule.fontStyle), r === 0 && (r = this._mainRule.foreground), i === 0 && (i = this._mainRule.background), this._rulesWithParentScopes.push(new ie(e, t, n, r, i));
	}
}, oe = class e {
	static toBinaryStr(e) {
		return e.toString(2).padStart(32, "0");
	}
	static print(t) {
		let n = e.getLanguageId(t), r = e.getTokenType(t), i = e.getFontStyle(t), a = e.getForeground(t), o = e.getBackground(t);
		console.log({
			languageId: n,
			tokenType: r,
			fontStyle: i,
			foreground: a,
			background: o
		});
	}
	static getLanguageId(e) {
		return (e & 255) >>> 0;
	}
	static getTokenType(e) {
		return (e & 768) >>> 8;
	}
	static containsBalancedBrackets(e) {
		return !!(e & 1024);
	}
	static getFontStyle(e) {
		return (e & 30720) >>> 11;
	}
	static getForeground(e) {
		return (e & 16744448) >>> 15;
	}
	static getBackground(e) {
		return (e & 4278190080) >>> 24;
	}
	static set(t, n, r, i, a, o, s) {
		let c = e.getLanguageId(t), l = e.getTokenType(t), u = +!!e.containsBalancedBrackets(t), d = e.getFontStyle(t), f = e.getForeground(t), p = e.getBackground(t);
		return n !== 0 && (c = n), r !== 8 && (l = ce(r)), i !== null && (u = +!!i), a !== -1 && (d = a), o !== 0 && (f = o), s !== 0 && (p = s), (c << 0 | l << 8 | u << 10 | d << 11 | f << 15 | p << 24) >>> 0;
	}
};
function se(e) {
	return e;
}
function ce(e) {
	return e;
}
function le(e, t) {
	let n = [], r = de(e), i = r.next();
	for (; i !== null;) {
		let e = 0;
		if (i.length === 2 && i.charAt(1) === ":") {
			switch (i.charAt(0)) {
				case "R":
					e = 1;
					break;
				case "L":
					e = -1;
					break;
				default: console.log(`Unknown priority ${i} in scope selector`);
			}
			i = r.next();
		}
		let t = o();
		if (n.push({
			matcher: t,
			priority: e
		}), i !== ",") break;
		i = r.next();
	}
	return n;
	function a() {
		if (i === "-") {
			i = r.next();
			let e = a();
			return (t) => !!e && !e(t);
		}
		if (i === "(") {
			i = r.next();
			let e = s();
			return i === ")" && (i = r.next()), e;
		}
		if (ue(i)) {
			let e = [];
			do
				e.push(i), i = r.next();
			while (ue(i));
			return (n) => t(e, n);
		}
		return null;
	}
	function o() {
		let e = [], t = a();
		for (; t;) e.push(t), t = a();
		return (t) => e.every((e) => e(t));
	}
	function s() {
		let e = [], t = o();
		for (; t && (e.push(t), i === "|" || i === ",");) {
			do
				i = r.next();
			while (i === "|" || i === ",");
			t = o();
		}
		return (t) => e.some((e) => e(t));
	}
}
function ue(e) {
	return !!e && !!e.match(/[\w\.:]+/);
}
function de(e) {
	let t = /([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g, n = t.exec(e);
	return { next: () => {
		if (!n) return null;
		let r = n[0];
		return n = t.exec(e), r;
	} };
}
function fe(e) {
	typeof e.dispose == "function" && e.dispose();
}
var pe = class {
	constructor(e) {
		this.scopeName = e;
	}
	toKey() {
		return this.scopeName;
	}
}, me = class {
	constructor(e, t) {
		this.scopeName = e, this.ruleName = t;
	}
	toKey() {
		return `${this.scopeName}#${this.ruleName}`;
	}
}, he = class {
	_references = [];
	_seenReferenceKeys = /* @__PURE__ */ new Set();
	get references() {
		return this._references;
	}
	visitedRule = /* @__PURE__ */ new Set();
	add(e) {
		let t = e.toKey();
		this._seenReferenceKeys.has(t) || (this._seenReferenceKeys.add(t), this._references.push(e));
	}
}, ge = class {
	constructor(e, t) {
		this.repo = e, this.initialScopeName = t, this.seenFullScopeRequests.add(this.initialScopeName), this.Q = [new pe(this.initialScopeName)];
	}
	seenFullScopeRequests = /* @__PURE__ */ new Set();
	seenPartialScopeRequests = /* @__PURE__ */ new Set();
	Q;
	processQueue() {
		let e = this.Q;
		this.Q = [];
		let t = new he();
		for (let n of e) _e(n, this.initialScopeName, this.repo, t);
		for (let e of t.references) if (e instanceof pe) {
			if (this.seenFullScopeRequests.has(e.scopeName)) continue;
			this.seenFullScopeRequests.add(e.scopeName), this.Q.push(e);
		} else {
			if (this.seenFullScopeRequests.has(e.scopeName) || this.seenPartialScopeRequests.has(e.toKey())) continue;
			this.seenPartialScopeRequests.add(e.toKey()), this.Q.push(e);
		}
	}
};
function _e(e, t, n, r) {
	let i = n.lookup(e.scopeName);
	if (!i) {
		if (e.scopeName === t) throw Error(`No grammar provided for <${t}>`);
		return;
	}
	let a = n.lookup(t);
	e instanceof pe ? ye({
		baseGrammar: a,
		selfGrammar: i
	}, r) : ve(e.ruleName, {
		baseGrammar: a,
		selfGrammar: i,
		repository: i.repository
	}, r);
	let o = n.injections(e.scopeName);
	if (o) for (let e of o) r.add(new pe(e));
}
function ve(e, t, n) {
	if (t.repository && t.repository[e]) {
		let r = t.repository[e];
		be([r], t, n);
	}
}
function ye(e, t) {
	e.selfGrammar.patterns && Array.isArray(e.selfGrammar.patterns) && be(e.selfGrammar.patterns, {
		...e,
		repository: e.selfGrammar.repository
	}, t), e.selfGrammar.injections && be(Object.values(e.selfGrammar.injections), {
		...e,
		repository: e.selfGrammar.repository
	}, t);
}
function be(e, t, n) {
	for (let r of e) {
		if (n.visitedRule.has(r)) continue;
		n.visitedRule.add(r);
		let e = r.repository ? c({}, t.repository, r.repository) : t.repository;
		Array.isArray(r.patterns) && be(r.patterns, {
			...t,
			repository: e
		}, n);
		let i = r.include;
		if (!i) continue;
		let a = Ee(i);
		switch (a.kind) {
			case 0:
				ye({
					...t,
					selfGrammar: t.baseGrammar
				}, n);
				break;
			case 1:
				ye(t, n);
				break;
			case 2:
				ve(a.ruleName, {
					...t,
					repository: e
				}, n);
				break;
			case 3:
			case 4:
				let r = a.scopeName === t.selfGrammar.scopeName ? t.selfGrammar : a.scopeName === t.baseGrammar.scopeName ? t.baseGrammar : void 0;
				if (r) {
					let i = {
						baseGrammar: t.baseGrammar,
						selfGrammar: r,
						repository: e
					};
					a.kind === 4 ? ve(a.ruleName, i, n) : ye(i, n);
				} else a.kind === 4 ? n.add(new me(a.scopeName, a.ruleName)) : n.add(new pe(a.scopeName));
		}
	}
}
var xe = class {
	kind = 0;
}, Se = class {
	kind = 1;
}, Ce = class {
	constructor(e) {
		this.ruleName = e;
	}
	kind = 2;
}, we = class {
	constructor(e) {
		this.scopeName = e;
	}
	kind = 3;
}, Te = class {
	constructor(e, t) {
		this.scopeName = e, this.ruleName = t;
	}
	kind = 4;
};
function Ee(e) {
	if (e === "$base") return new xe();
	if (e === "$self") return new Se();
	let t = e.indexOf("#");
	return t === -1 ? new we(e) : t === 0 ? new Ce(e.substring(1)) : new Te(e.substring(0, t), e.substring(t + 1));
}
var De = /\\(\d+)/, Oe = /\\(\d+)/g, ke = -1, Ae = -2;
function je(e) {
	return e;
}
function Me(e) {
	return e;
}
var Ne = class {
	$location;
	id;
	_nameIsCapturing;
	_name;
	_contentNameIsCapturing;
	_contentName;
	constructor(e, t, n, r) {
		this.$location = e, this.id = t, this._name = n || null, this._nameIsCapturing = d.hasCaptures(this._name), this._contentName = r || null, this._contentNameIsCapturing = d.hasCaptures(this._contentName);
	}
	get debugName() {
		let e = this.$location ? `${l(this.$location.filename)}:${this.$location.line}` : "unknown";
		return `${this.constructor.name}#${this.id} @ ${e}`;
	}
	getName(e, t) {
		return !this._nameIsCapturing || this._name === null || e === null || t === null ? this._name : d.replaceCaptures(this._name, e, t);
	}
	getContentName(e, t) {
		return !this._contentNameIsCapturing || this._contentName === null ? this._contentName : d.replaceCaptures(this._contentName, e, t);
	}
}, Pe = class extends Ne {
	retokenizeCapturedWithRuleId;
	constructor(e, t, n, r, i) {
		super(e, t, n, r), this.retokenizeCapturedWithRuleId = i;
	}
	dispose() {}
	collectPatterns(e, t) {
		throw Error("Not supported!");
	}
	compile(e, t) {
		throw Error("Not supported!");
	}
	compileAG(e, t, n, r) {
		throw Error("Not supported!");
	}
}, Fe = class extends Ne {
	_match;
	captures;
	_cachedCompiledPatterns;
	constructor(e, t, n, r, i) {
		super(e, t, n, null), this._match = new Be(r, this.id), this.captures = i, this._cachedCompiledPatterns = null;
	}
	dispose() {
		this._cachedCompiledPatterns &&= (this._cachedCompiledPatterns.dispose(), null);
	}
	get debugMatchRegExp() {
		return `${this._match.source}`;
	}
	collectPatterns(e, t) {
		t.push(this._match);
	}
	compile(e, t) {
		return this._getCachedCompiledPatterns(e).compile(e);
	}
	compileAG(e, t, n, r) {
		return this._getCachedCompiledPatterns(e).compileAG(e, n, r);
	}
	_getCachedCompiledPatterns(e) {
		return this._cachedCompiledPatterns || (this._cachedCompiledPatterns = new Ve(), this.collectPatterns(e, this._cachedCompiledPatterns)), this._cachedCompiledPatterns;
	}
}, Ie = class extends Ne {
	hasMissingPatterns;
	patterns;
	_cachedCompiledPatterns;
	constructor(e, t, n, r, i) {
		super(e, t, n, r), this.patterns = i.patterns, this.hasMissingPatterns = i.hasMissingPatterns, this._cachedCompiledPatterns = null;
	}
	dispose() {
		this._cachedCompiledPatterns &&= (this._cachedCompiledPatterns.dispose(), null);
	}
	collectPatterns(e, t) {
		for (let n of this.patterns) e.getRule(n).collectPatterns(e, t);
	}
	compile(e, t) {
		return this._getCachedCompiledPatterns(e).compile(e);
	}
	compileAG(e, t, n, r) {
		return this._getCachedCompiledPatterns(e).compileAG(e, n, r);
	}
	_getCachedCompiledPatterns(e) {
		return this._cachedCompiledPatterns || (this._cachedCompiledPatterns = new Ve(), this.collectPatterns(e, this._cachedCompiledPatterns)), this._cachedCompiledPatterns;
	}
}, Le = class extends Ne {
	_begin;
	beginCaptures;
	_end;
	endHasBackReferences;
	endCaptures;
	applyEndPatternLast;
	hasMissingPatterns;
	patterns;
	_cachedCompiledPatterns;
	constructor(e, t, n, r, i, a, o, s, c, l) {
		super(e, t, n, r), this._begin = new Be(i, this.id), this.beginCaptures = a, this._end = new Be(o || "￿", -1), this.endHasBackReferences = this._end.hasBackReferences, this.endCaptures = s, this.applyEndPatternLast = c || !1, this.patterns = l.patterns, this.hasMissingPatterns = l.hasMissingPatterns, this._cachedCompiledPatterns = null;
	}
	dispose() {
		this._cachedCompiledPatterns &&= (this._cachedCompiledPatterns.dispose(), null);
	}
	get debugBeginRegExp() {
		return `${this._begin.source}`;
	}
	get debugEndRegExp() {
		return `${this._end.source}`;
	}
	getEndWithResolvedBackReferences(e, t) {
		return this._end.resolveBackReferences(e, t);
	}
	collectPatterns(e, t) {
		t.push(this._begin);
	}
	compile(e, t) {
		return this._getCachedCompiledPatterns(e, t).compile(e);
	}
	compileAG(e, t, n, r) {
		return this._getCachedCompiledPatterns(e, t).compileAG(e, n, r);
	}
	_getCachedCompiledPatterns(e, t) {
		if (!this._cachedCompiledPatterns) {
			this._cachedCompiledPatterns = new Ve();
			for (let t of this.patterns) e.getRule(t).collectPatterns(e, this._cachedCompiledPatterns);
			this.applyEndPatternLast ? this._cachedCompiledPatterns.push(this._end.hasBackReferences ? this._end.clone() : this._end) : this._cachedCompiledPatterns.unshift(this._end.hasBackReferences ? this._end.clone() : this._end);
		}
		return this._end.hasBackReferences && (this.applyEndPatternLast ? this._cachedCompiledPatterns.setSource(this._cachedCompiledPatterns.length() - 1, t) : this._cachedCompiledPatterns.setSource(0, t)), this._cachedCompiledPatterns;
	}
}, Re = class extends Ne {
	_begin;
	beginCaptures;
	whileCaptures;
	_while;
	whileHasBackReferences;
	hasMissingPatterns;
	patterns;
	_cachedCompiledPatterns;
	_cachedCompiledWhilePatterns;
	constructor(e, t, n, r, i, a, o, s, c) {
		super(e, t, n, r), this._begin = new Be(i, this.id), this.beginCaptures = a, this.whileCaptures = s, this._while = new Be(o, Ae), this.whileHasBackReferences = this._while.hasBackReferences, this.patterns = c.patterns, this.hasMissingPatterns = c.hasMissingPatterns, this._cachedCompiledPatterns = null, this._cachedCompiledWhilePatterns = null;
	}
	dispose() {
		this._cachedCompiledPatterns &&= (this._cachedCompiledPatterns.dispose(), null), this._cachedCompiledWhilePatterns &&= (this._cachedCompiledWhilePatterns.dispose(), null);
	}
	get debugBeginRegExp() {
		return `${this._begin.source}`;
	}
	get debugWhileRegExp() {
		return `${this._while.source}`;
	}
	getWhileWithResolvedBackReferences(e, t) {
		return this._while.resolveBackReferences(e, t);
	}
	collectPatterns(e, t) {
		t.push(this._begin);
	}
	compile(e, t) {
		return this._getCachedCompiledPatterns(e).compile(e);
	}
	compileAG(e, t, n, r) {
		return this._getCachedCompiledPatterns(e).compileAG(e, n, r);
	}
	_getCachedCompiledPatterns(e) {
		if (!this._cachedCompiledPatterns) {
			this._cachedCompiledPatterns = new Ve();
			for (let t of this.patterns) e.getRule(t).collectPatterns(e, this._cachedCompiledPatterns);
		}
		return this._cachedCompiledPatterns;
	}
	compileWhile(e, t) {
		return this._getCachedCompiledWhilePatterns(e, t).compile(e);
	}
	compileWhileAG(e, t, n, r) {
		return this._getCachedCompiledWhilePatterns(e, t).compileAG(e, n, r);
	}
	_getCachedCompiledWhilePatterns(e, t) {
		return this._cachedCompiledWhilePatterns || (this._cachedCompiledWhilePatterns = new Ve(), this._cachedCompiledWhilePatterns.push(this._while.hasBackReferences ? this._while.clone() : this._while)), this._while.hasBackReferences && this._cachedCompiledWhilePatterns.setSource(0, t || "￿"), this._cachedCompiledWhilePatterns;
	}
}, ze = class e {
	static createCaptureRule(e, t, n, r, i) {
		return e.registerRule((e) => new Pe(t, e, n, r, i));
	}
	static getCompiledRuleId(t, n, r) {
		return t.id || n.registerRule((i) => {
			if (t.id = i, t.match) return new Fe(t.$vscodeTextmateLocation, t.id, t.name, t.match, e._compileCaptures(t.captures, n, r));
			if (t.begin === void 0) {
				t.repository && (r = c({}, r, t.repository));
				let i = t.patterns;
				return i === void 0 && t.include && (i = [{ include: t.include }]), new Ie(t.$vscodeTextmateLocation, t.id, t.name, t.contentName, e._compilePatterns(i, n, r));
			}
			return t.while ? new Re(t.$vscodeTextmateLocation, t.id, t.name, t.contentName, t.begin, e._compileCaptures(t.beginCaptures || t.captures, n, r), t.while, e._compileCaptures(t.whileCaptures || t.captures, n, r), e._compilePatterns(t.patterns, n, r)) : new Le(t.$vscodeTextmateLocation, t.id, t.name, t.contentName, t.begin, e._compileCaptures(t.beginCaptures || t.captures, n, r), t.end, e._compileCaptures(t.endCaptures || t.captures, n, r), t.applyEndPatternLast, e._compilePatterns(t.patterns, n, r));
		}), t.id;
	}
	static _compileCaptures(t, n, r) {
		let i = [];
		if (t) {
			let a = 0;
			for (let e in t) {
				if (e === "$vscodeTextmateLocation") continue;
				let t = parseInt(e, 10);
				t > a && (a = t);
			}
			for (let e = 0; e <= a; e++) i[e] = null;
			for (let a in t) {
				if (a === "$vscodeTextmateLocation") continue;
				let o = parseInt(a, 10), s = 0;
				t[a].patterns && (s = e.getCompiledRuleId(t[a], n, r)), i[o] = e.createCaptureRule(n, t[a].$vscodeTextmateLocation, t[a].name, t[a].contentName, s);
			}
		}
		return i;
	}
	static _compilePatterns(t, n, r) {
		let i = [];
		if (t) for (let a = 0, o = t.length; a < o; a++) {
			let o = t[a], s = -1;
			if (o.include) {
				let t = Ee(o.include);
				switch (t.kind) {
					case 0:
					case 1:
						s = e.getCompiledRuleId(r[o.include], n, r);
						break;
					case 2:
						let i = r[t.ruleName];
						i && (s = e.getCompiledRuleId(i, n, r));
						break;
					case 3:
					case 4:
						let a = t.scopeName, c = t.kind === 4 ? t.ruleName : null, l = n.getExternalGrammar(a, r);
						if (l) {
							if (c) {
								let t = l.repository[c];
								t && (s = e.getCompiledRuleId(t, n, l.repository));
							} else s = e.getCompiledRuleId(l.repository.$self, n, l.repository);
						}
				}
			} else s = e.getCompiledRuleId(o, n, r);
			if (s !== -1) {
				let e = n.getRule(s), t = !1;
				if ((e instanceof Ie || e instanceof Le || e instanceof Re) && e.hasMissingPatterns && e.patterns.length === 0 && (t = !0), t) continue;
				i.push(s);
			}
		}
		return {
			patterns: i,
			hasMissingPatterns: (t ? t.length : 0) !== i.length
		};
	}
}, Be = class e {
	source;
	ruleId;
	hasAnchor;
	hasBackReferences;
	_anchorCache;
	constructor(e, t) {
		if (e && typeof e == "string") {
			let t = e.length, n = 0, r = [], i = !1;
			for (let a = 0; a < t; a++) if (e.charAt(a) === "\\" && a + 1 < t) {
				let t = e.charAt(a + 1);
				t === "z" ? (r.push(e.substring(n, a)), r.push("$(?!\\n)(?<!\\n)"), n = a + 2) : (t === "A" || t === "G") && (i = !0), a++;
			}
			this.hasAnchor = i, n === 0 ? this.source = e : (r.push(e.substring(n, t)), this.source = r.join(""));
		} else this.hasAnchor = !1, this.source = e;
		this._anchorCache = this.hasAnchor ? this._buildAnchorCache() : null, this.ruleId = t, this.hasBackReferences = typeof this.source == "string" && De.test(this.source);
	}
	clone() {
		return new e(this.source, this.ruleId);
	}
	setSource(e) {
		this.source !== e && (this.source = e, this.hasAnchor && (this._anchorCache = this._buildAnchorCache()));
	}
	resolveBackReferences(e, t) {
		if (typeof this.source != "string") throw Error("This method should only be called if the source is a string");
		let n = t.map((t) => e.substring(t.start, t.end));
		return Oe.lastIndex = 0, this.source.replace(Oe, (e, t) => h(n[parseInt(t, 10)] || ""));
	}
	_buildAnchorCache() {
		if (typeof this.source != "string") throw Error("This method should only be called if the source is a string");
		let e = [], t = [], n = [], r = [], i, a, o, s;
		for (i = 0, a = this.source.length; i < a; i++) o = this.source.charAt(i), e[i] = o, t[i] = o, n[i] = o, r[i] = o, o === "\\" && i + 1 < a && (s = this.source.charAt(i + 1), s === "A" ? (e[i + 1] = "￿", t[i + 1] = "￿", n[i + 1] = "A", r[i + 1] = "A") : s === "G" ? (e[i + 1] = "￿", t[i + 1] = "G", n[i + 1] = "￿", r[i + 1] = "G") : (e[i + 1] = s, t[i + 1] = s, n[i + 1] = s, r[i + 1] = s), i++);
		return {
			A0_G0: e.join(""),
			A0_G1: t.join(""),
			A1_G0: n.join(""),
			A1_G1: r.join("")
		};
	}
	resolveAnchors(e, t) {
		return !this.hasAnchor || !this._anchorCache || typeof this.source != "string" ? this.source : e ? t ? this._anchorCache.A1_G1 : this._anchorCache.A1_G0 : t ? this._anchorCache.A0_G1 : this._anchorCache.A0_G0;
	}
}, Ve = class {
	_items;
	_hasAnchors;
	_cached;
	_anchorCache;
	constructor() {
		this._items = [], this._hasAnchors = !1, this._cached = null, this._anchorCache = {
			A0_G0: null,
			A0_G1: null,
			A1_G0: null,
			A1_G1: null
		};
	}
	dispose() {
		this._disposeCaches();
	}
	_disposeCaches() {
		this._cached &&= (this._cached.dispose(), null), this._anchorCache.A0_G0 && (this._anchorCache.A0_G0.dispose(), this._anchorCache.A0_G0 = null), this._anchorCache.A0_G1 && (this._anchorCache.A0_G1.dispose(), this._anchorCache.A0_G1 = null), this._anchorCache.A1_G0 && (this._anchorCache.A1_G0.dispose(), this._anchorCache.A1_G0 = null), this._anchorCache.A1_G1 && (this._anchorCache.A1_G1.dispose(), this._anchorCache.A1_G1 = null);
	}
	push(e) {
		this._items.push(e), this._hasAnchors = this._hasAnchors || e.hasAnchor;
	}
	unshift(e) {
		this._items.unshift(e), this._hasAnchors = this._hasAnchors || e.hasAnchor;
	}
	length() {
		return this._items.length;
	}
	setSource(e, t) {
		this._items[e].source !== t && (this._disposeCaches(), this._items[e].setSource(t));
	}
	compile(e) {
		if (!this._cached) {
			let t = this._items.map((e) => e.source);
			this._cached = new He(e, t, this._items.map((e) => e.ruleId));
		}
		return this._cached;
	}
	compileAG(e, t, n) {
		return this._hasAnchors ? t ? n ? (this._anchorCache.A1_G1 || (this._anchorCache.A1_G1 = this._resolveAnchors(e, t, n)), this._anchorCache.A1_G1) : (this._anchorCache.A1_G0 || (this._anchorCache.A1_G0 = this._resolveAnchors(e, t, n)), this._anchorCache.A1_G0) : n ? (this._anchorCache.A0_G1 || (this._anchorCache.A0_G1 = this._resolveAnchors(e, t, n)), this._anchorCache.A0_G1) : (this._anchorCache.A0_G0 || (this._anchorCache.A0_G0 = this._resolveAnchors(e, t, n)), this._anchorCache.A0_G0) : this.compile(e);
	}
	_resolveAnchors(e, t, n) {
		return new He(e, this._items.map((e) => e.resolveAnchors(t, n)), this._items.map((e) => e.ruleId));
	}
}, He = class {
	constructor(e, t, n) {
		this.regExps = t, this.rules = n, this.scanner = e.createOnigScanner(t);
	}
	scanner;
	dispose() {
		typeof this.scanner.dispose == "function" && this.scanner.dispose();
	}
	toString() {
		let e = [];
		for (let t = 0, n = this.rules.length; t < n; t++) e.push("   - " + this.rules[t] + ": " + this.regExps[t]);
		return e.join("\n");
	}
	findNextMatchSync(e, t, n) {
		let r = this.scanner.findNextMatchSync(e, t, n);
		return r ? {
			ruleId: this.rules[r.index],
			captureIndices: r.captureIndices
		} : null;
	}
}, Ue = class {
	constructor(e, t) {
		this.languageId = e, this.tokenType = t;
	}
}, We = class e {
	_defaultAttributes;
	_embeddedLanguagesMatcher;
	constructor(e, t) {
		this._defaultAttributes = new Ue(e, 8), this._embeddedLanguagesMatcher = new Ge(Object.entries(t || {}));
	}
	getDefaultAttributes() {
		return this._defaultAttributes;
	}
	getBasicScopeAttributes(t) {
		return t === null ? e._NULL_SCOPE_METADATA : this._getBasicScopeAttributes.get(t);
	}
	static _NULL_SCOPE_METADATA = new Ue(0, 0);
	_getBasicScopeAttributes = new g((e) => new Ue(this._scopeToLanguage(e), this._toStandardTokenType(e)));
	_scopeToLanguage(e) {
		return this._embeddedLanguagesMatcher.match(e) || 0;
	}
	_toStandardTokenType(t) {
		let n = t.match(e.STANDARD_TOKEN_TYPE_REGEXP);
		if (!n) return 8;
		switch (n[1]) {
			case "comment": return 1;
			case "string": return 2;
			case "regex": return 3;
			case "meta.embedded": return 0;
		}
		throw Error("Unexpected match for standard token type!");
	}
	static STANDARD_TOKEN_TYPE_REGEXP = /\b(comment|string|regex|meta\.embedded)\b/;
}, Ge = class {
	values;
	scopesRegExp;
	constructor(e) {
		if (e.length === 0) this.values = null, this.scopesRegExp = null;
		else {
			this.values = new Map(e);
			let t = e.map(([e, t]) => h(e));
			t.sort(), t.reverse(), this.scopesRegExp = RegExp(`^((${t.join(")|(")}))($|\\.)`, "");
		}
	}
	match(e) {
		if (!this.scopesRegExp) return;
		let t = e.match(this.scopesRegExp);
		if (t) return this.values.get(t[1]);
	}
};
typeof process < "u" && process.env.VSCODE_TEXTMATE_DEBUG;
var Ke = class {
	constructor(e, t) {
		this.stack = e, this.stoppedEarly = t;
	}
};
function qe(e, t, n, r, i, a, o, s) {
	let c = t.content.length, l = !1, u = -1;
	if (o) {
		let o = Je(e, t, n, r, i, a);
		i = o.stack, r = o.linePos, n = o.isFirstLine, u = o.anchorPosition;
	}
	let d = Date.now();
	for (; !l;) {
		if (s !== 0 && Date.now() - d > s) return new Ke(i, !0);
		f();
	}
	return new Ke(i, !1);
	function f() {
		let o = Ye(e, t, n, r, i, u);
		if (!o) {
			a.produce(i, c), l = !0;
			return;
		}
		let s = o.captureIndices, d = o.matchedRuleId, f = s && s.length > 0 ? s[0].end > r : !1;
		if (d === ke) {
			let o = i.getRule(e);
			a.produce(i, s[0].start), i = i.withContentNameScopesList(i.nameScopesList), et(e, t, n, i, a, o.endCaptures, s), a.produce(i, s[0].end);
			let d = i;
			if (i = i.parent, u = d.getAnchorPos(), !f && d.getEnterPos() === r) {
				i = d, a.produce(i, c), l = !0;
				return;
			}
		} else {
			let o = e.getRule(d);
			a.produce(i, s[0].start);
			let p = i, m = o.getName(t.content, s), h = i.contentNameScopesList.pushAttributed(m, e);
			if (i = i.push(d, r, u, s[0].end === c, null, h, h), o instanceof Le) {
				let r = o;
				et(e, t, n, i, a, r.beginCaptures, s), a.produce(i, s[0].end), u = s[0].end;
				let d = r.getContentName(t.content, s), m = h.pushAttributed(d, e);
				if (i = i.withContentNameScopesList(m), r.endHasBackReferences && (i = i.withEndRule(r.getEndWithResolvedBackReferences(t.content, s))), !f && p.hasSameRuleAs(i)) {
					i = i.pop(), a.produce(i, c), l = !0;
					return;
				}
			} else if (o instanceof Re) {
				let r = o;
				et(e, t, n, i, a, r.beginCaptures, s), a.produce(i, s[0].end), u = s[0].end;
				let d = r.getContentName(t.content, s), m = h.pushAttributed(d, e);
				if (i = i.withContentNameScopesList(m), r.whileHasBackReferences && (i = i.withEndRule(r.getWhileWithResolvedBackReferences(t.content, s))), !f && p.hasSameRuleAs(i)) {
					i = i.pop(), a.produce(i, c), l = !0;
					return;
				}
			} else if (et(e, t, n, i, a, o.captures, s), a.produce(i, s[0].end), i = i.pop(), !f) {
				i = i.safePop(), a.produce(i, c), l = !0;
				return;
			}
		}
		s[0].end > r && (r = s[0].end, n = !1);
	}
}
function Je(e, t, n, r, i, a) {
	let o = i.beginRuleCapturedEOL ? 0 : -1, s = [];
	for (let t = i; t; t = t.pop()) {
		let n = t.getRule(e);
		n instanceof Re && s.push({
			rule: n,
			stack: t
		});
	}
	for (let c = s.pop(); c; c = s.pop()) {
		let { ruleScanner: s, findOptions: l } = $e(c.rule, e, c.stack.endRule, n, r === o), u = s.findNextMatchSync(t, r, l);
		if (u) {
			if (u.ruleId !== Ae) {
				i = c.stack.pop();
				break;
			}
			u.captureIndices && u.captureIndices.length && (a.produce(c.stack, u.captureIndices[0].start), et(e, t, n, c.stack, a, c.rule.whileCaptures, u.captureIndices), a.produce(c.stack, u.captureIndices[0].end), o = u.captureIndices[0].end, u.captureIndices[0].end > r && (r = u.captureIndices[0].end, n = !1));
		} else {
			i = c.stack.pop();
			break;
		}
	}
	return {
		stack: i,
		linePos: r,
		anchorPosition: o,
		isFirstLine: n
	};
}
function Ye(e, t, n, r, i, a) {
	let o = Xe(e, t, n, r, i, a), s = e.getInjections();
	if (s.length === 0) return o;
	let c = Ze(s, e, t, n, r, i, a);
	if (!c) return o;
	if (!o) return c;
	let l = o.captureIndices[0].start, u = c.captureIndices[0].start;
	return u < l || c.priorityMatch && u === l ? c : o;
}
function Xe(e, t, n, r, i, a) {
	let { ruleScanner: o, findOptions: s } = Qe(i.getRule(e), e, i.endRule, n, r === a), c = o.findNextMatchSync(t, r, s);
	return c ? {
		captureIndices: c.captureIndices,
		matchedRuleId: c.ruleId
	} : null;
}
function Ze(e, t, n, r, i, a, o) {
	let s = Number.MAX_VALUE, c = null, l, u = 0, d = a.contentNameScopesList.getScopeNames();
	for (let a = 0, f = e.length; a < f; a++) {
		let f = e[a];
		if (!f.matcher(d)) continue;
		let { ruleScanner: p, findOptions: m } = Qe(t.getRule(f.ruleId), t, null, r, i === o), h = p.findNextMatchSync(n, i, m);
		if (!h) continue;
		let g = h.captureIndices[0].start;
		if (!(g >= s) && (s = g, c = h.captureIndices, l = h.ruleId, u = f.priority, s === i)) break;
	}
	return c ? {
		priorityMatch: u === -1,
		captureIndices: c,
		matchedRuleId: l
	} : null;
}
function Qe(e, t, n, r, i) {
	return {
		ruleScanner: e.compileAG(t, n, r, i),
		findOptions: 0
	};
}
function $e(e, t, n, r, i) {
	return {
		ruleScanner: e.compileWhileAG(t, n, r, i),
		findOptions: 0
	};
}
function et(e, t, n, r, i, a, o) {
	if (a.length === 0) return;
	let s = t.content, c = Math.min(a.length, o.length), l = [], u = o[0].end;
	for (let t = 0; t < c; t++) {
		let c = a[t];
		if (c === null) continue;
		let d = o[t];
		if (d.length === 0) continue;
		if (d.start > u) break;
		for (; l.length > 0 && l[l.length - 1].endPos <= d.start;) i.produceFromScopes(l[l.length - 1].scopes, l[l.length - 1].endPos), l.pop();
		if (l.length > 0 ? i.produceFromScopes(l[l.length - 1].scopes, d.start) : i.produce(r, d.start), c.retokenizeCapturedWithRuleId) {
			let t = c.getName(s, o), a = r.contentNameScopesList.pushAttributed(t, e), l = c.getContentName(s, o), u = a.pushAttributed(l, e), f = r.push(c.retokenizeCapturedWithRuleId, d.start, -1, !1, null, a, u), p = e.createOnigString(s.substring(0, d.end));
			qe(e, p, n && d.start === 0, d.start, f, i, !1, 0), fe(p);
			continue;
		}
		let f = c.getName(s, o);
		if (f !== null) {
			let t = (l.length > 0 ? l[l.length - 1].scopes : r.contentNameScopesList).pushAttributed(f, e);
			l.push(new tt(t, d.end));
		}
	}
	for (; l.length > 0;) i.produceFromScopes(l[l.length - 1].scopes, l[l.length - 1].endPos), l.pop();
}
var tt = class {
	scopes;
	endPos;
	constructor(e, t) {
		this.scopes = e, this.endPos = t;
	}
};
function nt(e, t, n, r, i, a, o, s) {
	return new ot(e, t, n, r, i, a, o, s);
}
function rt(e, t, n, r, i) {
	let a = le(t, it), o = ze.getCompiledRuleId(n, r, i.repository);
	for (let n of a) e.push({
		debugSelector: t,
		matcher: n.matcher,
		ruleId: o,
		grammar: i,
		priority: n.priority
	});
}
function it(e, t) {
	if (t.length < e.length) return !1;
	let n = 0;
	return e.every((e) => {
		for (let r = n; r < t.length; r++) if (at(t[r], e)) return n = r + 1, !0;
		return !1;
	});
}
function at(e, t) {
	if (!e) return !1;
	if (e === t) return !0;
	let n = t.length;
	return e.length > n && e.substr(0, n) === t && e[n] === ".";
}
var ot = class {
	constructor(e, t, n, r, i, a, o, s) {
		if (this._rootScopeName = e, this.balancedBracketSelectors = a, this._onigLib = s, this._basicScopeAttributesProvider = new We(n, r), this._rootId = -1, this._lastRuleId = 0, this._ruleId2desc = [null], this._includedGrammars = {}, this._grammarRepository = o, this._grammar = st(t, null), this._injections = null, this._tokenTypeMatchers = [], i) for (let e of Object.keys(i)) {
			let t = le(e, it);
			for (let n of t) this._tokenTypeMatchers.push({
				matcher: n.matcher,
				type: i[e]
			});
		}
	}
	_rootId;
	_lastRuleId;
	_ruleId2desc;
	_includedGrammars;
	_grammarRepository;
	_grammar;
	_injections;
	_basicScopeAttributesProvider;
	_tokenTypeMatchers;
	get themeProvider() {
		return this._grammarRepository;
	}
	dispose() {
		for (let e of this._ruleId2desc) e && e.dispose();
	}
	createOnigScanner(e) {
		return this._onigLib.createOnigScanner(e);
	}
	createOnigString(e) {
		return this._onigLib.createOnigString(e);
	}
	getMetadataForScope(e) {
		return this._basicScopeAttributesProvider.getBasicScopeAttributes(e);
	}
	_collectInjections() {
		let e = {
			lookup: (e) => e === this._rootScopeName ? this._grammar : this.getExternalGrammar(e),
			injections: (e) => this._grammarRepository.injections(e)
		}, t = [], n = this._rootScopeName, r = e.lookup(n);
		if (r) {
			let e = r.injections;
			if (e) for (let n in e) rt(t, n, e[n], this, r);
			let i = this._grammarRepository.injections(n);
			i && i.forEach((e) => {
				let n = this.getExternalGrammar(e);
				if (n) {
					let e = n.injectionSelector;
					e && rt(t, e, n, this, n);
				}
			});
		}
		return t.sort((e, t) => e.priority - t.priority), t;
	}
	getInjections() {
		return this._injections === null && (this._injections = this._collectInjections()), this._injections;
	}
	registerRule(e) {
		let t = ++this._lastRuleId, n = e(je(t));
		return this._ruleId2desc[t] = n, n;
	}
	getRule(e) {
		return this._ruleId2desc[Me(e)];
	}
	getExternalGrammar(e, t) {
		if (this._includedGrammars[e]) return this._includedGrammars[e];
		if (this._grammarRepository) {
			let n = this._grammarRepository.lookup(e);
			if (n) return this._includedGrammars[e] = st(n, t && t.$base), this._includedGrammars[e];
		}
	}
	tokenizeLine(e, t, n = 0) {
		let r = this._tokenize(e, t, !1, n);
		return {
			tokens: r.lineTokens.getResult(r.ruleStack, r.lineLength),
			ruleStack: r.ruleStack,
			stoppedEarly: r.stoppedEarly
		};
	}
	tokenizeLine2(e, t, n = 0) {
		let r = this._tokenize(e, t, !0, n);
		return {
			tokens: r.lineTokens.getBinaryResult(r.ruleStack, r.lineLength),
			ruleStack: r.ruleStack,
			stoppedEarly: r.stoppedEarly
		};
	}
	_tokenize(e, t, n, r) {
		this._rootId === -1 && (this._rootId = ze.getCompiledRuleId(this._grammar.repository.$self, this, this._grammar.repository), this.getInjections());
		let i;
		if (!t || t === lt.NULL) {
			i = !0;
			let e = this._basicScopeAttributesProvider.getDefaultAttributes(), n = this.themeProvider.getDefaults(), r = oe.set(0, e.languageId, e.tokenType, null, n.fontStyle, n.foregroundId, n.backgroundId), a = this.getRule(this._rootId).getName(null, null), o;
			o = a ? ct.createRootAndLookUpScopeName(a, r, this) : ct.createRoot("unknown", r), t = new lt(null, this._rootId, -1, -1, !1, null, o, o);
		} else i = !1, t.reset();
		e += "\n";
		let a = this.createOnigString(e), o = a.content.length, s = new dt(n, e, this._tokenTypeMatchers, this.balancedBracketSelectors), c = qe(this, a, i, 0, t, s, !0, r);
		return fe(a), {
			lineLength: o,
			lineTokens: s,
			ruleStack: c.stack,
			stoppedEarly: c.stoppedEarly
		};
	}
};
function st(e, t) {
	return e = i(e), e.repository = e.repository || {}, e.repository.$self = {
		$vscodeTextmateLocation: e.$vscodeTextmateLocation,
		patterns: e.patterns,
		name: e.scopeName
	}, e.repository.$base = t || e.repository.$self, e;
}
var ct = class e {
	constructor(e, t, n) {
		this.parent = e, this.scopePath = t, this.tokenAttributes = n;
	}
	static fromExtension(t, n) {
		let r = t, i = t?.scopePath ?? null;
		for (let t of n) i = v.push(i, t.scopeNames), r = new e(r, i, t.encodedTokenAttributes);
		return r;
	}
	static createRoot(t, n) {
		return new e(null, new v(null, t), n);
	}
	static createRootAndLookUpScopeName(t, n, r) {
		let i = r.getMetadataForScope(t), a = new v(null, t), o = r.themeProvider.themeMatch(a), s = e.mergeAttributes(n, i, o);
		return new e(null, a, s);
	}
	get scopeName() {
		return this.scopePath.scopeName;
	}
	toString() {
		return this.getScopeNames().join(" ");
	}
	equals(t) {
		return e.equals(this, t);
	}
	static equals(e, t) {
		do {
			if (e === t || !e && !t) return !0;
			if (!e || !t || e.scopeName !== t.scopeName || e.tokenAttributes !== t.tokenAttributes) return !1;
			e = e.parent, t = t.parent;
		} while (!0);
	}
	static mergeAttributes(e, t, n) {
		let r = -1, i = 0, a = 0;
		return n !== null && (r = n.fontStyle, i = n.foregroundId, a = n.backgroundId), oe.set(e, t.languageId, t.tokenType, null, r, i, a);
	}
	pushAttributed(t, n) {
		if (t === null) return this;
		if (t.indexOf(" ") === -1) return e._pushAttributed(this, t, n);
		let r = t.split(/ /g), i = this;
		for (let t of r) i = e._pushAttributed(i, t, n);
		return i;
	}
	static _pushAttributed(t, n, r) {
		let i = r.getMetadataForScope(n), a = t.scopePath.push(n), o = r.themeProvider.themeMatch(a), s = e.mergeAttributes(t.tokenAttributes, i, o);
		return new e(t, a, s);
	}
	getScopeNames() {
		return this.scopePath.getSegments();
	}
	getExtensionIfDefined(e) {
		let t = [], n = this;
		for (; n && n !== e;) t.push({
			encodedTokenAttributes: n.tokenAttributes,
			scopeNames: n.scopePath.getExtensionIfDefined(n.parent?.scopePath ?? null)
		}), n = n.parent;
		return n === e ? t.reverse() : void 0;
	}
}, lt = class e {
	constructor(e, t, n, r, i, a, o, s) {
		this.parent = e, this.ruleId = t, this.beginRuleCapturedEOL = i, this.endRule = a, this.nameScopesList = o, this.contentNameScopesList = s, this.depth = this.parent ? this.parent.depth + 1 : 1, this._enterPos = n, this._anchorPos = r;
	}
	_stackElementBrand = void 0;
	static NULL = new e(null, 0, 0, 0, !1, null, null, null);
	_enterPos;
	_anchorPos;
	depth;
	equals(t) {
		return t !== null && e._equals(this, t);
	}
	static _equals(e, t) {
		return e === t ? !0 : this._structuralEquals(e, t) ? ct.equals(e.contentNameScopesList, t.contentNameScopesList) : !1;
	}
	static _structuralEquals(e, t) {
		do {
			if (e === t || !e && !t) return !0;
			if (!e || !t || e.depth !== t.depth || e.ruleId !== t.ruleId || e.endRule !== t.endRule) return !1;
			e = e.parent, t = t.parent;
		} while (!0);
	}
	clone() {
		return this;
	}
	static _reset(e) {
		for (; e;) e._enterPos = -1, e._anchorPos = -1, e = e.parent;
	}
	reset() {
		e._reset(this);
	}
	pop() {
		return this.parent;
	}
	safePop() {
		return this.parent ? this.parent : this;
	}
	push(t, n, r, i, a, o, s) {
		return new e(this, t, n, r, i, a, o, s);
	}
	getEnterPos() {
		return this._enterPos;
	}
	getAnchorPos() {
		return this._anchorPos;
	}
	getRule(e) {
		return e.getRule(this.ruleId);
	}
	toString() {
		let e = [];
		return this._writeString(e, 0), "[" + e.join(",") + "]";
	}
	_writeString(e, t) {
		return this.parent && (t = this.parent._writeString(e, t)), e[t++] = `(${this.ruleId}, ${this.nameScopesList?.toString()}, ${this.contentNameScopesList?.toString()})`, t;
	}
	withContentNameScopesList(e) {
		return this.contentNameScopesList === e ? this : this.parent.push(this.ruleId, this._enterPos, this._anchorPos, this.beginRuleCapturedEOL, this.endRule, this.nameScopesList, e);
	}
	withEndRule(t) {
		return this.endRule === t ? this : new e(this.parent, this.ruleId, this._enterPos, this._anchorPos, this.beginRuleCapturedEOL, t, this.nameScopesList, this.contentNameScopesList);
	}
	hasSameRuleAs(e) {
		let t = this;
		for (; t && t._enterPos === e._enterPos;) {
			if (t.ruleId === e.ruleId) return !0;
			t = t.parent;
		}
		return !1;
	}
	toStateStackFrame() {
		return {
			ruleId: Me(this.ruleId),
			beginRuleCapturedEOL: this.beginRuleCapturedEOL,
			endRule: this.endRule,
			nameScopesList: this.nameScopesList?.getExtensionIfDefined(this.parent?.nameScopesList ?? null) ?? [],
			contentNameScopesList: this.contentNameScopesList?.getExtensionIfDefined(this.nameScopesList) ?? []
		};
	}
	static pushFrame(t, n) {
		let r = ct.fromExtension(t?.nameScopesList ?? null, n.nameScopesList);
		return new e(t, je(n.ruleId), n.enterPos ?? -1, n.anchorPos ?? -1, n.beginRuleCapturedEOL, n.endRule, r, ct.fromExtension(r, n.contentNameScopesList));
	}
}, ut = class {
	balancedBracketScopes;
	unbalancedBracketScopes;
	allowAny = !1;
	constructor(e, t) {
		this.balancedBracketScopes = e.flatMap((e) => e === "*" ? (this.allowAny = !0, []) : le(e, it).map((e) => e.matcher)), this.unbalancedBracketScopes = t.flatMap((e) => le(e, it).map((e) => e.matcher));
	}
	get matchesAlways() {
		return this.allowAny && this.unbalancedBracketScopes.length === 0;
	}
	get matchesNever() {
		return this.balancedBracketScopes.length === 0 && !this.allowAny;
	}
	match(e) {
		for (let t of this.unbalancedBracketScopes) if (t(e)) return !1;
		for (let t of this.balancedBracketScopes) if (t(e)) return !0;
		return this.allowAny;
	}
}, dt = class {
	constructor(e, t, n, r) {
		this.balancedBracketSelectors = r, this._emitBinaryTokens = e, this._tokenTypeOverrides = n, this._lineText = null, this._tokens = [], this._binaryTokens = [], this._lastTokenEndIndex = 0;
	}
	_emitBinaryTokens;
	_lineText;
	_tokens;
	_binaryTokens;
	_lastTokenEndIndex;
	_tokenTypeOverrides;
	produce(e, t) {
		this.produceFromScopes(e.contentNameScopesList, t);
	}
	produceFromScopes(e, t) {
		if (this._lastTokenEndIndex >= t) return;
		if (this._emitBinaryTokens) {
			let n = e?.tokenAttributes ?? 0, r = !1;
			if (this.balancedBracketSelectors?.matchesAlways && (r = !0), this._tokenTypeOverrides.length > 0 || this.balancedBracketSelectors && !this.balancedBracketSelectors.matchesAlways && !this.balancedBracketSelectors.matchesNever) {
				let t = e?.getScopeNames() ?? [];
				for (let e of this._tokenTypeOverrides) e.matcher(t) && (n = oe.set(n, 0, se(e.type), null, -1, 0, 0));
				this.balancedBracketSelectors && (r = this.balancedBracketSelectors.match(t));
			}
			if (r && (n = oe.set(n, 0, 8, r, -1, 0, 0)), this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 1] === n) {
				this._lastTokenEndIndex = t;
				return;
			}
			this._binaryTokens.push(this._lastTokenEndIndex), this._binaryTokens.push(n), this._lastTokenEndIndex = t;
			return;
		}
		let n = e?.getScopeNames() ?? [];
		this._tokens.push({
			startIndex: this._lastTokenEndIndex,
			endIndex: t,
			scopes: n
		}), this._lastTokenEndIndex = t;
	}
	getResult(e, t) {
		return this._tokens.length > 0 && this._tokens[this._tokens.length - 1].startIndex === t - 1 && this._tokens.pop(), this._tokens.length === 0 && (this._lastTokenEndIndex = -1, this.produce(e, t), this._tokens[this._tokens.length - 1].startIndex = 0), this._tokens;
	}
	getBinaryResult(e, t) {
		this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 2] === t - 1 && (this._binaryTokens.pop(), this._binaryTokens.pop()), this._binaryTokens.length === 0 && (this._lastTokenEndIndex = -1, this.produce(e, t), this._binaryTokens[this._binaryTokens.length - 2] = 0);
		let n = new Uint32Array(this._binaryTokens.length);
		for (let e = 0, t = this._binaryTokens.length; e < t; e++) n[e] = this._binaryTokens[e];
		return n;
	}
}, ft = class {
	constructor(e, t) {
		this._onigLib = t, this._theme = e;
	}
	_grammars = /* @__PURE__ */ new Map();
	_rawGrammars = /* @__PURE__ */ new Map();
	_injectionGrammars = /* @__PURE__ */ new Map();
	_theme;
	dispose() {
		for (let e of this._grammars.values()) e.dispose();
	}
	setTheme(e) {
		this._theme = e;
	}
	getColorMap() {
		return this._theme.getColorMap();
	}
	addGrammar(e, t) {
		this._rawGrammars.set(e.scopeName, e), t && this._injectionGrammars.set(e.scopeName, t);
	}
	lookup(e) {
		return this._rawGrammars.get(e);
	}
	injections(e) {
		return this._injectionGrammars.get(e);
	}
	getDefaults() {
		return this._theme.getDefaults();
	}
	themeMatch(e) {
		return this._theme.match(e);
	}
	grammarForScopeName(e, t, n, r, i) {
		if (!this._grammars.has(e)) {
			let a = this._rawGrammars.get(e);
			if (!a) return null;
			this._grammars.set(e, nt(e, a, t, n, r, i, this, this._onigLib));
		}
		return this._grammars.get(e);
	}
}, pt = class {
	_options;
	_syncRegistry;
	_ensureGrammarCache;
	constructor(e) {
		this._options = e, this._syncRegistry = new ft(_.createFromRawTheme(e.theme, e.colorMap), e.onigLib), this._ensureGrammarCache = /* @__PURE__ */ new Map();
	}
	dispose() {
		this._syncRegistry.dispose();
	}
	setTheme(e, t) {
		this._syncRegistry.setTheme(_.createFromRawTheme(e, t));
	}
	getColorMap() {
		return this._syncRegistry.getColorMap();
	}
	loadGrammarWithEmbeddedLanguages(e, t, n) {
		return this.loadGrammarWithConfiguration(e, t, { embeddedLanguages: n });
	}
	loadGrammarWithConfiguration(e, t, n) {
		return this._loadGrammar(e, t, n.embeddedLanguages, n.tokenTypes, new ut(n.balancedBracketSelectors || [], n.unbalancedBracketSelectors || []));
	}
	loadGrammar(e) {
		return this._loadGrammar(e, 0, null, null, null);
	}
	_loadGrammar(e, t, n, r, i) {
		let a = new ge(this._syncRegistry, e);
		for (; a.Q.length > 0;) a.Q.map((e) => this._loadSingleGrammar(e.scopeName)), a.processQueue();
		return this._grammarForScopeName(e, t, n, r, i);
	}
	_loadSingleGrammar(e) {
		this._ensureGrammarCache.has(e) || (this._doLoadSingleGrammar(e), this._ensureGrammarCache.set(e, !0));
	}
	_doLoadSingleGrammar(e) {
		let t = this._options.loadGrammar(e);
		if (t) {
			let n = typeof this._options.getInjections == "function" ? this._options.getInjections(e) : void 0;
			this._syncRegistry.addGrammar(t, n);
		}
	}
	addGrammar(e, t = [], n = 0, r = null) {
		return this._syncRegistry.addGrammar(e, t), this._grammarForScopeName(e.scopeName, n, r);
	}
	_grammarForScopeName(e, t = 0, n = null, r = null, i = null) {
		return this._syncRegistry.grammarForScopeName(e, t, n, r, i);
	}
}, mt = lt.NULL;
//#endregion
//#region node_modules/@shikijs/primitive/dist/index.mjs
function ht(e, t) {
	let n = typeof e == "string" ? {} : { ...e.colorReplacements }, r = typeof e == "string" ? e : e.name;
	for (let [e, i] of Object.entries(t?.colorReplacements || {})) typeof i == "string" ? n[e] = i : e === r && Object.assign(n, i);
	return n;
}
function w(e, t) {
	return e && (t?.[e?.toLowerCase()] || e);
}
function gt(e) {
	return Array.isArray(e) ? e : [e];
}
async function _t(e) {
	return Promise.resolve(typeof e == "function" ? e() : e).then((e) => e.default || e);
}
function vt(e) {
	return !e || [
		"plaintext",
		"txt",
		"text",
		"plain"
	].includes(e);
}
function yt(e) {
	return e === "ansi" || vt(e);
}
function bt(e) {
	return e === "none";
}
function xt(e) {
	return bt(e);
}
var St = /(\r?\n)/g;
function Ct(e, t = !1) {
	if (e.length === 0) return [["", 0]];
	let n = e.split(St), r = 0, i = [];
	for (let e = 0; e < n.length; e += 2) {
		let a = t ? n[e] + (n[e + 1] || "") : n[e];
		i.push([a, r]), r += n[e].length, r += n[e + 1]?.length || 0;
	}
	return i;
}
var wt = {
	light: "#333333",
	dark: "#bbbbbb"
}, Tt = {
	light: "#fffffe",
	dark: "#1e1e1e"
}, Et = "__shiki_resolved";
function Dt(e) {
	if (e?.[Et]) return e;
	let t = { ...e };
	t.tokenColors && !t.settings && (t.settings = t.tokenColors, delete t.tokenColors), t.type ||= "dark", t.colorReplacements = { ...t.colorReplacements }, t.settings ||= [];
	let { bg: n, fg: r } = t;
	if (!n || !r) {
		let e = t.settings ? t.settings.find((e) => !e.name && !e.scope) : void 0;
		e?.settings?.foreground && (r = e.settings.foreground), e?.settings?.background && (n = e.settings.background), !r && t?.colors?.["editor.foreground"] && (r = t.colors["editor.foreground"]), !n && t?.colors?.["editor.background"] && (n = t.colors["editor.background"]), r ||= t.type === "light" ? wt.light : wt.dark, n ||= t.type === "light" ? Tt.light : Tt.dark, t.fg = r, t.bg = n;
	}
	t.settings[0] && t.settings[0].settings && !t.settings[0].scope || t.settings.unshift({ settings: {
		foreground: t.fg,
		background: t.bg
	} });
	let i = 0, a = /* @__PURE__ */ new Map();
	function o(e) {
		if (a.has(e)) return a.get(e);
		i += 1;
		let n = `#${i.toString(16).padStart(8, "0").toLowerCase()}`;
		return t.colorReplacements?.[`#${n}`] ? o(e) : (a.set(e, n), n);
	}
	t.settings = t.settings.map((e) => {
		let n = e.settings?.foreground && !e.settings.foreground.startsWith("#"), r = e.settings?.background && !e.settings.background.startsWith("#");
		if (!n && !r) return e;
		let i = {
			...e,
			settings: { ...e.settings }
		};
		if (n) {
			let n = o(e.settings.foreground);
			t.colorReplacements[n] = e.settings.foreground, i.settings.foreground = n;
		}
		if (r) {
			let n = o(e.settings.background);
			t.colorReplacements[n] = e.settings.background, i.settings.background = n;
		}
		return i;
	});
	for (let e of Object.keys(t.colors || {})) if ((e === "editor.foreground" || e === "editor.background" || e.startsWith("terminal.ansi")) && !t.colors[e]?.startsWith("#")) {
		let n = o(t.colors[e]);
		t.colorReplacements[n] = t.colors[e], t.colors[e] = n;
	}
	return Object.defineProperty(t, Et, {
		enumerable: !1,
		writable: !1,
		value: !0
	}), t;
}
async function Ot(e) {
	return [...new Set((await Promise.all(e.filter((e) => !yt(e)).map(async (e) => await _t(e).then((e) => Array.isArray(e) ? e : [e])))).flat())];
}
async function kt(e) {
	return (await Promise.all(e.map(async (e) => xt(e) ? null : Dt(await _t(e))))).filter((e) => !!e);
}
function At(e, t) {
	if (!t) return e;
	if (t[e]) {
		let n = /* @__PURE__ */ new Set([e]);
		for (; t[e];) {
			if (e = t[e], n.has(e)) throw new r(`Circular alias \`${[...n].join(" -> ")} -> ${e}\``);
			n.add(e);
		}
	}
	return e;
}
var jt = class extends pt {
	_resolver;
	_themes;
	_langs;
	_alias;
	_resolvedThemes = /* @__PURE__ */ new Map();
	_resolvedGrammars = /* @__PURE__ */ new Map();
	_langMap = /* @__PURE__ */ new Map();
	_langGraph = /* @__PURE__ */ new Map();
	_textmateThemeCache = /* @__PURE__ */ new WeakMap();
	_loadedThemesCache = null;
	_loadedLanguagesCache = null;
	constructor(e, t, n, r = {}) {
		super(e), this._resolver = e, this._themes = t, this._langs = n, this._alias = r, this._themes.map((e) => this.loadTheme(e)), this.loadLanguages(this._langs);
	}
	getTheme(e) {
		return typeof e == "string" ? this._resolvedThemes.get(e) : this.loadTheme(e);
	}
	loadTheme(e) {
		let t = Dt(e);
		return t.name && (this._resolvedThemes.set(t.name, t), this._loadedThemesCache = null), t;
	}
	getLoadedThemes() {
		return this._loadedThemesCache ||= [...this._resolvedThemes.keys()], this._loadedThemesCache;
	}
	setTheme(e) {
		let t = this._textmateThemeCache.get(e);
		t || (t = _.createFromRawTheme(e), this._textmateThemeCache.set(e, t)), this._syncRegistry.setTheme(t);
	}
	getGrammar(e) {
		return e = At(e, this._alias), this._resolvedGrammars.get(e);
	}
	loadLanguage(e) {
		if (this.getGrammar(e.name)) return;
		let t = new Set([...this._langMap.values()].filter((t) => t.embeddedLangsLazy?.includes(e.name)));
		this._resolver.addLanguage(e);
		let n = {
			balancedBracketSelectors: e.balancedBracketSelectors || ["*"],
			unbalancedBracketSelectors: e.unbalancedBracketSelectors || []
		};
		this._syncRegistry._rawGrammars.set(e.scopeName, e);
		let r = this.loadGrammarWithConfiguration(e.scopeName, 1, n);
		if (r.name = e.name, this._resolvedGrammars.set(e.name, r), e.aliases && e.aliases.forEach((t) => {
			this._alias[t] = e.name;
		}), this._loadedLanguagesCache = null, t.size) for (let e of t) this._resolvedGrammars.delete(e.name), this._loadedLanguagesCache = null, this._syncRegistry?._injectionGrammars?.delete(e.scopeName), this._syncRegistry?._grammars?.delete(e.scopeName), this.loadLanguage(this._langMap.get(e.name));
	}
	dispose() {
		super.dispose(), this._resolvedThemes.clear(), this._resolvedGrammars.clear(), this._langMap.clear(), this._langGraph.clear(), this._loadedThemesCache = null;
	}
	loadLanguages(e) {
		for (let t of e) this.resolveEmbeddedLanguages(t);
		let t = [...this._langGraph.entries()], n = t.filter(([e, t]) => !t);
		if (n.length) {
			let e = t.filter(([e, t]) => t ? (t.embeddedLanguages || t.embeddedLangs)?.some((e) => n.map(([e]) => e).includes(e)) : !1).filter((e) => !n.includes(e));
			throw new r(`Missing languages ${n.map(([e]) => `\`${e}\``).join(", ")}, required by ${e.map(([e]) => `\`${e}\``).join(", ")}`);
		}
		for (let [e, n] of t) this._resolver.addLanguage(n);
		for (let [e, n] of t) this.loadLanguage(n);
	}
	getLoadedLanguages() {
		return this._loadedLanguagesCache ||= [.../* @__PURE__ */ new Set([...this._resolvedGrammars.keys(), ...Object.keys(this._alias)])], this._loadedLanguagesCache;
	}
	resolveEmbeddedLanguages(e) {
		this._langMap.set(e.name, e), this._langGraph.set(e.name, e);
		let t = e.embeddedLanguages ?? e.embeddedLangs;
		if (t) for (let e of t) this._langGraph.set(e, this._langMap.get(e));
	}
}, Mt = class {
	_langs = /* @__PURE__ */ new Map();
	_scopeToLang = /* @__PURE__ */ new Map();
	_injections = /* @__PURE__ */ new Map();
	_onigLib;
	constructor(e, t) {
		this._onigLib = {
			createOnigScanner: (t) => e.createScanner(t),
			createOnigString: (t) => e.createString(t)
		}, t.forEach((e) => this.addLanguage(e));
	}
	get onigLib() {
		return this._onigLib;
	}
	getLangRegistration(e) {
		return this._langs.get(e);
	}
	loadGrammar(e) {
		return this._scopeToLang.get(e);
	}
	addLanguage(e) {
		this._langs.set(e.name, e), e.aliases && e.aliases.forEach((t) => {
			this._langs.set(t, e);
		}), this._scopeToLang.set(e.scopeName, e), e.injectTo && e.injectTo.forEach((t) => {
			this._injections.get(t) || this._injections.set(t, []), this._injections.get(t).push(e.scopeName);
		});
	}
	getInjections(e) {
		let t = e.split("."), n = [];
		for (let e = 1; e <= t.length; e++) {
			let r = t.slice(0, e).join(".");
			n = [...n, ...this._injections.get(r) || []];
		}
		return n;
	}
}, Nt = 0;
function Pt(e) {
	Nt += 1, e.warnings !== !1 && Nt >= 10 && Nt % 10 == 0 && console.warn(`[Shiki] ${Nt} instances have been created. Shiki is supposed to be used as a singleton, consider refactoring your code to cache your highlighter instance; Or call \`highlighter.dispose()\` to release unused instances.`);
	let t = !1;
	if (!e.engine) throw new r("`engine` option is required for synchronous mode");
	let n = (e.langs || []).flat(1), i = (e.themes || []).flat(1).map(Dt), a = new jt(new Mt(e.engine, n), i, n, e.langAlias), o;
	function s(t) {
		return At(t, e.langAlias);
	}
	function c(e) {
		_();
		let t = a.getGrammar(typeof e == "string" ? e : e.name);
		if (!t) throw new r(`Language \`${e}\` not found, you may need to load it first`);
		return t;
	}
	function l(e) {
		if (e === "none") return {
			bg: "",
			fg: "",
			name: "none",
			settings: [],
			type: "dark"
		};
		_();
		let t = a.getTheme(e);
		if (!t) throw new r(`Theme \`${e}\` not found, you may need to load it first`);
		return t;
	}
	function u(e) {
		_();
		let t = l(e);
		return o !== e && (a.setTheme(t), o = e), {
			theme: t,
			colorMap: a.getColorMap()
		};
	}
	function d() {
		return _(), a.getLoadedThemes();
	}
	function f() {
		return _(), a.getLoadedLanguages();
	}
	function p(...e) {
		_(), a.loadLanguages(e.flat(1));
	}
	async function m(...e) {
		return p(await Ot(e));
	}
	function h(...e) {
		_();
		for (let t of e.flat(1)) a.loadTheme(t);
	}
	async function g(...e) {
		return _(), h(await kt(e));
	}
	function _() {
		if (t) throw new r("Shiki instance has been disposed");
	}
	function v() {
		t || (t = !0, a.dispose(), --Nt);
	}
	return {
		setTheme: u,
		getTheme: l,
		getLanguage: c,
		getLoadedThemes: d,
		getLoadedLanguages: f,
		resolveLangAlias: s,
		loadLanguage: m,
		loadLanguageSync: p,
		loadTheme: g,
		loadThemeSync: h,
		dispose: v,
		[Symbol.dispose]: v
	};
}
async function Ft(e) {
	e.engine || console.warn("`engine` option is required. Use `createOnigurumaEngine` or `createJavaScriptRegexEngine` to create an engine.");
	let [t, n, r] = await Promise.all([
		kt(e.themes || []),
		Ot(e.langs || []),
		e.engine
	]);
	return Pt({
		...e,
		themes: t,
		langs: n,
		engine: r
	});
}
var It = /* @__PURE__ */ new WeakMap();
function Lt(e, t) {
	It.set(e, t);
}
function Rt(e) {
	return It.get(e);
}
var zt = class e {
	_stacks = {};
	lang;
	get themes() {
		return Object.keys(this._stacks);
	}
	get theme() {
		return this.themes[0];
	}
	get _stack() {
		return this._stacks[this.theme];
	}
	static initial(t, n) {
		return new e(Object.fromEntries(gt(n).map((e) => [e, mt])), t);
	}
	constructor(...e) {
		if (e.length === 2) {
			let [t, n] = e;
			this.lang = n, this._stacks = t;
		} else {
			let [t, n, r] = e;
			this.lang = n, this._stacks = { [r]: t };
		}
	}
	getInternalStack(e = this.theme) {
		return this._stacks[e];
	}
	getScopes(e = this.theme) {
		return Bt(this._stacks[e]);
	}
	toJSON() {
		return {
			lang: this.lang,
			theme: this.theme,
			themes: this.themes,
			scopes: this.getScopes()
		};
	}
};
function Bt(e) {
	let t = [], n = /* @__PURE__ */ new Set();
	function r(e) {
		if (n.has(e)) return;
		n.add(e);
		let i = e?.nameScopesList?.scopeName;
		i && t.push(i), e.parent && r(e.parent);
	}
	return r(e), t;
}
function Vt(e, t) {
	if (!(e instanceof zt)) throw new r("Invalid grammar state");
	return e.getInternalStack(t);
}
var Ht = /,/, Ut = / /;
function Wt(e, t, n = {}) {
	let { theme: i = e.getLoadedThemes()[0] } = n;
	if (vt(e.resolveLangAlias(n.lang || "text")) || bt(i)) return Ct(t).map((e) => [{
		content: e[0],
		offset: e[1]
	}]);
	let { theme: a, colorMap: o } = e.setTheme(i), s = e.getLanguage(n.lang || "text");
	if (n.grammarState) {
		if (n.grammarState.lang !== s.name) throw new r(`Grammar state language "${n.grammarState.lang}" does not match highlight language "${s.name}"`);
		if (!n.grammarState.themes.includes(a.name)) throw new r(`Grammar state themes "${n.grammarState.themes}" do not contain highlight theme "${a.name}"`);
	}
	return Kt(t, s, a, o, n);
}
function Gt(...e) {
	if (e.length === 2) return Rt(e[1]);
	let [t, n, i = {}] = e, { lang: a = "text", theme: o = t.getLoadedThemes()[0] } = i;
	if (vt(a) || bt(o)) throw new r("Plain language does not have grammar state");
	if (a === "ansi") throw new r("ANSI language does not have grammar state");
	let { theme: s, colorMap: c } = t.setTheme(o), l = t.getLanguage(a);
	return new zt(qt(n, l, s, c, i).stateStack, l.name, s.name);
}
function Kt(e, t, n, r, i) {
	let a = qt(e, t, n, r, i), o = new zt(a.stateStack, t.name, n.name);
	return Lt(a.tokens, o), a.tokens;
}
function qt(e, t, n, r, i) {
	let a = ht(n, i), { tokenizeMaxLineLength: o = 0, tokenizeTimeLimit: s = 500, includeExplanation: c = !1 } = i, l = Ct(e), u = i.grammarState ? Vt(i.grammarState, n.name) ?? mt : i.grammarContextCode == null ? mt : qt(i.grammarContextCode, t, n, r, {
		...i,
		grammarState: void 0,
		grammarContextCode: void 0
	}).stateStack, d = [], f = [];
	for (let e = 0, i = l.length; e < i; e++) {
		let [i, p] = l[e];
		if (i === "") {
			d = [], f.push([]);
			continue;
		}
		if (o > 0 && i.length >= o) {
			d = [], f.push([{
				content: i,
				offset: p,
				color: "",
				fontStyle: 0
			}]);
			continue;
		}
		let m, h, g;
		c && c !== "tokenType" && (m = t.tokenizeLine(i, u, s), h = m.tokens, g = 0);
		let _ = t.tokenizeLine2(i, u, s), v = _.tokens.length / 2;
		for (let e = 0; e < v; e++) {
			let t = _.tokens[2 * e], o = e + 1 < v ? _.tokens[2 * e + 2] : i.length;
			if (t === o) continue;
			let s = _.tokens[2 * e + 1], l = w(r[oe.getForeground(s)], a), u = oe.getFontStyle(s), f = {
				content: i.substring(t, o),
				offset: p + t,
				color: l,
				fontStyle: u
			};
			if (c === "tokenType") f.type = oe.getTokenType(s);
			else if (c) {
				let e = [];
				if (c !== "scopeName") for (let t of n.settings) {
					let n;
					switch (typeof t.scope) {
						case "string":
							n = t.scope.split(Ht).map((e) => e.trim());
							break;
						case "object":
							n = t.scope;
							break;
						default: continue;
					}
					e.push({
						settings: t,
						selectors: n.map((e) => e.split(Ut))
					});
				}
				f.explanation = [];
				let r = 0;
				for (; t + r < o;) {
					let t = h[g], n = i.substring(t.startIndex, t.endIndex);
					r += n.length, f.explanation.push({
						content: n,
						scopes: c === "scopeName" ? Jt(t.scopes) : Yt(e, t.scopes)
					}), g += 1;
				}
			}
			d.push(f);
		}
		f.push(d), d = [], u = _.ruleStack;
	}
	return {
		tokens: f,
		stateStack: u
	};
}
function Jt(e) {
	return e.map((e) => ({ scopeName: e }));
}
function Yt(e, t) {
	let n = [];
	for (let r = 0, i = t.length; r < i; r++) {
		let i = t[r];
		n[r] = {
			scopeName: i,
			themeMatches: Qt(e, i, t.slice(0, r))
		};
	}
	return n;
}
function Xt(e, t) {
	return e === t || t.substring(0, e.length) === e && t[e.length] === ".";
}
function Zt(e, t, n) {
	if (!Xt(e.at(-1), t)) return !1;
	let r = e.length - 2, i = n.length - 1;
	for (; r >= 0 && i >= 0;) Xt(e[r], n[i]) && --r, --i;
	return r === -1;
}
function Qt(e, t, n) {
	let r = [];
	for (let { selectors: i, settings: a } of e) for (let e of i) if (Zt(e, t, n)) {
		r.push(a);
		break;
	}
	return r;
}
function $t(e, t, n, r = Wt) {
	let i = Object.entries(n.themes).filter((e) => e[1]).map((e) => ({
		color: e[0],
		theme: e[1]
	})), a = i.map((i) => {
		let a = r(e, t, {
			...n,
			theme: i.theme
		});
		return {
			tokens: a,
			state: Rt(a),
			theme: typeof i.theme == "string" ? i.theme : i.theme.name
		};
	}), o = en(...a.map((e) => e.tokens)), s = o[0].map((e, t) => e.map((e, r) => {
		let a = {
			content: e.content,
			variants: {},
			offset: e.offset
		};
		return "includeExplanation" in n && n.includeExplanation && (a.explanation = e.explanation), o.forEach((e, n) => {
			let { content: o, explanation: s, offset: c, ...l } = e[t][r];
			a.variants[i[n].color] = l;
		}), a;
	})), c = a[0].state ? new zt(Object.fromEntries(a.map((e) => [e.theme, e.state?.getInternalStack(e.theme)])), a[0].state.lang) : void 0;
	return c && Lt(s, c), s;
}
function en(...e) {
	let t = e.map(() => []), n = e.length;
	for (let r = 0; r < e[0].length; r++) {
		let i = e.map((e) => e[r]), a = t.map(() => []);
		t.forEach((e, t) => e.push(a[t]));
		let o = i.map(() => 0), s = i.map((e) => e[0]);
		for (; s.every((e) => e);) {
			let e = Math.min(...s.map((e) => e.content.length));
			for (let t = 0; t < n; t++) {
				let n = s[t];
				n.content.length === e ? (a[t].push(n), o[t] += 1, s[t] = i[t][o[t]]) : (a[t].push({
					...n,
					content: n.content.slice(0, e)
				}), s[t] = {
					...n,
					content: n.content.slice(e),
					offset: n.offset + e
				});
			}
		}
	}
	return t;
}
//#endregion
//#region node_modules/html-void-elements/index.js
var tn = [
	"area",
	"base",
	"basefont",
	"bgsound",
	"br",
	"col",
	"command",
	"embed",
	"frame",
	"hr",
	"image",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr"
], nn = class {
	constructor(e, t, n) {
		this.normal = t, this.property = e, n && (this.space = n);
	}
};
nn.prototype.normal = {}, nn.prototype.property = {}, nn.prototype.space = void 0;
//#endregion
//#region node_modules/property-information/lib/util/merge.js
function rn(e, t) {
	let n = {}, r = {};
	for (let t of e) Object.assign(n, t.property), Object.assign(r, t.normal);
	return new nn(n, r, t);
}
//#endregion
//#region node_modules/property-information/lib/normalize.js
function an(e) {
	return e.toLowerCase();
}
//#endregion
//#region node_modules/property-information/lib/util/info.js
var T = class {
	constructor(e, t) {
		this.attribute = t, this.property = e;
	}
};
T.prototype.attribute = "", T.prototype.booleanish = !1, T.prototype.boolean = !1, T.prototype.commaOrSpaceSeparated = !1, T.prototype.commaSeparated = !1, T.prototype.defined = !1, T.prototype.mustUseProperty = !1, T.prototype.number = !1, T.prototype.overloadedBoolean = !1, T.prototype.property = "", T.prototype.spaceSeparated = !1, T.prototype.space = void 0;
//#endregion
//#region node_modules/property-information/lib/util/types.js
var on = /* @__PURE__ */ n({
	boolean: () => E,
	booleanish: () => D,
	commaOrSpaceSeparated: () => A,
	commaSeparated: () => ln,
	number: () => O,
	overloadedBoolean: () => cn,
	spaceSeparated: () => k
}), sn = 0, E = un(), D = un(), cn = un(), O = un(), k = un(), ln = un(), A = un();
function un() {
	return 2 ** ++sn;
}
//#endregion
//#region node_modules/property-information/lib/util/defined-info.js
var dn = Object.keys(on), fn = class extends T {
	constructor(e, t, n, r) {
		let i = -1;
		if (super(e, t), pn(this, "space", r), typeof n == "number") for (; ++i < dn.length;) {
			let e = dn[i];
			pn(this, dn[i], (n & on[e]) === on[e]);
		}
	}
};
fn.prototype.defined = !0;
function pn(e, t, n) {
	n && (e[t] = n);
}
//#endregion
//#region node_modules/property-information/lib/util/create.js
function mn(e) {
	let t = {}, n = {};
	for (let [r, i] of Object.entries(e.properties)) {
		let a = new fn(r, e.transform(e.attributes || {}, r), i, e.space);
		e.mustUseProperty && e.mustUseProperty.includes(r) && (a.mustUseProperty = !0), t[r] = a, n[an(r)] = r, n[an(a.attribute)] = r;
	}
	return new nn(t, n, e.space);
}
//#endregion
//#region node_modules/property-information/lib/aria.js
var hn = mn({
	properties: {
		ariaActiveDescendant: null,
		ariaAtomic: D,
		ariaAutoComplete: null,
		ariaBusy: D,
		ariaChecked: D,
		ariaColCount: O,
		ariaColIndex: O,
		ariaColSpan: O,
		ariaControls: k,
		ariaCurrent: null,
		ariaDescribedBy: k,
		ariaDetails: null,
		ariaDisabled: D,
		ariaDropEffect: k,
		ariaErrorMessage: null,
		ariaExpanded: D,
		ariaFlowTo: k,
		ariaGrabbed: D,
		ariaHasPopup: null,
		ariaHidden: D,
		ariaInvalid: null,
		ariaKeyShortcuts: null,
		ariaLabel: null,
		ariaLabelledBy: k,
		ariaLevel: O,
		ariaLive: null,
		ariaModal: D,
		ariaMultiLine: D,
		ariaMultiSelectable: D,
		ariaOrientation: null,
		ariaOwns: k,
		ariaPlaceholder: null,
		ariaPosInSet: O,
		ariaPressed: D,
		ariaReadOnly: D,
		ariaRelevant: null,
		ariaRequired: D,
		ariaRoleDescription: k,
		ariaRowCount: O,
		ariaRowIndex: O,
		ariaRowSpan: O,
		ariaSelected: D,
		ariaSetSize: O,
		ariaSort: null,
		ariaValueMax: O,
		ariaValueMin: O,
		ariaValueNow: O,
		ariaValueText: null,
		role: null
	},
	transform(e, t) {
		return t === "role" ? t : "aria-" + t.slice(4).toLowerCase();
	}
});
//#endregion
//#region node_modules/property-information/lib/util/case-sensitive-transform.js
function gn(e, t) {
	return t in e ? e[t] : t;
}
//#endregion
//#region node_modules/property-information/lib/util/case-insensitive-transform.js
function _n(e, t) {
	return gn(e, t.toLowerCase());
}
//#endregion
//#region node_modules/property-information/lib/html.js
var vn = mn({
	attributes: {
		acceptcharset: "accept-charset",
		classname: "class",
		htmlfor: "for",
		httpequiv: "http-equiv"
	},
	mustUseProperty: [
		"checked",
		"multiple",
		"muted",
		"selected"
	],
	properties: {
		abbr: null,
		accept: ln,
		acceptCharset: k,
		accessKey: k,
		action: null,
		allow: null,
		allowFullScreen: E,
		allowPaymentRequest: E,
		allowUserMedia: E,
		alpha: E,
		alt: null,
		as: null,
		async: E,
		autoCapitalize: null,
		autoComplete: k,
		autoFocus: E,
		autoPlay: E,
		blocking: k,
		capture: null,
		charSet: null,
		checked: E,
		cite: null,
		className: k,
		closedBy: null,
		colorSpace: null,
		cols: O,
		colSpan: O,
		command: null,
		commandFor: null,
		content: null,
		contentEditable: D,
		controls: E,
		controlsList: k,
		coords: O | ln,
		crossOrigin: null,
		data: null,
		dateTime: null,
		decoding: null,
		default: E,
		defer: E,
		dir: null,
		dirName: null,
		disabled: E,
		download: cn,
		draggable: D,
		encType: null,
		enterKeyHint: null,
		fetchPriority: null,
		form: null,
		formAction: null,
		formEncType: null,
		formMethod: null,
		formNoValidate: E,
		formTarget: null,
		headers: k,
		height: O,
		hidden: cn,
		high: O,
		href: null,
		hrefLang: null,
		htmlFor: k,
		httpEquiv: k,
		id: null,
		imageSizes: null,
		imageSrcSet: null,
		inert: E,
		inputMode: null,
		integrity: null,
		is: null,
		isMap: E,
		itemId: null,
		itemProp: k,
		itemRef: k,
		itemScope: E,
		itemType: k,
		kind: null,
		label: null,
		lang: null,
		language: null,
		list: null,
		loading: null,
		loop: E,
		low: O,
		manifest: null,
		max: null,
		maxLength: O,
		media: null,
		method: null,
		min: null,
		minLength: O,
		multiple: E,
		muted: E,
		name: null,
		nonce: null,
		noModule: E,
		noValidate: E,
		onAbort: null,
		onAfterPrint: null,
		onAuxClick: null,
		onBeforeMatch: null,
		onBeforePrint: null,
		onBeforeToggle: null,
		onBeforeUnload: null,
		onBlur: null,
		onCancel: null,
		onCanPlay: null,
		onCanPlayThrough: null,
		onChange: null,
		onClick: null,
		onClose: null,
		onContextLost: null,
		onContextMenu: null,
		onContextRestored: null,
		onCopy: null,
		onCueChange: null,
		onCut: null,
		onDblClick: null,
		onDrag: null,
		onDragEnd: null,
		onDragEnter: null,
		onDragExit: null,
		onDragLeave: null,
		onDragOver: null,
		onDragStart: null,
		onDrop: null,
		onDurationChange: null,
		onEmptied: null,
		onEnded: null,
		onError: null,
		onFocus: null,
		onFormData: null,
		onHashChange: null,
		onInput: null,
		onInvalid: null,
		onKeyDown: null,
		onKeyPress: null,
		onKeyUp: null,
		onLanguageChange: null,
		onLoad: null,
		onLoadedData: null,
		onLoadedMetadata: null,
		onLoadEnd: null,
		onLoadStart: null,
		onMessage: null,
		onMessageError: null,
		onMouseDown: null,
		onMouseEnter: null,
		onMouseLeave: null,
		onMouseMove: null,
		onMouseOut: null,
		onMouseOver: null,
		onMouseUp: null,
		onOffline: null,
		onOnline: null,
		onPageHide: null,
		onPageShow: null,
		onPaste: null,
		onPause: null,
		onPlay: null,
		onPlaying: null,
		onPopState: null,
		onProgress: null,
		onRateChange: null,
		onRejectionHandled: null,
		onReset: null,
		onResize: null,
		onScroll: null,
		onScrollEnd: null,
		onSecurityPolicyViolation: null,
		onSeeked: null,
		onSeeking: null,
		onSelect: null,
		onSlotChange: null,
		onStalled: null,
		onStorage: null,
		onSubmit: null,
		onSuspend: null,
		onTimeUpdate: null,
		onToggle: null,
		onUnhandledRejection: null,
		onUnload: null,
		onVolumeChange: null,
		onWaiting: null,
		onWheel: null,
		open: E,
		optimum: O,
		pattern: null,
		ping: k,
		placeholder: null,
		playsInline: E,
		popover: null,
		popoverTarget: null,
		popoverTargetAction: null,
		poster: null,
		preload: null,
		readOnly: E,
		referrerPolicy: null,
		rel: k,
		required: E,
		reversed: E,
		rows: O,
		rowSpan: O,
		sandbox: k,
		scope: null,
		scoped: E,
		seamless: E,
		selected: E,
		shadowRootClonable: E,
		shadowRootCustomElementRegistry: E,
		shadowRootDelegatesFocus: E,
		shadowRootMode: null,
		shadowRootSerializable: E,
		shape: null,
		size: O,
		sizes: null,
		slot: null,
		span: O,
		spellCheck: D,
		src: null,
		srcDoc: null,
		srcLang: null,
		srcSet: null,
		start: O,
		step: null,
		style: null,
		tabIndex: O,
		target: null,
		title: null,
		translate: null,
		type: null,
		typeMustMatch: E,
		useMap: null,
		value: D,
		width: O,
		wrap: null,
		writingSuggestions: null,
		align: null,
		aLink: null,
		archive: k,
		axis: null,
		background: null,
		bgColor: null,
		border: O,
		borderColor: null,
		bottomMargin: O,
		cellPadding: null,
		cellSpacing: null,
		char: null,
		charOff: null,
		classId: null,
		clear: null,
		code: null,
		codeBase: null,
		codeType: null,
		color: null,
		compact: E,
		declare: E,
		event: null,
		face: null,
		frame: null,
		frameBorder: null,
		hSpace: O,
		leftMargin: O,
		link: null,
		longDesc: null,
		lowSrc: null,
		marginHeight: O,
		marginWidth: O,
		noResize: E,
		noHref: E,
		noShade: E,
		noWrap: E,
		object: null,
		profile: null,
		prompt: null,
		rev: null,
		rightMargin: O,
		rules: null,
		scheme: null,
		scrolling: D,
		standby: null,
		summary: null,
		text: null,
		topMargin: O,
		valueType: null,
		version: null,
		vAlign: null,
		vLink: null,
		vSpace: O,
		allowTransparency: null,
		autoCorrect: null,
		autoSave: null,
		credentialless: E,
		disablePictureInPicture: E,
		disableRemotePlayback: E,
		exportParts: ln,
		part: k,
		prefix: null,
		property: null,
		results: O,
		security: null,
		unselectable: null
	},
	space: "html",
	transform: _n
}), yn = mn({
	attributes: {
		accentHeight: "accent-height",
		alignmentBaseline: "alignment-baseline",
		arabicForm: "arabic-form",
		baselineShift: "baseline-shift",
		capHeight: "cap-height",
		className: "class",
		clipPath: "clip-path",
		clipRule: "clip-rule",
		colorInterpolation: "color-interpolation",
		colorInterpolationFilters: "color-interpolation-filters",
		colorProfile: "color-profile",
		colorRendering: "color-rendering",
		crossOrigin: "crossorigin",
		dataType: "datatype",
		dominantBaseline: "dominant-baseline",
		enableBackground: "enable-background",
		fillOpacity: "fill-opacity",
		fillRule: "fill-rule",
		floodColor: "flood-color",
		floodOpacity: "flood-opacity",
		fontFamily: "font-family",
		fontSize: "font-size",
		fontSizeAdjust: "font-size-adjust",
		fontStretch: "font-stretch",
		fontStyle: "font-style",
		fontVariant: "font-variant",
		fontWeight: "font-weight",
		glyphName: "glyph-name",
		glyphOrientationHorizontal: "glyph-orientation-horizontal",
		glyphOrientationVertical: "glyph-orientation-vertical",
		hrefLang: "hreflang",
		horizAdvX: "horiz-adv-x",
		horizOriginX: "horiz-origin-x",
		horizOriginY: "horiz-origin-y",
		imageRendering: "image-rendering",
		letterSpacing: "letter-spacing",
		lightingColor: "lighting-color",
		markerEnd: "marker-end",
		markerMid: "marker-mid",
		markerStart: "marker-start",
		maskType: "mask-type",
		navDown: "nav-down",
		navDownLeft: "nav-down-left",
		navDownRight: "nav-down-right",
		navLeft: "nav-left",
		navNext: "nav-next",
		navPrev: "nav-prev",
		navRight: "nav-right",
		navUp: "nav-up",
		navUpLeft: "nav-up-left",
		navUpRight: "nav-up-right",
		onAbort: "onabort",
		onActivate: "onactivate",
		onAfterPrint: "onafterprint",
		onBeforePrint: "onbeforeprint",
		onBegin: "onbegin",
		onCancel: "oncancel",
		onCanPlay: "oncanplay",
		onCanPlayThrough: "oncanplaythrough",
		onChange: "onchange",
		onClick: "onclick",
		onClose: "onclose",
		onCopy: "oncopy",
		onCueChange: "oncuechange",
		onCut: "oncut",
		onDblClick: "ondblclick",
		onDrag: "ondrag",
		onDragEnd: "ondragend",
		onDragEnter: "ondragenter",
		onDragExit: "ondragexit",
		onDragLeave: "ondragleave",
		onDragOver: "ondragover",
		onDragStart: "ondragstart",
		onDrop: "ondrop",
		onDurationChange: "ondurationchange",
		onEmptied: "onemptied",
		onEnd: "onend",
		onEnded: "onended",
		onError: "onerror",
		onFocus: "onfocus",
		onFocusIn: "onfocusin",
		onFocusOut: "onfocusout",
		onHashChange: "onhashchange",
		onInput: "oninput",
		onInvalid: "oninvalid",
		onKeyDown: "onkeydown",
		onKeyPress: "onkeypress",
		onKeyUp: "onkeyup",
		onLoad: "onload",
		onLoadedData: "onloadeddata",
		onLoadedMetadata: "onloadedmetadata",
		onLoadStart: "onloadstart",
		onMessage: "onmessage",
		onMouseDown: "onmousedown",
		onMouseEnter: "onmouseenter",
		onMouseLeave: "onmouseleave",
		onMouseMove: "onmousemove",
		onMouseOut: "onmouseout",
		onMouseOver: "onmouseover",
		onMouseUp: "onmouseup",
		onMouseWheel: "onmousewheel",
		onOffline: "onoffline",
		onOnline: "ononline",
		onPageHide: "onpagehide",
		onPageShow: "onpageshow",
		onPaste: "onpaste",
		onPause: "onpause",
		onPlay: "onplay",
		onPlaying: "onplaying",
		onPopState: "onpopstate",
		onProgress: "onprogress",
		onRateChange: "onratechange",
		onRepeat: "onrepeat",
		onReset: "onreset",
		onResize: "onresize",
		onScroll: "onscroll",
		onSeeked: "onseeked",
		onSeeking: "onseeking",
		onSelect: "onselect",
		onShow: "onshow",
		onStalled: "onstalled",
		onStorage: "onstorage",
		onSubmit: "onsubmit",
		onSuspend: "onsuspend",
		onTimeUpdate: "ontimeupdate",
		onToggle: "ontoggle",
		onUnload: "onunload",
		onVolumeChange: "onvolumechange",
		onWaiting: "onwaiting",
		onZoom: "onzoom",
		overlinePosition: "overline-position",
		overlineThickness: "overline-thickness",
		paintOrder: "paint-order",
		panose1: "panose-1",
		pointerEvents: "pointer-events",
		referrerPolicy: "referrerpolicy",
		renderingIntent: "rendering-intent",
		shapeRendering: "shape-rendering",
		stopColor: "stop-color",
		stopOpacity: "stop-opacity",
		strikethroughPosition: "strikethrough-position",
		strikethroughThickness: "strikethrough-thickness",
		strokeDashArray: "stroke-dasharray",
		strokeDashOffset: "stroke-dashoffset",
		strokeLineCap: "stroke-linecap",
		strokeLineJoin: "stroke-linejoin",
		strokeMiterLimit: "stroke-miterlimit",
		strokeOpacity: "stroke-opacity",
		strokeWidth: "stroke-width",
		tabIndex: "tabindex",
		textAnchor: "text-anchor",
		textDecoration: "text-decoration",
		textRendering: "text-rendering",
		transformOrigin: "transform-origin",
		typeOf: "typeof",
		underlinePosition: "underline-position",
		underlineThickness: "underline-thickness",
		unicodeBidi: "unicode-bidi",
		unicodeRange: "unicode-range",
		unitsPerEm: "units-per-em",
		vAlphabetic: "v-alphabetic",
		vHanging: "v-hanging",
		vIdeographic: "v-ideographic",
		vMathematical: "v-mathematical",
		vectorEffect: "vector-effect",
		vertAdvY: "vert-adv-y",
		vertOriginX: "vert-origin-x",
		vertOriginY: "vert-origin-y",
		wordSpacing: "word-spacing",
		writingMode: "writing-mode",
		xHeight: "x-height",
		playbackOrder: "playbackorder",
		timelineBegin: "timelinebegin"
	},
	properties: {
		about: A,
		accentHeight: O,
		accumulate: null,
		additive: null,
		alignmentBaseline: null,
		alphabetic: O,
		amplitude: O,
		arabicForm: null,
		ascent: O,
		attributeName: null,
		attributeType: null,
		azimuth: O,
		bandwidth: null,
		baselineShift: null,
		baseFrequency: null,
		baseProfile: null,
		bbox: null,
		begin: null,
		bias: O,
		by: null,
		calcMode: null,
		capHeight: O,
		className: k,
		clip: null,
		clipPath: null,
		clipPathUnits: null,
		clipRule: null,
		color: null,
		colorInterpolation: null,
		colorInterpolationFilters: null,
		colorProfile: null,
		colorRendering: null,
		content: null,
		contentScriptType: null,
		contentStyleType: null,
		crossOrigin: null,
		cursor: null,
		cx: null,
		cy: null,
		d: null,
		dataType: null,
		defaultAction: null,
		descent: O,
		diffuseConstant: O,
		direction: null,
		display: null,
		dur: null,
		divisor: O,
		dominantBaseline: null,
		download: E,
		dx: null,
		dy: null,
		edgeMode: null,
		editable: null,
		elevation: O,
		enableBackground: null,
		end: null,
		event: null,
		exponent: O,
		externalResourcesRequired: null,
		fill: null,
		fillOpacity: O,
		fillRule: null,
		filter: null,
		filterRes: null,
		filterUnits: null,
		floodColor: null,
		floodOpacity: null,
		focusable: null,
		focusHighlight: null,
		fontFamily: null,
		fontSize: null,
		fontSizeAdjust: null,
		fontStretch: null,
		fontStyle: null,
		fontVariant: null,
		fontWeight: null,
		format: null,
		fr: null,
		from: null,
		fx: null,
		fy: null,
		g1: ln,
		g2: ln,
		glyphName: ln,
		glyphOrientationHorizontal: null,
		glyphOrientationVertical: null,
		glyphRef: null,
		gradientTransform: null,
		gradientUnits: null,
		handler: null,
		hanging: O,
		hatchContentUnits: null,
		hatchUnits: null,
		height: null,
		href: null,
		hrefLang: null,
		horizAdvX: O,
		horizOriginX: O,
		horizOriginY: O,
		id: null,
		ideographic: O,
		imageRendering: null,
		initialVisibility: null,
		in: null,
		in2: null,
		intercept: O,
		k: O,
		k1: O,
		k2: O,
		k3: O,
		k4: O,
		kernelMatrix: A,
		kernelUnitLength: null,
		keyPoints: null,
		keySplines: null,
		keyTimes: null,
		kerning: null,
		lang: null,
		lengthAdjust: null,
		letterSpacing: null,
		lightingColor: null,
		limitingConeAngle: O,
		local: null,
		markerEnd: null,
		markerMid: null,
		markerStart: null,
		markerHeight: null,
		markerUnits: null,
		markerWidth: null,
		mask: null,
		maskContentUnits: null,
		maskType: null,
		maskUnits: null,
		mathematical: null,
		max: null,
		media: null,
		mediaCharacterEncoding: null,
		mediaContentEncodings: null,
		mediaSize: O,
		mediaTime: null,
		method: null,
		min: null,
		mode: null,
		name: null,
		navDown: null,
		navDownLeft: null,
		navDownRight: null,
		navLeft: null,
		navNext: null,
		navPrev: null,
		navRight: null,
		navUp: null,
		navUpLeft: null,
		navUpRight: null,
		numOctaves: null,
		observer: null,
		offset: null,
		onAbort: null,
		onActivate: null,
		onAfterPrint: null,
		onBeforePrint: null,
		onBegin: null,
		onCancel: null,
		onCanPlay: null,
		onCanPlayThrough: null,
		onChange: null,
		onClick: null,
		onClose: null,
		onCopy: null,
		onCueChange: null,
		onCut: null,
		onDblClick: null,
		onDrag: null,
		onDragEnd: null,
		onDragEnter: null,
		onDragExit: null,
		onDragLeave: null,
		onDragOver: null,
		onDragStart: null,
		onDrop: null,
		onDurationChange: null,
		onEmptied: null,
		onEnd: null,
		onEnded: null,
		onError: null,
		onFocus: null,
		onFocusIn: null,
		onFocusOut: null,
		onHashChange: null,
		onInput: null,
		onInvalid: null,
		onKeyDown: null,
		onKeyPress: null,
		onKeyUp: null,
		onLoad: null,
		onLoadedData: null,
		onLoadedMetadata: null,
		onLoadStart: null,
		onMessage: null,
		onMouseDown: null,
		onMouseEnter: null,
		onMouseLeave: null,
		onMouseMove: null,
		onMouseOut: null,
		onMouseOver: null,
		onMouseUp: null,
		onMouseWheel: null,
		onOffline: null,
		onOnline: null,
		onPageHide: null,
		onPageShow: null,
		onPaste: null,
		onPause: null,
		onPlay: null,
		onPlaying: null,
		onPopState: null,
		onProgress: null,
		onRateChange: null,
		onRepeat: null,
		onReset: null,
		onResize: null,
		onScroll: null,
		onSeeked: null,
		onSeeking: null,
		onSelect: null,
		onShow: null,
		onStalled: null,
		onStorage: null,
		onSubmit: null,
		onSuspend: null,
		onTimeUpdate: null,
		onToggle: null,
		onUnload: null,
		onVolumeChange: null,
		onWaiting: null,
		onZoom: null,
		opacity: null,
		operator: null,
		order: null,
		orient: null,
		orientation: null,
		origin: null,
		overflow: null,
		overlay: null,
		overlinePosition: O,
		overlineThickness: O,
		paintOrder: null,
		panose1: null,
		path: null,
		pathLength: O,
		patternContentUnits: null,
		patternTransform: null,
		patternUnits: null,
		phase: null,
		ping: k,
		pitch: null,
		playbackOrder: null,
		pointerEvents: null,
		points: null,
		pointsAtX: O,
		pointsAtY: O,
		pointsAtZ: O,
		preserveAlpha: null,
		preserveAspectRatio: null,
		primitiveUnits: null,
		propagate: null,
		property: A,
		r: null,
		radius: null,
		referrerPolicy: null,
		refX: null,
		refY: null,
		rel: A,
		rev: A,
		renderingIntent: null,
		repeatCount: null,
		repeatDur: null,
		requiredExtensions: A,
		requiredFeatures: A,
		requiredFonts: A,
		requiredFormats: A,
		resource: null,
		restart: null,
		result: null,
		rotate: null,
		rx: null,
		ry: null,
		scale: null,
		seed: null,
		shapeRendering: null,
		side: null,
		slope: null,
		snapshotTime: null,
		specularConstant: O,
		specularExponent: O,
		spreadMethod: null,
		spacing: null,
		startOffset: null,
		stdDeviation: null,
		stemh: null,
		stemv: null,
		stitchTiles: null,
		stopColor: null,
		stopOpacity: null,
		strikethroughPosition: O,
		strikethroughThickness: O,
		string: null,
		stroke: null,
		strokeDashArray: A,
		strokeDashOffset: null,
		strokeLineCap: null,
		strokeLineJoin: null,
		strokeMiterLimit: O,
		strokeOpacity: O,
		strokeWidth: null,
		style: null,
		surfaceScale: O,
		syncBehavior: null,
		syncBehaviorDefault: null,
		syncMaster: null,
		syncTolerance: null,
		syncToleranceDefault: null,
		systemLanguage: A,
		tabIndex: O,
		tableValues: null,
		target: null,
		targetX: O,
		targetY: O,
		textAnchor: null,
		textDecoration: null,
		textRendering: null,
		textLength: null,
		timelineBegin: null,
		title: null,
		transformBehavior: null,
		type: null,
		typeOf: A,
		to: null,
		transform: null,
		transformOrigin: null,
		u1: null,
		u2: null,
		underlinePosition: O,
		underlineThickness: O,
		unicode: null,
		unicodeBidi: null,
		unicodeRange: null,
		unitsPerEm: O,
		values: null,
		vAlphabetic: O,
		vMathematical: O,
		vectorEffect: null,
		vHanging: O,
		vIdeographic: O,
		version: null,
		vertAdvY: O,
		vertOriginX: O,
		vertOriginY: O,
		viewBox: null,
		viewTarget: null,
		visibility: null,
		width: null,
		widths: null,
		wordSpacing: null,
		writingMode: null,
		x: null,
		x1: null,
		x2: null,
		xChannelSelector: null,
		xHeight: O,
		y: null,
		y1: null,
		y2: null,
		yChannelSelector: null,
		z: null,
		zoomAndPan: null
	},
	space: "svg",
	transform: gn
}), bn = mn({
	properties: {
		xLinkActuate: null,
		xLinkArcRole: null,
		xLinkHref: null,
		xLinkRole: null,
		xLinkShow: null,
		xLinkTitle: null,
		xLinkType: null
	},
	space: "xlink",
	transform(e, t) {
		return "xlink:" + t.slice(5).toLowerCase();
	}
}), xn = mn({
	attributes: { xmlnsxlink: "xmlns:xlink" },
	properties: {
		xmlnsXLink: null,
		xmlns: null
	},
	space: "xmlns",
	transform: _n
}), Sn = mn({
	properties: {
		xmlBase: null,
		xmlLang: null,
		xmlSpace: null
	},
	space: "xml",
	transform(e, t) {
		return "xml:" + t.slice(3).toLowerCase();
	}
}), Cn = /[A-Z]/g, wn = /-[a-z]/g, Tn = /^data[-\w.:]+$/i;
function En(e, t) {
	let n = an(t), r = t, i = T;
	if (n in e.normal) return e.property[e.normal[n]];
	if (n.length > 4 && n.slice(0, 4) === "data" && Tn.test(t)) {
		if (t.charAt(4) === "-") {
			let e = t.slice(5).replace(wn, On);
			r = "data" + e.charAt(0).toUpperCase() + e.slice(1);
		} else {
			let e = t.slice(4);
			if (!wn.test(e)) {
				let n = e.replace(Cn, Dn);
				n.charAt(0) !== "-" && (n = "-" + n), t = "data" + n;
			}
		}
		i = fn;
	}
	return new i(r, t);
}
function Dn(e) {
	return "-" + e.toLowerCase();
}
function On(e) {
	return e.charAt(1).toUpperCase();
}
//#endregion
//#region node_modules/property-information/index.js
var kn = rn([
	hn,
	vn,
	bn,
	xn,
	Sn
], "html"), An = rn([
	hn,
	yn,
	bn,
	xn,
	Sn
], "svg"), jn = {}.hasOwnProperty;
function Mn(e, t) {
	let n = t || {};
	function r(t, ...n) {
		let i = r.invalid, a = r.handlers;
		if (t && jn.call(t, e)) {
			let n = String(t[e]);
			i = jn.call(a, n) ? a[n] : r.unknown;
		}
		if (i) return i.call(this, t, ...n);
	}
	return r.handlers = n.handlers || {}, r.invalid = n.invalid, r.unknown = n.unknown, r;
}
//#endregion
//#region node_modules/stringify-entities/lib/core.js
var Nn = /["&'<>`]/g, Pn = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g, Fn = /[\x01-\t\v\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g, In = /[|\\{}()[\]^$+*?.]/g, Ln = /* @__PURE__ */ new WeakMap();
function Rn(e, t) {
	if (e = e.replace(t.subset ? zn(t.subset) : Nn, r), t.subset || t.escapeOnly) return e;
	return e.replace(Pn, n).replace(Fn, r);
	function n(e, n, r) {
		return t.format((e.charCodeAt(0) - 55296) * 1024 + e.charCodeAt(1) - 56320 + 65536, r.charCodeAt(n + 2), t);
	}
	function r(e, n, r) {
		return t.format(e.charCodeAt(0), r.charCodeAt(n + 1), t);
	}
}
function zn(e) {
	let t = Ln.get(e);
	return t || (t = Bn(e), Ln.set(e, t)), t;
}
function Bn(e) {
	let t = [], n = -1;
	for (; ++n < e.length;) t.push(e[n].replace(In, "\\$&"));
	return RegExp("(?:" + t.join("|") + ")", "g");
}
//#endregion
//#region node_modules/stringify-entities/lib/util/to-hexadecimal.js
var Vn = /[\dA-Fa-f]/;
function Hn(e, t, n) {
	let r = "&#x" + e.toString(16).toUpperCase();
	return n && t && !Vn.test(String.fromCharCode(t)) ? r : r + ";";
}
//#endregion
//#region node_modules/stringify-entities/lib/util/to-decimal.js
var Un = /\d/;
function Wn(e, t, n) {
	let r = "&#" + String(e);
	return n && t && !Un.test(String.fromCharCode(t)) ? r : r + ";";
}
//#endregion
//#region node_modules/character-entities-legacy/index.js
var Gn = /* @__PURE__ */ "AElig.AMP.Aacute.Acirc.Agrave.Aring.Atilde.Auml.COPY.Ccedil.ETH.Eacute.Ecirc.Egrave.Euml.GT.Iacute.Icirc.Igrave.Iuml.LT.Ntilde.Oacute.Ocirc.Ograve.Oslash.Otilde.Ouml.QUOT.REG.THORN.Uacute.Ucirc.Ugrave.Uuml.Yacute.aacute.acirc.acute.aelig.agrave.amp.aring.atilde.auml.brvbar.ccedil.cedil.cent.copy.curren.deg.divide.eacute.ecirc.egrave.eth.euml.frac12.frac14.frac34.gt.iacute.icirc.iexcl.igrave.iquest.iuml.laquo.lt.macr.micro.middot.nbsp.not.ntilde.oacute.ocirc.ograve.ordf.ordm.oslash.otilde.ouml.para.plusmn.pound.quot.raquo.reg.sect.shy.sup1.sup2.sup3.szlig.thorn.times.uacute.ucirc.ugrave.uml.uuml.yacute.yen.yuml".split("."), Kn = {
	nbsp: "\xA0",
	iexcl: "¡",
	cent: "¢",
	pound: "£",
	curren: "¤",
	yen: "¥",
	brvbar: "¦",
	sect: "§",
	uml: "¨",
	copy: "©",
	ordf: "ª",
	laquo: "«",
	not: "¬",
	shy: "­",
	reg: "®",
	macr: "¯",
	deg: "°",
	plusmn: "±",
	sup2: "²",
	sup3: "³",
	acute: "´",
	micro: "µ",
	para: "¶",
	middot: "·",
	cedil: "¸",
	sup1: "¹",
	ordm: "º",
	raquo: "»",
	frac14: "¼",
	frac12: "½",
	frac34: "¾",
	iquest: "¿",
	Agrave: "À",
	Aacute: "Á",
	Acirc: "Â",
	Atilde: "Ã",
	Auml: "Ä",
	Aring: "Å",
	AElig: "Æ",
	Ccedil: "Ç",
	Egrave: "È",
	Eacute: "É",
	Ecirc: "Ê",
	Euml: "Ë",
	Igrave: "Ì",
	Iacute: "Í",
	Icirc: "Î",
	Iuml: "Ï",
	ETH: "Ð",
	Ntilde: "Ñ",
	Ograve: "Ò",
	Oacute: "Ó",
	Ocirc: "Ô",
	Otilde: "Õ",
	Ouml: "Ö",
	times: "×",
	Oslash: "Ø",
	Ugrave: "Ù",
	Uacute: "Ú",
	Ucirc: "Û",
	Uuml: "Ü",
	Yacute: "Ý",
	THORN: "Þ",
	szlig: "ß",
	agrave: "à",
	aacute: "á",
	acirc: "â",
	atilde: "ã",
	auml: "ä",
	aring: "å",
	aelig: "æ",
	ccedil: "ç",
	egrave: "è",
	eacute: "é",
	ecirc: "ê",
	euml: "ë",
	igrave: "ì",
	iacute: "í",
	icirc: "î",
	iuml: "ï",
	eth: "ð",
	ntilde: "ñ",
	ograve: "ò",
	oacute: "ó",
	ocirc: "ô",
	otilde: "õ",
	ouml: "ö",
	divide: "÷",
	oslash: "ø",
	ugrave: "ù",
	uacute: "ú",
	ucirc: "û",
	uuml: "ü",
	yacute: "ý",
	thorn: "þ",
	yuml: "ÿ",
	fnof: "ƒ",
	Alpha: "Α",
	Beta: "Β",
	Gamma: "Γ",
	Delta: "Δ",
	Epsilon: "Ε",
	Zeta: "Ζ",
	Eta: "Η",
	Theta: "Θ",
	Iota: "Ι",
	Kappa: "Κ",
	Lambda: "Λ",
	Mu: "Μ",
	Nu: "Ν",
	Xi: "Ξ",
	Omicron: "Ο",
	Pi: "Π",
	Rho: "Ρ",
	Sigma: "Σ",
	Tau: "Τ",
	Upsilon: "Υ",
	Phi: "Φ",
	Chi: "Χ",
	Psi: "Ψ",
	Omega: "Ω",
	alpha: "α",
	beta: "β",
	gamma: "γ",
	delta: "δ",
	epsilon: "ε",
	zeta: "ζ",
	eta: "η",
	theta: "θ",
	iota: "ι",
	kappa: "κ",
	lambda: "λ",
	mu: "μ",
	nu: "ν",
	xi: "ξ",
	omicron: "ο",
	pi: "π",
	rho: "ρ",
	sigmaf: "ς",
	sigma: "σ",
	tau: "τ",
	upsilon: "υ",
	phi: "φ",
	chi: "χ",
	psi: "ψ",
	omega: "ω",
	thetasym: "ϑ",
	upsih: "ϒ",
	piv: "ϖ",
	bull: "•",
	hellip: "…",
	prime: "′",
	Prime: "″",
	oline: "‾",
	frasl: "⁄",
	weierp: "℘",
	image: "ℑ",
	real: "ℜ",
	trade: "™",
	alefsym: "ℵ",
	larr: "←",
	uarr: "↑",
	rarr: "→",
	darr: "↓",
	harr: "↔",
	crarr: "↵",
	lArr: "⇐",
	uArr: "⇑",
	rArr: "⇒",
	dArr: "⇓",
	hArr: "⇔",
	forall: "∀",
	part: "∂",
	exist: "∃",
	empty: "∅",
	nabla: "∇",
	isin: "∈",
	notin: "∉",
	ni: "∋",
	prod: "∏",
	sum: "∑",
	minus: "−",
	lowast: "∗",
	radic: "√",
	prop: "∝",
	infin: "∞",
	ang: "∠",
	and: "∧",
	or: "∨",
	cap: "∩",
	cup: "∪",
	int: "∫",
	there4: "∴",
	sim: "∼",
	cong: "≅",
	asymp: "≈",
	ne: "≠",
	equiv: "≡",
	le: "≤",
	ge: "≥",
	sub: "⊂",
	sup: "⊃",
	nsub: "⊄",
	sube: "⊆",
	supe: "⊇",
	oplus: "⊕",
	otimes: "⊗",
	perp: "⊥",
	sdot: "⋅",
	lceil: "⌈",
	rceil: "⌉",
	lfloor: "⌊",
	rfloor: "⌋",
	lang: "〈",
	rang: "〉",
	loz: "◊",
	spades: "♠",
	clubs: "♣",
	hearts: "♥",
	diams: "♦",
	quot: "\"",
	amp: "&",
	lt: "<",
	gt: ">",
	OElig: "Œ",
	oelig: "œ",
	Scaron: "Š",
	scaron: "š",
	Yuml: "Ÿ",
	circ: "ˆ",
	tilde: "˜",
	ensp: " ",
	emsp: " ",
	thinsp: " ",
	zwnj: "‌",
	zwj: "‍",
	lrm: "‎",
	rlm: "‏",
	ndash: "–",
	mdash: "—",
	lsquo: "‘",
	rsquo: "’",
	sbquo: "‚",
	ldquo: "“",
	rdquo: "”",
	bdquo: "„",
	dagger: "†",
	Dagger: "‡",
	permil: "‰",
	lsaquo: "‹",
	rsaquo: "›",
	euro: "€"
}, qn = [
	"cent",
	"copy",
	"divide",
	"gt",
	"lt",
	"not",
	"para",
	"times"
], Jn = {}.hasOwnProperty, Yn = {}, Xn;
for (Xn in Kn) Jn.call(Kn, Xn) && (Yn[Kn[Xn]] = Xn);
var Zn = /[^\dA-Za-z]/;
function Qn(e, t, n, r) {
	let i = String.fromCharCode(e);
	if (Jn.call(Yn, i)) {
		let e = Yn[i], a = "&" + e;
		return n && Gn.includes(e) && !qn.includes(e) && (!r || t && t !== 61 && Zn.test(String.fromCharCode(t))) ? a : a + ";";
	}
	return "";
}
//#endregion
//#region node_modules/stringify-entities/lib/util/format-smart.js
function $n(e, t, n) {
	let r = Hn(e, t, n.omitOptionalSemicolons), i;
	if ((n.useNamedReferences || n.useShortestReferences) && (i = Qn(e, t, n.omitOptionalSemicolons, n.attribute)), (n.useShortestReferences || !i) && n.useShortestReferences) {
		let i = Wn(e, t, n.omitOptionalSemicolons);
		i.length < r.length && (r = i);
	}
	return i && (!n.useShortestReferences || i.length < r.length) ? i : r;
}
//#endregion
//#region node_modules/stringify-entities/lib/index.js
function er(e, t) {
	return Rn(e, Object.assign({ format: $n }, t));
}
//#endregion
//#region node_modules/hast-util-to-html/lib/handle/comment.js
var tr = /^>|^->|<!--|-->|--!>|<!-$/g, nr = [">"], rr = ["<", ">"];
function ir(e, t, n, r) {
	return r.settings.bogusComments ? "<?" + er(e.value, Object.assign({}, r.settings.characterReferences, { subset: nr })) + ">" : "<!--" + e.value.replace(tr, i) + "-->";
	function i(e) {
		return er(e, Object.assign({}, r.settings.characterReferences, { subset: rr }));
	}
}
//#endregion
//#region node_modules/hast-util-to-html/lib/handle/doctype.js
function ar(e, t, n, r) {
	return "<!" + (r.settings.upperDoctype ? "DOCTYPE" : "doctype") + (r.settings.tightDoctype ? "" : " ") + "html>";
}
//#endregion
//#region node_modules/ccount/index.js
function or(e, t) {
	let n = String(e);
	if (typeof t != "string") throw TypeError("Expected character");
	let r = 0, i = n.indexOf(t);
	for (; i !== -1;) r++, i = n.indexOf(t, i + t.length);
	return r;
}
//#endregion
//#region node_modules/comma-separated-tokens/index.js
function sr(e, t) {
	let n = t || {};
	return (e[e.length - 1] === "" ? [...e, ""] : e).join((n.padRight ? " " : "") + "," + (n.padLeft === !1 ? "" : " ")).trim();
}
//#endregion
//#region node_modules/space-separated-tokens/index.js
function cr(e) {
	return e.join(" ").trim();
}
//#endregion
//#region node_modules/hast-util-whitespace/lib/index.js
var lr = /[ \t\n\f\r]/g;
function ur(e) {
	return typeof e == "object" ? e.type === "text" && dr(e.value) : dr(e);
}
function dr(e) {
	return e.replace(lr, "") === "";
}
//#endregion
//#region node_modules/hast-util-to-html/lib/omission/util/siblings.js
var j = mr(1), fr = mr(-1), pr = [];
function mr(e) {
	return t;
	function t(t, n, r) {
		let i = t ? t.children : pr, a = (n || 0) + e, o = i[a];
		if (!r) for (; o && ur(o);) a += e, o = i[a];
		return o;
	}
}
//#endregion
//#region node_modules/hast-util-to-html/lib/omission/omission.js
var hr = {}.hasOwnProperty;
function gr(e) {
	return t;
	function t(t, n, r) {
		return hr.call(e, t.tagName) && e[t.tagName](t, n, r);
	}
}
//#endregion
//#region node_modules/hast-util-to-html/lib/omission/closing.js
var _r = gr({
	body: br,
	caption: vr,
	colgroup: vr,
	dd: wr,
	dt: Cr,
	head: vr,
	html: yr,
	li: Sr,
	optgroup: Er,
	option: Dr,
	p: xr,
	rp: Tr,
	rt: Tr,
	tbody: kr,
	td: Mr,
	tfoot: Ar,
	th: Mr,
	thead: Or,
	tr: jr
});
function vr(e, t, n) {
	let r = j(n, t, !0);
	return !r || r.type !== "comment" && !(r.type === "text" && ur(r.value.charAt(0)));
}
function yr(e, t, n) {
	let r = j(n, t);
	return !r || r.type !== "comment";
}
function br(e, t, n) {
	let r = j(n, t);
	return !r || r.type !== "comment";
}
function xr(e, t, n) {
	let r = j(n, t);
	return r ? r.type === "element" && (r.tagName === "address" || r.tagName === "article" || r.tagName === "aside" || r.tagName === "blockquote" || r.tagName === "details" || r.tagName === "div" || r.tagName === "dl" || r.tagName === "fieldset" || r.tagName === "figcaption" || r.tagName === "figure" || r.tagName === "footer" || r.tagName === "form" || r.tagName === "h1" || r.tagName === "h2" || r.tagName === "h3" || r.tagName === "h4" || r.tagName === "h5" || r.tagName === "h6" || r.tagName === "header" || r.tagName === "hgroup" || r.tagName === "hr" || r.tagName === "main" || r.tagName === "menu" || r.tagName === "nav" || r.tagName === "ol" || r.tagName === "p" || r.tagName === "pre" || r.tagName === "section" || r.tagName === "table" || r.tagName === "ul") : !n || n.type !== "element" || n.tagName !== "a" && n.tagName !== "audio" && n.tagName !== "del" && n.tagName !== "ins" && n.tagName !== "map" && n.tagName !== "noscript" && n.tagName !== "video";
}
function Sr(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && r.tagName === "li";
}
function Cr(e, t, n) {
	let r = j(n, t);
	return !!(r && r.type === "element" && (r.tagName === "dt" || r.tagName === "dd"));
}
function wr(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && (r.tagName === "dt" || r.tagName === "dd");
}
function Tr(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && (r.tagName === "rp" || r.tagName === "rt");
}
function Er(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && r.tagName === "optgroup";
}
function Dr(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && (r.tagName === "option" || r.tagName === "optgroup");
}
function Or(e, t, n) {
	let r = j(n, t);
	return !!(r && r.type === "element" && (r.tagName === "tbody" || r.tagName === "tfoot"));
}
function kr(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && (r.tagName === "tbody" || r.tagName === "tfoot");
}
function Ar(e, t, n) {
	return !j(n, t);
}
function jr(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && r.tagName === "tr";
}
function Mr(e, t, n) {
	let r = j(n, t);
	return !r || r.type === "element" && (r.tagName === "td" || r.tagName === "th");
}
//#endregion
//#region node_modules/hast-util-to-html/lib/omission/opening.js
var Nr = gr({
	body: Ir,
	colgroup: Lr,
	head: Fr,
	html: Pr,
	tbody: Rr
});
function Pr(e) {
	let t = j(e, -1);
	return !t || t.type !== "comment";
}
function Fr(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e.children) if (n.type === "element" && (n.tagName === "base" || n.tagName === "title")) {
		if (t.has(n.tagName)) return !1;
		t.add(n.tagName);
	}
	let n = e.children[0];
	return !n || n.type === "element";
}
function Ir(e) {
	let t = j(e, -1, !0);
	return !t || t.type !== "comment" && !(t.type === "text" && ur(t.value.charAt(0))) && (t.type !== "element" || t.tagName !== "meta" && t.tagName !== "link" && t.tagName !== "script" && t.tagName !== "style" && t.tagName !== "template");
}
function Lr(e, t, n) {
	let r = fr(n, t), i = j(e, -1, !0);
	return n && r && r.type === "element" && r.tagName === "colgroup" && _r(r, n.children.indexOf(r), n) ? !1 : !!(i && i.type === "element" && i.tagName === "col");
}
function Rr(e, t, n) {
	let r = fr(n, t), i = j(e, -1);
	return n && r && r.type === "element" && (r.tagName === "thead" || r.tagName === "tbody") && _r(r, n.children.indexOf(r), n) ? !1 : !!(i && i.type === "element" && i.tagName === "tr");
}
//#endregion
//#region node_modules/hast-util-to-html/lib/handle/element.js
var zr = {
	name: [["	\n\f\r &/=>".split(""), "	\n\f\r \"&'/=>`".split("")], ["\0	\n\f\r \"&'/<=>".split(""), "\0	\n\f\r \"&'/<=>`".split("")]],
	unquoted: [["	\n\f\r &>".split(""), "\0	\n\f\r \"&'<=>`".split("")], ["\0	\n\f\r \"&'<=>`".split(""), "\0	\n\f\r \"&'<=>`".split("")]],
	single: [["&'".split(""), "\"&'`".split("")], ["\0&'".split(""), "\0\"&'`".split("")]],
	double: [["\"&".split(""), "\"&'`".split("")], ["\0\"&".split(""), "\0\"&'`".split("")]]
};
function Br(e, t, n, r) {
	let i = r.schema, a = i.space !== "svg" && r.settings.omitOptionalTags, o = i.space === "svg" ? r.settings.closeEmptyElements : r.settings.voids.includes(e.tagName.toLowerCase()), s = [], c;
	i.space === "html" && e.tagName === "svg" && (r.schema = An);
	let l = Vr(r, e.properties), u = r.all(i.space === "html" && e.tagName === "template" ? e.content : e);
	return r.schema = i, u && (o = !1), (l || !a || !Nr(e, t, n)) && (s.push("<", e.tagName, l ? " " + l : ""), o && (i.space === "svg" || r.settings.closeSelfClosing) && (c = l.charAt(l.length - 1), (!r.settings.tightSelfClosing || c === "/" || c && c !== "\"" && c !== "'") && s.push(" "), s.push("/")), s.push(">")), s.push(u), !o && (!a || !_r(e, t, n)) && s.push("</" + e.tagName + ">"), s.join("");
}
function Vr(e, t) {
	let n = [], r = -1, i;
	if (t) {
		for (i in t) if (t[i] !== null && t[i] !== void 0) {
			let r = Hr(e, i, t[i]);
			r && n.push(r);
		}
	}
	for (; ++r < n.length;) {
		let t = e.settings.tightAttributes ? n[r].charAt(n[r].length - 1) : void 0;
		r !== n.length - 1 && t !== "\"" && t !== "'" && (n[r] += " ");
	}
	return n.join("");
}
function Hr(e, t, n) {
	let r = En(e.schema, t), i = e.settings.allowParseErrors && e.schema.space === "html" ? 0 : 1, a = +!e.settings.allowDangerousCharacters, o = e.quote, s;
	if (r.overloadedBoolean && (n === r.attribute || n === "") ? n = !0 : (r.boolean || r.overloadedBoolean) && (typeof n != "string" || n === r.attribute || n === "") && (n = !!n), n == null || n === !1 || typeof n == "number" && Number.isNaN(n)) return "";
	let c = er(r.attribute, Object.assign({}, e.settings.characterReferences, { subset: zr.name[i][a] }));
	return n === !0 || (n = Array.isArray(n) ? (r.commaSeparated ? sr : cr)(n, { padLeft: !e.settings.tightCommaSeparatedLists }) : String(n), e.settings.collapseEmptyAttributes && !n) ? c : (e.settings.preferUnquoted && (s = er(n, Object.assign({}, e.settings.characterReferences, {
		attribute: !0,
		subset: zr.unquoted[i][a]
	}))), s !== n && (e.settings.quoteSmart && or(n, o) > or(n, e.alternative) && (o = e.alternative), s = o + er(n, Object.assign({}, e.settings.characterReferences, {
		subset: (o === "'" ? zr.single : zr.double)[i][a],
		attribute: !0
	})) + o), c + (s && "=" + s));
}
//#endregion
//#region node_modules/hast-util-to-html/lib/handle/text.js
var Ur = ["<", "&"];
function Wr(e, t, n, r) {
	return n && n.type === "element" && (n.tagName === "script" || n.tagName === "style") ? e.value : er(e.value, Object.assign({}, r.settings.characterReferences, { subset: Ur }));
}
//#endregion
//#region node_modules/hast-util-to-html/lib/handle/raw.js
function Gr(e, t, n, r) {
	return r.settings.allowDangerousHtml ? e.value : Wr(e, t, n, r);
}
//#endregion
//#region node_modules/hast-util-to-html/lib/handle/root.js
function Kr(e, t, n, r) {
	return r.all(e);
}
//#endregion
//#region node_modules/hast-util-to-html/lib/handle/index.js
var qr = Mn("type", {
	invalid: Jr,
	unknown: Yr,
	handlers: {
		comment: ir,
		doctype: ar,
		element: Br,
		raw: Gr,
		root: Kr,
		text: Wr
	}
});
function Jr(e) {
	throw Error("Expected node, not `" + e + "`");
}
function Yr(e) {
	throw Error("Cannot compile unknown node `" + e.type + "`");
}
//#endregion
//#region node_modules/hast-util-to-html/lib/index.js
var Xr = {}, Zr = {}, Qr = [];
function $r(e, t) {
	let n = t || Xr, r = n.quote || "\"", i = r === "\"" ? "'" : "\"";
	if (r !== "\"" && r !== "'") throw Error("Invalid quote `" + r + "`, expected `'` or `\"`");
	return {
		one: ei,
		all: ti,
		settings: {
			omitOptionalTags: n.omitOptionalTags || !1,
			allowParseErrors: n.allowParseErrors || !1,
			allowDangerousCharacters: n.allowDangerousCharacters || !1,
			quoteSmart: n.quoteSmart || !1,
			preferUnquoted: n.preferUnquoted || !1,
			tightAttributes: n.tightAttributes || !1,
			upperDoctype: n.upperDoctype || !1,
			tightDoctype: n.tightDoctype || !1,
			bogusComments: n.bogusComments || !1,
			tightCommaSeparatedLists: n.tightCommaSeparatedLists || !1,
			tightSelfClosing: n.tightSelfClosing || !1,
			collapseEmptyAttributes: n.collapseEmptyAttributes || !1,
			allowDangerousHtml: n.allowDangerousHtml || !1,
			voids: n.voids || tn,
			characterReferences: n.characterReferences || Zr,
			closeSelfClosing: n.closeSelfClosing || !1,
			closeEmptyElements: n.closeEmptyElements || !1
		},
		schema: n.space === "svg" ? An : kn,
		quote: r,
		alternative: i
	}.one(Array.isArray(e) ? {
		type: "root",
		children: e
	} : e, void 0, void 0);
}
function ei(e, t, n) {
	return qr(e, t, n, this);
}
function ti(e) {
	let t = [], n = e && e.children || Qr, r = -1;
	for (; ++r < n.length;) t[r] = this.one(n[r], r, e);
	return t.join("");
}
//#endregion
//#region node_modules/@shikijs/core/dist/index.mjs
var ni = /\s+/g;
function ri(e, t) {
	if (!t) return e;
	e.properties ||= {}, e.properties.class ||= [], typeof e.properties.class == "string" && (e.properties.class = e.properties.class.split(ni)), Array.isArray(e.properties.class) || (e.properties.class = []);
	let n = Array.isArray(t) ? t : t.split(ni);
	for (let t of n) t && !e.properties.class.includes(t) && e.properties.class.push(t);
	return e;
}
function ii(e) {
	let t = Ct(e, !0).map(([e]) => e);
	function n(n) {
		if (n === e.length) return {
			line: t.length - 1,
			character: t.at(-1).length
		};
		let r = n, i = 0;
		for (let e of t) {
			if (r < e.length) break;
			r -= e.length, i++;
		}
		return {
			line: i,
			character: r
		};
	}
	function r(e, n) {
		let r = 0;
		for (let n = 0; n < e; n++) r += t[n].length;
		return r += n, r;
	}
	return {
		lines: t,
		indexToPos: n,
		posToIndex: r
	};
}
var ai = ["color", "background-color"];
function oi(e, t) {
	let n = 0, r = [];
	for (let i of t) i > n && r.push({
		...e,
		content: e.content.slice(n, i),
		offset: e.offset + n
	}), n = i;
	return n < e.content.length && r.push({
		...e,
		content: e.content.slice(n),
		offset: e.offset + n
	}), r;
}
function si(e, t) {
	let n = [...t instanceof Set ? t : new Set(t)].sort((e, t) => e - t);
	return n.length ? e.map((e) => e.flatMap((e) => {
		let t = n.filter((t) => e.offset < t && t < e.offset + e.content.length).map((t) => t - e.offset).sort((e, t) => e - t);
		return t.length ? oi(e, t) : e;
	})) : e;
}
function ci(e, t, n, i, a = "css-vars") {
	let o = {
		content: e.content,
		explanation: e.explanation,
		offset: e.offset
	}, s = t.map((t) => li(e.variants[t])), c = new Set(s.flatMap((e) => Object.keys(e))), l = {}, u = (e, r) => {
		let i = r === "color" ? "" : r === "background-color" ? "-bg" : `-${r}`;
		return n + t[e] + (r === "color" ? "" : i);
	};
	return s.forEach((e, n) => {
		for (let o of c) {
			let c = e[o] || "inherit";
			if (n === 0 && i && ai.includes(o)) {
				if (i === "light-dark()" && s.length > 1) {
					let e = t.findIndex((e) => e === "light"), i = t.findIndex((e) => e === "dark");
					if (e === -1 || i === -1) throw new r("When using `defaultColor: \"light-dark()\"`, you must provide both `light` and `dark` themes");
					l[o] = `light-dark(${s[e][o] || "inherit"}, ${s[i][o] || "inherit"})`, a === "css-vars" && (l[u(n, o)] = c);
				} else l[o] = c;
			} else a === "css-vars" && (l[u(n, o)] = c);
		}
	}), o.htmlStyle = l, o;
}
function li(e) {
	let t = {};
	if (e.color && (t.color = e.color), e.bgColor && (t["background-color"] = e.bgColor), e.fontStyle) {
		e.fontStyle & C.Italic && (t["font-style"] = "italic"), e.fontStyle & C.Bold && (t["font-weight"] = "bold");
		let n = [];
		e.fontStyle & C.Underline && n.push("underline"), e.fontStyle & C.Strikethrough && n.push("line-through"), n.length && (t["text-decoration"] = n.join(" "));
	}
	return t;
}
function ui(e) {
	return typeof e == "string" ? e : Object.entries(e).map(([e, t]) => `${e}:${t}`).join(";");
}
function di() {
	let e = /* @__PURE__ */ new WeakMap();
	function t(t) {
		if (!e.has(t.meta)) {
			let n = ii(t.source);
			function i(e) {
				if (typeof e == "number") {
					if (e < 0 || e > t.source.length) throw new r(`Invalid decoration offset: ${e}. Code length: ${t.source.length}`);
					return {
						...n.indexToPos(e),
						offset: e
					};
				}
				{
					let t = n.lines[e.line];
					if (t === void 0) throw new r(`Invalid decoration position ${JSON.stringify(e)}. Lines length: ${n.lines.length}`);
					let i = e.character;
					if (i < 0 && (i = t.length + i), i < 0 || i > t.length) throw new r(`Invalid decoration position ${JSON.stringify(e)}. Line ${e.line} length: ${t.length}`);
					return {
						...e,
						character: i,
						offset: n.posToIndex(e.line, i)
					};
				}
			}
			let a = (t.options.decorations || []).map((e) => ({
				...e,
				start: i(e.start),
				end: i(e.end)
			}));
			fi(a), e.set(t.meta, {
				decorations: a,
				converter: n,
				source: t.source
			});
		}
		return e.get(t.meta);
	}
	return {
		name: "shiki:decorations",
		tokens(e) {
			if (this.options.decorations?.length) return si(e, t(this).decorations.flatMap((e) => [e.start.offset, e.end.offset]));
		},
		code(e) {
			if (!this.options.decorations?.length) return;
			let n = t(this), i = [...e.children].filter((e) => e.type === "element" && e.tagName === "span");
			if (i.length !== n.converter.lines.length) throw new r(`Number of lines in code element (${i.length}) does not match the number of lines in the source (${n.converter.lines.length}). Failed to apply decorations.`);
			function a(e, t, n, a) {
				let o = i[e], c = "", l = -1, u = -1;
				if (t === 0 && (l = 0), n === 0 && (u = 0), n === Infinity && (u = o.children.length), l === -1 || u === -1) for (let e = 0; e < o.children.length; e++) c += pi(o.children[e]), l === -1 && c.length === t && (l = e + 1), u === -1 && c.length === n && (u = e + 1);
				if (l === -1) throw new r(`Failed to find start index for decoration ${JSON.stringify(a.start)}`);
				if (u === -1) throw new r(`Failed to find end index for decoration ${JSON.stringify(a.end)}`);
				let d = o.children.slice(l, u);
				if (!a.alwaysWrap && d.length === o.children.length) s(o, a, "line");
				else if (!a.alwaysWrap && d.length === 1 && d[0].type === "element") s(d[0], a, "token");
				else {
					let e = {
						type: "element",
						tagName: "span",
						properties: {},
						children: d
					};
					s(e, a, "wrapper"), o.children.splice(l, d.length, e);
				}
			}
			function o(e, t) {
				i[e] = s(i[e], t, "line");
			}
			function s(e, t, n) {
				let r = t.properties || {}, i = t.transform || ((e) => e);
				return e.tagName = t.tagName || "span", e.properties = {
					...e.properties,
					...r,
					class: e.properties.class
				}, t.properties?.class && ri(e, t.properties.class), e = i(e, n) || e, e;
			}
			let c = [], l = n.decorations.sort((e, t) => t.start.offset - e.start.offset || e.end.offset - t.end.offset);
			for (let e of l) {
				let { start: t, end: n } = e;
				if (t.line === n.line) a(t.line, t.character, n.character, e);
				else if (t.line < n.line) {
					a(t.line, t.character, Infinity, e);
					for (let r = t.line + 1; r < n.line; r++) c.unshift(() => o(r, e));
					a(n.line, 0, n.character, e);
				}
			}
			c.forEach((e) => e());
		}
	};
}
function fi(e) {
	for (let t = 0; t < e.length; t++) {
		let n = e[t];
		if (n.start.offset > n.end.offset) throw new r(`Invalid decoration range: ${JSON.stringify(n.start)} - ${JSON.stringify(n.end)}`);
		for (let i = t + 1; i < e.length; i++) {
			let t = e[i], a = n.start.offset <= t.start.offset && t.start.offset < n.end.offset, o = n.start.offset < t.end.offset && t.end.offset <= n.end.offset, s = t.start.offset <= n.start.offset && n.start.offset < t.end.offset, c = t.start.offset < n.end.offset && n.end.offset <= t.end.offset;
			if (a || o || s || c) {
				if (a && o || s && c || s && n.start.offset === n.end.offset || o && t.start.offset === t.end.offset) continue;
				throw new r(`Decorations ${JSON.stringify(n.start)} and ${JSON.stringify(t.start)} intersect.`);
			}
		}
	}
}
function pi(e) {
	return e.type === "text" ? e.value : e.type === "element" ? e.children.map(pi).join("") : "";
}
var mi = [/* @__PURE__ */ di()];
function hi(e) {
	let t = gi(e.transformers || []);
	return [
		...t.pre,
		...t.normal,
		...t.post,
		...mi
	];
}
function gi(e) {
	let t = [], n = [], r = [];
	for (let i of e) switch (i.enforce) {
		case "pre":
			t.push(i);
			break;
		case "post":
			n.push(i);
			break;
		default: r.push(i);
	}
	return {
		pre: t,
		post: n,
		normal: r
	};
}
var M = [
	"black",
	"red",
	"green",
	"yellow",
	"blue",
	"magenta",
	"cyan",
	"white",
	"brightBlack",
	"brightRed",
	"brightGreen",
	"brightYellow",
	"brightBlue",
	"brightMagenta",
	"brightCyan",
	"brightWhite"
], _i = {
	1: "bold",
	2: "dim",
	3: "italic",
	4: "underline",
	7: "reverse",
	8: "hidden",
	9: "strikethrough"
};
function vi(e, t) {
	let n = e.indexOf("\x1B", t);
	if (n !== -1 && e[n + 1] === "[") {
		let t = e.indexOf("m", n);
		if (t !== -1) return {
			sequence: e.substring(n + 2, t).split(";"),
			startPosition: n,
			position: t + 1
		};
	}
	return { position: e.length };
}
function yi(e) {
	let t = e.shift();
	if (t === "2") {
		let t = e.splice(0, 3).map((e) => Number.parseInt(e));
		return t.length !== 3 || t.some((e) => Number.isNaN(e)) ? void 0 : {
			type: "rgb",
			rgb: t
		};
	}
	if (t === "5") {
		let t = e.shift();
		if (t) return {
			type: "table",
			index: Number(t)
		};
	}
}
function bi(e) {
	let t = [];
	for (; e.length > 0;) {
		let n = e.shift();
		if (!n) continue;
		let r = Number.parseInt(n);
		if (!Number.isNaN(r)) {
			if (r === 0) t.push({ type: "resetAll" });
			else if (r <= 9) _i[r] && t.push({
				type: "setDecoration",
				value: _i[r]
			});
			else if (r <= 29) {
				let e = _i[r - 20];
				e && (t.push({
					type: "resetDecoration",
					value: e
				}), e === "dim" && t.push({
					type: "resetDecoration",
					value: "bold"
				}));
			} else if (r <= 37) t.push({
				type: "setForegroundColor",
				value: {
					type: "named",
					name: M[r - 30]
				}
			});
			else if (r === 38) {
				let n = yi(e);
				n && t.push({
					type: "setForegroundColor",
					value: n
				});
			} else if (r === 39) t.push({ type: "resetForegroundColor" });
			else if (r <= 47) t.push({
				type: "setBackgroundColor",
				value: {
					type: "named",
					name: M[r - 40]
				}
			});
			else if (r === 48) {
				let n = yi(e);
				n && t.push({
					type: "setBackgroundColor",
					value: n
				});
			} else r === 49 ? t.push({ type: "resetBackgroundColor" }) : r === 53 ? t.push({
				type: "setDecoration",
				value: "overline"
			}) : r === 55 ? t.push({
				type: "resetDecoration",
				value: "overline"
			}) : r >= 90 && r <= 97 ? t.push({
				type: "setForegroundColor",
				value: {
					type: "named",
					name: M[r - 90 + 8]
				}
			}) : r >= 100 && r <= 107 && t.push({
				type: "setBackgroundColor",
				value: {
					type: "named",
					name: M[r - 100 + 8]
				}
			});
		}
	}
	return t;
}
function xi() {
	let e = null, t = null, n = /* @__PURE__ */ new Set();
	return { parse(r) {
		let i = [], a = 0;
		do {
			let o = vi(r, a), s = o.sequence ? r.substring(a, o.startPosition) : r.substring(a);
			if (s.length > 0 && i.push({
				value: s,
				foreground: e,
				background: t,
				decorations: new Set(n)
			}), o.sequence) {
				let r = bi(o.sequence);
				for (let i of r) i.type === "resetAll" ? (e = null, t = null, n.clear()) : i.type === "resetForegroundColor" ? e = null : i.type === "resetBackgroundColor" ? t = null : i.type === "resetDecoration" && n.delete(i.value);
				for (let i of r) i.type === "setForegroundColor" ? e = i.value : i.type === "setBackgroundColor" ? t = i.value : i.type === "setDecoration" && n.add(i.value);
			}
			a = o.position;
		} while (a < r.length);
		return i;
	} };
}
var Si = {
	black: "#000000",
	red: "#bb0000",
	green: "#00bb00",
	yellow: "#bbbb00",
	blue: "#0000bb",
	magenta: "#ff00ff",
	cyan: "#00bbbb",
	white: "#eeeeee",
	brightBlack: "#555555",
	brightRed: "#ff5555",
	brightGreen: "#00ff00",
	brightYellow: "#ffff55",
	brightBlue: "#5555ff",
	brightMagenta: "#ff55ff",
	brightCyan: "#55ffff",
	brightWhite: "#ffffff"
};
function Ci(e = Si) {
	function t(t) {
		return e[t];
	}
	function n(e) {
		return `#${e.map((e) => Math.max(0, Math.min(e, 255)).toString(16).padStart(2, "0")).join("")}`;
	}
	let r;
	function i() {
		if (r) return r;
		r = [];
		for (let e = 0; e < M.length; e++) r.push(t(M[e]));
		let e = [
			0,
			95,
			135,
			175,
			215,
			255
		];
		for (let t = 0; t < 6; t++) for (let i = 0; i < 6; i++) for (let a = 0; a < 6; a++) r.push(n([
			e[t],
			e[i],
			e[a]
		]));
		let i = 8;
		for (let e = 0; e < 24; e++, i += 10) r.push(n([
			i,
			i,
			i
		]));
		return r;
	}
	function a(e) {
		return i()[e];
	}
	function o(e) {
		switch (e.type) {
			case "named": return t(e.name);
			case "rgb": return n(e.rgb);
			case "table": return a(e.index);
		}
	}
	return { value: o };
}
var wi = /#([0-9a-f]{3,8})/i, Ti = /var\((--[\w-]+-ansi-[\w-]+)\)/, Ei = {
	black: "#000000",
	red: "#cd3131",
	green: "#0DBC79",
	yellow: "#E5E510",
	blue: "#2472C8",
	magenta: "#BC3FBC",
	cyan: "#11A8CD",
	white: "#E5E5E5",
	brightBlack: "#666666",
	brightRed: "#F14C4C",
	brightGreen: "#23D18B",
	brightYellow: "#F5F543",
	brightBlue: "#3B8EEA",
	brightMagenta: "#D670D6",
	brightCyan: "#29B8DB",
	brightWhite: "#FFFFFF"
};
function Di(e, t, n) {
	let r = ht(e, n), i = Ct(t), a = Ci(Object.fromEntries(M.map((t) => {
		let n = `terminal.ansi${t[0].toUpperCase()}${t.substring(1)}`;
		return [t, e.colors?.[n] || Ei[t]];
	}))), o = xi();
	return i.map((t) => o.parse(t[0]).map((n) => {
		let i, o;
		n.decorations.has("reverse") ? (i = n.background ? a.value(n.background) : e.bg, o = n.foreground ? a.value(n.foreground) : e.fg) : (i = n.foreground ? a.value(n.foreground) : e.fg, o = n.background ? a.value(n.background) : void 0), i = w(i, r), o = w(o, r), n.decorations.has("dim") && (i = Oi(i));
		let s = C.None;
		return n.decorations.has("bold") && (s |= C.Bold), n.decorations.has("italic") && (s |= C.Italic), n.decorations.has("underline") && (s |= C.Underline), n.decorations.has("strikethrough") && (s |= C.Strikethrough), {
			content: n.value,
			offset: t[1],
			color: i,
			bgColor: o,
			fontStyle: s
		};
	}));
}
function Oi(e) {
	let t = e.match(wi);
	if (t) {
		let e = t[1];
		if (e.length === 8) {
			let t = Math.round(Number.parseInt(e.slice(6, 8), 16) / 2).toString(16).padStart(2, "0");
			return `#${e.slice(0, 6)}${t}`;
		}
		if (e.length === 6) return `#${e}80`;
		if (e.length === 4) {
			let t = e[0], n = e[1], r = e[2], i = e[3];
			return `#${t}${t}${n}${n}${r}${r}${Math.round(Number.parseInt(`${i}${i}`, 16) / 2).toString(16).padStart(2, "0")}`;
		}
		if (e.length === 3) {
			let t = e[0], n = e[1], r = e[2];
			return `#${t}${t}${n}${n}${r}${r}80`;
		}
	}
	let n = e.match(Ti);
	return n ? `var(${n[1]}-dim)` : e;
}
function ki(e, t, n = {}) {
	let r = e.resolveLangAlias(n.lang || "text"), { theme: i = e.getLoadedThemes()[0] } = n;
	if (!vt(r) && !bt(i) && r === "ansi") {
		let { theme: r } = e.setTheme(i);
		return Di(r, t, n);
	}
	return Wt(e, t, n);
}
function Ai(e, t, n) {
	let i, a, o, s, c, l;
	if ("themes" in n) {
		let { defaultColor: u = "light", cssVariablePrefix: d = "--shiki-", colorsRendering: f = "css-vars" } = n, p = Object.entries(n.themes).filter((e) => e[1]).map((e) => ({
			color: e[0],
			theme: e[1]
		})).sort((e, t) => e.color === u ? -1 : +(t.color === u));
		if (p.length === 0) throw new r("`themes` option must not be empty");
		let m = $t(e, t, n, ki);
		if (l = Rt(m), u && u !== "light-dark()" && !p.some((e) => e.color === u)) throw new r(`\`themes\` option must contain the defaultColor key \`${u}\``);
		let h = p.map((t) => e.getTheme(t.theme)), g = p.map((e) => e.color);
		o = m.map((e) => e.map((e) => ci(e, g, d, u, f))), l && Lt(o, l);
		let _ = p.map((e) => ht(e.theme, n));
		a = ji(p, h, _, d, u, "fg", f), i = ji(p, h, _, d, u, "bg", f), s = `shiki-themes ${h.map((e) => e.name).join(" ")}`, c = u ? void 0 : [a, i].join(";");
	} else if ("theme" in n) {
		let r = ht(n.theme, n);
		o = ki(e, t, n);
		let c = e.getTheme(n.theme);
		i = w(c.bg, r), a = w(c.fg, r), s = c.name, l = Rt(o);
	} else throw new r("Invalid options, either `theme` or `themes` must be provided");
	return {
		tokens: o,
		fg: a,
		bg: i,
		themeName: s,
		rootStyle: c,
		grammarState: l
	};
}
function ji(e, t, n, i, a, o, s) {
	return e.map((c, l) => {
		let u = w(t[l][o], n[l]) || "inherit", d = `${i + c.color}${o === "bg" ? "-bg" : ""}:${u}`;
		if (l === 0 && a) {
			if (a === "light-dark()" && e.length > 1) {
				let i = e.findIndex((e) => e.color === "light"), a = e.findIndex((e) => e.color === "dark");
				if (i === -1 || a === -1) throw new r("When using `defaultColor: \"light-dark()\"`, you must provide both `light` and `dark` themes");
				return `light-dark(${w(t[i][o], n[i]) || "inherit"}, ${w(t[a][o], n[a]) || "inherit"});${d}`;
			}
			return u;
		}
		return s === "css-vars" ? d : null;
	}).filter((e) => !!e).join(";");
}
var Mi = /^\s+$/, Ni = /^(\s*)(.*?)(\s*)$/;
function Pi(e, t, n, r = {
	meta: {},
	options: n,
	codeToHast: (t, n) => Pi(e, t, n),
	codeToTokens: (t, n) => Ai(e, t, n)
}) {
	let i = t;
	for (let e of hi(n)) i = e.preprocess?.call(r, i, n) || i;
	let { tokens: a, fg: o, bg: s, themeName: c, rootStyle: l, grammarState: u } = Ai(e, i, n), { mergeWhitespaces: d = !0, mergeSameStyleTokens: f = !1 } = n;
	d === !0 ? a = Ii(a) : d === "never" && (a = Li(a)), f && (a = Ri(a));
	let p = {
		...r,
		get source() {
			return i;
		}
	};
	for (let e of hi(n)) a = e.tokens?.call(p, a) || a;
	return Fi(a, {
		...n,
		fg: o,
		bg: s,
		themeName: c,
		rootStyle: n.rootStyle === !1 ? !1 : n.rootStyle ?? l
	}, p, u);
}
function Fi(e, t, n, r = Rt(e)) {
	let i = hi(t), a = [], o = {
		type: "root",
		children: []
	}, { structure: s = "classic", tabindex: c = "0" } = t, l = { class: `shiki ${t.themeName || ""}` };
	t.rootStyle !== !1 && (l.style = t.rootStyle == null ? `background-color:${t.bg};color:${t.fg}` : t.rootStyle), c !== !1 && c != null && (l.tabindex = c.toString());
	for (let [e, n] of Object.entries(t.meta || {})) e.startsWith("_") || (l[e] = n);
	let u = {
		type: "element",
		tagName: "pre",
		properties: l,
		children: [],
		data: t.data
	}, d = {
		type: "element",
		tagName: "code",
		properties: {},
		children: a
	}, f = [], p = {
		...n,
		structure: s,
		addClassToHast: ri,
		get source() {
			return n.source;
		},
		get tokens() {
			return e;
		},
		get options() {
			return t;
		},
		get root() {
			return o;
		},
		get pre() {
			return u;
		},
		get code() {
			return d;
		},
		get lines() {
			return f;
		}
	};
	if (e.forEach((e, t) => {
		t && (s === "inline" ? o.children.push({
			type: "element",
			tagName: "br",
			properties: {},
			children: []
		}) : s === "classic" && a.push({
			type: "text",
			value: "\n"
		}));
		let n = {
			type: "element",
			tagName: "span",
			properties: { class: "line" },
			children: []
		}, r = 0;
		for (let a of e) {
			let e = {
				type: "element",
				tagName: "span",
				properties: { ...a.htmlAttrs },
				children: [{
					type: "text",
					value: a.content
				}]
			}, c = ui(a.htmlStyle || li(a));
			c && (e.properties.style = c);
			for (let o of i) e = o?.span?.call(p, e, t + 1, r, n, a) || e;
			s === "inline" ? o.children.push(e) : s === "classic" && n.children.push(e), r += a.content.length;
		}
		if (s === "classic") {
			for (let e of i) n = e?.line?.call(p, n, t + 1) || n;
			f.push(n), a.push(n);
		} else s === "inline" && f.push(n);
	}), s === "classic") {
		for (let e of i) d = e?.code?.call(p, d) || d;
		u.children.push(d);
		for (let e of i) u = e?.pre?.call(p, u) || u;
		o.children.push(u);
	} else if (s === "inline") {
		let e = [], t = {
			type: "element",
			tagName: "span",
			properties: { class: "line" },
			children: []
		};
		for (let n of o.children) n.type === "element" && n.tagName === "br" ? (e.push(t), t = {
			type: "element",
			tagName: "span",
			properties: { class: "line" },
			children: []
		}) : (n.type === "element" || n.type === "text") && t.children.push(n);
		e.push(t);
		let n = {
			type: "element",
			tagName: "code",
			properties: {},
			children: e
		};
		for (let e of i) n = e?.code?.call(p, n) || n;
		o.children = [];
		for (let e = 0; e < n.children.length; e++) {
			e > 0 && o.children.push({
				type: "element",
				tagName: "br",
				properties: {},
				children: []
			});
			let t = n.children[e];
			t.type === "element" && o.children.push(...t.children);
		}
	}
	let m = o;
	for (let e of i) m = e?.root?.call(p, m) || m;
	return r && Lt(m, r), m;
}
function Ii(e) {
	return e.map((e) => {
		let t = [], n = "", r;
		return e.forEach((i, a) => {
			let o = !(i.fontStyle && (i.fontStyle & C.Underline || i.fontStyle & C.Strikethrough));
			o && Mi.test(i.content) && e[a + 1] ? (r === void 0 && (r = i.offset), n += i.content) : n ? (o ? t.push({
				...i,
				offset: r,
				content: n + i.content
			}) : t.push({
				content: n,
				offset: r
			}, i), r = void 0, n = "") : t.push(i);
		}), t;
	});
}
function Li(e) {
	return e.map((e) => e.flatMap((e) => {
		if (Mi.test(e.content)) return e;
		let t = e.content.match(Ni);
		if (!t) return e;
		let [, n, r, i] = t;
		if (!n && !i) return e;
		let a = [{
			...e,
			offset: e.offset + n.length,
			content: r
		}];
		return n && a.unshift({
			content: n,
			offset: e.offset
		}), i && a.push({
			content: i,
			offset: e.offset + n.length + r.length
		}), a;
	}));
}
function Ri(e) {
	return e.map((e) => {
		let t = [];
		for (let n of e) {
			if (t.length === 0) {
				t.push({ ...n });
				continue;
			}
			let e = t.at(-1), r = ui(e.htmlStyle || li(e)), i = ui(n.htmlStyle || li(n)), a = e.fontStyle && (e.fontStyle & C.Underline || e.fontStyle & C.Strikethrough), o = n.fontStyle && (n.fontStyle & C.Underline || n.fontStyle & C.Strikethrough);
			!a && !o && r === i ? e.content += n.content : t.push({ ...n });
		}
		return t;
	});
}
var zi = $r;
function Bi(e, t, n) {
	let r = {
		meta: {},
		options: n,
		codeToHast: (t, n) => Pi(e, t, n),
		codeToTokens: (t, n) => Ai(e, t, n)
	}, i = zi(Pi(e, t, n, r));
	for (let e of hi(n)) i = e.postprocess?.call(r, i, n) || i;
	return i;
}
async function Vi(e) {
	let t = await Ft(e);
	return {
		getLastGrammarState: (...e) => Gt(t, ...e),
		codeToTokensBase: (e, n) => ki(t, e, n),
		codeToTokensWithThemes: (e, n) => $t(t, e, n),
		codeToTokens: (e, n) => Ai(t, e, n),
		codeToHast: (e, n) => Pi(t, e, n),
		codeToHtml: (e, n) => Bi(t, e, n),
		getBundledLanguages: () => ({}),
		getBundledThemes: () => ({}),
		...t,
		getInternalContext: () => t
	};
}
//#endregion
//#region node_modules/@shikijs/engine-javascript/dist/scanner-DX8LRFGE.mjs
var Hi = 4294967295, Ui = class {
	patterns;
	options;
	regexps;
	constructor(e, t = {}) {
		this.patterns = e, this.options = t;
		let { forgiving: n = !1, cache: r, regexConstructor: i } = t;
		if (!i) throw Error("Option `regexConstructor` is not provided");
		this.regexps = e.map((e) => {
			if (typeof e != "string") return e;
			let t = r?.get(e);
			if (t) {
				if (t instanceof RegExp) return t;
				if (n) return null;
				throw t;
			}
			try {
				let t = i(e);
				return r?.set(e, t), t;
			} catch (t) {
				if (r?.set(e, t), n) return null;
				throw t;
			}
		});
	}
	findNextMatchSync(e, t, n) {
		let r = typeof e == "string" ? e : e.content, i = [];
		function a(e, t, n = 0) {
			return {
				index: e,
				captureIndices: t.indices.map((e) => e == null ? {
					start: Hi,
					end: Hi,
					length: 0
				} : {
					start: e[0] + n,
					end: e[1] + n,
					length: e[1] - e[0]
				})
			};
		}
		for (let e = 0; e < this.regexps.length; e++) {
			let n = this.regexps[e];
			if (n) try {
				n.lastIndex = t;
				let o = n.exec(r);
				if (!o) continue;
				if (o.index === t) return a(e, o, 0);
				i.push([
					e,
					o,
					0
				]);
			} catch (e) {
				if (this.options.forgiving) continue;
				throw e;
			}
		}
		if (i.length) {
			let e = Math.min(...i.map((e) => e[1].index));
			for (let [t, n, r] of i) if (n.index === e) return a(t, n, r);
		}
		return null;
	}
};
//#endregion
//#region node_modules/oniguruma-parser/dist/utils.js
function Wi(e) {
	if ([...e].length !== 1) throw Error(`Expected "${e}" to be a single code point`);
	return e.codePointAt(0);
}
function Gi(e, t, n) {
	return e.has(t) || e.set(t, n), e.get(t);
}
var Ki = /* @__PURE__ */ new Set([
	"alnum",
	"alpha",
	"ascii",
	"blank",
	"cntrl",
	"digit",
	"graph",
	"lower",
	"print",
	"punct",
	"space",
	"upper",
	"word",
	"xdigit"
]), N = String.raw;
function qi(e, t) {
	if (e == null) throw Error(t ?? "Value expected");
	return e;
}
//#endregion
//#region node_modules/oniguruma-parser/dist/tokenizer/tokenize.js
var Ji = N`\[\^?`, Yi = `c.? | C(?:-.?)?|${N`[pP]\{(?:\^?[-\x20_]*[A-Za-z][-\x20\w]*\})?`}|${N`x[89A-Fa-f]\p{AHex}(?:\\x[89A-Fa-f]\p{AHex})*`}|${N`u(?:\p{AHex}{4})? | x\{[^\}]*\}? | x\p{AHex}{0,2}`}|${N`o\{[^\}]*\}?`}|${N`\d{1,3}`}`, Xi = /[?*+][?+]?|\{(?:\d+(?:,\d*)?|,\d+)\}\??/, Zi = new RegExp(N`
  \\ (?:
    ${Yi}
    | [gk]<[^>]*>?
    | [gk]'[^']*'?
    | .
  )
  | \( (?:
    \? (?:
      [:=!>({]
      | <[=!]
      | <[^>]*>
      | '[^']*'
      | ~\|?
      | #(?:[^)\\]|\\.?)*
      | [^:)]*[:)]
    )?
    | \*[^\)]*\)?
  )?
  | (?:${Xi.source})+
  | ${Ji}
  | .
`.replace(/\s+/g, ""), "gsu"), Qi = new RegExp(N`
  \\ (?:
    ${Yi}
    | .
  )
  | \[:(?:\^?\p{Alpha}+|\^):\]
  | ${Ji}
  | &&
  | .
`.replace(/\s+/g, ""), "gsu");
function $i(e, t = {}) {
	let n = {
		flags: "",
		...t,
		rules: {
			captureGroup: !1,
			singleline: !1,
			...t.rules
		}
	};
	if (typeof e != "string") throw Error("String expected as pattern");
	let r = Da(n.flags), i = [r.extended], a = {
		captureGroup: n.rules.captureGroup,
		getCurrentModX() {
			return i.at(-1);
		},
		numOpenGroups: 0,
		popModX() {
			i.pop();
		},
		pushModX(e) {
			i.push(e);
		},
		replaceCurrentModX(e) {
			i[i.length - 1] = e;
		},
		singleline: n.rules.singleline
	}, o = [], s;
	for (Zi.lastIndex = 0; s = Zi.exec(e);) {
		let t = ea(a, e, s[0], Zi.lastIndex);
		t.tokens ? o.push(...t.tokens) : t.token && o.push(t.token), t.lastIndex !== void 0 && (Zi.lastIndex = t.lastIndex);
	}
	let c = [], l = 0;
	o.filter((e) => e.type === "GroupOpen").forEach((e) => {
		e.kind === "capturing" ? e.number = ++l : e.raw === "(" && c.push(e);
	}), l || c.forEach((e, t) => {
		e.kind = "capturing", e.number = t + 1;
	});
	let u = l || c.length;
	return {
		tokens: o.map((e) => e.type === "EscapedNumber" ? ka(e, u) : e).flat(),
		flags: r
	};
}
function ea(e, t, n, r) {
	let [i, a] = n;
	if (n === "[" || n === "[^") {
		let e = ta(t, n, r);
		return {
			tokens: e.tokens,
			lastIndex: e.lastIndex
		};
	}
	if (i === "\\") {
		if ("AbBGyYzZ".includes(a)) return { token: aa(n, n) };
		if (/^\\g[<']/.test(n)) {
			if (!/^\\g(?:<[^>]+>|'[^']+')$/.test(n)) throw Error(`Invalid group name "${n}"`);
			return { token: _a(n) };
		}
		if (/^\\k[<']/.test(n)) {
			if (!/^\\k(?:<[^>]+>|'[^']+')$/.test(n)) throw Error(`Invalid group name "${n}"`);
			return { token: oa(n) };
		}
		if (a === "K") return { token: da("keep", n) };
		if (a === "N" || a === "R") return { token: F("newline", n, { negate: a === "N" }) };
		if (a === "O") return { token: F("any", n) };
		if (a === "X") return { token: F("text_segment", n) };
		let e = ra(n, { inCharClass: !1 });
		return Array.isArray(e) ? { tokens: e } : { token: e };
	}
	if (i === "(") {
		if (a === "*") return { token: Sa(n) };
		if (n === "(?{") throw Error(`Unsupported callout "${n}"`);
		if (n.startsWith("(?#")) {
			if (t[r] !== ")") throw Error("Unclosed comment group \"(?#\"");
			return { lastIndex: r + 1 };
		}
		if (/^\(\?[-imx]+[:)]$/.test(n)) return { token: xa(n, e) };
		if (e.pushModX(e.getCurrentModX()), e.numOpenGroups++, n === "(" && !e.captureGroup || n === "(?:") return { token: ma("group", n) };
		if (n === "(?>") return { token: ma("atomic", n) };
		if (n === "(?=" || n === "(?!" || n === "(?<=" || n === "(?<!") return { token: ma(n[2] === "<" ? "lookbehind" : "lookahead", n, { negate: n.endsWith("!") }) };
		if (n === "(" && e.captureGroup || n.startsWith("(?<") && n.endsWith(">") || n.startsWith("(?'") && n.endsWith("'")) return { token: ma("capturing", n, { ...n !== "(" && { name: n.slice(3, -1) } }) };
		if (n.startsWith("(?~")) {
			if (n === "(?~|") throw Error(`Unsupported absence function kind "${n}"`);
			return { token: ma("absence_repeater", n) };
		}
		throw Error(n === "(?(" ? `Unsupported conditional "${n}"` : `Invalid or unsupported group option "${n}"`);
	}
	if (n === ")") {
		if (e.popModX(), e.numOpenGroups--, e.numOpenGroups < 0) throw Error("Unmatched \")\"");
		return { token: pa(n) };
	}
	if (e.getCurrentModX()) {
		if (n === "#") {
			let e = t.indexOf("\n", r);
			return { lastIndex: e === -1 ? t.length : e };
		}
		if (/^\s$/.test(n)) {
			let e = /\s+/y;
			return e.lastIndex = r, { lastIndex: e.exec(t) ? e.lastIndex : r };
		}
	}
	return n === "." ? { token: F("dot", n) } : n === "^" || n === "$" ? { token: aa(e.singleline ? {
		"^": N`\A`,
		$: N`\Z`
	}[n] : n, n) } : n === "|" ? { token: ia(n) } : Xi.test(n) ? { tokens: Aa(n) } : { token: P(Wi(n), n) };
}
function ta(e, t, n) {
	let r = [ua(t[1] === "^", t)], i = 1, a;
	for (Qi.lastIndex = n; a = Qi.exec(e);) {
		let e = a[0];
		if (e[0] === "[" && e[1] !== ":") i++, r.push(ua(e[1] === "^", e));
		else if (e === "]") {
			if (r.at(-1).type === "CharacterClassOpen") r.push(P(93, e));
			else if (i--, r.push(sa(e)), !i) break;
		} else {
			let t = na(e);
			Array.isArray(t) ? r.push(...t) : r.push(t);
		}
	}
	return {
		tokens: r,
		lastIndex: Qi.lastIndex || e.length
	};
}
function na(e) {
	if (e[0] === "\\") return ra(e, { inCharClass: !0 });
	if (e[0] === "[") {
		let t = /\[:(?<negate>\^?)(?<name>[a-z]+):\]/.exec(e);
		if (!t || !Ki.has(t.groups.name)) throw Error(`Invalid POSIX class "${e}"`);
		return F("posix", e, {
			value: t.groups.name,
			negate: !!t.groups.negate
		});
	}
	return e === "-" ? ca(e) : e === "&&" ? la(e) : P(Wi(e), e);
}
function ra(e, { inCharClass: t }) {
	let n = e[1];
	if (n === "c" || n === "C") return ba(e);
	if ("dDhHsSwW".includes(n)) return wa(e);
	if (e.startsWith(N`\o{`)) throw Error(`Incomplete, invalid, or unsupported octal code point "${e}"`);
	if (/^\\[pP]\{/.test(e)) {
		if (e.length === 3) throw Error(`Incomplete or invalid Unicode property "${e}"`);
		return Ta(e);
	}
	if (/^\\x[89A-Fa-f]\p{AHex}/u.test(e)) try {
		let t = e.split(/\\x/).slice(1).map((e) => parseInt(e, 16)), n = new TextDecoder("utf-8", {
			ignoreBOM: !0,
			fatal: !0
		}).decode(new Uint8Array(t)), r = new TextEncoder();
		return [...n].map((e) => {
			let t = [...r.encode(e)].map((e) => `\\x${e.toString(16)}`).join("");
			return P(Wi(e), t);
		});
	} catch {
		throw Error(`Multibyte code "${e}" incomplete or invalid in Oniguruma`);
	}
	if (n === "u" || n === "x") return P(Oa(e), e);
	if (ya.has(n)) return P(ya.get(n), e);
	if (/\d/.test(n)) return fa(t, e);
	if (e === "\\") throw Error(N`Incomplete escape "\"`);
	if (n === "M") throw Error(`Unsupported meta "${e}"`);
	if ([...e].length === 2) return P(e.codePointAt(1), e);
	throw Error(`Unexpected escape "${e}"`);
}
function ia(e) {
	return {
		type: "Alternator",
		raw: e
	};
}
function aa(e, t) {
	return {
		type: "Assertion",
		kind: e,
		raw: t
	};
}
function oa(e) {
	return {
		type: "Backreference",
		raw: e
	};
}
function P(e, t) {
	return {
		type: "Character",
		value: e,
		raw: t
	};
}
function sa(e) {
	return {
		type: "CharacterClassClose",
		raw: e
	};
}
function ca(e) {
	return {
		type: "CharacterClassHyphen",
		raw: e
	};
}
function la(e) {
	return {
		type: "CharacterClassIntersector",
		raw: e
	};
}
function ua(e, t) {
	return {
		type: "CharacterClassOpen",
		negate: e,
		raw: t
	};
}
function F(e, t, n = {}) {
	return {
		type: "CharacterSet",
		kind: e,
		...n,
		raw: t
	};
}
function da(e, t, n = {}) {
	return e === "keep" ? {
		type: "Directive",
		kind: e,
		raw: t
	} : {
		type: "Directive",
		kind: e,
		flags: qi(n.flags),
		raw: t
	};
}
function fa(e, t) {
	return {
		type: "EscapedNumber",
		inCharClass: e,
		raw: t
	};
}
function pa(e) {
	return {
		type: "GroupClose",
		raw: e
	};
}
function ma(e, t, n = {}) {
	return {
		type: "GroupOpen",
		kind: e,
		...n,
		raw: t
	};
}
function ha(e, t, n, r) {
	return {
		type: "NamedCallout",
		kind: e,
		tag: t,
		arguments: n,
		raw: r
	};
}
function ga(e, t, n, r) {
	return {
		type: "Quantifier",
		kind: e,
		min: t,
		max: n,
		raw: r
	};
}
function _a(e) {
	return {
		type: "Subroutine",
		raw: e
	};
}
var va = /* @__PURE__ */ new Set([
	"COUNT",
	"CMP",
	"ERROR",
	"FAIL",
	"MAX",
	"MISMATCH",
	"SKIP",
	"TOTAL_COUNT"
]), ya = /* @__PURE__ */ new Map([
	["a", 7],
	["b", 8],
	["e", 27],
	["f", 12],
	["n", 10],
	["r", 13],
	["t", 9],
	["v", 11]
]);
function ba(e) {
	let t = e[1] === "c" ? e[2] : e[3];
	if (!t || !/[A-Za-z]/.test(t)) throw Error(`Unsupported control character "${e}"`);
	return P(Wi(t.toUpperCase()) - 64, e);
}
function xa(e, t) {
	let { on: n, off: r } = /^\(\?(?<on>[imx]*)(?:-(?<off>[-imx]*))?/.exec(e).groups;
	r ??= "";
	let i = (t.getCurrentModX() || n.includes("x")) && !r.includes("x"), a = Ea(n), o = Ea(r), s = {};
	if (a && (s.enable = a), o && (s.disable = o), e.endsWith(")")) return t.replaceCurrentModX(i), da("flags", e, { flags: s });
	if (e.endsWith(":")) return t.pushModX(i), t.numOpenGroups++, ma("group", e, { ...(a || o) && { flags: s } });
	throw Error(`Unexpected flag modifier "${e}"`);
}
function Sa(e) {
	let t = /\(\*(?<name>[A-Za-z_]\w*)?(?:\[(?<tag>(?:[A-Za-z_]\w*)?)\])?(?:\{(?<args>[^}]*)\})?\)/.exec(e);
	if (!t) throw Error(`Incomplete or invalid named callout "${e}"`);
	let { name: n, tag: r, args: i } = t.groups;
	if (!n) throw Error(`Invalid named callout "${e}"`);
	if (r === "") throw Error(`Named callout tag with empty value not allowed "${e}"`);
	let a = i ? i.split(",").filter((e) => e !== "").map((e) => /^[+-]?\d+$/.test(e) ? +e : e) : [], [o, s, c] = a, l = va.has(n) ? n.toLowerCase() : "custom";
	switch (l) {
		case "fail":
		case "mismatch":
		case "skip":
			if (a.length > 0) throw Error(`Named callout arguments not allowed "${a}"`);
			break;
		case "error":
			if (a.length > 1) throw Error(`Named callout allows only one argument "${a}"`);
			if (typeof o == "string") throw Error(`Named callout argument must be a number "${o}"`);
			break;
		case "max":
			if (!a.length || a.length > 2) throw Error(`Named callout must have one or two arguments "${a}"`);
			if (typeof o == "string" && !/^[A-Za-z_]\w*$/.test(o)) throw Error(`Named callout argument one must be a tag or number "${o}"`);
			if (a.length === 2 && (typeof s == "number" || !/^[<>X]$/.test(s))) throw Error(`Named callout optional argument two must be '<', '>', or 'X' "${s}"`);
			break;
		case "count":
		case "total_count":
			if (a.length > 1) throw Error(`Named callout allows only one argument "${a}"`);
			if (a.length === 1 && (typeof o == "number" || !/^[<>X]$/.test(o))) throw Error(`Named callout optional argument must be '<', '>', or 'X' "${o}"`);
			break;
		case "cmp":
			if (a.length !== 3) throw Error(`Named callout must have three arguments "${a}"`);
			if (typeof o == "string" && !/^[A-Za-z_]\w*$/.test(o)) throw Error(`Named callout argument one must be a tag or number "${o}"`);
			if (typeof s == "number" || !/^(?:[<>!=]=|[<>])$/.test(s)) throw Error(`Named callout argument two must be '==', '!=', '>', '<', '>=', or '<=' "${s}"`);
			if (typeof c == "string" && !/^[A-Za-z_]\w*$/.test(c)) throw Error(`Named callout argument three must be a tag or number "${c}"`);
			break;
		case "custom": throw Error(`Undefined callout name "${n}"`);
		default: throw Error(`Unexpected named callout kind "${l}"`);
	}
	return ha(l, r ?? null, i?.split(",") ?? null, e);
}
function Ca(e) {
	let t = null, n, r;
	if (e[0] === "{") {
		let { minStr: i, maxStr: a } = /^\{(?<minStr>\d*)(?:,(?<maxStr>\d*))?/.exec(e).groups, o = 1e5;
		if (+i > o || a && +a > o) throw Error("Quantifier value unsupported in Oniguruma");
		if (n = +i, r = a === void 0 ? +i : a === "" ? 1 / 0 : +a, n > r && (t = "possessive", [n, r] = [r, n]), e.endsWith("?")) {
			if (t === "possessive") throw Error("Unsupported possessive interval quantifier chain with \"?\"");
			t = "lazy";
		} else t ||= "greedy";
	} else n = +(e[0] === "+"), r = e[0] === "?" ? 1 : 1 / 0, t = e[1] === "+" ? "possessive" : e[1] === "?" ? "lazy" : "greedy";
	return ga(t, n, r, e);
}
function wa(e) {
	let t = e[1].toLowerCase();
	return F({
		d: "digit",
		h: "hex",
		s: "space",
		w: "word"
	}[t], e, { negate: e[1] !== t });
}
function Ta(e) {
	let { p: t, neg: n, value: r } = /^\\(?<p>[pP])\{(?<neg>\^?)(?<value>[^}]+)/.exec(e).groups;
	return F("property", e, {
		value: r,
		negate: t === "P" && !n || t === "p" && !!n
	});
}
function Ea(e) {
	let t = {};
	return e.includes("i") && (t.ignoreCase = !0), e.includes("m") && (t.dotAll = !0), e.includes("x") && (t.extended = !0), Object.keys(t).length ? t : null;
}
function Da(e) {
	let t = {
		ignoreCase: !1,
		dotAll: !1,
		extended: !1,
		digitIsAscii: !1,
		posixIsAscii: !1,
		spaceIsAscii: !1,
		wordIsAscii: !1,
		textSegmentMode: null
	};
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		if (!"imxDPSWy".includes(r)) throw Error(`Invalid flag "${r}"`);
		if (r === "y") {
			if (!/^y{[gw]}/.test(e.slice(n))) throw Error("Invalid or unspecified flag \"y\" mode");
			t.textSegmentMode = e[n + 2] === "g" ? "grapheme" : "word", n += 3;
			continue;
		}
		t[{
			i: "ignoreCase",
			m: "dotAll",
			x: "extended",
			D: "digitIsAscii",
			P: "posixIsAscii",
			S: "spaceIsAscii",
			W: "wordIsAscii"
		}[r]] = !0;
	}
	return t;
}
function Oa(e) {
	if (/^(?:\\u(?!\p{AHex}{4})|\\x(?!\p{AHex}{1,2}|\{\p{AHex}{1,8}\}))/u.test(e)) throw Error(`Incomplete or invalid escape "${e}"`);
	let t = e[2] === "{" ? /^\\x\{\s*(?<hex>\p{AHex}+)/u.exec(e).groups.hex : e.slice(2);
	return parseInt(t, 16);
}
function ka(e, t) {
	let { raw: n, inCharClass: r } = e, i = n.slice(1);
	if (!r && (i !== "0" && i.length === 1 || i[0] !== "0" && +i <= t)) return [oa(n)];
	let a = [], o = i.match(/^[0-7]+|\d/g);
	for (let e = 0; e < o.length; e++) {
		let t = o[e], r;
		if (e === 0 && t !== "8" && t !== "9") {
			if (r = parseInt(t, 8), r > 127) throw Error(N`Octal encoded byte above 177 unsupported "${n}"`);
		} else r = Wi(t);
		a.push(P(r, (e === 0 ? "\\" : "") + t));
	}
	return a;
}
function Aa(e) {
	let t = [], n = new RegExp(Xi, "gy"), r;
	for (; r = n.exec(e);) {
		let e = r[0];
		if (e[0] === "{") {
			let r = /^\{(?<min>\d+),(?<max>\d+)\}\??$/.exec(e);
			if (r) {
				let { min: i, max: a } = r.groups;
				if (+i > +a && e.endsWith("?")) {
					n.lastIndex--, t.push(Ca(e.slice(0, -1)));
					continue;
				}
			}
		}
		t.push(Ca(e));
	}
	return t;
}
//#endregion
//#region node_modules/oniguruma-parser/dist/parser/node-utils.js
function ja(e, t) {
	if (!Array.isArray(e.body)) throw Error("Expected node with body array");
	if (e.body.length !== 1) return !1;
	let n = e.body[0];
	return !t || Object.keys(t).every((e) => t[e] === n[e]);
}
function Ma(e) {
	return Na.has(e.type);
}
var Na = /* @__PURE__ */ new Set([
	"AbsenceFunction",
	"Backreference",
	"CapturingGroup",
	"Character",
	"CharacterClass",
	"CharacterSet",
	"Group",
	"Quantifier",
	"Subroutine"
]);
//#endregion
//#region node_modules/oniguruma-parser/dist/parser/parse.js
function Pa(e, t = {}) {
	let n = {
		flags: "",
		normalizeUnknownPropertyNames: !1,
		skipBackrefValidation: !1,
		skipLookbehindValidation: !1,
		skipPropertyNameValidation: !1,
		unicodePropertyMap: null,
		...t,
		rules: {
			captureGroup: !1,
			singleline: !1,
			...t.rules
		}
	}, r = $i(e, {
		flags: n.flags,
		rules: {
			captureGroup: n.rules.captureGroup,
			singleline: n.rules.singleline
		}
	}), i = (e, t) => {
		let n = r.tokens[a.nextIndex];
		switch (a.parent = e, a.nextIndex++, n.type) {
			case "Alternator": return Wa();
			case "Assertion": return Fa(n);
			case "Backreference": return Ia(n, a);
			case "Character": return Ja(n.value, { useLastValid: !!t.isCheckingRangeEnd });
			case "CharacterClassHyphen": return La(n, a, t);
			case "CharacterClassOpen": return Ra(n, a, t);
			case "CharacterSet": return za(n, a);
			case "Directive": return Qa(n.kind, { flags: n.flags });
			case "GroupOpen": return Ba(n, a, t);
			case "NamedCallout": return to(n.kind, n.tag, n.arguments);
			case "Quantifier": return Va(n, a);
			case "Subroutine": return Ha(n, a);
			default: throw Error(`Unexpected token type "${n.type}"`);
		}
	}, a = {
		capturingGroups: [],
		hasNumberedRef: !1,
		namedGroupsByName: /* @__PURE__ */ new Map(),
		nextIndex: 0,
		normalizeUnknownPropertyNames: n.normalizeUnknownPropertyNames,
		parent: null,
		skipBackrefValidation: n.skipBackrefValidation,
		skipLookbehindValidation: n.skipLookbehindValidation,
		skipPropertyNameValidation: n.skipPropertyNameValidation,
		subroutines: [],
		tokens: r.tokens,
		unicodePropertyMap: n.unicodePropertyMap,
		walk: i
	}, o = io($a(r.flags)), s = o.body[0];
	for (; a.nextIndex < r.tokens.length;) {
		let e = i(s, {});
		e.type === "Alternative" ? (o.body.push(e), s = e) : s.body.push(e);
	}
	let { capturingGroups: c, hasNumberedRef: l, namedGroupsByName: u, subroutines: d } = a;
	if (l && u.size && !n.rules.captureGroup) throw Error("Numbered backref/subroutine not allowed when using named capture");
	for (let { ref: e } of d) if (typeof e == "number") {
		if (e > c.length) throw Error("Subroutine uses a group number that's not defined");
		e && (c[e - 1].isSubroutined = !0);
	} else if (u.has(e)) {
		if (u.get(e).length > 1) throw Error(N`Subroutine uses a duplicate group name "\g<${e}>"`);
		u.get(e)[0].isSubroutined = !0;
	} else throw Error(N`Subroutine uses a group name that's not defined "\g<${e}>"`);
	return o;
}
function Fa({ kind: e }) {
	return Ga(qi({
		"^": "line_start",
		$: "line_end",
		"\\A": "string_start",
		"\\b": "word_boundary",
		"\\B": "word_boundary",
		"\\G": "search_start",
		"\\y": "text_segment_boundary",
		"\\Y": "text_segment_boundary",
		"\\z": "string_end",
		"\\Z": "string_end_newline"
	}[e], `Unexpected assertion kind "${e}"`), { negate: e === N`\B` || e === N`\Y` });
}
function Ia({ raw: e }, t) {
	let n = /^\\k[<']/.test(e), r = n ? e.slice(3, -1) : e.slice(1), i = (n, r = !1) => {
		let i = t.capturingGroups.length, a = !1;
		if (n > i) {
			if (t.skipBackrefValidation) a = !0;
			else throw Error(`Not enough capturing groups defined to the left "${e}"`);
		}
		return t.hasNumberedRef = !0, Ka(r ? i + 1 - n : n, { orphan: a });
	};
	if (n) {
		let n = /^(?<sign>-?)0*(?<num>[1-9]\d*)$/.exec(r);
		if (n) return i(+n.groups.num, !!n.groups.sign);
		if (/[-+]/.test(r)) throw Error(`Invalid backref name "${e}"`);
		if (!t.namedGroupsByName.has(r)) throw Error(`Group name not defined to the left "${e}"`);
		return Ka(r);
	}
	return i(+r);
}
function La(e, t, n) {
	let { tokens: r, walk: i } = t, a = t.parent, o = a.body.at(-1), s = r[t.nextIndex];
	if (!n.isCheckingRangeEnd && o && o.type !== "CharacterClass" && o.type !== "CharacterClassRange" && s && s.type !== "CharacterClassOpen" && s.type !== "CharacterClassClose" && s.type !== "CharacterClassIntersector") {
		let e = i(a, {
			...n,
			isCheckingRangeEnd: !0
		});
		if (o.type === "Character" && e.type === "Character") return a.body.pop(), Xa(o, e);
		throw Error("Invalid character class range");
	}
	return Ja(Wi("-"));
}
function Ra({ negate: e }, t, n) {
	let { tokens: r, walk: i } = t, a = [Ya()], o = r[t.nextIndex], s = go(o);
	for (; s.type !== "CharacterClassClose";) {
		if (s.type === "CharacterClassIntersector") a.push(Ya()), t.nextIndex++;
		else {
			let e = a.at(-1);
			e.body.push(i(e, n));
		}
		s = go(r[t.nextIndex], o);
	}
	let c = Ya({ negate: e });
	return a.length === 1 ? c.body = a[0].body : (c.kind = "intersection", c.body = a.map((e) => e.body.length === 1 ? e.body[0] : e)), t.nextIndex++, c;
}
function za({ kind: e, negate: t, value: n }, r) {
	let { normalizeUnknownPropertyNames: i, skipPropertyNameValidation: a, unicodePropertyMap: o } = r;
	if (e === "property") {
		let r = ho(n);
		if (Ki.has(r) && !o?.has(r)) e = "posix", n = r;
		else return oo(n, {
			negate: t,
			normalizeUnknownPropertyNames: i,
			skipPropertyNameValidation: a,
			unicodePropertyMap: o
		});
	}
	return e === "posix" ? no(n, { negate: t }) : Za(e, { negate: t });
}
function Ba(e, t, n) {
	let { tokens: r, capturingGroups: i, namedGroupsByName: a, skipLookbehindValidation: o, walk: s } = t, c = so(e), l = c.type === "AbsenceFunction", u = fo(c), d = u && c.negate;
	if (c.type === "CapturingGroup" && (i.push(c), c.name && Gi(a, c.name, []).push(c)), l && n.isInAbsenceFunction) throw Error("Nested absence function not supported by Oniguruma");
	let f = _o(r[t.nextIndex]);
	for (; f.type !== "GroupClose";) {
		if (f.type === "Alternator") c.body.push(Wa()), t.nextIndex++;
		else {
			let e = c.body.at(-1), t = s(e, {
				...n,
				isInAbsenceFunction: n.isInAbsenceFunction || l,
				isInLookbehind: n.isInLookbehind || u,
				isInNegLookbehind: n.isInNegLookbehind || d
			});
			if (e.body.push(t), (u || n.isInLookbehind) && !o) {
				let e = "Lookbehind includes a pattern not allowed by Oniguruma";
				if (d || n.isInNegLookbehind) {
					if (uo(t) || t.type === "CapturingGroup") throw Error(e);
				} else if (uo(t) || fo(t) && t.negate) throw Error(e);
			}
		}
		f = _o(r[t.nextIndex]);
	}
	return t.nextIndex++, c;
}
function Va({ kind: e, min: t, max: n }, r) {
	let i = r.parent, a = i.body.at(-1);
	if (!a || !Ma(a)) throw Error("Quantifier requires a repeatable token");
	let o = ro(e, t, n, a);
	return i.body.pop(), o;
}
function Ha({ raw: e }, t) {
	let { capturingGroups: n, subroutines: r } = t, i = e.slice(3, -1), a = /^(?<sign>[-+]?)0*(?<num>[1-9]\d*)$/.exec(i);
	if (a) {
		let e = +a.groups.num, r = n.length;
		if (t.hasNumberedRef = !0, i = {
			"": e,
			"+": r + e,
			"-": r + 1 - e
		}[a.groups.sign], i < 1) throw Error("Invalid subroutine number");
	} else i === "0" && (i = 0);
	let o = ao(i);
	return r.push(o), o;
}
function Ua(e, t) {
	if (e !== "repeater") throw Error(`Unexpected absence function kind "${e}"`);
	return {
		type: "AbsenceFunction",
		kind: e,
		body: co(t?.body)
	};
}
function Wa(e) {
	return {
		type: "Alternative",
		body: lo(e?.body)
	};
}
function Ga(e, t) {
	let n = {
		type: "Assertion",
		kind: e
	};
	return (e === "word_boundary" || e === "text_segment_boundary") && (n.negate = !!t?.negate), n;
}
function Ka(e, t) {
	let n = !!t?.orphan;
	return {
		type: "Backreference",
		ref: e,
		...n && { orphan: n }
	};
}
function qa(e, t) {
	let n = {
		name: void 0,
		isSubroutined: !1,
		...t
	};
	if (n.name !== void 0 && !po(n.name)) throw Error(`Group name "${n.name}" invalid in Oniguruma`);
	return {
		type: "CapturingGroup",
		number: e,
		...n.name && { name: n.name },
		...n.isSubroutined && { isSubroutined: n.isSubroutined },
		body: co(t?.body)
	};
}
function Ja(e, t) {
	let n = {
		useLastValid: !1,
		...t
	};
	if (e > 1114111) {
		let t = e.toString(16);
		if (n.useLastValid) e = 1114111;
		else throw Error(e > 1310719 ? `Invalid code point out of range "\\x{${t}}"` : `Invalid code point out of range in JS "\\x{${t}}"`);
	}
	return {
		type: "Character",
		value: e
	};
}
function Ya(e) {
	let t = {
		kind: "union",
		negate: !1,
		...e
	};
	return {
		type: "CharacterClass",
		kind: t.kind,
		negate: t.negate,
		body: lo(e?.body)
	};
}
function Xa(e, t) {
	if (t.value < e.value) throw Error("Character class range out of order");
	return {
		type: "CharacterClassRange",
		min: e,
		max: t
	};
}
function Za(e, t) {
	let n = !!t?.negate, r = {
		type: "CharacterSet",
		kind: e
	};
	return (e === "digit" || e === "hex" || e === "newline" || e === "space" || e === "word") && (r.negate = n), (e === "text_segment" || e === "newline" && !n) && (r.variableLength = !0), r;
}
function Qa(e, t = {}) {
	if (e === "keep") return {
		type: "Directive",
		kind: e
	};
	if (e === "flags") return {
		type: "Directive",
		kind: e,
		flags: qi(t.flags)
	};
	throw Error(`Unexpected directive kind "${e}"`);
}
function $a(e) {
	return {
		type: "Flags",
		...e
	};
}
function I(e) {
	let t = e?.atomic, n = e?.flags;
	if (t && n) throw Error("Atomic group cannot have flags");
	return {
		type: "Group",
		...t && { atomic: t },
		...n && { flags: n },
		body: co(e?.body)
	};
}
function eo(e) {
	let t = {
		behind: !1,
		negate: !1,
		...e
	};
	return {
		type: "LookaroundAssertion",
		kind: t.behind ? "lookbehind" : "lookahead",
		negate: t.negate,
		body: co(e?.body)
	};
}
function to(e, t, n) {
	return {
		type: "NamedCallout",
		kind: e,
		tag: t,
		arguments: n
	};
}
function no(e, t) {
	let n = !!t?.negate;
	if (!Ki.has(e)) throw Error(`Invalid POSIX class "${e}"`);
	return {
		type: "CharacterSet",
		kind: "posix",
		value: e,
		negate: n
	};
}
function ro(e, t, n, r) {
	if (t > n) throw Error("Invalid reversed quantifier range");
	return {
		type: "Quantifier",
		kind: e,
		min: t,
		max: n,
		body: r
	};
}
function io(e, t) {
	return {
		type: "Regex",
		body: co(t?.body),
		flags: e
	};
}
function ao(e) {
	return {
		type: "Subroutine",
		ref: e
	};
}
function oo(e, t) {
	let n = {
		negate: !1,
		normalizeUnknownPropertyNames: !1,
		skipPropertyNameValidation: !1,
		unicodePropertyMap: null,
		...t
	}, r = n.unicodePropertyMap?.get(ho(e));
	if (!r) {
		if (n.normalizeUnknownPropertyNames) r = mo(e);
		else if (n.unicodePropertyMap && !n.skipPropertyNameValidation) throw Error(N`Invalid Unicode property "\p{${e}}"`);
	}
	return {
		type: "CharacterSet",
		kind: "property",
		value: r ?? e,
		negate: n.negate
	};
}
function so({ flags: e, kind: t, name: n, negate: r, number: i }) {
	switch (t) {
		case "absence_repeater": return Ua("repeater");
		case "atomic": return I({ atomic: !0 });
		case "capturing": return qa(i, { name: n });
		case "group": return I({ flags: e });
		case "lookahead":
		case "lookbehind": return eo({
			behind: t === "lookbehind",
			negate: r
		});
		default: throw Error(`Unexpected group kind "${t}"`);
	}
}
function co(e) {
	if (e === void 0) e = [Wa()];
	else if (!Array.isArray(e) || !e.length || !e.every((e) => e.type === "Alternative")) throw Error("Invalid body; expected array of one or more Alternative nodes");
	return e;
}
function lo(e) {
	if (e === void 0) e = [];
	else if (!Array.isArray(e) || !e.every((e) => !!e.type)) throw Error("Invalid body; expected array of nodes");
	return e;
}
function uo(e) {
	return e.type === "LookaroundAssertion" && e.kind === "lookahead";
}
function fo(e) {
	return e.type === "LookaroundAssertion" && e.kind === "lookbehind";
}
function po(e) {
	return /^[\p{Alpha}\p{Pc}][^)]*$/u.test(e);
}
function mo(e) {
	return e.trim().replace(/[- _]+/g, "_").replace(/[A-Z][a-z]+(?=[A-Z])/g, "$&_").replace(/[A-Za-z]+/g, (e) => e[0].toUpperCase() + e.slice(1).toLowerCase());
}
function ho(e) {
	return e.replace(/[- _]+/g, "").toLowerCase();
}
function go(e, t) {
	let n = t;
	return qi(e, `Unclosed character class${n?.type === "Character" && n.value === 93 && n.raw === "]" ? " (started with \"]\")" : ""}`);
}
function _o(e) {
	return qi(e, "Unclosed group");
}
//#endregion
//#region node_modules/oniguruma-parser/dist/traverser/traverse.js
function vo(e, t, n = null) {
	function r(e, t) {
		for (let n = 0; n < e.length; n++) {
			let r = i(e[n], t, n, e);
			n = Math.max(-1, n + r);
		}
	}
	function i(a, o = null, s = null, c = null) {
		let l = 0, u = !1, d = {
			node: a,
			parent: o,
			key: s,
			container: c,
			root: e,
			remove() {
				yo(c).splice(Math.max(0, bo(s) + l), 1), l--, u = !0;
			},
			removeAllNextSiblings() {
				return yo(c).splice(bo(s) + 1);
			},
			removeAllPrevSiblings() {
				let e = bo(s) + l;
				return l -= e, yo(c).splice(0, Math.max(0, e));
			},
			replaceWith(e, t = {}) {
				let n = !!t.traverse;
				c ? c[Math.max(0, bo(s) + l)] = e : qi(o, "Can't replace root node")[s] = e, n && i(e, o, s, c), u = !0;
			},
			replaceWithMultiple(e, t = {}) {
				let n = !!t.traverse;
				if (yo(c).splice(Math.max(0, bo(s) + l), 1, ...e), l += e.length - 1, n) {
					let t = 0;
					for (let n = 0; n < e.length; n++) t += i(e[n], o, bo(s) + n + t, c);
				}
				u = !0;
			},
			skip() {
				u = !0;
			}
		}, { type: f } = a, p = t["*"], m = t[f], h = typeof p == "function" ? p : p?.enter, g = typeof m == "function" ? m : m?.enter;
		if (h?.(d, n), g?.(d, n), !u) switch (f) {
			case "AbsenceFunction":
			case "Alternative":
			case "CapturingGroup":
			case "CharacterClass":
			case "Group":
			case "LookaroundAssertion":
				r(a.body, a);
				break;
			case "Assertion":
			case "Backreference":
			case "Character":
			case "CharacterSet":
			case "Directive":
			case "Flags":
			case "NamedCallout":
			case "Subroutine": break;
			case "CharacterClassRange":
				i(a.min, a, "min"), i(a.max, a, "max");
				break;
			case "Quantifier":
				i(a.body, a, "body");
				break;
			case "Regex":
				r(a.body, a), i(a.flags, a, "flags");
				break;
			default: throw Error(`Unexpected node type "${f}"`);
		}
		return m?.exit?.(d, n), p?.exit?.(d, n), l;
	}
	return i(e), e;
}
function yo(e) {
	if (!Array.isArray(e)) throw Error("Container expected");
	return e;
}
function bo(e) {
	if (typeof e != "number") throw Error("Numeric key expected");
	return e;
}
//#endregion
//#region node_modules/regex/src/utils-internals.js
var xo = String.raw`\(\?(?:[:=!>A-Za-z\-]|<[=!]|\(DEFINE\))`;
function So(e, t) {
	for (let n = 0; n < e.length; n++) e[n] >= t && e[n]++;
}
function Co(e, t, n, r) {
	return e.slice(0, t) + r + e.slice(t + n.length);
}
//#endregion
//#region node_modules/regex-utilities/src/index.js
var L = Object.freeze({
	DEFAULT: "DEFAULT",
	CHAR_CLASS: "CHAR_CLASS"
});
function wo(e, t, n, r) {
	let i = new RegExp(String.raw`${t}|(?<$skip>\[\^?|\\?.)`, "gsu"), a = [!1], o = 0, s = "";
	for (let t of e.matchAll(i)) {
		let { 0: e, groups: { $skip: i } } = t;
		if (!i && (!r || r === L.DEFAULT == !o)) {
			n instanceof Function ? s += n(t, {
				context: o ? L.CHAR_CLASS : L.DEFAULT,
				negated: a[a.length - 1]
			}) : s += n;
			continue;
		}
		e[0] === "[" ? (o++, a.push(e[1] === "^")) : e === "]" && o && (o--, a.pop()), s += e;
	}
	return s;
}
function To(e, t, n, r) {
	wo(e, t, n, r);
}
function Eo(e, t, n = 0, r) {
	if (!new RegExp(t, "su").test(e)) return null;
	let i = RegExp(`${t}|(?<$skip>\\\\?.)`, "gsu");
	i.lastIndex = n;
	let a = 0, o;
	for (; o = i.exec(e);) {
		let { 0: e, groups: { $skip: t } } = o;
		if (!t && (!r || r === L.DEFAULT == !a)) return o;
		e === "[" ? a++ : e === "]" && a && a--, i.lastIndex == o.index && i.lastIndex++;
	}
	return null;
}
function Do(e, t, n) {
	return !!Eo(e, t, 0, n);
}
function Oo(e, t) {
	let n = /\\?./gsu;
	n.lastIndex = t;
	let r = e.length, i = 0, a = 1, o;
	for (; o = n.exec(e);) {
		let [e] = o;
		if (e === "[") i++;
		else if (i) e === "]" && i--;
		else if (e === "(") a++;
		else if (e === ")" && (a--, !a)) {
			r = o.index;
			break;
		}
	}
	return e.slice(t, r);
}
//#endregion
//#region node_modules/regex/src/atomic.js
var ko = new RegExp(String.raw`(?<noncapturingStart>${xo})|(?<capturingStart>\((?:\?<[^>]+>)?)|\\?.`, "gsu");
function Ao(e, t) {
	let n = t?.hiddenCaptures ?? [], r = t?.captureTransfers ?? /* @__PURE__ */ new Map();
	if (!/\(\?>/.test(e)) return {
		pattern: e,
		captureTransfers: r,
		hiddenCaptures: n
	};
	let i = [0], a = [], o = 0, s = 0, c = NaN, l;
	do {
		l = !1;
		let t = 0, u = 0, d = !1, f;
		for (ko.lastIndex = Number.isNaN(c) ? 0 : c + 7; f = ko.exec(e);) {
			let { 0: p, index: m, groups: { capturingStart: h, noncapturingStart: g } } = f;
			if (p === "[") t++;
			else if (t) p === "]" && t--;
			else if (p === "(?>" && !d) c = m, d = !0;
			else if (d && g) u++;
			else if (h) d ? u++ : (o++, i.push(o + s));
			else if (p === ")" && d) {
				if (!u) {
					s++;
					let t = o + s;
					if (e = `${e.slice(0, c)}(?:(?=(${e.slice(c + 3, m)}))<$$${t}>)${e.slice(m + 1)}`, l = !0, a.push(t), So(n, t), r.size) {
						let e = /* @__PURE__ */ new Map();
						r.forEach((n, r) => {
							e.set(r >= t ? r + 1 : r, n.map((e) => e >= t ? e + 1 : e));
						}), r = e;
					}
					break;
				}
				u--;
			}
		}
	} while (l);
	return n.push(...a), e = wo(e, String.raw`\\(?<backrefNum>[1-9]\d*)|<\$\$(?<wrappedBackrefNum>\d+)>`, ({ 0: e, groups: { backrefNum: t, wrappedBackrefNum: n } }) => {
		if (t) {
			let n = +t;
			if (n > i.length - 1) throw Error(`Backref "${e}" greater than number of captures`);
			return `\\${i[n]}`;
		}
		return `\\${n}`;
	}, L.DEFAULT), {
		pattern: e,
		captureTransfers: r,
		hiddenCaptures: n
	};
}
var jo = String.raw`(?:[?*+]|\{\d+(?:,\d*)?\})`, Mo = new RegExp(String.raw`
\\(?: \d+
  | c[A-Za-z]
  | [gk]<[^>]+>
  | [pPu]\{[^\}]+\}
  | u[A-Fa-f\d]{4}
  | x[A-Fa-f\d]{2}
  )
| \((?: \? (?: [:=!>]
  | <(?:[=!]|[^>]+>)
  | [A-Za-z\-]+:
  | \(DEFINE\)
  ))?
| (?<qBase>${jo})(?<qMod>[?+]?)(?<invalidQ>[?*+\{]?)
| \\?.
`.replace(/\s+/g, ""), "gsu");
function No(e) {
	if (!RegExp(`${jo}\\+`).test(e)) return { pattern: e };
	let t = [], n = null, r = null, i = "", a = 0, o;
	for (Mo.lastIndex = 0; o = Mo.exec(e);) {
		let { 0: s, index: c, groups: { qBase: l, qMod: u, invalidQ: d } } = o;
		if (s === "[") a || (r = c), a++;
		else if (s === "]") a ? a-- : r = null;
		else if (!a) {
			if (u === "+" && i && !i.startsWith("(")) {
				if (d) throw Error(`Invalid quantifier "${s}"`);
				let t = -1;
				if (/^\{\d+\}$/.test(l)) e = Co(e, c + l.length, u, "");
				else {
					if (i === ")" || i === "]") {
						let t = i === ")" ? n : r;
						if (t === null) throw Error(`Invalid unmatched "${i}"`);
						e = `${e.slice(0, t)}(?>${e.slice(t, c)}${l})${e.slice(c + s.length)}`;
					} else e = `${e.slice(0, c - i.length)}(?>${i}${l})${e.slice(c + s.length)}`;
					t += 4;
				}
				Mo.lastIndex += t;
			} else s[0] === "(" ? t.push(c) : s === ")" && (n = t.length ? t.pop() : null);
		}
		i = s;
	}
	return { pattern: e };
}
//#endregion
//#region node_modules/regex-recursion/src/index.js
var R = String.raw, Po = R`\(\?R=(?<rDepth>[^\)]+)\)|${R`\\g<(?<gRNameOrNum>[^>&]+)&R=(?<gRDepth>[^>]+)>`}`, Fo = R`\(\?<(?![=!])(?<captureName>[^>]+)>`, Io = R`${Fo}|(?<unnamed>\()(?!\?)`, Lo = new RegExp(R`${Fo}|${Po}|\(\?|\\?.`, "gsu"), Ro = "Cannot use multiple overlapping recursions";
function zo(e, t) {
	let { hiddenCaptures: n, mode: r } = {
		hiddenCaptures: [],
		mode: "plugin",
		...t
	}, i = t?.captureTransfers ?? /* @__PURE__ */ new Map();
	if (!new RegExp(Po, "su").test(e)) return {
		pattern: e,
		captureTransfers: i,
		hiddenCaptures: n
	};
	if (r === "plugin" && Do(e, R`\(\?\(DEFINE\)`, L.DEFAULT)) throw Error("DEFINE groups cannot be used with recursion");
	let a = [], o = Do(e, R`\\[1-9]`, L.DEFAULT), s = /* @__PURE__ */ new Map(), c = [], l = !1, u = 0, d = 0, f;
	for (Lo.lastIndex = 0; f = Lo.exec(e);) {
		let { 0: t, groups: { captureName: p, rDepth: m, gRNameOrNum: h, gRDepth: g } } = f;
		if (t === "[") u++;
		else if (u) t === "]" && u--;
		else {
			if (m) {
				if (Bo(m), l) throw Error(Ro);
				if (o) throw Error(`${r === "external" ? "Backrefs" : "Numbered backrefs"} cannot be used with global recursion`);
				let t = e.slice(0, f.index), s = e.slice(Lo.lastIndex);
				if (Do(s, Po, L.DEFAULT)) throw Error(Ro);
				let c = m - 1;
				e = Vo(t, s, c, !1, n, a, d), i = Wo(i, t, c, a.length, 0, d);
				break;
			}
			if (h) {
				Bo(g);
				let u = !1;
				for (let e of c) if (e.name === h || e.num === +h) {
					if (u = !0, e.hasRecursedWithin) throw Error(Ro);
					break;
				}
				if (!u) throw Error(R`Recursive \g cannot be used outside the referenced group "${r === "external" ? h : R`\g<${h}&R=${g}>`}"`);
				let p = s.get(h), m = Oo(e, p);
				if (o && Do(m, R`${Fo}|\((?!\?)`, L.DEFAULT)) throw Error(`${r === "external" ? "Backrefs" : "Numbered backrefs"} cannot be used with recursion of capturing groups`);
				let _ = e.slice(p, f.index), v = m.slice(_.length + t.length), y = a.length, b = g - 1, x = Vo(_, v, b, !0, n, a, d);
				i = Wo(i, _, b, a.length - y, y, d), e = `${e.slice(0, p)}${x}${e.slice(p + m.length)}`, Lo.lastIndex += x.length - t.length - _.length - v.length, c.forEach((e) => e.hasRecursedWithin = !0), l = !0;
			} else if (p) d++, s.set(String(d), Lo.lastIndex), s.set(p, Lo.lastIndex), c.push({
				num: d,
				name: p
			});
			else if (t[0] === "(") {
				let e = t === "(";
				e && (d++, s.set(String(d), Lo.lastIndex)), c.push(e ? { num: d } : {});
			} else t === ")" && c.pop();
		}
	}
	return n.push(...a), {
		pattern: e,
		captureTransfers: i,
		hiddenCaptures: n
	};
}
function Bo(e) {
	let t = `Max depth must be integer between 2 and 100; used ${e}`;
	if (!/^[1-9]\d*$/.test(e) || (e = +e, e < 2 || e > 100)) throw Error(t);
}
function Vo(e, t, n, r, i, a, o) {
	let s = /* @__PURE__ */ new Set();
	r && To(e + t, Fo, ({ groups: { captureName: e } }) => {
		s.add(e);
	}, L.DEFAULT);
	let c = [
		n,
		r ? s : null,
		i,
		a,
		o
	];
	return `${e}${Ho(`(?:${e}`, "forward", ...c)}(?:)${Ho(`${t})`, "backward", ...c)}${t}`;
}
function Ho(e, t, n, r, i, a, o) {
	let s = (e) => t === "forward" ? e + 2 : n - e + 2 - 1, c = "";
	for (let t = 0; t < n; t++) {
		let n = s(t);
		c += wo(e, R`${Io}|\\k<(?<backref>[^>]+)>`, ({ 0: e, groups: { captureName: t, unnamed: s, backref: c } }) => {
			if (c && r && !r.has(c)) return e;
			let l = `_$${n}`;
			if (s || t) {
				let n = o + a.length + 1;
				return a.push(n), Uo(i, n), s ? e : `(?<${t}${l}>`;
			}
			return R`\k<${c}${l}>`;
		}, L.DEFAULT);
	}
	return c;
}
function Uo(e, t) {
	for (let n = 0; n < e.length; n++) e[n] >= t && e[n]++;
}
function Wo(e, t, n, r, i, a) {
	if (e.size && r) {
		let o = 0;
		To(t, Io, () => o++, L.DEFAULT);
		let s = a - o + i, c = /* @__PURE__ */ new Map();
		return e.forEach((e, t) => {
			let i = (r - o * n) / n, a = o * n, l = t > s + o ? t + r : t, u = [];
			for (let t of e) if (t <= s) u.push(t);
			else if (t > s + o + i) u.push(t + r);
			else if (t <= s + o) for (let e = 0; e <= n; e++) u.push(t + o * e);
			else for (let e = 0; e <= n; e++) u.push(t + a + i * e);
			c.set(l, u);
		}), c;
	}
	return e;
}
//#endregion
//#region node_modules/oniguruma-to-es/dist/esm/index.js
var z = String.fromCodePoint, B = String.raw, V = {}, Go = globalThis.RegExp;
V.flagGroups = (() => {
	try {
		new Go("(?i:)");
	} catch {
		return !1;
	}
	return !0;
})(), V.unicodeSets = (() => {
	try {
		new Go("[[]]", "v");
	} catch {
		return !1;
	}
	return !0;
})(), V.bugFlagVLiteralHyphenIsRange = V.unicodeSets ? (() => {
	try {
		new Go(B`[\d\-a]`, "v");
	} catch {
		return !0;
	}
	return !1;
})() : !1, V.bugNestedClassIgnoresNegation = V.unicodeSets && new Go("[[^a]]", "v").test("a");
function Ko(e, { enable: t, disable: n }) {
	return {
		dotAll: !n?.dotAll && !!(t?.dotAll || e.dotAll),
		ignoreCase: !n?.ignoreCase && !!(t?.ignoreCase || e.ignoreCase)
	};
}
function qo(e, t, n) {
	return e.has(t) || e.set(t, n), e.get(t);
}
function Jo(e, t) {
	return Xo[e] >= Xo[t];
}
function Yo(e, t) {
	if (e == null) throw Error(t ?? "Value expected");
	return e;
}
var Xo = {
	ES2025: 2025,
	ES2024: 2024,
	ES2018: 2018
}, Zo = {
	auto: "auto",
	ES2025: "ES2025",
	ES2024: "ES2024",
	ES2018: "ES2018"
};
function Qo(e = {}) {
	if ({}.toString.call(e) !== "[object Object]") throw Error("Unexpected options");
	if (e.target !== void 0 && !Zo[e.target]) throw Error(`Unexpected target "${e.target}"`);
	let t = {
		accuracy: "default",
		avoidSubclass: !1,
		flags: "",
		global: !1,
		hasIndices: !1,
		lazyCompileLength: Infinity,
		target: "auto",
		verbose: !1,
		...e,
		rules: {
			allowOrphanBackrefs: !1,
			asciiWordBoundaries: !1,
			captureGroup: !1,
			recursionLimit: 20,
			singleline: !1,
			...e.rules
		}
	};
	return t.target === "auto" && (t.target = V.flagGroups ? "ES2025" : V.unicodeSets ? "ES2024" : "ES2018"), t;
}
var $o = "[	-\r ]", es = /* @__PURE__ */ new Set([z(304), z(305)]), H = B`[\p{L}\p{M}\p{N}\p{Pc}]`;
function ts(e) {
	if (es.has(e)) return [e];
	let t = /* @__PURE__ */ new Set(), n = e.toLowerCase(), r = n.toUpperCase(), i = as.get(n), a = rs.get(n), o = is.get(n);
	return [...r].length === 1 && t.add(r), o && t.add(o), i && t.add(i), t.add(n), a && t.add(a), [...t];
}
var ns = /* @__PURE__ */ new Map("C Other\nCc Control cntrl\nCf Format\nCn Unassigned\nCo Private_Use\nCs Surrogate\nL Letter\nLC Cased_Letter\nLl Lowercase_Letter\nLm Modifier_Letter\nLo Other_Letter\nLt Titlecase_Letter\nLu Uppercase_Letter\nM Mark Combining_Mark\nMc Spacing_Mark\nMe Enclosing_Mark\nMn Nonspacing_Mark\nN Number\nNd Decimal_Number digit\nNl Letter_Number\nNo Other_Number\nP Punctuation punct\nPc Connector_Punctuation\nPd Dash_Punctuation\nPe Close_Punctuation\nPf Final_Punctuation\nPi Initial_Punctuation\nPo Other_Punctuation\nPs Open_Punctuation\nS Symbol\nSc Currency_Symbol\nSk Modifier_Symbol\nSm Math_Symbol\nSo Other_Symbol\nZ Separator\nZl Line_Separator\nZp Paragraph_Separator\nZs Space_Separator\nASCII\nASCII_Hex_Digit AHex\nAlphabetic Alpha\nAny\nAssigned\nBidi_Control Bidi_C\nBidi_Mirrored Bidi_M\nCase_Ignorable CI\nCased\nChanges_When_Casefolded CWCF\nChanges_When_Casemapped CWCM\nChanges_When_Lowercased CWL\nChanges_When_NFKC_Casefolded CWKCF\nChanges_When_Titlecased CWT\nChanges_When_Uppercased CWU\nDash\nDefault_Ignorable_Code_Point DI\nDeprecated Dep\nDiacritic Dia\nEmoji\nEmoji_Component EComp\nEmoji_Modifier EMod\nEmoji_Modifier_Base EBase\nEmoji_Presentation EPres\nExtended_Pictographic ExtPict\nExtender Ext\nGrapheme_Base Gr_Base\nGrapheme_Extend Gr_Ext\nHex_Digit Hex\nIDS_Binary_Operator IDSB\nIDS_Trinary_Operator IDST\nID_Continue IDC\nID_Start IDS\nIdeographic Ideo\nJoin_Control Join_C\nLogical_Order_Exception LOE\nLowercase Lower\nMath\nNoncharacter_Code_Point NChar\nPattern_Syntax Pat_Syn\nPattern_White_Space Pat_WS\nQuotation_Mark QMark\nRadical\nRegional_Indicator RI\nSentence_Terminal STerm\nSoft_Dotted SD\nTerminal_Punctuation Term\nUnified_Ideograph UIdeo\nUppercase Upper\nVariation_Selector VS\nWhite_Space space\nXID_Continue XIDC\nXID_Start XIDS".split(/\s/).map((e) => [ho(e), e])), rs = /* @__PURE__ */ new Map([["s", z(383)], [z(383), "s"]]), is = /* @__PURE__ */ new Map([
	[z(223), z(7838)],
	[z(107), z(8490)],
	[z(229), z(8491)],
	[z(969), z(8486)]
]), as = new Map([
	U(453),
	U(456),
	U(459),
	U(498),
	...cs(8072, 8079),
	...cs(8088, 8095),
	...cs(8104, 8111),
	U(8124),
	U(8140),
	U(8188)
]), os = /* @__PURE__ */ new Map([
	["alnum", B`[\p{Alpha}\p{Nd}]`],
	["alpha", B`\p{Alpha}`],
	["ascii", B`\p{ASCII}`],
	["blank", B`[\p{Zs}\t]`],
	["cntrl", B`\p{Cc}`],
	["digit", B`\p{Nd}`],
	["graph", B`[\P{space}&&\P{Cc}&&\P{Cn}&&\P{Cs}]`],
	["lower", B`\p{Lower}`],
	["print", B`[[\P{space}&&\P{Cc}&&\P{Cn}&&\P{Cs}]\p{Zs}]`],
	["punct", B`[\p{P}\p{S}]`],
	["space", B`\p{space}`],
	["upper", B`\p{Upper}`],
	["word", B`[\p{Alpha}\p{M}\p{Nd}\p{Pc}]`],
	["xdigit", B`\p{AHex}`]
]);
function ss(e, t) {
	let n = [];
	for (let r = e; r <= t; r++) n.push(r);
	return n;
}
function U(e) {
	let t = z(e);
	return [t.toLowerCase(), t];
}
function cs(e, t) {
	return ss(e, t).map((e) => U(e));
}
var ls = /* @__PURE__ */ new Set([
	"Lower",
	"Lowercase",
	"Upper",
	"Uppercase",
	"Ll",
	"Lowercase_Letter",
	"Lt",
	"Titlecase_Letter",
	"Lu",
	"Uppercase_Letter"
]);
function us(e, t) {
	let n = {
		accuracy: "default",
		asciiWordBoundaries: !1,
		avoidSubclass: !1,
		bestEffortTarget: "ES2025",
		...t
	};
	ms(e);
	let r = {
		accuracy: n.accuracy,
		asciiWordBoundaries: n.asciiWordBoundaries,
		avoidSubclass: n.avoidSubclass,
		flagDirectivesByAlt: /* @__PURE__ */ new Map(),
		jsGroupNameMap: /* @__PURE__ */ new Map(),
		minTargetEs2024: Jo(n.bestEffortTarget, "ES2024"),
		passedLookbehind: !1,
		strategy: null,
		subroutineRefMap: /* @__PURE__ */ new Map(),
		supportedGNodes: /* @__PURE__ */ new Set(),
		digitIsAscii: e.flags.digitIsAscii,
		spaceIsAscii: e.flags.spaceIsAscii,
		wordIsAscii: e.flags.wordIsAscii
	};
	vo(e, ds, r);
	let i = {
		dotAll: e.flags.dotAll,
		ignoreCase: e.flags.ignoreCase
	}, a = {
		currentFlags: i,
		prevFlags: null,
		globalFlags: i,
		groupOriginByCopy: /* @__PURE__ */ new Map(),
		groupsByName: /* @__PURE__ */ new Map(),
		multiplexCapturesToLeftByRef: /* @__PURE__ */ new Map(),
		openRefs: /* @__PURE__ */ new Map(),
		reffedNodesByReferencer: /* @__PURE__ */ new Map(),
		subroutineRefMap: r.subroutineRefMap
	};
	return vo(e, fs, a), vo(e, ps, {
		groupsByName: a.groupsByName,
		highestOrphanBackref: 0,
		numCapturesToLeft: 0,
		reffedNodesByReferencer: a.reffedNodesByReferencer
	}), e._originMap = a.groupOriginByCopy, e._strategy = r.strategy, e;
}
var ds = {
	AbsenceFunction({ node: e, parent: t, replaceWith: n }) {
		let { body: r, kind: i } = e;
		if (i === "repeater") {
			let e = I();
			e.body[0].body.push(eo({
				negate: !0,
				body: r
			}), oo("Any"));
			let i = I();
			i.body[0].body.push(ro("greedy", 0, Infinity, e)), n(K(i, t), { traverse: !0 });
		} else throw Error("Unsupported absence function \"(?~|\"");
	},
	Alternative: {
		enter({ node: e, parent: t, key: n }, { flagDirectivesByAlt: r }) {
			let i = e.body.filter((e) => e.kind === "flags");
			for (let e = n + 1; e < t.body.length; e++) {
				let n = t.body[e];
				qo(r, n, []).push(...i);
			}
		},
		exit({ node: e }, { flagDirectivesByAlt: t }) {
			if (t.get(e)?.length) {
				let n = xs(t.get(e));
				if (n) {
					let t = I({ flags: n });
					t.body[0].body = e.body, e.body = [K(t, e)];
				}
			}
		}
	},
	Assertion({ node: e, parent: t, key: n, container: r, root: i, remove: a, replaceWith: o }, s) {
		let { kind: c, negate: l } = e, { asciiWordBoundaries: u, avoidSubclass: d, supportedGNodes: f, wordIsAscii: p } = s;
		if (c === "text_segment_boundary") throw Error(`Unsupported text segment boundary "\\${l ? "Y" : "y"}"`);
		if (c === "line_end") o(K(eo({ body: [Wa({ body: [Ga("string_end")] }), Wa({ body: [Ja(10)] })] }), t));
		else if (c === "line_start") o(K(W(B`(?<=\A|\n(?!\z))`, { skipLookbehindValidation: !0 }), t));
		else if (c === "search_start") {
			if (f.has(e)) i.flags.sticky = !0, a();
			else {
				let e = r[n - 1];
				if (e && Ds(e)) o(K(eo({ negate: !0 }), t));
				else if (d) throw Error(B`Uses "\G" in a way that requires a subclass`);
				else o(G(Ga("string_start"), t)), s.strategy = "clip_search";
			}
		} else if (c !== "string_end" && c !== "string_start") {
			if (c === "string_end_newline") o(K(W(B`(?=\n?\z)`), t));
			else if (c === "word_boundary") {
				if (!p && !u) {
					let e = `(?:(?<=${H})(?!${H})|(?<!${H})(?=${H}))`, n = `(?:(?<=${H})(?=${H})|(?<!${H})(?!${H}))`;
					o(K(W(l ? n : e), t));
				}
			} else throw Error(`Unexpected assertion kind "${c}"`);
		}
	},
	Backreference({ node: e }, { jsGroupNameMap: t }) {
		let { ref: n } = e;
		typeof n == "string" && !ks(n) && (n = bs(n, t), e.ref = n);
	},
	CapturingGroup({ node: e }, { jsGroupNameMap: t, subroutineRefMap: n }) {
		let { name: r } = e;
		r && !ks(r) && (r = bs(r, t), e.name = r), n.set(e.number, e), r && n.set(r, e);
	},
	CharacterClassRange({ node: e, parent: t, replaceWith: n }) {
		t.kind === "intersection" && n(K(Ya({ body: [e] }), t), { traverse: !0 });
	},
	CharacterSet({ node: e, parent: t, replaceWith: n }, { accuracy: r, minTargetEs2024: i, digitIsAscii: a, spaceIsAscii: o, wordIsAscii: s }) {
		let { kind: c, negate: l, value: u } = e;
		if (a && (c === "digit" || u === "digit")) {
			n(G(Za("digit", { negate: l }), t));
			return;
		}
		if (o && (c === "space" || u === "space")) {
			n(K(As(W($o), l), t));
			return;
		}
		if (s && (c === "word" || u === "word")) {
			n(G(Za("word", { negate: l }), t));
			return;
		}
		if (c === "any") n(G(oo("Any"), t));
		else if (c === "digit") n(G(oo("Nd", { negate: l }), t));
		else if (c !== "dot") {
			if (c === "text_segment") {
				if (r === "strict") throw Error(B`Use of "\X" requires non-strict accuracy`);
				let e = "\\p{Emoji}(?:\\p{EMod}|\\uFE0F\\u20E3?|[\\x{E0020}-\\x{E007E}]+\\x{E007F})?", a = B`\p{RI}{2}|${e}(?:\u200D${e})*`;
				n(K(W(B`(?>\r\n|${i ? B`\p{RGI_Emoji}` : a}|\P{M}\p{M}*)`, { skipPropertyNameValidation: !0 }), t));
			} else if (c === "hex") n(G(oo("AHex", { negate: l }), t));
			else if (c === "newline") n(K(W(l ? "[^\n]" : "(?>\r\n?|[\n\v\f\u2028\u2029])"), t));
			else if (c === "posix") {
				if (!i && (u === "graph" || u === "print")) {
					if (r === "strict") throw Error(`POSIX class "${u}" requires min target ES2024 or non-strict accuracy`);
					let e = {
						graph: "!-~",
						print: " -~"
					}[u];
					l && (e = `\0-${z(e.codePointAt(0) - 1)}${z(e.codePointAt(2) + 1)}-\u{10FFFF}`), n(K(W(`[${e}]`), t));
				} else n(K(As(W(os.get(u)), l), t));
			} else if (c === "property") ns.has(ho(u)) || (e.key = "sc");
			else if (c === "space") n(G(oo("space", { negate: l }), t));
			else if (c === "word") n(K(As(W(H), l), t));
			else throw Error(`Unexpected character set kind "${c}"`);
		}
	},
	Directive({ node: e, parent: t, root: n, remove: r, replaceWith: i, removeAllPrevSiblings: a, removeAllNextSiblings: o }) {
		let { kind: s, flags: c } = e;
		if (s === "flags") {
			if (!c.enable && !c.disable) r();
			else {
				let e = I({ flags: c });
				e.body[0].body = o(), i(K(e, t), { traverse: !0 });
			}
		} else if (s === "keep") {
			let e = n.body[0], r = n.body.length === 1 && ja(e, { type: "Group" }) && e.body[0].body.length === 1 ? e.body[0] : n;
			if (t.parent !== r || r.body.length > 1) throw Error(B`Uses "\K" in a way that's unsupported`);
			let o = eo({ behind: !0 });
			o.body[0].body = a(), i(K(o, t));
		} else throw Error(`Unexpected directive kind "${s}"`);
	},
	Flags({ node: e, parent: t }) {
		if (e.posixIsAscii) throw Error("Unsupported flag \"P\"");
		if (e.textSegmentMode === "word") throw Error("Unsupported flag \"y{w}\"");
		[
			"digitIsAscii",
			"extended",
			"posixIsAscii",
			"spaceIsAscii",
			"wordIsAscii",
			"textSegmentMode"
		].forEach((t) => delete e[t]), Object.assign(e, {
			global: !1,
			hasIndices: !1,
			multiline: !1,
			sticky: e.sticky ?? !1
		}), t.options = {
			disable: {
				x: !0,
				n: !0
			},
			force: { v: !0 }
		};
	},
	Group({ node: e }) {
		if (!e.flags) return;
		let { enable: t, disable: n } = e.flags;
		t?.extended && delete t.extended, n?.extended && delete n.extended, t?.dotAll && n?.dotAll && delete t.dotAll, t?.ignoreCase && n?.ignoreCase && delete t.ignoreCase, t && !Object.keys(t).length && delete e.flags.enable, n && !Object.keys(n).length && delete e.flags.disable, !e.flags.enable && !e.flags.disable && delete e.flags;
	},
	LookaroundAssertion({ node: e }, t) {
		let { kind: n } = e;
		n === "lookbehind" && (t.passedLookbehind = !0);
	},
	NamedCallout({ node: e, parent: t, replaceWith: n }) {
		let { kind: r } = e;
		if (r === "fail") n(K(eo({ negate: !0 }), t));
		else throw Error(`Unsupported named callout "(*${r.toUpperCase()}"`);
	},
	Quantifier({ node: e }) {
		if (e.body.type === "Quantifier") {
			let t = I();
			t.body[0].body.push(e.body), e.body = K(t, e);
		}
	},
	Regex: {
		enter({ node: e }, { supportedGNodes: t }) {
			let n = [], r = !1, i = !1;
			for (let t of e.body) if (t.body.length === 1 && t.body[0].kind === "search_start") t.body.pop();
			else {
				let e = ws(t.body);
				e ? (r = !0, Array.isArray(e) ? n.push(...e) : n.push(e)) : i = !0;
			}
			r && !i && n.forEach((e) => t.add(e));
		},
		exit(e, { accuracy: t, passedLookbehind: n, strategy: r }) {
			if (t === "strict" && n && r) throw Error(B`Uses "\G" in a way that requires non-strict accuracy`);
		}
	},
	Subroutine({ node: e }, { jsGroupNameMap: t }) {
		let { ref: n } = e;
		typeof n == "string" && !ks(n) && (n = bs(n, t), e.ref = n);
	}
}, fs = {
	Backreference({ node: e }, { multiplexCapturesToLeftByRef: t, reffedNodesByReferencer: n }) {
		let { orphan: r, ref: i } = e;
		r || n.set(e, [...t.get(i).map(({ node: e }) => e)]);
	},
	CapturingGroup: {
		enter({ node: e, parent: t, replaceWith: n, skip: r }, { groupOriginByCopy: i, groupsByName: a, multiplexCapturesToLeftByRef: o, openRefs: s, reffedNodesByReferencer: c }) {
			let l = i.get(e);
			if (l && s.has(e.number)) {
				let r = G(vs(e.number), t);
				c.set(r, s.get(e.number)), n(r);
				return;
			}
			s.set(e.number, e), o.set(e.number, []), e.name && qo(o, e.name, []);
			let u = o.get(e.name ?? e.number);
			for (let t = 0; t < u.length; t++) {
				let n = u[t];
				if (l === n.node || l && l === n.origin || e === n.origin) {
					u.splice(t, 1);
					break;
				}
			}
			if (o.get(e.number).push({
				node: e,
				origin: l
			}), e.name && o.get(e.name).push({
				node: e,
				origin: l
			}), e.name) {
				let t = qo(a, e.name, /* @__PURE__ */ new Map()), n = !1;
				if (l) n = !0;
				else for (let e of t.values()) if (!e.hasDuplicateNameToRemove) {
					n = !0;
					break;
				}
				a.get(e.name).set(e, {
					node: e,
					hasDuplicateNameToRemove: n
				});
			}
		},
		exit({ node: e }, { openRefs: t }) {
			t.get(e.number) === e && t.delete(e.number);
		}
	},
	Group: {
		enter({ node: e }, t) {
			t.prevFlags = t.currentFlags, e.flags && (t.currentFlags = Ko(t.currentFlags, e.flags));
		},
		exit(e, t) {
			t.currentFlags = t.prevFlags;
		}
	},
	Subroutine({ node: e, parent: t, replaceWith: n }, r) {
		let { isRecursive: i, ref: a } = e;
		if (i) {
			let n = t;
			for (; (n = n.parent) && (n.type !== "CapturingGroup" || n.name !== a && n.number !== a););
			r.reffedNodesByReferencer.set(e, n);
			return;
		}
		let o = r.subroutineRefMap.get(a), s = a === 0, c = s ? vs(0) : _s(o, r.groupOriginByCopy, null), l = c;
		if (!s) {
			let e = xs(ys(o, (e) => e.type === "Group" && !!e.flags)), t = e ? Ko(r.globalFlags, e) : r.globalFlags;
			hs(t, r.currentFlags) || (l = I({ flags: Ss(t) }), l.body[0].body.push(c));
		}
		n(K(l, t), { traverse: !s });
	}
}, ps = {
	Backreference({ node: e, parent: t, replaceWith: n }, r) {
		if (e.orphan) {
			r.highestOrphanBackref = Math.max(r.highestOrphanBackref, e.ref);
			return;
		}
		let i = r.reffedNodesByReferencer.get(e).filter((t) => gs(t, e));
		i.length ? i.length > 1 ? n(K(I({
			atomic: !0,
			body: i.reverse().map((e) => Wa({ body: [Ka(e.number)] }))
		}), t)) : e.ref = i[0].number : n(K(eo({ negate: !0 }), t));
	},
	CapturingGroup({ node: e }, t) {
		e.number = ++t.numCapturesToLeft, e.name && t.groupsByName.get(e.name).get(e).hasDuplicateNameToRemove && delete e.name;
	},
	Regex: { exit({ node: e }, t) {
		let n = Math.max(t.highestOrphanBackref - t.numCapturesToLeft, 0);
		for (let t = 0; t < n; t++) {
			let t = qa();
			e.body.at(-1).body.push(t);
		}
	} },
	Subroutine({ node: e }, t) {
		!e.isRecursive || e.ref === 0 || (e.ref = t.reffedNodesByReferencer.get(e).number);
	}
};
function ms(e) {
	vo(e, { "*"({ node: e, parent: t }) {
		e.parent = t;
	} });
}
function hs(e, t) {
	return e.dotAll === t.dotAll && e.ignoreCase === t.ignoreCase;
}
function gs(e, t) {
	let n = t;
	do {
		if (n.type === "Regex") return !1;
		if (n.type === "Alternative") continue;
		if (n === e) return !1;
		let t = Cs(n.parent);
		for (let r of t) {
			if (r === n) break;
			if (r === e || Ts(r, e)) return !0;
		}
	} while (n = n.parent);
	throw Error("Unexpected path");
}
function _s(e, t, n, r) {
	let i = Array.isArray(e) ? [] : {};
	for (let [a, o] of Object.entries(e)) a === "parent" ? i.parent = Array.isArray(n) ? r : n : o && typeof o == "object" ? i[a] = _s(o, t, i, n) : (a === "type" && o === "CapturingGroup" && t.set(i, t.get(e) ?? e), i[a] = o);
	return i;
}
function vs(e) {
	let t = ao(e);
	return t.isRecursive = !0, t;
}
function ys(e, t) {
	let n = [];
	for (; e = e.parent;) (!t || t(e)) && n.push(e);
	return n;
}
function bs(e, t) {
	if (t.has(e)) return t.get(e);
	let n = `$${t.size}_${e.replace(/^[^$_\p{IDS}]|[^$\u200C\u200D\p{IDC}]/gu, "_")}`;
	return t.set(e, n), n;
}
function xs(e) {
	let t = ["dotAll", "ignoreCase"], n = {
		enable: {},
		disable: {}
	};
	return e.forEach(({ flags: e }) => {
		t.forEach((t) => {
			e.enable?.[t] && (delete n.disable[t], n.enable[t] = !0), e.disable?.[t] && (n.disable[t] = !0);
		});
	}), Object.keys(n.enable).length || delete n.enable, Object.keys(n.disable).length || delete n.disable, n.enable || n.disable ? n : null;
}
function Ss({ dotAll: e, ignoreCase: t }) {
	let n = {};
	return (e || t) && (n.enable = {}, e && (n.enable.dotAll = !0), t && (n.enable.ignoreCase = !0)), (!e || !t) && (n.disable = {}, !e && (n.disable.dotAll = !0), !t && (n.disable.ignoreCase = !0)), n;
}
function Cs(e) {
	if (!e) throw Error("Node expected");
	let { body: t } = e;
	return Array.isArray(t) ? t : t ? [t] : null;
}
function ws(e) {
	let t = e.find((e) => e.kind === "search_start" || Os(e, { negate: !1 }) || !Es(e));
	if (!t) return null;
	if (t.kind === "search_start") return t;
	if (t.type === "LookaroundAssertion") return t.body[0].body[0];
	if (t.type === "CapturingGroup" || t.type === "Group") {
		let e = [];
		for (let n of t.body) {
			let t = ws(n.body);
			if (!t) return null;
			Array.isArray(t) ? e.push(...t) : e.push(t);
		}
		return e;
	}
	return null;
}
function Ts(e, t) {
	let n = Cs(e) ?? [];
	for (let e of n) if (e === t || Ts(e, t)) return !0;
	return !1;
}
function Es({ type: e }) {
	return e === "Assertion" || e === "Directive" || e === "LookaroundAssertion";
}
function Ds(e) {
	let t = [
		"Character",
		"CharacterClass",
		"CharacterSet"
	];
	return t.includes(e.type) || e.type === "Quantifier" && e.min && t.includes(e.body.type);
}
function Os(e, t) {
	let n = {
		negate: null,
		...t
	};
	return e.type === "LookaroundAssertion" && (n.negate === null || e.negate === n.negate) && e.body.length === 1 && ja(e.body[0], {
		type: "Assertion",
		kind: "search_start"
	});
}
function ks(e) {
	return /^[$_\p{IDS}][$\u200C\u200D\p{IDC}]*$/u.test(e);
}
function W(e, t) {
	let n = Pa(e, {
		...t,
		unicodePropertyMap: ns
	}).body;
	return n.length > 1 || n[0].body.length > 1 ? I({ body: n }) : n[0].body[0];
}
function As(e, t) {
	return e.negate = t, e;
}
function G(e, t) {
	return e.parent = t, e;
}
function K(e, t) {
	return ms(e), e.parent = t, e;
}
function js(e, t) {
	let n = Qo(t), r = Jo(n.target, "ES2024"), i = Jo(n.target, "ES2025"), a = n.rules.recursionLimit;
	if (!Number.isInteger(a) || a < 2 || a > 20) throw Error("Invalid recursionLimit; use 2-20");
	let o = null, s = null;
	if (!i) {
		let t = [e.flags.ignoreCase];
		vo(e, Ms, {
			getCurrentModI: () => t.at(-1),
			popModI() {
				t.pop();
			},
			pushModI(e) {
				t.push(e);
			},
			setHasCasedChar() {
				t.at(-1) ? o = !0 : s = !0;
			}
		});
	}
	let c = {
		dotAll: e.flags.dotAll,
		ignoreCase: !!((e.flags.ignoreCase || o) && !s)
	}, l = e, u = {
		accuracy: n.accuracy,
		appliedGlobalFlags: c,
		captureMap: /* @__PURE__ */ new Map(),
		currentFlags: {
			dotAll: e.flags.dotAll,
			ignoreCase: e.flags.ignoreCase
		},
		inCharClass: !1,
		lastNode: l,
		originMap: e._originMap,
		recursionLimit: a,
		useAppliedIgnoreCase: !!(!i && o && s),
		useFlagMods: i,
		useFlagV: r,
		verbose: n.verbose
	};
	function d(e) {
		return u.lastNode = l, l = e, Yo(Ns[e.type], `Unexpected node type "${e.type}"`)(e, u, d);
	}
	let f = {
		pattern: e.body.map(d).join("|"),
		flags: d(e.flags),
		options: { ...e.options }
	};
	return r || (delete f.options.force.v, f.options.disable.v = !0, f.options.unicodeSetsPlugin = null), f._captureTransfers = /* @__PURE__ */ new Map(), f._hiddenCaptures = [], u.captureMap.forEach((e, t) => {
		e.hidden && f._hiddenCaptures.push(t), e.transferTo && qo(f._captureTransfers, e.transferTo, []).push(t);
	}), f;
}
var Ms = {
	"*": {
		enter({ node: e }, t) {
			if (Gs(e)) {
				let n = t.getCurrentModI();
				t.pushModI(e.flags ? Ko({ ignoreCase: n }, e.flags).ignoreCase : n);
			}
		},
		exit({ node: e }, t) {
			Gs(e) && t.popModI();
		}
	},
	Backreference(e, t) {
		t.setHasCasedChar();
	},
	Character({ node: e }, t) {
		zs(z(e.value)) && t.setHasCasedChar();
	},
	CharacterClassRange({ node: e, skip: t }, n) {
		t(), Bs(e, { firstOnly: !0 }).length && n.setHasCasedChar();
	},
	CharacterSet({ node: e }, t) {
		e.kind === "property" && ls.has(e.value) && t.setHasCasedChar();
	}
}, Ns = {
	Alternative({ body: e }, t, n) {
		return e.map(n).join("");
	},
	Assertion({ kind: e, negate: t }) {
		if (e === "string_end") return "$";
		if (e === "string_start") return "^";
		if (e === "word_boundary") return t ? B`\B` : B`\b`;
		throw Error(`Unexpected assertion kind "${e}"`);
	},
	Backreference({ ref: e }, t) {
		if (typeof e != "number") throw Error("Unexpected named backref in transformed AST");
		if (!t.useFlagMods && t.accuracy === "strict" && t.currentFlags.ignoreCase && !t.captureMap.get(e).ignoreCase) throw Error("Use of case-insensitive backref to case-sensitive group requires target ES2025 or non-strict accuracy");
		return "\\" + e;
	},
	CapturingGroup(e, t, n) {
		let { body: r, name: i, number: a } = e, o = { ignoreCase: t.currentFlags.ignoreCase }, s = t.originMap.get(e);
		return s && (o.hidden = !0, a > s.number && (o.transferTo = s.number)), t.captureMap.set(a, o), `(${i ? `?<${i}>` : ""}${r.map(n).join("|")})`;
	},
	Character({ value: e }, t) {
		let n = z(e), r = Vs(e, {
			escDigit: t.lastNode.type === "Backreference",
			inCharClass: t.inCharClass,
			useFlagV: t.useFlagV
		});
		if (r !== n) return r;
		if (t.useAppliedIgnoreCase && t.currentFlags.ignoreCase && zs(n)) {
			let e = ts(n);
			return t.inCharClass ? e.join("") : e.length > 1 ? `[${e.join("")}]` : e[0];
		}
		return n;
	},
	CharacterClass(e, t, n) {
		let { kind: r, negate: i, parent: a } = e, { body: o } = e;
		if (r === "intersection" && !t.useFlagV) throw Error("Use of character class intersection requires min target ES2024");
		V.bugFlagVLiteralHyphenIsRange && t.useFlagV && o.some(qs) && (o = [Ja(45), ...o.filter((e) => !qs(e))]);
		let s = () => `[${i ? "^" : ""}${o.map(n).join(r === "intersection" ? "&&" : "")}]`;
		if (!t.inCharClass) {
			if ((!t.useFlagV || V.bugNestedClassIgnoresNegation) && !i) {
				let t = o.filter((e) => e.type === "CharacterClass" && e.kind === "union" && e.negate);
				if (t.length) {
					let r = I(), i = r.body[0];
					return r.parent = a, i.parent = r, o = o.filter((e) => !t.includes(e)), e.body = o, o.length ? (e.parent = i, i.body.push(e)) : r.body.pop(), t.forEach((e) => {
						let t = Wa({ body: [e] });
						e.parent = t, t.parent = r, r.body.push(t);
					}), n(r);
				}
			}
			t.inCharClass = !0;
			let r = s();
			return t.inCharClass = !1, r;
		}
		let c = o[0];
		if (r === "union" && !i && c && ((!t.useFlagV || !t.verbose) && a.kind === "union" && !(V.bugFlagVLiteralHyphenIsRange && t.useFlagV) || !t.verbose && a.kind === "intersection" && o.length === 1 && c.type !== "CharacterClassRange")) return o.map(n).join("");
		if (!t.useFlagV && a.type === "CharacterClass") throw Error("Uses nested character class in a way that requires min target ES2024");
		return s();
	},
	CharacterClassRange(e, t) {
		let n = e.min.value, r = e.max.value, i = {
			escDigit: !1,
			inCharClass: !0,
			useFlagV: t.useFlagV
		}, a = Vs(n, i), o = Vs(r, i), s = /* @__PURE__ */ new Set();
		return t.useAppliedIgnoreCase && t.currentFlags.ignoreCase && Hs(Bs(e)).forEach((e) => {
			s.add(Array.isArray(e) ? `${Vs(e[0], i)}-${Vs(e[1], i)}` : Vs(e, i));
		}), `${a}-${o}${[...s].join("")}`;
	},
	CharacterSet({ kind: e, negate: t, value: n, key: r }, i) {
		if (e === "dot") return i.currentFlags.dotAll ? i.appliedGlobalFlags.dotAll || i.useFlagMods ? "." : "[^]" : B`[^\n]`;
		if (e === "digit") return t ? B`\D` : B`\d`;
		if (e === "property") {
			if (i.useAppliedIgnoreCase && i.currentFlags.ignoreCase && ls.has(n)) throw Error(`Unicode property "${n}" can't be case-insensitive when other chars have specific case`);
			return `${t ? B`\P` : B`\p`}{${r ? `${r}=` : ""}${n}}`;
		}
		if (e === "word") return t ? B`\W` : B`\w`;
		throw Error(`Unexpected character set kind "${e}"`);
	},
	Flags(e, t) {
		return (t.appliedGlobalFlags.ignoreCase ? "i" : "") + (e.dotAll ? "s" : "") + (e.sticky ? "y" : "");
	},
	Group({ atomic: e, body: t, flags: n, parent: r }, i, a) {
		let o = i.currentFlags;
		n && (i.currentFlags = Ko(o, n));
		let s = t.map(a).join("|"), c = !i.verbose && t.length === 1 && r.type !== "Quantifier" && !e && (!i.useFlagMods || !n) ? s : `(?${Us(e, n, i.useFlagMods)}${s})`;
		return i.currentFlags = o, c;
	},
	LookaroundAssertion({ body: e, kind: t, negate: n }, r, i) {
		return `(?${`${t === "lookahead" ? "" : "<"}${n ? "!" : "="}`}${e.map(i).join("|")})`;
	},
	Quantifier(e, t, n) {
		return n(e.body) + Ws(e);
	},
	Subroutine({ isRecursive: e, ref: t }, n) {
		if (!e) throw Error("Unexpected non-recursive subroutine in transformed AST");
		let r = n.recursionLimit;
		return t === 0 ? `(?R=${r})` : B`\g<${t}&R=${r}>`;
	}
}, Ps = /* @__PURE__ */ new Set([
	"$",
	"(",
	")",
	"*",
	"+",
	".",
	"?",
	"[",
	"\\",
	"]",
	"^",
	"{",
	"|",
	"}"
]), Fs = /* @__PURE__ */ new Set([
	"-",
	"\\",
	"]",
	"^",
	"["
]), Is = /* @__PURE__ */ new Set(/* @__PURE__ */ "()-/[\\]^{|}!#$%&*+,.:;<=>?@`~".split("")), Ls = /* @__PURE__ */ new Map([
	[9, B`\t`],
	[10, B`\n`],
	[11, B`\v`],
	[12, B`\f`],
	[13, B`\r`],
	[8232, B`\u2028`],
	[8233, B`\u2029`],
	[65279, B`\uFEFF`]
]), Rs = /^\p{Cased}$/u;
function zs(e) {
	return Rs.test(e);
}
function Bs(e, t) {
	let n = !!t?.firstOnly, r = e.min.value, i = e.max.value, a = [];
	if (r < 65 && (i === 65535 || i >= 131071) || r === 65536 && i >= 131071) return a;
	for (let e = r; e <= i; e++) {
		let t = z(e);
		if (!zs(t)) continue;
		let o = ts(t).filter((e) => {
			let t = e.codePointAt(0);
			return t < r || t > i;
		});
		if (o.length && (a.push(...o), n)) break;
	}
	return a;
}
function Vs(e, { escDigit: t, inCharClass: n, useFlagV: r }) {
	if (Ls.has(e)) return Ls.get(e);
	if (e < 32 || e > 126 && e < 160 || e > 262143 || t && Ks(e)) return e > 255 ? `\\u{${e.toString(16).toUpperCase()}}` : `\\x${e.toString(16).toUpperCase().padStart(2, "0")}`;
	let i = n ? r ? Is : Fs : Ps, a = z(e);
	return (i.has(a) ? "\\" : "") + a;
}
function Hs(e) {
	let t = e.map((e) => e.codePointAt(0)).sort((e, t) => e - t), n = [], r = null;
	for (let e = 0; e < t.length; e++) t[e + 1] === t[e] + 1 ? r ??= t[e] : r === null ? n.push(t[e]) : (n.push([r, t[e]]), r = null);
	return n;
}
function Us(e, t, n) {
	if (e) return ">";
	let r = "";
	if (t && n) {
		let { enable: e, disable: n } = t;
		r = (e?.ignoreCase ? "i" : "") + (e?.dotAll ? "s" : "") + (n ? "-" : "") + (n?.ignoreCase ? "i" : "") + (n?.dotAll ? "s" : "");
	}
	return `${r}:`;
}
function Ws({ kind: e, max: t, min: n }) {
	let r;
	return r = !n && t === 1 ? "?" : !n && t === Infinity ? "*" : n === 1 && t === Infinity ? "+" : n === t ? `{${n}}` : `{${n},${t === Infinity ? "" : t}}`, r + {
		greedy: "",
		lazy: "?",
		possessive: "+"
	}[e];
}
function Gs({ type: e }) {
	return e === "CapturingGroup" || e === "Group" || e === "LookaroundAssertion";
}
function Ks(e) {
	return e > 47 && e < 58;
}
function qs({ type: e, value: t }) {
	return e === "Character" && t === 45;
}
var Js = class e extends RegExp {
	#e = /* @__PURE__ */ new Map();
	#t = null;
	#n;
	#r = null;
	#i = null;
	rawOptions = {};
	get source() {
		return this.#n || "(?:)";
	}
	constructor(t, n, r) {
		let i = !!r?.lazyCompile;
		if (t instanceof RegExp) {
			if (r) throw Error("Cannot provide options when copying a regexp");
			let i = t;
			super(i, n), this.#n = i.source, i instanceof e && (this.#e = i.#e, this.#r = i.#r, this.#i = i.#i, this.rawOptions = i.rawOptions);
		} else {
			let e = {
				hiddenCaptures: [],
				strategy: null,
				transfers: [],
				...r
			};
			super(i ? "" : t, n), this.#n = t, this.#e = Xs(e.hiddenCaptures, e.transfers), this.#i = e.strategy, this.rawOptions = r ?? {};
		}
		i || (this.#t = this);
	}
	exec(t) {
		if (!this.#t) {
			let { lazyCompile: t, ...n } = this.rawOptions;
			this.#t = new e(this.#n, this.flags, n);
		}
		let n = this.global || this.sticky, r = this.lastIndex;
		if (this.#i === "clip_search" && n && r) {
			this.lastIndex = 0;
			let e = this.#a(t.slice(r));
			return e && (Ys(e, r, t, this.hasIndices), this.lastIndex += r), e;
		}
		return this.#a(t);
	}
	#a(e) {
		this.#t.lastIndex = this.lastIndex;
		let t = super.exec.call(this.#t, e);
		if (this.lastIndex = this.#t.lastIndex, !t || !this.#e.size) return t;
		let n = [...t];
		t.length = 1;
		let r;
		this.hasIndices && (r = [...t.indices], t.indices.length = 1);
		let i = [0];
		for (let e = 1; e < n.length; e++) {
			let { hidden: a, transferTo: o } = this.#e.get(e) ?? {};
			if (a ? i.push(null) : (i.push(t.length), t.push(n[e]), this.hasIndices && t.indices.push(r[e])), o && n[e] !== void 0) {
				let a = i[o];
				if (!a) throw Error(`Invalid capture transfer to "${a}"`);
				if (t[a] = n[e], this.hasIndices && (t.indices[a] = r[e]), t.groups) {
					this.#r ||= Zs(this.source);
					let i = this.#r.get(o);
					i && (t.groups[i] = n[e], this.hasIndices && (t.indices.groups[i] = r[e]));
				}
			}
		}
		return t;
	}
};
function Ys(e, t, n, r) {
	if (e.index += t, e.input = n, r) {
		let n = e.indices;
		for (let e = 0; e < n.length; e++) {
			let r = n[e];
			r && (n[e] = [r[0] + t, r[1] + t]);
		}
		let r = n.groups;
		r && Object.keys(r).forEach((e) => {
			let n = r[e];
			n && (r[e] = [n[0] + t, n[1] + t]);
		});
	}
}
function Xs(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let t of e) n.set(t, { hidden: !0 });
	for (let [e, r] of t) for (let t of r) qo(n, t, {}).transferTo = e;
	return n;
}
function Zs(e) {
	let t = /(?<capture>\((?:\?<(?![=!])(?<name>[^>]+)>|(?!\?)))|\\?./gsu, n = /* @__PURE__ */ new Map(), r = 0, i = 0, a;
	for (; a = t.exec(e);) {
		let { 0: e, groups: { capture: t, name: o } } = a;
		e === "[" ? r++ : r ? e === "]" && r-- : t && (i++, o && n.set(i, o));
	}
	return n;
}
function Qs(e, t) {
	let n = $s(e, t);
	return n.options ? new Js(n.pattern, n.flags, n.options) : new RegExp(n.pattern, n.flags);
}
function $s(e, t) {
	let n = Qo(t), r = us(Pa(e, {
		flags: n.flags,
		normalizeUnknownPropertyNames: !0,
		rules: {
			captureGroup: n.rules.captureGroup,
			singleline: n.rules.singleline
		},
		skipBackrefValidation: n.rules.allowOrphanBackrefs,
		unicodePropertyMap: ns
	}), {
		accuracy: n.accuracy,
		asciiWordBoundaries: n.rules.asciiWordBoundaries,
		avoidSubclass: n.avoidSubclass,
		bestEffortTarget: n.target
	}), i = js(r, n), a = zo(i.pattern, {
		captureTransfers: i._captureTransfers,
		hiddenCaptures: i._hiddenCaptures,
		mode: "external"
	}), o = Ao(No(a.pattern).pattern, {
		captureTransfers: a.captureTransfers,
		hiddenCaptures: a.hiddenCaptures
	}), s = {
		pattern: o.pattern,
		flags: `${n.hasIndices ? "d" : ""}${n.global ? "g" : ""}${i.flags}${i.options.disable.v ? "u" : "v"}`
	};
	if (n.avoidSubclass) {
		if (n.lazyCompileLength !== Infinity) throw Error("Lazy compilation requires subclass");
	} else {
		let e = o.hiddenCaptures.sort((e, t) => e - t), t = Array.from(o.captureTransfers), i = r._strategy, a = s.pattern.length >= n.lazyCompileLength;
		(e.length || t.length || i || a) && (s.options = {
			...e.length && { hiddenCaptures: e },
			...t.length && { transfers: t },
			...i && { strategy: i },
			...a && { lazyCompile: a }
		});
	}
	return s;
}
//#endregion
//#region node_modules/@shikijs/engine-javascript/dist/engine-compile.mjs
function ec(e, t) {
	return Qs(e, {
		global: !0,
		hasIndices: !0,
		lazyCompileLength: 3e3,
		rules: {
			allowOrphanBackrefs: !0,
			asciiWordBoundaries: !0,
			captureGroup: !0,
			recursionLimit: 5,
			singleline: !0
		},
		...t
	});
}
function tc(e = {}) {
	let t = {
		target: "auto",
		cache: /* @__PURE__ */ new Map(),
		...e
	};
	return t.regexConstructor ||= (e) => ec(e, { target: t.target }), {
		createScanner(e) {
			return new Ui(e, t);
		},
		createString(e) {
			return { content: e };
		}
	};
}
//#endregion
//#region node_modules/@shikijs/engine-oniguruma/dist/index.mjs
var nc = class extends Error {
	constructor(e) {
		super(e), this.name = "ShikiError";
	}
};
function rc() {
	return 2147483648;
}
function ic() {
	return typeof performance < "u" ? performance.now() : Date.now();
}
var ac = (e, t) => e + (t - e % t) % t;
async function oc(e) {
	let t, n, r = {};
	function i(e) {
		n = e, r.HEAPU8 = new Uint8Array(e), r.HEAPU32 = new Uint32Array(e);
	}
	function a(e, t, n) {
		r.HEAPU8.copyWithin(e, t, t + n);
	}
	function o(e) {
		try {
			return t.grow(e - n.byteLength + 65535 >>> 16), i(t.buffer), 1;
		} catch {}
	}
	function s(e) {
		let t = r.HEAPU8.length;
		e >>>= 0;
		let n = rc();
		if (e > n) return !1;
		for (let r = 1; r <= 4; r *= 2) {
			let i = t * (1 + .2 / r);
			if (i = Math.min(i, e + 100663296), o(Math.min(n, ac(Math.max(e, i), 65536)))) return !0;
		}
		return !1;
	}
	let c = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0;
	function l(e, t, n = 1024) {
		let r = t + n, i = t;
		for (; e[i] && !(i >= r);) ++i;
		if (i - t > 16 && e.buffer && c) return c.decode(e.subarray(t, i));
		let a = "";
		for (; t < i;) {
			let n = e[t++];
			if (!(n & 128)) {
				a += String.fromCharCode(n);
				continue;
			}
			let r = e[t++] & 63;
			if ((n & 224) == 192) {
				a += String.fromCharCode((n & 31) << 6 | r);
				continue;
			}
			let i = e[t++] & 63;
			if (n = (n & 240) == 224 ? (n & 15) << 12 | r << 6 | i : (n & 7) << 18 | r << 12 | i << 6 | e[t++] & 63, n < 65536) a += String.fromCharCode(n);
			else {
				let e = n - 65536;
				a += String.fromCharCode(55296 | e >> 10, 56320 | e & 1023);
			}
		}
		return a;
	}
	function u(e, t) {
		return e ? l(r.HEAPU8, e, t) : "";
	}
	let d = {
		emscripten_get_now: ic,
		emscripten_memcpy_big: a,
		emscripten_resize_heap: s,
		fd_write: () => 0
	};
	async function f() {
		let n = await e({
			env: d,
			wasi_snapshot_preview1: d
		});
		t = n.memory, i(t.buffer), Object.assign(r, n), r.UTF8ToString = u;
	}
	return await f(), r;
}
var sc = Object.defineProperty, cc = (e, t, n) => t in e ? sc(e, t, {
	enumerable: !0,
	configurable: !0,
	writable: !0,
	value: n
}) : e[t] = n, q = (e, t, n) => cc(e, typeof t == "symbol" ? t : t + "", n), J = null;
function lc(e) {
	throw new nc(e.UTF8ToString(e.getLastOnigError()));
}
var uc = class e {
	constructor(t) {
		q(this, "utf16Length"), q(this, "utf8Length"), q(this, "utf16Value"), q(this, "utf8Value"), q(this, "utf16OffsetToUtf8"), q(this, "utf8OffsetToUtf16");
		let n = t.length, r = e._utf8ByteLength(t), i = r !== n, a = i ? new Uint32Array(n + 1) : null;
		i && (a[n] = r);
		let o = i ? new Uint32Array(r + 1) : null;
		i && (o[r] = n);
		let s = new Uint8Array(r), c = 0;
		for (let e = 0; e < n; e++) {
			let r = t.charCodeAt(e), l = r, u = !1;
			if (r >= 55296 && r <= 56319 && e + 1 < n) {
				let n = t.charCodeAt(e + 1);
				n >= 56320 && n <= 57343 && (l = (r - 55296 << 10) + 65536 | n - 56320, u = !0);
			}
			i && (a[e] = c, u && (a[e + 1] = c), l <= 127 ? o[c + 0] = e : l <= 2047 ? (o[c + 0] = e, o[c + 1] = e) : l <= 65535 ? (o[c + 0] = e, o[c + 1] = e, o[c + 2] = e) : (o[c + 0] = e, o[c + 1] = e, o[c + 2] = e, o[c + 3] = e)), l <= 127 ? s[c++] = l : l <= 2047 ? (s[c++] = 192 | (l & 1984) >>> 6, s[c++] = 128 | (l & 63) >>> 0) : l <= 65535 ? (s[c++] = 224 | (l & 61440) >>> 12, s[c++] = 128 | (l & 4032) >>> 6, s[c++] = 128 | (l & 63) >>> 0) : (s[c++] = 240 | (l & 1835008) >>> 18, s[c++] = 128 | (l & 258048) >>> 12, s[c++] = 128 | (l & 4032) >>> 6, s[c++] = 128 | (l & 63) >>> 0), u && e++;
		}
		this.utf16Length = n, this.utf8Length = r, this.utf16Value = t, this.utf8Value = s, this.utf16OffsetToUtf8 = a, this.utf8OffsetToUtf16 = o;
	}
	static _utf8ByteLength(e) {
		let t = 0;
		for (let n = 0, r = e.length; n < r; n++) {
			let i = e.charCodeAt(n), a = i, o = !1;
			if (i >= 55296 && i <= 56319 && n + 1 < r) {
				let t = e.charCodeAt(n + 1);
				t >= 56320 && t <= 57343 && (a = (i - 55296 << 10) + 65536 | t - 56320, o = !0);
			}
			t += a <= 127 ? 1 : a <= 2047 ? 2 : a <= 65535 ? 3 : 4, o && n++;
		}
		return t;
	}
	createString(e) {
		let t = e.omalloc(this.utf8Length);
		return e.HEAPU8.set(this.utf8Value, t), t;
	}
}, dc = class e {
	constructor(t) {
		if (q(this, "id", ++e.LAST_ID), q(this, "_onigBinding"), q(this, "content"), q(this, "utf16Length"), q(this, "utf8Length"), q(this, "utf16OffsetToUtf8"), q(this, "utf8OffsetToUtf16"), q(this, "ptr"), !J) throw new nc("Must invoke loadWasm first.");
		this._onigBinding = J, this.content = t;
		let n = new uc(t);
		this.utf16Length = n.utf16Length, this.utf8Length = n.utf8Length, this.utf16OffsetToUtf8 = n.utf16OffsetToUtf8, this.utf8OffsetToUtf16 = n.utf8OffsetToUtf16, this.utf8Length < 1e4 && !e._sharedPtrInUse ? (e._sharedPtr ||= J.omalloc(1e4), e._sharedPtrInUse = !0, J.HEAPU8.set(n.utf8Value, e._sharedPtr), this.ptr = e._sharedPtr) : this.ptr = n.createString(J);
	}
	convertUtf8OffsetToUtf16(e) {
		return this.utf8OffsetToUtf16 ? e < 0 ? 0 : e > this.utf8Length ? this.utf16Length : this.utf8OffsetToUtf16[e] : e;
	}
	convertUtf16OffsetToUtf8(e) {
		return this.utf16OffsetToUtf8 ? e < 0 ? 0 : e > this.utf16Length ? this.utf8Length : this.utf16OffsetToUtf8[e] : e;
	}
	dispose() {
		this.ptr === e._sharedPtr ? e._sharedPtrInUse = !1 : this._onigBinding.ofree(this.ptr);
	}
};
q(dc, "LAST_ID", 0), q(dc, "_sharedPtr", 0), q(dc, "_sharedPtrInUse", !1);
var fc = dc, pc = class {
	constructor(e) {
		if (q(this, "_onigBinding"), q(this, "_ptr"), !J) throw new nc("Must invoke loadWasm first.");
		let t = [], n = [];
		for (let r = 0, i = e.length; r < i; r++) {
			let i = new uc(e[r]);
			t[r] = i.createString(J), n[r] = i.utf8Length;
		}
		let r = J.omalloc(4 * e.length);
		J.HEAPU32.set(t, r / 4);
		let i = J.omalloc(4 * e.length);
		J.HEAPU32.set(n, i / 4);
		let a = J.createOnigScanner(r, i, e.length);
		for (let n = 0, r = e.length; n < r; n++) J.ofree(t[n]);
		J.ofree(i), J.ofree(r), a === 0 && lc(J), this._onigBinding = J, this._ptr = a;
	}
	dispose() {
		this._onigBinding.freeOnigScanner(this._ptr);
	}
	findNextMatchSync(e, t, n) {
		let r = 0;
		if (typeof n == "number" && (r = n), typeof e == "string") {
			e = new fc(e);
			let n = this._findNextMatchSync(e, t, !1, r);
			return e.dispose(), n;
		}
		return this._findNextMatchSync(e, t, !1, r);
	}
	_findNextMatchSync(e, t, n, r) {
		let i = this._onigBinding, a = i.findNextOnigScannerMatch(this._ptr, e.id, e.ptr, e.utf8Length, e.convertUtf16OffsetToUtf8(t), r);
		if (a === 0) return null;
		let o = i.HEAPU32, s = a / 4, c = o[s++], l = o[s++], u = [];
		for (let t = 0; t < l; t++) {
			let n = e.convertUtf8OffsetToUtf16(o[s++]), r = e.convertUtf8OffsetToUtf16(o[s++]);
			u[t] = {
				start: n,
				end: r,
				length: r - n
			};
		}
		return {
			index: c,
			captureIndices: u
		};
	}
};
function mc(e) {
	return typeof e.instantiator == "function";
}
function hc(e) {
	return typeof e.default == "function";
}
function gc(e) {
	return e.data !== void 0;
}
function _c(e) {
	return typeof Response < "u" && e instanceof Response;
}
function vc(e) {
	return typeof ArrayBuffer < "u" && (e instanceof ArrayBuffer || ArrayBuffer.isView(e)) || typeof Buffer < "u" && Buffer.isBuffer?.(e) || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer || typeof Uint32Array < "u" && e instanceof Uint32Array;
}
var yc;
function bc(e) {
	if (yc) return yc;
	async function t() {
		J = await oc(async (t) => {
			let n = e;
			return n = await n, typeof n == "function" && (n = await n(t)), typeof n == "function" && (n = await n(t)), mc(n) ? n = await n.instantiator(t) : hc(n) ? n = await n.default(t) : (gc(n) && (n = n.data), _c(n) ? n = typeof WebAssembly.instantiateStreaming == "function" ? await Sc(n)(t) : await Cc(n)(t) : vc(n) || n instanceof WebAssembly.Module ? n = await xc(n)(t) : "default" in n && n.default instanceof WebAssembly.Module && (n = await xc(n.default)(t))), "instance" in n && (n = n.instance), "exports" in n && (n = n.exports), n;
		});
	}
	return yc = t(), yc;
}
function xc(e) {
	return (t) => WebAssembly.instantiate(e, t);
}
function Sc(e) {
	return (t) => WebAssembly.instantiateStreaming(e, t);
}
function Cc(e) {
	return async (t) => {
		let n = await e.arrayBuffer();
		return WebAssembly.instantiate(n, t);
	};
}
async function wc(e) {
	return e && await bc(e), {
		createScanner(e) {
			return new pc(e.map((e) => typeof e == "string" ? e : e.source));
		},
		createString(e) {
			return new fc(e);
		}
	};
}
//#endregion
//#region node_modules/@pierre/theming/dist/modules/unwrapDefault.js
function Tc(e) {
	return typeof e == "object" && e && "default" in e ? e.default : e;
}
//#endregion
//#region node_modules/@pierre/theming/dist/modules/createThemeResolver.js
var Ec = class extends Error {
	constructor(e) {
		super(`Theme "${e}" is already registered`), this.name = "DuplicateThemeError";
	}
}, Dc = class extends Error {
	constructor(e) {
		super(`No loader registered for theme "${e}"`), this.name = "UnregisteredThemeError";
	}
}, Oc = class extends Error {
	constructor(e) {
		super(`Theme "${e}" has not been resolved`), this.name = "UnresolvedThemeError";
	}
};
function kc() {
	let e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = 0;
	function i(t, n) {
		if (e.has(t)) throw new Ec(t);
		e.set(t, n);
	}
	function a(t, n) {
		return !e.has(t) && (e.set(t, n), !0);
	}
	function o(t) {
		return e.has(t);
	}
	function s(i) {
		let a = t.get(i);
		if (a !== void 0) return Promise.resolve(a);
		let o = n.get(i);
		if (o !== void 0) return o;
		let s = e.get(i);
		if (s === void 0) return Promise.reject(new Dc(i));
		let c = r, l = s().then((e) => {
			let a = Tc(e);
			return c === r && t.set(i, a), n.get(i) === l && n.delete(i), a;
		}).catch((e) => {
			throw n.get(i) === l && n.delete(i), e;
		});
		return n.set(i, l), l;
	}
	function c(e) {
		return Promise.all(e.map((e) => s(e)));
	}
	function l(e, n) {
		t.set(e, n);
	}
	function u(e) {
		for (let [t, n] of e) l(t, n);
	}
	function d(e) {
		return t.get(e);
	}
	function f(e) {
		let n = [];
		for (let r of e) {
			let e = t.get(r);
			if (e === void 0) throw new Oc(r);
			n.push(e);
		}
		return n;
	}
	function p(e) {
		return t.has(e);
	}
	function m(e) {
		for (let n of e) if (!t.has(n)) return !1;
		return !0;
	}
	function h(e) {
		let n = t.get(e);
		return n === void 0 ? s(e) : n;
	}
	function g() {
		r++, t.clear(), n.clear();
	}
	return {
		clearResolvedThemes: g,
		getResolvedOrResolveTheme: h,
		getResolvedTheme: d,
		getResolvedThemes: f,
		hasRegisteredTheme: o,
		hasResolvedTheme: p,
		hasResolvedThemes: m,
		registerTheme: i,
		registerThemeIfAbsent: a,
		resolveTheme: s,
		resolveThemes: c,
		seedResolvedTheme: l,
		seedResolvedThemes: u
	};
}
//#endregion
//#region node_modules/diff/libesm/diff/base.js
var Y = class {
	diff(e, t, n = {}) {
		let r;
		typeof n == "function" ? (r = n, n = {}) : "callback" in n && (r = n.callback);
		let i = this.castInput(e, n), a = this.castInput(t, n), o = this.removeEmpty(this.tokenize(i, n)), s = this.removeEmpty(this.tokenize(a, n));
		return this.diffWithOptionsObj(o, s, n, r);
	}
	diffWithOptionsObj(e, t, n, r) {
		let i = (e) => {
			if (e = this.postProcess(e, n), r) {
				setTimeout(function() {
					r(e);
				}, 0);
				return;
			}
			return e;
		}, a = t.length, o = e.length, s = 1, c = a + o;
		n.maxEditLength != null && (c = Math.min(c, n.maxEditLength));
		let l = n.timeout ?? Infinity, u = Date.now() + l, d = [{
			oldPos: -1,
			lastComponent: void 0
		}], f = this.extractCommon(d[0], t, e, 0, n);
		if (d[0].oldPos + 1 >= o && f + 1 >= a) return i(this.buildValues(d[0].lastComponent, t, e));
		let p = -Infinity, m = Infinity, h = () => {
			for (let r = Math.max(p, -s); r <= Math.min(m, s); r += 2) {
				let s, c = d[r - 1], l = d[r + 1];
				c && (d[r - 1] = void 0);
				let u = !1;
				if (l) {
					let e = l.oldPos - r;
					u = l && 0 <= e && e < a;
				}
				let h = c && c.oldPos + 1 < o;
				if (!u && !h) {
					d[r] = void 0;
					continue;
				}
				if (s = !h || u && c.oldPos < l.oldPos ? this.addToPath(l, !0, !1, 0, n) : this.addToPath(c, !1, !0, 1, n), f = this.extractCommon(s, t, e, r, n), s.oldPos + 1 >= o && f + 1 >= a) return i(this.buildValues(s.lastComponent, t, e)) || !0;
				d[r] = s, s.oldPos + 1 >= o && (m = Math.min(m, r - 1)), f + 1 >= a && (p = Math.max(p, r + 1));
			}
			s++;
		};
		if (r) (function e() {
			setTimeout(function() {
				if (s > c || Date.now() > u) return r(void 0);
				h() || e();
			}, 0);
		})();
		else for (; s <= c && Date.now() <= u;) {
			let e = h();
			if (e) return e;
		}
	}
	addToPath(e, t, n, r, i) {
		let a = e.lastComponent;
		return a && !i.oneChangePerToken && a.added === t && a.removed === n ? {
			oldPos: e.oldPos + r,
			lastComponent: {
				count: a.count + 1,
				added: t,
				removed: n,
				previousComponent: a.previousComponent
			}
		} : {
			oldPos: e.oldPos + r,
			lastComponent: {
				count: 1,
				added: t,
				removed: n,
				previousComponent: a
			}
		};
	}
	extractCommon(e, t, n, r, i) {
		let a = t.length, o = n.length, s = e.oldPos, c = s - r, l = 0;
		for (; c + 1 < a && s + 1 < o && this.equals(n[s + 1], t[c + 1], i);) c++, s++, l++, i.oneChangePerToken && (e.lastComponent = {
			count: 1,
			previousComponent: e.lastComponent,
			added: !1,
			removed: !1
		});
		return l && !i.oneChangePerToken && (e.lastComponent = {
			count: l,
			previousComponent: e.lastComponent,
			added: !1,
			removed: !1
		}), e.oldPos = s, c;
	}
	equals(e, t, n) {
		return n.comparator ? n.comparator(e, t) : e === t || !!n.ignoreCase && e.toLowerCase() === t.toLowerCase();
	}
	removeEmpty(e) {
		let t = [];
		for (let n = 0; n < e.length; n++) e[n] && t.push(e[n]);
		return t;
	}
	castInput(e, t) {
		return e;
	}
	tokenize(e, t) {
		return Array.from(e);
	}
	join(e) {
		return e.join("");
	}
	postProcess(e, t) {
		return e;
	}
	get useLongestToken() {
		return !1;
	}
	buildValues(e, t, n) {
		let r = [], i;
		for (; e;) r.push(e), i = e.previousComponent, delete e.previousComponent, e = i;
		r.reverse();
		let a = r.length, o = 0, s = 0, c = 0;
		for (; o < a; o++) {
			let e = r[o];
			if (e.removed) e.value = this.join(n.slice(c, c + e.count)), c += e.count;
			else {
				if (!e.added && this.useLongestToken) {
					let r = t.slice(s, s + e.count);
					r = r.map(function(e, t) {
						let r = n[c + t];
						return r.length > e.length ? r : e;
					}), e.value = this.join(r);
				} else e.value = this.join(t.slice(s, s + e.count));
				s += e.count, e.added || (c += e.count);
			}
		}
		return r;
	}
}, Ac = new class extends Y {}();
function jc(e, t, n) {
	return Ac.diff(e, t, n);
}
//#endregion
//#region node_modules/diff/libesm/util/string.js
function Mc(e, t) {
	let n;
	for (n = 0; n < e.length && n < t.length; n++) if (e[n] != t[n]) return e.slice(0, n);
	return e.slice(0, n);
}
function Nc(e, t) {
	let n;
	if (!e || !t || e[e.length - 1] != t[t.length - 1]) return "";
	for (n = 0; n < e.length && n < t.length; n++) if (e[e.length - (n + 1)] != t[t.length - (n + 1)]) return e.slice(-n);
	return e.slice(-n);
}
function Pc(e, t, n) {
	if (e.slice(0, t.length) != t) throw Error(`string ${JSON.stringify(e)} doesn't start with prefix ${JSON.stringify(t)}; this is a bug`);
	return n + e.slice(t.length);
}
function Fc(e, t, n) {
	if (!t) return e + n;
	if (e.slice(-t.length) != t) throw Error(`string ${JSON.stringify(e)} doesn't end with suffix ${JSON.stringify(t)}; this is a bug`);
	return e.slice(0, -t.length) + n;
}
function Ic(e, t) {
	return Pc(e, t, "");
}
function Lc(e, t) {
	return Fc(e, t, "");
}
function Rc(e, t) {
	return t.slice(0, zc(e, t));
}
function zc(e, t) {
	let n = 0;
	e.length > t.length && (n = e.length - t.length);
	let r = t.length;
	e.length < t.length && (r = e.length);
	let i = Array(r), a = 0;
	i[0] = 0;
	for (let e = 1; e < r; e++) {
		for (t[e] == t[a] ? i[e] = i[a] : i[e] = a; a > 0 && t[e] != t[a];) a = i[a];
		t[e] == t[a] && a++;
	}
	a = 0;
	for (let r = n; r < e.length; r++) {
		for (; a > 0 && e[r] != t[a];) a = i[a];
		e[r] == t[a] && a++;
	}
	return a;
}
function Bc(e, t) {
	let n = [];
	for (let r of Array.from(t.segment(e))) {
		let e = r.segment;
		n.length && /\s/.test(n[n.length - 1]) && /\s/.test(e) ? n[n.length - 1] += e : n.push(e);
	}
	return n;
}
function Vc(e, t) {
	if (t) return Uc(e, t)[1];
	let n;
	for (n = e.length - 1; n >= 0 && e[n].match(/\s/); n--);
	return e.substring(n + 1);
}
function Hc(e, t) {
	if (t) return Uc(e, t)[0];
	let n = e.match(/^\s*/);
	return n ? n[0] : "";
}
function Uc(e, t) {
	if (!t) return [Hc(e), Vc(e)];
	if (t.resolvedOptions().granularity != "word") throw Error("The segmenter passed must have a granularity of \"word\"");
	let n = Bc(e, t), r = n[0], i = n[n.length - 1];
	return [/\s/.test(r) ? r : "", /\s/.test(i) ? i : ""];
}
//#endregion
//#region node_modules/diff/libesm/diff/word.js
var Wc = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}", Gc = RegExp(`[${Wc}]+|\\s+|[^${Wc}]`, "ug");
new class extends Y {
	equals(e, t, n) {
		return n.ignoreCase && (e = e.toLowerCase(), t = t.toLowerCase()), e.trim() === t.trim();
	}
	tokenize(e, t = {}) {
		let n;
		if (t.intlSegmenter) {
			let r = t.intlSegmenter;
			if (r.resolvedOptions().granularity != "word") throw Error("The segmenter passed must have a granularity of \"word\"");
			n = Bc(e, r);
		} else n = e.match(Gc) || [];
		let r = [], i = null;
		return n.forEach((e) => {
			/\s/.test(e) ? i == null ? r.push(e) : r.push(r.pop() + e) : i != null && /\s/.test(i) ? r[r.length - 1] == i ? r.push(r.pop() + e) : r.push(i + e) : r.push(e), i = e;
		}), r;
	}
	join(e) {
		return e.map((e, t) => t == 0 ? e : e.replace(/^\s+/, "")).join("");
	}
	postProcess(e, t) {
		if (!e || t.oneChangePerToken) return e;
		let n = null, r = null, i = null;
		return e.forEach((e) => {
			e.added ? r = e : e.removed ? i = e : ((r || i) && Kc(n, i, r, e, t.intlSegmenter), n = e, r = null, i = null);
		}), (r || i) && Kc(n, i, r, null, t.intlSegmenter), e;
	}
}();
function Kc(e, t, n, r, i) {
	if (t && n) {
		let [a, o] = Uc(t.value, i), [s, c] = Uc(n.value, i);
		if (e) {
			let r = Mc(a, s);
			e.value = Fc(e.value, s, r), t.value = Ic(t.value, r), n.value = Ic(n.value, r);
		}
		if (r) {
			let e = Nc(o, c);
			r.value = Pc(r.value, c, e), t.value = Lc(t.value, e), n.value = Lc(n.value, e);
		}
	} else if (n) {
		if (e) {
			let e = Hc(n.value, i);
			n.value = n.value.substring(e.length);
		}
		if (r) {
			let e = Hc(r.value, i);
			r.value = r.value.substring(e.length);
		}
	} else if (e && r) {
		let n = Hc(r.value, i), [a, o] = Uc(t.value, i), s = Mc(n, a);
		t.value = Ic(t.value, s);
		let c = Nc(Ic(n, s), o);
		t.value = Lc(t.value, c), r.value = Pc(r.value, n, c), e.value = Fc(e.value, n, n.slice(0, n.length - c.length));
	} else if (r) {
		let e = Hc(r.value, i), n = Rc(Vc(t.value, i), e);
		t.value = Lc(t.value, n);
	} else if (e) {
		let n = Rc(Vc(e.value, i), Hc(t.value, i));
		t.value = Ic(t.value, n);
	}
}
var qc = new class extends Y {
	tokenize(e) {
		let t = RegExp(`(\\r?\\n)|[${Wc}]+|[^\\S\\n\\r]+|[^${Wc}]`, "ug");
		return e.match(t) || [];
	}
}();
function Jc(e, t, n) {
	return qc.diff(e, t, n);
}
new class extends Y {
	constructor() {
		super(...arguments), this.tokenize = Yc;
	}
	equals(e, t, n) {
		return n.ignoreWhitespace ? ((!n.newlineIsToken || !e.includes("\n")) && (e = e.trim()), (!n.newlineIsToken || !t.includes("\n")) && (t = t.trim())) : n.ignoreNewlineAtEof && !n.newlineIsToken && (e.endsWith("\n") && (e = e.slice(0, -1)), t.endsWith("\n") && (t = t.slice(0, -1))), super.equals(e, t, n);
	}
}();
function Yc(e, t) {
	t.stripTrailingCr && (e = e.replace(/\r\n/g, "\n"));
	let n = [], r = e.split(/(\n|\r\n)/);
	r[r.length - 1] || r.pop();
	for (let e = 0; e < r.length; e++) {
		let i = r[e];
		e % 2 && !t.newlineIsToken ? n[n.length - 1] += i : n.push(i);
	}
	return n;
}
//#endregion
//#region node_modules/diff/libesm/diff/sentence.js
function Xc(e) {
	return e == "." || e == "!" || e == "?";
}
new class extends Y {
	tokenize(e) {
		let t = [], n = 0;
		for (let r = 0; r < e.length; r++) {
			if (r == e.length - 1) {
				t.push(e.slice(n));
				break;
			}
			if (Xc(e[r]) && e[r + 1].match(/\s/)) {
				for (t.push(e.slice(n, r + 1)), r = n = r + 1; e[r + 1]?.match(/\s/);) r++;
				t.push(e.slice(n, r + 1)), n = r + 1;
			}
		}
		return t;
	}
}(), new class extends Y {
	tokenize(e) {
		return e.split(/([{}:;,]|\s+)/);
	}
}(), new class extends Y {
	constructor() {
		super(...arguments), this.tokenize = Yc;
	}
	get useLongestToken() {
		return !0;
	}
	castInput(e, t) {
		let { undefinedReplacement: n, stringifyReplacer: r = (e, t) => t === void 0 ? n : t } = t;
		return typeof e == "string" ? e : JSON.stringify(Zc(e, null, null, r), null, "  ");
	}
	equals(e, t, n) {
		return super.equals(e.replace(/,([\r\n])/g, "$1"), t.replace(/,([\r\n])/g, "$1"), n);
	}
}();
function Zc(e, t, n, r, i) {
	t ||= [], n ||= [], r && (e = r(i === void 0 ? "" : i, e));
	let a;
	for (a = 0; a < t.length; a += 1) if (t[a] === e) return n[a];
	let o;
	if (Object.prototype.toString.call(e) === "[object Array]") {
		for (t.push(e), o = Array(e.length), n.push(o), a = 0; a < e.length; a += 1) o[a] = Zc(e[a], t, n, r, String(a));
		return t.pop(), n.pop(), o;
	}
	if (e && e.toJSON && (e = e.toJSON()), typeof e == "object" && e) {
		t.push(e), o = {}, n.push(o);
		let i = [], s;
		for (s in e)
 /* istanbul ignore else */
		Object.prototype.hasOwnProperty.call(e, s) && i.push(s);
		for (i.sort(), a = 0; a < i.length; a += 1) s = i[a], o[s] = Zc(e[s], t, n, r, s);
		t.pop(), n.pop();
	} else o = e;
	return o;
}
new class extends Y {
	tokenize(e) {
		return e.slice();
	}
	join(e) {
		return e;
	}
	removeEmpty(e) {
		return e;
	}
}();
//#endregion
//#region node_modules/@shikijs/transformers/dist/index.mjs
function Qc(e = {}) {
	let { classPrefix: t = "__shiki_", classSuffix: n = "", classReplacer: r = (e) => e } = e, i = /* @__PURE__ */ new Map();
	function a(e) {
		return Object.entries(e).map(([e, t]) => `${e}:${t}`).join(";");
	}
	function o(e) {
		let o = t + $c(typeof e == "string" ? e : a(e)) + n;
		return o = r(o), i.has(o) || i.set(o, typeof e == "string" ? e : { ...e }), o;
	}
	return {
		name: "@shikijs/transformers:style-to-class",
		pre(e) {
			if (!e.properties.style) return;
			let t = o(e.properties.style);
			delete e.properties.style, this.addClassToHast(e, t);
		},
		tokens(e) {
			for (let t of e) for (let e of t) {
				if (!e.htmlStyle) continue;
				let t = o(e.htmlStyle);
				e.htmlStyle = {}, e.htmlAttrs ||= {}, e.htmlAttrs.class ? e.htmlAttrs.class += ` ${t}` : e.htmlAttrs.class = t;
			}
		},
		getClassRegistry() {
			return i;
		},
		getCSS() {
			let e = "";
			for (let [t, n] of i.entries()) e += `.${t}{${typeof n == "string" ? n : a(n)}}`;
			return e;
		},
		clearRegistry() {
			i.clear();
		}
	};
}
function $c(e, t = 0) {
	let n = 3735928559 ^ t, r = 1103547991 ^ t;
	for (let t = 0, i; t < e.length; t++) i = e.charCodeAt(t), n = Math.imul(n ^ i, 2654435761), r = Math.imul(r ^ i, 1597334677);
	return n = Math.imul(n ^ n >>> 16, 2246822507), n ^= Math.imul(r ^ r >>> 13, 3266489909), r = Math.imul(r ^ r >>> 16, 2246822507), r ^= Math.imul(n ^ n >>> 13, 3266489909), (4294967296 * (2097151 & r) + (n >>> 0)).toString(36).slice(0, 6);
}
//#endregion
//#region node_modules/@pierre/theming/dist/modules/color.js
var el = /^#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)$/i, tl = /^0(?:\.0+)?%?$/;
function nl(e) {
	let t = e.indexOf("(");
	if (t <= 0 || !e.endsWith(")")) return;
	let n = e.slice(0, t).trim();
	if (!/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)$/i.test(n)) return;
	let r = e.slice(t + 1, -1).trim();
	if (r.length === 0) return;
	let i = r.lastIndexOf("/");
	if (i !== -1) return r.slice(i + 1).trim();
	if (/^(?:rgba|hsla)$/i.test(n)) {
		let e = r.split(",");
		if (e.length === 4) return e[3]?.trim();
	}
}
function rl(e) {
	let t = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/i.exec(e.trim());
	if (t == null) return null;
	let n = t[1], r, i = 1;
	return n.length === 3 ? r = n.split("").map((e) => e + e).join("") : n.length === 6 ? r = n : (r = n.slice(0, 6), i = parseInt(n.slice(6, 8), 16) / 255), [
		parseInt(r.slice(0, 2), 16),
		parseInt(r.slice(2, 4), 16),
		parseInt(r.slice(4, 6), 16),
		i
	];
}
function il(e) {
	if (e == null) return null;
	let t = rl(e);
	if (t == null) return null;
	let n = t[0] / 255, r = t[1] / 255, i = t[2] / 255, a = (e) => e <= .03928 ? e / 12.92 : ((e + .055) / 1.055) ** 2.4;
	return .2126 * a(n) + .7152 * a(r) + .0722 * a(i);
}
function al(e) {
	if (e == null) return !1;
	let t = e.trim().toLowerCase();
	if (t === "transparent" || el.test(t)) return !0;
	let n = nl(t);
	return n != null && tl.test(n);
}
function ol(e, t, n) {
	if (t == null || n == null) return !1;
	let r = il(e), i = il(t), a = il(n);
	return r == null || i == null || a == null ? !1 : Math.abs(r - a) < Math.abs(r - i);
}
//#endregion
//#region node_modules/@pierre/theming/dist/modules/normalizeThemeColors.js
var sl = /* @__PURE__ */ new WeakMap();
function cl(e) {
	let t = sl.get(e);
	if (t != null) return t;
	let n = e.colors ?? {}, r = { ...n }, i = n["editor.background"] ?? e.bg, a = n["editor.foreground"] ?? e.fg, o = n["sideBar.background"] ?? i, s = n["sideBar.foreground"] ?? a;
	X(r, "editor.background", i), X(r, "editor.foreground", a), X(r, "sideBar.background", o), X(r, "sideBar.foreground", s), X(r, "input.background", n["input.background"] ?? o), X(r, "sideBarSectionHeader.foreground", n["sideBarSectionHeader.foreground"] ?? s), X(r, "list.activeSelectionForeground", n["list.activeSelectionForeground"] ?? s), X(r, "gitDecoration.addedResourceForeground", ll(n["gitDecoration.addedResourceForeground"], n["terminal.ansiGreen"], n["editorGutter.addedBackground"])), X(r, "gitDecoration.modifiedResourceForeground", ll(n["gitDecoration.modifiedResourceForeground"], n["terminal.ansiBlue"], n["editorGutter.modifiedBackground"])), X(r, "gitDecoration.deletedResourceForeground", ll(n["gitDecoration.deletedResourceForeground"], n["terminal.ansiRed"], n["editorGutter.deletedBackground"]));
	let c = (al(n["list.focusOutline"]) ? void 0 : n["list.focusOutline"]) ?? (al(n.focusBorder) ? void 0 : n.focusBorder);
	c == null ? delete r["list.focusOutline"] : r["list.focusOutline"] = c;
	let l = n["list.hoverBackground"];
	l != null && (ul(l, o) || ol(l, o, s)) && delete r["list.hoverBackground"];
	let u = Object.freeze({
		...e,
		colors: Object.freeze(r)
	});
	return sl.set(e, u), u;
}
function X(e, t, n) {
	n != null && n !== "" && (e[t] = n);
}
function ll(...e) {
	for (let t of e) if (t != null && t !== "") return t;
}
function ul(e, t) {
	return t != null && e.toLowerCase() === t.toLowerCase();
}
//#endregion
//#region src/diff/shiki-wasm.ts
var dl = /* @__PURE__ */ n({ default: () => fl }), fl, pl = t((() => {
	fl = {};
}));
//#endregion
//#region node_modules/@pierre/diffs/dist/worker/worker.js
(() => {
	try {
		return process.env.NODE_ENV === "development";
	} catch {
		return !1;
	}
})();
var ml = {
	dark: "pierre-dark",
	light: "pierre-light"
};
Object.freeze({
	fromStart: 0,
	fromEnd: 0
});
var hl = /* @__PURE__ */ new Map(), gl = /* @__PURE__ */ new Set();
function _l(e, t) {
	e = Array.isArray(e) ? e : [e];
	for (let n of e) {
		if (gl.has(n.name)) continue;
		let e = hl.get(n.name);
		e ?? (e = n, hl.set(n.name, e)), gl.add(e.name), t.loadLanguageSync(e.data);
	}
}
var vl = /* @__PURE__ */ new Set(), yl = kc();
function bl(e, t) {
	e = Array.isArray(e) ? e : [e];
	for (let n of e) {
		let e;
		if (typeof n == "string") {
			if (e = yl.getResolvedTheme(n), e == null) throw Error(`loadResolvedThemes: ${n} is not resolved, you must resolve it before calling loadResolvedThemes`);
		} else e = n, n = n.name, yl.getResolvedTheme(n) ?? yl.seedResolvedTheme(n, e);
		vl.has(n) || (vl.add(n), t.loadThemeSync(e));
	}
}
var Z = /* @__PURE__ */ new Map(), xl = 0, Sl = {
	"1c": "1c",
	abap: "abap",
	as: "actionscript-3",
	ada: "ada",
	adb: "ada",
	ads: "ada",
	adoc: "asciidoc",
	asciidoc: "asciidoc",
	"component.html": "angular-html",
	"component.ts": "angular-ts",
	conf: "nginx",
	htaccess: "apache",
	cls: "tex",
	trigger: "apex",
	apl: "apl",
	applescript: "applescript",
	scpt: "applescript",
	ara: "ara",
	asm: "asm",
	s: "riscv",
	astro: "astro",
	awk: "awk",
	bal: "ballerina",
	sh: "zsh",
	bash: "zsh",
	bat: "cmd",
	cmd: "cmd",
	be: "berry",
	beancount: "beancount",
	bib: "bibtex",
	bicep: "bicep",
	"blade.php": "blade",
	bsl: "bsl",
	c: "c",
	h: "objective-cpp",
	cs: "csharp",
	cpp: "cpp",
	hpp: "cpp",
	cc: "cpp",
	cxx: "cpp",
	hh: "cpp",
	cdc: "cdc",
	cairo: "cairo",
	clar: "clarity",
	clj: "clojure",
	cljs: "clojure",
	cljc: "clojure",
	soy: "soy",
	cmake: "cmake",
	"CMakeLists.txt": "cmake",
	cob: "cobol",
	cbl: "cobol",
	cobol: "cobol",
	CODEOWNERS: "codeowners",
	ql: "ql",
	coffee: "coffeescript",
	lisp: "lisp",
	cl: "lisp",
	lsp: "lisp",
	log: "log",
	v: "verilog",
	cql: "cql",
	cr: "crystal",
	css: "css",
	csv: "csv",
	cue: "cue",
	cypher: "cypher",
	cyp: "cypher",
	d: "d",
	dart: "dart",
	dax: "dax",
	desktop: "desktop",
	diff: "diff",
	patch: "diff",
	Dockerfile: "dockerfile",
	dockerfile: "dockerfile",
	env: "dotenv",
	dm: "dream-maker",
	edge: "edge",
	el: "emacs-lisp",
	ex: "elixir",
	exs: "elixir",
	elm: "elm",
	erb: "erb",
	erl: "erlang",
	hrl: "erlang",
	f: "fortran-fixed-form",
	for: "fortran-fixed-form",
	fs: "fsharp",
	fsi: "fsharp",
	fsx: "fsharp",
	f03: "f03",
	f08: "f08",
	f18: "f18",
	f77: "f77",
	f90: "fortran-free-form",
	f95: "fortran-free-form",
	fnl: "fennel",
	fish: "fish",
	ftl: "ftl",
	tres: "gdresource",
	res: "gdresource",
	gd: "gdscript",
	gdshader: "gdshader",
	gs: "genie",
	feature: "gherkin",
	COMMIT_EDITMSG: "git-commit",
	"git-rebase-todo": "git-rebase",
	gjs: "glimmer-js",
	gleam: "gleam",
	gts: "glimmer-ts",
	glsl: "glsl",
	vert: "glsl",
	frag: "glsl",
	shader: "shaderlab",
	gp: "gnuplot",
	plt: "gnuplot",
	gnuplot: "gnuplot",
	go: "go",
	graphql: "graphql",
	gql: "graphql",
	groovy: "groovy",
	gvy: "groovy",
	hack: "hack",
	haml: "haml",
	hbs: "handlebars",
	handlebars: "handlebars",
	hs: "haskell",
	lhs: "haskell",
	hx: "haxe",
	hcl: "hcl",
	hjson: "hjson",
	hlsl: "hlsl",
	fx: "hlsl",
	html: "html",
	htm: "html",
	http: "http",
	rest: "http",
	hxml: "hxml",
	hy: "hy",
	imba: "imba",
	ini: "ini",
	cfg: "ini",
	jade: "pug",
	pug: "pug",
	java: "java",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jinja: "jinja",
	jinja2: "jinja",
	j2: "jinja",
	jison: "jison",
	jl: "julia",
	json: "json",
	json5: "json5",
	jsonc: "jsonc",
	jsonl: "jsonl",
	jsonnet: "jsonnet",
	libsonnet: "jsonnet",
	jssm: "jssm",
	jsx: "jsx",
	kt: "kotlin",
	kts: "kts",
	kql: "kusto",
	tex: "tex",
	ltx: "tex",
	lean: "lean4",
	less: "less",
	liquid: "liquid",
	lit: "lit",
	ll: "llvm",
	logo: "logo",
	lua: "lua",
	luau: "luau",
	Makefile: "makefile",
	mk: "makefile",
	makefile: "makefile",
	md: "markdown",
	markdown: "markdown",
	marko: "marko",
	m: "wolfram",
	mat: "matlab",
	mdc: "mdc",
	mdx: "mdx",
	wiki: "wikitext",
	mediawiki: "wikitext",
	mmd: "mermaid",
	mermaid: "mermaid",
	mips: "mipsasm",
	mojo: "mojo",
	"🔥": "mojo",
	move: "move",
	nar: "narrat",
	nf: "nextflow",
	nim: "nim",
	nims: "nim",
	nimble: "nim",
	nix: "nix",
	nu: "nushell",
	mm: "objective-cpp",
	ml: "ocaml",
	mli: "ocaml",
	mll: "ocaml",
	mly: "ocaml",
	pas: "pascal",
	p: "pascal",
	pl: "prolog",
	pm: "perl",
	t: "perl",
	raku: "raku",
	p6: "raku",
	pl6: "raku",
	php: "php",
	phtml: "php",
	pls: "plsql",
	sql: "sql",
	po: "po",
	polar: "polar",
	pcss: "postcss",
	pot: "pot",
	potx: "potx",
	pq: "powerquery",
	pqm: "powerquery",
	ps1: "powershell",
	psm1: "powershell",
	psd1: "powershell",
	prisma: "prisma",
	pro: "prolog",
	P: "prolog",
	properties: "properties",
	proto: "protobuf",
	pp: "puppet",
	purs: "purescript",
	py: "python",
	pyw: "python",
	pyi: "python",
	qml: "qml",
	qmldir: "qmldir",
	qss: "qss",
	r: "r",
	R: "r",
	rkt: "racket",
	rktl: "racket",
	razor: "razor",
	cshtml: "razor",
	rb: "ruby",
	rbw: "ruby",
	reg: "reg",
	regex: "regexp",
	rel: "rel",
	rs: "rust",
	rst: "rst",
	rake: "ruby",
	gemspec: "ruby",
	jbuilder: "ruby",
	builder: "ruby",
	rabl: "ruby",
	arb: "ruby",
	ru: "ruby",
	podspec: "ruby",
	Gemfile: "ruby",
	Rakefile: "ruby",
	Guardfile: "ruby",
	Capfile: "ruby",
	Berksfile: "ruby",
	Brewfile: "ruby",
	Vagrantfile: "ruby",
	Thorfile: "ruby",
	Appraisals: "ruby",
	Dangerfile: "ruby",
	sas: "sas",
	sass: "sass",
	scala: "scala",
	sc: "scala",
	scm: "scheme",
	ss: "scheme",
	sld: "scheme",
	scss: "scss",
	sdbl: "sdbl",
	shadergraph: "shader",
	st: "smalltalk",
	sol: "solidity",
	sparql: "sparql",
	rq: "sparql",
	spl: "splunk",
	config: "ssh-config",
	do: "stata",
	ado: "stata",
	dta: "stata",
	styl: "stylus",
	stylus: "stylus",
	svelte: "svelte",
	swift: "swift",
	sv: "system-verilog",
	svh: "system-verilog",
	service: "systemd",
	socket: "systemd",
	device: "systemd",
	timer: "systemd",
	talon: "talonscript",
	tasl: "tasl",
	tcl: "tcl",
	templ: "templ",
	tf: "tf",
	tfvars: "tfvars",
	toml: "toml",
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	tsp: "typespec",
	tsv: "tsv",
	tsx: "tsx",
	ttl: "turtle",
	twig: "twig",
	typ: "typst",
	vv: "v",
	vala: "vala",
	vapi: "vala",
	vb: "vb",
	vbs: "vb",
	bas: "vb",
	vh: "verilog",
	vhd: "vhdl",
	vhdl: "vhdl",
	vim: "vimscript",
	vue: "vue",
	"vine.ts": "vue-vine",
	vy: "vyper",
	wasm: "wasm",
	wat: "wasm",
	wy: "文言",
	wgsl: "wgsl",
	wit: "wit",
	wl: "wolfram",
	nb: "wolfram",
	xml: "xml",
	xsl: "xsl",
	xslt: "xsl",
	yaml: "yaml",
	yml: "yml",
	zs: "zenscript",
	zig: "zig",
	zsh: "zsh",
	sty: "tex"
};
function Cl(e) {
	if (Z.has(e)) return Z.get(e) ?? "text";
	if (Sl[e] != null) return Sl[e];
	let t = e.match(/\.([^/\\]+\.[^/\\]+)$/);
	if (t != null) {
		if (Z.has(t[1])) return Z.get(t[1]) ?? "text";
		if (Sl[t[1]] != null) return Sl[t[1]] ?? "text";
	}
	let n = e.match(/\.([^.]+)$/)?.[1] ?? "";
	return Z.has(n) ? Z.get(n) ?? "text" : Sl[n] ?? "text";
}
function wl(e, t) {
	if (e <= xl) return !1;
	Z.clear();
	for (let e in t) {
		let n = t[e];
		n != null && Z.set(e, n);
	}
	return xl = e, !0;
}
function Tl(e) {
	let t = e.length;
	return e.charCodeAt(t - 1) === 10 && (t--, e.charCodeAt(t - 1) === 13 && t--), e.slice(0, t);
}
function El(e) {
	return {
		type: "text",
		value: e
	};
}
function Dl({ tagName: e, children: t = [], properties: n = {} }) {
	return {
		type: "element",
		tagName: e,
		properties: n,
		children: t
	};
}
function Ol(e) {
	let t = e.children[0];
	for (; t != null;) {
		if (t.type === "element" && t.tagName === "code") return t;
		t = "children" in t ? t.children[0] : null;
	}
}
function kl(e, t, n) {
	let r = typeof n.lineInfo == "function" ? n.lineInfo(t) : n.lineInfo[t - 1];
	if (r == null) {
		let r = `processLine: line ${t}, contains no state.lineInfo`;
		throw console.error(r, {
			node: e,
			line: t,
			state: n
		}), Error(r);
	}
	return e.tagName = "div", e.properties["data-line"] = r.lineNumber, e.properties["data-alt-line"] = r.altLineNumber, e.properties["data-line-type"] = r.type, e.properties["data-line-index"] = r.lineIndex, e.children.length === 0 && e.children.push(El("\n")), e;
}
var Al = Symbol("no-token"), jl = Symbol("multiple-tokens");
function Ml(e) {
	let t = Nl(e);
	if (t != null) return t;
	let n = Al, r = [], i = [], a, o = () => {
		if (i.length === 0 || a == null) {
			i = [], a = void 0;
			return;
		}
		if (i.length === 1) {
			let e = i[0];
			if (e?.type === "element") {
				Fl(e, a);
				for (let t of e.children) Pl(t);
			} else Pl(e);
			r.push(e), i = [], a = void 0;
			return;
		}
		for (let e of i) Pl(e);
		r.push(Dl({
			tagName: "span",
			properties: { "data-char": a },
			children: i
		})), i = [], a = void 0;
	}, s = (e) => {
		if (e !== Al) {
			if (e === jl) {
				n = jl;
				return;
			}
			if (n === Al) {
				n = e;
				return;
			}
			n !== e && (n = jl);
		}
	};
	for (let t of e.children) {
		let e = t.type === "element" ? Ml(t) : Al;
		if (s(e), typeof e != "number") {
			o(), r.push(t);
			continue;
		}
		a != null && a !== e && o(), a ??= e, i.push(t);
	}
	return o(), e.children = r, n;
}
function Nl(e) {
	let t = e.properties["data-char"];
	if (typeof t == "number") return t;
}
function Pl(e) {
	if (e.type === "element") {
		e.properties["data-char"] = void 0;
		for (let t of e.children) Pl(t);
	}
}
function Fl(e, t) {
	e.properties["data-char"] = t;
}
function Il(e = !1, t = !1) {
	let n = { lineInfo: [] }, r = [{
		line(e) {
			return delete e.properties.class, e;
		},
		pre(t) {
			let r = Ol(t), i = [];
			if (r != null) {
				let t = 1;
				for (let a of r.children) a.type === "element" && (e && Ml(a), i.push(kl(a, t, n)), t++);
				r.children = i;
			}
			return t;
		},
		...e ? {
			tokens(e) {
				for (let t of e) {
					let e = 0;
					for (let n of t) {
						let t = n;
						t.__lineChar ??= e, e += n.content.length;
					}
				}
			},
			preprocess(e, t) {
				t.mergeWhitespaces = "never";
			},
			span(e, t, n, r, i) {
				if (i?.offset != null && i.content != null) {
					let t = i.__lineChar;
					return t != null && (e.properties["data-char"] = t), e;
				}
				return e;
			}
		} : null
	}];
	return t && r.push(Rl, Ll), e && r.push({ line: (e) => (e.type === "element" && e.children.length === 0 && e.children.push({
		type: "element",
		tagName: "br",
		properties: {},
		children: []
	}), e) }), {
		state: n,
		transformers: r,
		toClass: Ll
	};
}
var Ll = Qc({ classPrefix: "hl-" }), Rl = {
	name: "token-style-normalizer",
	tokens(e) {
		for (let t of e) for (let e of t) {
			if (e.htmlStyle != null) continue;
			let t = {};
			e.color != null && (t.color = e.color), e.bgColor != null && (t["background-color"] = e.bgColor), e.fontStyle != null && e.fontStyle !== 0 && (e.fontStyle & 1 && (t["font-style"] = "italic"), e.fontStyle & 2 && (t["font-weight"] = "bold"), e.fontStyle & 4 && (t["text-decoration"] = "underline")), Object.keys(t).length > 0 && (e.htmlStyle = t);
		}
	}
};
function Q(e) {
	return `--${e === "token" ? "diffs-token" : "diffs"}-`;
}
function zl({ theme: e = ml, highlighter: t, prefix: n }) {
	let r = "";
	if (typeof e == "string") {
		let i = t.getTheme(e), a = cl(i);
		r += `color:${a.fg};`, r += `background-color:${a.bg};`, r += `${Q("global")}fg:${a.fg};`, r += `${Q("global")}bg:${a.bg};`, r += Bl(i, n);
	} else {
		let n = t.getTheme(e.dark), i = cl(n);
		r += `${Q("global")}dark:${i.fg};`, r += `${Q("global")}dark-bg:${i.bg};`, r += Bl(n, "dark"), n = t.getTheme(e.light), i = cl(n), r += `${Q("global")}light:${i.fg};`, r += `${Q("global")}light-bg:${i.bg};`, r += Bl(n, "light");
	}
	return r;
}
function Bl(e, t) {
	t = t == null ? "" : `${t}-`;
	let n = "", r = e.colors?.["gitDecoration.addedResourceForeground"] ?? e.colors?.["terminal.ansiGreen"];
	r != null && (n += `${Q("global")}${t}addition-color:${r};`);
	let i = e.colors?.["gitDecoration.deletedResourceForeground"] ?? e.colors?.["terminal.ansiRed"];
	i != null && (n += `${Q("global")}${t}deletion-color:${i};`);
	let a = e.colors?.["gitDecoration.modifiedResourceForeground"] ?? e.colors?.["terminal.ansiBlue"];
	return a != null && (n += `${Q("global")}${t}modified-color:${a};`), n;
}
function Vl(e) {
	let t = e.children[0];
	for (; t != null;) {
		if (t.type === "element" && t.tagName === "code") return t.children;
		t = "children" in t ? t.children[0] : null;
	}
	throw console.error(e), Error("getLineNodes: Unable to find children");
}
function Hl(e, t) {
	return e - (t === 0 ? 0 : 1);
}
function Ul(e, t) {
	return Hl(e, t) + t;
}
function Wl({ isPartial: e, rangeSize: t, expandedHunks: n, hunkIndex: r, collapsedContextThreshold: i }) {
	let a = Math.max(t, 0);
	if (a === 0 || e) return {
		fromStart: 0,
		fromEnd: 0,
		rangeSize: a,
		collapsedLines: a,
		renderAll: !1
	};
	if (n === !0 || a <= i) return {
		fromStart: a,
		fromEnd: 0,
		rangeSize: a,
		collapsedLines: 0,
		renderAll: !0
	};
	let o = n?.get(r), s = Math.min(Math.max(o?.fromStart ?? 0, 0), a), c = Math.min(Math.max(o?.fromEnd ?? 0, 0), a), l = s + c, u = l >= a;
	return {
		fromStart: u ? a : s,
		fromEnd: u ? 0 : c,
		rangeSize: a,
		collapsedLines: Math.max(a - l, 0),
		renderAll: u
	};
}
function Gl({ fileDiff: e, errorPrefix: t }) {
	let n = e.hunks[e.hunks.length - 1];
	if (n == null || e.isPartial || e.additionLines.length === 0 || e.deletionLines.length === 0) return 0;
	let r = e.additionLines.length - Ul(n.additionStart, n.additionCount), i = e.deletionLines.length - Ul(n.deletionStart, n.deletionCount);
	if (r <= 0 && i <= 0) return 0;
	if (r !== i) throw Error(`${t}: trailing context mismatch (additions=${r}, deletions=${i}) for ${e.name}`);
	return Math.min(r, i);
}
function Kl({ fileDiff: e, hunkIndex: t, expandedHunks: n, collapsedContextThreshold: r, errorPrefix: i }) {
	if (t !== e.hunks.length - 1) return;
	let a = Gl({
		fileDiff: e,
		errorPrefix: i
	});
	if (a <= 0) return;
	if (n === !0 || a <= r) return {
		fromStart: a,
		fromEnd: 0,
		rangeSize: a,
		collapsedLines: 0,
		renderAll: !0
	};
	let o = n?.get(e.hunks.length), s = Math.min(Math.max(o?.fromStart ?? 0, 0), a);
	return {
		fromStart: s,
		fromEnd: 0,
		rangeSize: a,
		collapsedLines: a - s,
		renderAll: s >= a
	};
}
function ql({ diff: e, diffStyle: t, startingLine: n = 0, totalLines: r = Infinity, expandedHunks: i, collapsedContextThreshold: a = 1, callback: o }) {
	let s = Jl({
		diff: e,
		diffStyle: t,
		startingLine: n,
		expandedHunks: i,
		collapsedContextThreshold: a
	}), c = {
		viewportStart: n,
		viewportEnd: n + r,
		isWindowedHighlight: n > 0 || r < Infinity,
		splitCount: s.splitCount,
		unifiedCount: s.unifiedCount,
		finalHunkIndex: e.hunks.length - 1,
		shouldBreak() {
			if (!c.isWindowedHighlight) return !1;
			let e = c.unifiedCount >= n + r, i = c.splitCount >= n + r;
			return t === "unified" ? e : (t === "split" || e) && i;
		},
		shouldSkip(e, r) {
			if (!c.isWindowedHighlight) return !1;
			let i = e > 0 && c.unifiedCount + e <= n, a = r > 0 && c.splitCount + r <= n;
			return t === "unified" ? i : (t === "split" || i) && a;
		},
		incrementCounts(e, n) {
			(t === "unified" || t === "both") && (c.unifiedCount += e), (t === "split" || t === "both") && (c.splitCount += n);
		},
		isInWindow(e, n) {
			if (!c.isWindowedHighlight) return !0;
			let r = c.isInUnifiedWindow(e), i = c.isInSplitWindow(n);
			return t === "unified" ? r : t === "split" ? i : r || i;
		},
		isInUnifiedWindow(e) {
			return !c.isWindowedHighlight || c.unifiedCount >= n - e && c.unifiedCount < n + r;
		},
		isInSplitWindow(e) {
			return !c.isWindowedHighlight || c.splitCount >= n - e && c.splitCount < n + r;
		},
		emit(e, n = !1) {
			return n || (t === "unified" ? c.incrementCounts(1, 0) : t === "split" ? c.incrementCounts(0, 1) : c.incrementCounts(1, 1)), o(e) ?? !1;
		}
	};
	hunkIterator: for (let n = s.hunkIndex; n < e.hunks.length; n++) {
		let r = e.hunks[n];
		if (r == null) throw Error("iterateOverDiff: invalid hunk index");
		if (c.shouldBreak()) break;
		let o = Hl(r.deletionStart, r.deletionCount), s = Hl(r.additionStart, r.additionCount), l = !e.isPartial && r.deletionCount === 0 ? o : r.deletionLineIndex, u = !e.isPartial && r.additionCount === 0 ? s : r.additionLineIndex, d = Wl({
			isPartial: e.isPartial,
			rangeSize: r.collapsedBefore,
			expandedHunks: i,
			hunkIndex: n,
			collapsedContextThreshold: a
		}), f = n === c.finalHunkIndex ? Kl({
			fileDiff: e,
			hunkIndex: n,
			expandedHunks: i,
			collapsedContextThreshold: a,
			errorPrefix: "iterateOverDiff"
		}) : void 0, p = d.fromStart + d.fromEnd;
		function m(e, n) {
			return f == null || f.collapsedLines <= 0 || f.fromStart + f.fromEnd > 0 ? 0 : t === "unified" ? e === r.unifiedLineStart + r.unifiedLineCount - 1 ? f.collapsedLines : 0 : n === r.splitLineStart + r.splitLineCount - 1 ? f.collapsedLines : 0;
		}
		let h = d.collapsedLines === 0;
		function g() {
			return h ? 0 : (h = !0, d.collapsedLines);
		}
		if (c.shouldSkip(p, p)) c.incrementCounts(p, p), g();
		else {
			let e = r.unifiedLineStart - d.rangeSize, i = r.splitLineStart - d.rangeSize, a = l - d.rangeSize, f = u - d.rangeSize, p = o + 1 - d.rangeSize, m = s + 1 - d.rangeSize;
			if (Zl(c, d.fromStart, t, (t) => c.emit({
				hunkIndex: n,
				hunk: r,
				collapsedBefore: 0,
				collapsedAfter: 0,
				type: "context-expanded",
				deletionLine: {
					lineNumber: p + t,
					lineIndex: a + t,
					noEOFCR: !1,
					unifiedLineIndex: e + t,
					splitLineIndex: i + t
				},
				additionLine: {
					unifiedLineIndex: e + t,
					splitLineIndex: i + t,
					lineIndex: f + t,
					lineNumber: m + t,
					noEOFCR: !1
				}
			})) || (e = r.unifiedLineStart - d.fromEnd, i = r.splitLineStart - d.fromEnd, a = l - d.fromEnd, f = u - d.fromEnd, p = o + 1 - d.fromEnd, m = s + 1 - d.fromEnd, Zl(c, d.fromEnd, t, (t) => c.emit({
				hunkIndex: n,
				hunk: r,
				collapsedBefore: g(),
				collapsedAfter: 0,
				type: "context-expanded",
				deletionLine: {
					lineNumber: p + t,
					lineIndex: a + t,
					noEOFCR: !1,
					unifiedLineIndex: e + t,
					splitLineIndex: i + t
				},
				additionLine: {
					unifiedLineIndex: e + t,
					splitLineIndex: i + t,
					lineIndex: f + t,
					lineNumber: m + t,
					noEOFCR: !1
				}
			}), () => {
				g();
			}))) break hunkIterator;
		}
		let _ = r.unifiedLineStart, v = r.splitLineStart, y = l, b = u, x = o + 1, S = s + 1, ee = r.hunkContent.at(-1);
		for (let e of r.hunkContent) {
			if (c.shouldBreak()) break hunkIterator;
			let i = e === ee;
			if (e.type === "context") {
				if (c.shouldSkip(e.lines, e.lines)) c.incrementCounts(e.lines, e.lines), g();
				else if (Zl(c, e.lines, t, (t) => {
					let a = i && t === e.lines - 1, o = _ + t, s = v + t;
					return c.emit({
						hunkIndex: n,
						hunk: r,
						collapsedBefore: g(),
						collapsedAfter: m(o, s),
						type: "context",
						deletionLine: {
							lineNumber: x + t,
							lineIndex: y + t,
							noEOFCR: a && r.noEOFCRDeletions,
							unifiedLineIndex: o,
							splitLineIndex: s
						},
						additionLine: {
							unifiedLineIndex: o,
							splitLineIndex: s,
							lineIndex: b + t,
							lineNumber: S + t,
							noEOFCR: a && r.noEOFCRAdditions
						}
					});
				}, () => {
					g();
				})) break hunkIterator;
				_ += e.lines, v += e.lines, y += e.lines, b += e.lines, x += e.lines, S += e.lines;
			} else {
				let a = Math.max(e.deletions, e.additions), o = e.deletions + e.additions;
				if (!c.shouldSkip(o, a)) {
					let s = Ql(c, e, t);
					(s[0]?.[0] ?? 0) > 0 && g();
					for (let [l, u] of s) for (let s = l; s < u; s++) {
						let l = m(_ + s, t === "unified" ? v + (s < e.deletions ? s : s - e.deletions) : v + s);
						if (c.emit($l({
							hunkIndex: n,
							hunk: r,
							collapsedBefore: g(),
							collapsedAfter: l,
							diffStyle: t,
							index: s,
							unifiedLineIndex: _,
							splitLineIndex: v,
							additionLineIndex: b,
							deletionLineIndex: y,
							additionLineNumber: S,
							deletionLineNumber: x,
							content: e,
							isLastContent: i,
							unifiedCount: o,
							splitCount: a
						}), !0)) break hunkIterator;
					}
				}
				g(), c.incrementCounts(o, a), _ += o, v += a, y += e.deletions, b += e.additions, x += e.deletions, S += e.additions;
			}
		}
		if (f != null) {
			let { collapsedLines: n, fromStart: r, fromEnd: i } = f, a = r + i;
			if (Zl(c, a, t, (t) => {
				let r = t === a - 1;
				return c.emit({
					hunkIndex: e.hunks.length,
					hunk: void 0,
					collapsedBefore: 0,
					collapsedAfter: r ? n : 0,
					type: "context-expanded",
					deletionLine: {
						lineNumber: x + t,
						lineIndex: y + t,
						noEOFCR: !1,
						unifiedLineIndex: _ + t,
						splitLineIndex: v + t
					},
					additionLine: {
						unifiedLineIndex: _ + t,
						splitLineIndex: v + t,
						lineIndex: b + t,
						lineNumber: S + t,
						noEOFCR: !1
					}
				});
			}, void 0, () => c.shouldBreak())) break hunkIterator;
		}
	}
}
function Jl({ diff: e, diffStyle: t, startingLine: n, expandedHunks: r, collapsedContextThreshold: i }) {
	if (n <= 0 || t === "both") return {
		hunkIndex: 0,
		splitCount: 0,
		unifiedCount: 0
	};
	let a = Yl({
		diff: e,
		expandedHunks: r,
		collapsedContextThreshold: i
	}), o = 0, s = e.hunks.length - 1, c = e.hunks.length;
	for (; o <= s;) {
		let e = o + s >> 1, r = a[e + 1];
		if (r == null) throw Error("iterateOverDiff: invalid hunk prefix index");
		(t === "unified" ? r.unifiedCount : r.splitCount) > n ? (c = e, s = e - 1) : o = e + 1;
	}
	if (c >= e.hunks.length) {
		let t = a[e.hunks.length];
		if (t == null) throw Error("iterateOverDiff: invalid terminal hunk prefix index");
		return {
			hunkIndex: e.hunks.length,
			splitCount: t.splitCount,
			unifiedCount: t.unifiedCount
		};
	}
	let l = a[c];
	if (l == null) throw Error("iterateOverDiff: invalid selected hunk prefix index");
	return {
		hunkIndex: c,
		splitCount: l.splitCount,
		unifiedCount: l.unifiedCount
	};
}
function Yl({ diff: e, expandedHunks: t, collapsedContextThreshold: n }) {
	let r = 0, i = 0, a = e.hunks.length - 1, o = [{
		splitCount: 0,
		unifiedCount: 0
	}];
	for (let s = 0; s < e.hunks.length; s++) {
		let c = e.hunks[s];
		if (c == null) throw Error("iterateOverDiff: invalid hunk summary index");
		let l = Wl({
			isPartial: e.isPartial,
			rangeSize: c.collapsedBefore,
			expandedHunks: t,
			hunkIndex: s,
			collapsedContextThreshold: n
		}), u = l.fromStart + l.fromEnd;
		r += u + c.splitLineCount, i += u + c.unifiedLineCount;
		let d = s === a ? Kl({
			fileDiff: e,
			hunkIndex: s,
			expandedHunks: t,
			collapsedContextThreshold: n,
			errorPrefix: "iterateOverDiff"
		}) : void 0;
		if (d != null) {
			let e = d.fromStart + d.fromEnd;
			r += e, i += e;
		}
		o.push({
			splitCount: r,
			unifiedCount: i
		});
	}
	return o;
}
function Xl(e, t, n) {
	if (!e.isWindowedHighlight || t <= 0) return [0, t];
	let r = [];
	function i(n) {
		let i = Math.max(0, e.viewportStart - n), a = Math.min(t, e.viewportEnd - n);
		a > i && r.push([i, a]);
	}
	if (n !== "split" && i(e.unifiedCount), n !== "unified" && i(e.splitCount), r.length === 0) return [0, 0];
	let a = r[0][0], o = r[0][1];
	for (let e = 1; e < r.length; e++) {
		let t = r[e];
		a = Math.min(a, t[0]), o = Math.max(o, t[1]);
	}
	return [a, o];
}
function Zl(e, t, n, r, i, a) {
	let [o, s] = Xl(e, t, n);
	o > 0 && (e.incrementCounts(o, o), i?.());
	let c = o;
	for (; c < t;) {
		if (a?.() === !0) return !0;
		if (c >= s) {
			e.incrementCounts(t - c, t - c);
			break;
		}
		if (e.isInWindow(0, 0)) {
			if (r(c) === !0) return !0;
		} else e.incrementCounts(1, 1);
		c++;
	}
	return !1;
}
function Ql(e, t, n) {
	if (!e.isWindowedHighlight) return [[0, n === "unified" ? t.deletions + t.additions : Math.max(t.deletions, t.additions)]];
	let r = n !== "split", i = n !== "unified", a = n === "unified" ? "unified" : "split", o = [];
	function s(t, n) {
		if (t + n <= e.viewportStart || t >= e.viewportEnd) return;
		let r = Math.max(0, e.viewportStart - t), i = Math.min(n, e.viewportEnd - t);
		return i > r ? [r, i] : void 0;
	}
	function c(e, n) {
		return a === "split" ? e : n === "additions" ? [e[0] + t.deletions, e[1] + t.deletions] : e;
	}
	function l(e, t) {
		if (e == null) return;
		let [n, r] = c(e, t);
		r > n && o.push([n, r]);
	}
	if (r && (l(s(e.unifiedCount, t.deletions), "deletions"), l(s(e.unifiedCount + t.deletions, t.additions), "additions")), i && (l(s(e.splitCount, t.deletions), "deletions"), l(s(e.splitCount, t.additions), "additions")), o.length === 0) return o;
	o.sort((e, t) => e[0] - t[0]);
	let u = [o[0]];
	for (let [e, t] of o.slice(1)) {
		let n = u[u.length - 1];
		e <= n[1] ? n[1] = Math.max(n[1], t) : u.push([e, t]);
	}
	return u;
}
function $l({ hunkIndex: e, hunk: t, collapsedAfter: n, collapsedBefore: r, diffStyle: i, index: a, unifiedLineIndex: o, splitLineIndex: s, additionLineIndex: c, deletionLineIndex: l, additionLineNumber: u, deletionLineNumber: d, content: f, isLastContent: p, unifiedCount: m, splitCount: h }) {
	let g = a < f.deletions ? o + a : void 0, _ = i === "unified" ? a >= f.deletions ? o + a : void 0 : a < f.additions ? o + f.deletions + a : void 0, v = i === "unified" ? s + (a < f.deletions ? a : a - f.deletions) : s + a, y = a < f.deletions ? l + a : void 0, b = a < f.deletions ? d + a : void 0, x = i === "unified" ? a >= f.deletions ? c + (a - f.deletions) : void 0 : a < f.additions ? c + a : void 0, S = i === "unified" ? a >= f.deletions ? u + (a - f.deletions) : void 0 : a < f.additions ? u + a : void 0, ee = i === "unified" ? p && a === f.deletions - 1 && t.noEOFCRDeletions : p && a === h - 1 && t.noEOFCRDeletions, C = i === "unified" ? p && a === m - 1 && t.noEOFCRAdditions : p && a === h - 1 && t.noEOFCRAdditions, te = y != null && b != null && g != null ? {
		lineNumber: b,
		lineIndex: y,
		noEOFCR: ee,
		unifiedLineIndex: g,
		splitLineIndex: v
	} : void 0, ne = x != null && S != null && _ != null ? {
		unifiedLineIndex: _,
		splitLineIndex: v,
		lineIndex: x,
		lineNumber: S,
		noEOFCR: C
	} : void 0;
	if (te == null && ne != null) return {
		type: "change",
		hunkIndex: e,
		hunk: t,
		collapsedAfter: n,
		collapsedBefore: r,
		deletionLine: void 0,
		additionLine: ne
	};
	if (te != null && ne == null) return {
		type: "change",
		hunkIndex: e,
		hunk: t,
		collapsedAfter: n,
		collapsedBefore: r,
		deletionLine: te,
		additionLine: void 0
	};
	if (te == null || ne == null) throw Error("iterateOverDiff: missing change line data");
	return {
		type: "change",
		hunkIndex: e,
		hunk: t,
		collapsedAfter: n,
		collapsedBefore: r,
		deletionLine: te,
		additionLine: ne
	};
}
function eu({ line: e, spanStart: t, spanLength: n }) {
	return {
		start: {
			line: e,
			character: t
		},
		end: {
			line: e,
			character: t + n
		},
		properties: { "data-diff-span": "" },
		alwaysWrap: !0
	};
}
function tu({ item: e, arr: t, enableJoin: n, isNeutral: r = !1, isLastItem: i = !1 }) {
	let a = t[t.length - 1];
	if (a == null || i || !n) {
		t.push([+!r, e.value]);
		return;
	}
	let o = a[0] === 0;
	if (r === o || r && e.value.length === 1 && !o) {
		a[1] += e.value;
		return;
	}
	t.push([+!r, e.value]);
}
var nu = { forcePlainText: !1 };
function ru(e, t, n, { forcePlainText: r, startingLine: i, totalLines: a, expandedHunks: o, collapsedContextThreshold: s = 1 } = nu) {
	r ? (i ??= 0, a ??= Infinity) : (i = 0, a = Infinity);
	let c = i > 0 || a < Infinity, l = typeof n.theme == "string" ? t.getTheme(n.theme).type : void 0, u = zl({
		theme: n.theme,
		highlighter: t
	}), d = r && !c && (e.unifiedLineCount > 1e3 || e.splitLineCount > 1e3) ? "none" : n.lineDiffType, f = {
		deletionLines: [],
		additionLines: []
	}, { maxLineDiffLength: p } = n, m = !r && !e.isPartial, h = r ? o : void 0, g = /* @__PURE__ */ new Map();
	function _(e) {
		let t = m ? 0 : e, n = g.get(t) ?? au();
		return g.set(t, n), n;
	}
	function v(e, t, n, r) {
		if (c) {
			let e = n.at(-1);
			(e == null || e.targetIndex + e.count !== t) && (e = {
				targetIndex: t,
				originalOffset: r.length,
				count: 0
			}, n.push(e)), e.count++;
		}
		r.push(e);
	}
	ql({
		diff: e,
		diffStyle: "both",
		startingLine: i,
		totalLines: a,
		expandedHunks: !c || h,
		collapsedContextThreshold: s,
		callback: ({ hunkIndex: t, additionLine: n, deletionLine: r, type: i }) => {
			let a = _(t), o = n == null ? r.splitLineIndex : n.splitLineIndex;
			i === "change" && n != null && r != null && iu({
				additionLine: e.additionLines[n.lineIndex],
				deletionLine: e.deletionLines[r.lineIndex],
				deletionLineIndex: a.deletionContent.length,
				additionLineIndex: a.additionContent.length,
				deletionDecorations: a.deletionDecorations,
				additionDecorations: a.additionDecorations,
				lineDiffType: d,
				maxLineDiffLength: p
			}), r != null && (v(e.deletionLines[r.lineIndex], r.lineIndex, a.deletionSegments, a.deletionContent), a.deletionInfo.push({
				type: i === "change" ? "change-deletion" : i,
				lineNumber: r.lineNumber,
				altLineNumber: i === "change" ? void 0 : n.lineNumber ?? void 0,
				lineIndex: `${r.unifiedLineIndex},${o}`
			})), n != null && (v(e.additionLines[n.lineIndex], n.lineIndex, a.additionSegments, a.additionContent), a.additionInfo.push({
				type: i === "change" ? "change-addition" : i,
				lineNumber: n.lineNumber,
				altLineNumber: i === "change" ? void 0 : r.lineNumber ?? void 0,
				lineIndex: `${n.unifiedLineIndex},${o}`
			}));
		}
	});
	for (let i of g.values()) {
		if (i.deletionContent.length === 0 && i.additionContent.length === 0) continue;
		let a = {
			name: e.prevName ?? e.name,
			contents: i.deletionContent.value
		}, o = {
			name: e.name,
			contents: i.additionContent.value
		}, { deletionLines: s, additionLines: c } = ou({
			deletionFile: a,
			deletionInfo: i.deletionInfo,
			deletionDecorations: i.deletionDecorations,
			additionFile: o,
			additionInfo: i.additionInfo,
			additionDecorations: i.additionDecorations,
			highlighter: t,
			options: n,
			languageOverride: r ? "text" : e.lang
		});
		if (m) {
			f.deletionLines = s, f.additionLines = c;
			continue;
		}
		if (i.deletionSegments.length > 0) for (let e of i.deletionSegments) for (let t = 0; t < e.count; t++) f.deletionLines[e.targetIndex + t] = s[e.originalOffset + t];
		else f.deletionLines.push(...s);
		if (i.additionSegments.length > 0) for (let e of i.additionSegments) for (let t = 0; t < e.count; t++) f.additionLines[e.targetIndex + t] = c[e.originalOffset + t];
		else f.additionLines.push(...c);
	}
	return {
		code: f,
		themeStyles: u,
		baseThemeType: l
	};
}
function iu({ deletionLine: e, additionLine: t, deletionLineIndex: n, additionLineIndex: r, deletionDecorations: i, additionDecorations: a, lineDiffType: o, maxLineDiffLength: s }) {
	if (e == null || t == null || o === "none" || (e = Tl(e), t = Tl(t), e.length > s || t.length > s)) return;
	let c = o === "char" ? jc(e, t) : Jc(e, t), l = [], u = [], d = o === "word-alt", f = c.at(-1);
	for (let e of c) {
		let t = e === f;
		!e.added && !e.removed ? (tu({
			item: e,
			arr: l,
			enableJoin: d,
			isNeutral: !0,
			isLastItem: t
		}), tu({
			item: e,
			arr: u,
			enableJoin: d,
			isNeutral: !0,
			isLastItem: t
		})) : e.removed ? tu({
			item: e,
			arr: l,
			enableJoin: d,
			isLastItem: t
		}) : tu({
			item: e,
			arr: u,
			enableJoin: d,
			isLastItem: t
		});
	}
	let p = 0;
	for (let e of l) e[0] === 1 && i.push(eu({
		line: n,
		spanStart: p,
		spanLength: e[1].length
	})), p += e[1].length;
	p = 0;
	for (let e of u) e[0] === 1 && a.push(eu({
		line: r,
		spanStart: p,
		spanLength: e[1].length
	})), p += e[1].length;
}
function au() {
	return {
		deletionContent: {
			push(e) {
				this.value += e, this.length++;
			},
			value: "",
			length: 0
		},
		additionContent: {
			push(e) {
				this.value += e, this.length++;
			},
			value: "",
			length: 0
		},
		deletionInfo: [],
		additionInfo: [],
		deletionDecorations: [],
		additionDecorations: [],
		deletionSegments: [],
		additionSegments: []
	};
}
function ou({ deletionFile: e, additionFile: t, deletionInfo: n, additionInfo: r, highlighter: i, deletionDecorations: a, additionDecorations: o, languageOverride: s, options: { theme: c = ml, ...l } }) {
	let u = s ?? Cl(e.name), d = s ?? Cl(t.name), { state: f, transformers: p } = Il(l.useTokenTransformer), m = typeof c == "string" ? {
		...l,
		lang: "text",
		theme: c,
		transformers: p,
		decorations: void 0,
		defaultColor: !1,
		cssVariablePrefix: Q("token"),
		tokenizeTimeLimit: 0
	} : {
		...l,
		lang: "text",
		themes: c,
		transformers: p,
		decorations: void 0,
		defaultColor: !1,
		cssVariablePrefix: Q("token"),
		tokenizeTimeLimit: 0
	};
	return {
		deletionLines: e.contents === "" ? [] : (m.lang = u, f.lineInfo = n, m.decorations = a, Vl(i.codeToHast(Tl(e.contents), m))),
		additionLines: t.contents === "" ? [] : (m.lang = d, m.decorations = o, f.lineInfo = r, Vl(i.codeToHast(Tl(t.contents), m)))
	};
}
var su = 10, cu = 13, lu = 4, uu = 40;
function du(e) {
	let t = [0], n = e.indexOf("\r"), r = e.indexOf("\n"), i = 0, a = 0;
	for (; n !== -1 || r !== -1;) {
		let o;
		if (n !== -1 && (r === -1 || n < r) ? r === n + 1 ? (o = r + 1, n = e.indexOf("\r", o), r = e.indexOf("\n", o)) : (o = n + 1, n = e.indexOf("\r", o)) : (o = r + 1, r = e.indexOf("\n", o)), t.push(o), ++a === lu) {
			if (o - i <= uu) {
				for (let n = o; n < e.length; n++) {
					let r = e.charCodeAt(n);
					(r === su || r === cu) && (r === cu && n + 1 < e.length && e.charCodeAt(n + 1) === su && n++, t.push(n + 1));
				}
				return t;
			}
			i = o, a = 0;
		}
	}
	return t;
}
function fu(e) {
	let t = du(e);
	return Array.from({ length: t.length }, (n, r) => {
		let i = t[r], a = t[r + 1] ?? e.length;
		return e.slice(i, a);
	});
}
var pu = { forcePlainText: !1 };
function mu(e, t, { theme: n = ml, tokenizeMaxLineLength: r, useTokenTransformer: i }, { forcePlainText: a, startingLine: o, totalLines: s, lines: c } = pu) {
	a ? (o ??= 0, s ??= Infinity) : (o = 0, s = Infinity);
	let l = o > 0 || s < Infinity, { state: u, transformers: d } = Il(i), f = a ? "text" : e.lang ?? Cl(e.name), p = typeof n == "string" ? t.getTheme(n).type : void 0, m = zl({
		theme: n,
		highlighter: t
	});
	u.lineInfo = (e) => ({
		type: "context",
		lineIndex: e - 1 + o,
		lineNumber: e + o
	});
	let h = typeof n == "string" ? {
		lang: f,
		theme: n,
		transformers: d,
		defaultColor: !1,
		cssVariablePrefix: Q("token"),
		tokenizeMaxLineLength: r,
		tokenizeTimeLimit: 0
	} : {
		lang: f,
		themes: n,
		transformers: d,
		defaultColor: !1,
		cssVariablePrefix: Q("token"),
		tokenizeMaxLineLength: r,
		tokenizeTimeLimit: 0
	}, g = Vl(t.codeToHast(l ? hu(c ?? fu(e.contents), o, s) : e.contents, h)), _ = l ? Array(o) : g;
	return l && _.push(...g), {
		code: _,
		themeStyles: m,
		baseThemeType: p
	};
}
function hu(e, t, n) {
	if (e.length === 0) return "";
	let r = Math.min(t + n, e.length);
	return e.slice(t, r).join("");
}
var gu, $ = {
	theme: ml,
	useTokenTransformer: !1,
	tokenizeMaxLineLength: 1e3,
	lineDiffType: "word-alt",
	maxLineDiffLength: 1e3
}, _u = /(?:)/;
self.addEventListener("error", (e) => {
	console.error("[Shiki Worker] Unhandled error:", e.error);
}), self.addEventListener("message", (e) => {
	vu(e.data);
});
async function vu(e) {
	try {
		switch (e.type) {
			case "initialize":
				await yu(e);
				break;
			case "set-render-options":
				await bu(e);
				break;
			case "file":
				await xu(e);
				break;
			case "diff":
				await Su(e);
				break;
			default: throw Error(`Unknown request type: ${e.type}`);
		}
	} catch (t) {
		console.error("Worker error:", t), Du(e.id, t);
	} finally {
		_u.exec("");
	}
}
async function yu({ id: e, renderOptions: t, preferredHighlighter: n, resolvedThemes: r, resolvedLanguages: i, customExtensionsVersion: a, customExtensionMap: o }) {
	let s = Cu(n);
	"then" in s && (s = await s), wu({
		customExtensionsVersion: a,
		customExtensionMap: o
	}), bl(r, s), i != null && _l(i, s), $ = t, postMessage({
		type: "success",
		id: e,
		requestType: "initialize",
		sentAt: Date.now()
	});
}
async function bu({ id: e, renderOptions: t, resolvedThemes: n }) {
	let r = Cu();
	"then" in r && (r = await r), bl(n, r), $ = t, postMessage({
		type: "success",
		id: e,
		requestType: "set-render-options",
		sentAt: Date.now()
	});
}
async function xu({ id: e, file: t, resolvedLanguages: n, customExtensionsVersion: r, customExtensionMap: i }) {
	let a = Cu();
	"then" in a && (a = await a), wu({
		customExtensionsVersion: r,
		customExtensionMap: i
	}), n != null && _l(n, a);
	let o = {
		theme: $.theme,
		useTokenTransformer: $.useTokenTransformer,
		tokenizeMaxLineLength: $.tokenizeMaxLineLength
	};
	Tu(e, mu(t, a, o), o);
}
async function Su({ id: e, diff: t, resolvedLanguages: n, customExtensionsVersion: r, customExtensionMap: i }) {
	let a = Cu();
	"then" in a && (a = await a), wu({
		customExtensionsVersion: r,
		customExtensionMap: i
	}), n != null && _l(n, a), Eu(e, ru(t, a, $), $);
}
function Cu(e = "shiki-js") {
	return gu ??= Vi({
		themes: [],
		langs: [],
		engine: e === "shiki-wasm" ? wc(Promise.resolve().then(() => (pl(), dl))) : tc()
	}), gu;
}
function wu({ customExtensionsVersion: e, customExtensionMap: t }) {
	if (e != null || t != null) {
		if (e == null || t == null) throw Error("Worker request must include both customExtensionsVersion and customExtensionMap");
		wl(e, t);
	}
}
function Tu(e, t, n) {
	postMessage({
		type: "success",
		requestType: "file",
		id: e,
		result: t,
		options: n,
		sentAt: Date.now()
	});
}
function Eu(e, t, n) {
	postMessage({
		type: "success",
		requestType: "diff",
		id: e,
		result: t,
		options: n,
		sentAt: Date.now()
	});
}
function Du(e, t) {
	let n = {
		type: "error",
		id: e,
		error: t instanceof Error ? t.message : String(t),
		stack: t instanceof Error ? t.stack : void 0
	};
	postMessage(n);
}
//#endregion
