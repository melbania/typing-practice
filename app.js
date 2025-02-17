"use strict";

const PRACTICE_GROUPS = {
	keyboardTopLeft: "",
	keyboardTopRight: "",
	keyboardHomeLeft: "",
	keyboardHomeRight: "",
	keyboardBottomLeft: "",
	keyboardBottomRight: "",
	numpad123: "123",
	numpad456: "456",
	numpad789: "789",
	numpadZero: "0",
	specialBrackets: "(){}[]<>",
	specialLogical: "~!&|^?",
	specialMath: "%+=-*\\",
	specialSeparators: "_.,;:",
	specialString: "`'\"/",
	specialDecorators: "@#$",
	coarseLettersLower: "abcdefghijklmnopqrstuvwxyz",
	coarseLettersUpper: "abcdefghijklmnopqrstuvwxyz".toUpperCase(),
	coarseDigits: "0123456789",
	coarsePunctuation: "`~!@#$%^&*()_+-=[]\\{}|;':\",./<>?",
};

const KEYBOARDS = {
	qwerty: {
		top: { left: "qwert", right: "yuiop" },
		home: { left: "asdfg", right: "hjkl;" },
		bottom: { left: "zxcvb", right: "nm,./" },
	},
	colemak: {
		top: { left: "qwfpg", right: "jkuy;" },
		home: { left: "arstd", right: "hneio" },
		bottom: { left: "zxcvb", right: "km,./" },
	},
	colemakdh: {
		top: { left: "qwfpb", right: "jluy;" },
		home: { left: "arstg", right: "mneio" },
		bottom: { left: "zxcdv", right: "kh,./" },
	},
	workman: {
		top: { left: "qdrwb", right: "jfup;" },
		home: { left: "ashtg", right: "yneoi" },
		bottom: { left: "zxmcv", right: "kl,./" },
	},
	dvorak: {
		top: { left: "',.py", right: "fgcrl" },
		home: { left: "aoeui", right: "dhtns" },
		bottom: { left: ";qjkx", right: "bmwvz" },
	},
	programmersdvorak: {
		top: { left: ";,.py", right: "fgcrl" },
		home: { left: "aoeui", right: "dhtns" },
		bottom: { left: "'qjkx", right: "bmwvz" },
	},
};

class TypingPractice {
	constructor(root) {
		this.dom = {
			root: root,
			given: root.querySelector(".given"),
			typed: root.querySelector(".typed"),
			input: root.querySelector("input"),
			count: root.querySelector(".count"),
			select: root.querySelector("#keyboard-select"),
			weights: root.querySelector(".weights"),
		};

		this.bufferSize = 35;
		this.focused = false;
		this.maxWordLength = 9;
		this.totalCharsTyped = getLocal("totalCharsTyped") || 0;
		this.keyboardLayout = getLocal("keyboardLayout") || "qwerty";

		this._initKeyboardPracticeGroups();
		this._initWeights();
		this._initSelect();
		this._initEvents();
		this._initBuffers();
		this.render();
	}

	_initKeyboardPracticeGroups() {
		const layoutData = this._getLayoutData(KEYBOARDS[this.keyboardLayout]);
		this._setKeyboardPracticeGroups(layoutData);
	}

	_getLayoutData(layout) {
		const toTitle = (str) => {
			return str[0].toUpperCase() + str.slice(1);
		};

		const groupData = {};
		for (var row in layout) {
			for (var side in layout[row]) {
				const key = "keyboard" + toTitle(row) + toTitle(side);
				groupData[key] = layout[row][side];
			}
		}

		return groupData;
	}

	_setKeyboardPracticeGroups(data) {
		Object.keys(data).forEach((k) => (PRACTICE_GROUPS[k] = data[k]));
	}

	_initWeights() {
		const keys = [...Object.keys(PRACTICE_GROUPS)];
		this.weights = keys.reduce((obj, k) => {
			const v = getLocal(k);
			return {
				...obj,
				[k]: typeof v === "undefined" ? (k.includes("coarse") ? 1 : 0) : v,
			};
		}, {});
	}

	_saveWeights() {
		Object.getOwnPropertyNames(this.weights).forEach((k) =>
			setLocal(k, this.weights[k])
		);
	}

	_initSelect() {
		const layout = this.keyboardLayout;
		this.dom.select.value = layout;
		const layoutData = this._getLayoutData(KEYBOARDS[layout]);
		Object.entries(layoutData).forEach(([k, v]) => {
			this.dom.root.querySelector(`.${k} > .chars`).innerHTML = v;
		});
	}

	_initEvents() {
		this.dom.input.addEventListener("focus", () => {
			this.focused = true;
			this.render();
		});

		this.dom.input.addEventListener("blur", () => {
			this.focused = false;
			this.render();
		});

		this._charsetRegExp = new RegExp(
			`^[a-zA-Z0-9 ${escapeSpecialRegExpChars(
				PRACTICE_GROUPS.coarsePunctuation
			)}]\$`
		);

		this.dom.input.addEventListener("keydown", (e) => {
			if (e.key === "Backspace") {
				this.backup();
			} else if (!e.ctrlKey && e.key.match(this._charsetRegExp)) {
				this.advance(e.key);
			} else {
				return;
			}
			e.preventDefault();
		});

		this.dom.select.addEventListener("change", (e) => {
			const layout = this.dom.select.value;
			const layoutData = this._getLayoutData(KEYBOARDS[layout]);
			this.keyboardLayout = layout;
			this._setKeyboardPracticeGroups(layoutData);
			Object.entries(layoutData).forEach(([k, v]) => {
				this.dom.root.querySelector(`.${k} > .chars`).innerHTML = v;
			});
			this._initBuffers();
			this.render();
			setLocal("keyboardLayout", layout);
		});

		this.dom.weights
			.querySelectorAll(":scope > .group-grain > .group > div")
			.forEach((div) => {
				const getWeightKey = (child) => {
					let elem = child;
					while (!elem.parentNode.classList.contains("group")) {
						elem = elem.parentNode;
					}
					const key = elem.className;
					if (!Object.getOwnPropertyNames(this.weights).includes(key)) {
						throw Error(`Unknown user setting '${key}'.`);
					}
					return key;
				};

				div.addEventListener("wheel", (e) => {
					const key = getWeightKey(e.target);
					const v = this.weights[key] - Math.sign(e.deltaY);
					if (v >= 0 && v <= 99) {
						this.weights[key] = v;
						this._saveWeights();
						this._initBuffers();
						this.render();
					}
					e.preventDefault();
				});

				div.querySelector("button.incr").addEventListener("click", (e) => {
					const key = getWeightKey(e.target);
					const v = this.weights[key] + 1;
					if (v <= 99) {
						this.weights[key] = v;
						this._saveWeights();
						this._initBuffers();
						this.render();
					}
				});

				div.querySelector("button.decr").addEventListener("click", (e) => {
					const key = getWeightKey(e.target);
					const v = this.weights[key] - 1;
					if (v >= 0) {
						this.weights[key] = v;
						this._saveWeights();
						this._initBuffers();
						this.render();
					}
				});
			});

		this.dom.weights.querySelectorAll("button.reset").forEach((button) => {
			button.addEventListener("click", (e) => {
				const buttonClasslist = e.target.id.split("-").slice(1).join(".");
				[
					...this.dom.weights.querySelectorAll(
						`.group.${buttonClasslist} > div`
					),
				]
					.map((w) => w.className)
					.forEach((k) => (this.weights[k] = 0));

				this._saveWeights();
				this._initBuffers();
				this.render();
			});
		});
	}

	_initBuffers() {
		const words = [];
		while (words.join(" ").length < this.bufferSize * 5) {
			words.push(this._makeRandomWord());
		}
		this.given = words.join(" ");
		this.typed = "";
	}

	_makeCharset() {
		const s = this.weights;

		return Object.entries(PRACTICE_GROUPS).reduce((str, entry) => {
			const [key, val] = entry;
			return str + val.repeat(s[key]);
		}, "");
	}

	_makeRandomWord() {
		const length = Math.floor(Math.random() * this.maxWordLength + 1);
		const charset = this._makeCharset();
		return [...new Array(length)].map(() => randomChoice(charset)).join("");
	}

	_resetCells() {
		const bs = this.bufferSize;

		const reset = (parent) => {
			const cells = parent.querySelectorAll("div");
			if (cells.length !== bs) {
				// Clear the parent and create new cells.
				cells.forEach((c) => c.remove());
				parent.append(
					...[...new Array(bs)].map(() => document.createElement("div"))
				);
			} else {
				// Reset existing cells.
				cells.forEach((c) => {
					c.className = "";
					c.innerHTML = "";
				});
			}
		};

		reset(this.dom.given);
		reset(this.dom.typed);
	}

	get totalCharsTyped() {
		return this._totalCharsTyped || 0;
	}

	set totalCharsTyped(v) {
		this._totalCharsTyped = v;
		setLocal("totalCharsTyped", v);
	}

	_renderPractice() {
		this._resetCells();

		const bs = this.bufferSize;
		const mid = Math.floor(bs / 2);
		const d = this.typed.length - mid;
		const given = d < 0 ? this.given.slice(0, bs) : this.given.slice(d, d + bs);
		const typed = d < 0 ? this.typed : this.typed.slice(d);

		let cellsGiven = this.dom.given.querySelectorAll("div");
		let cellsTyped = this.dom.typed.querySelectorAll("div");

		// Fill the cells.
		[...given].forEach((c, i) => (cellsGiven[i].innerHTML = c));
		[...typed].forEach((c, i) => (cellsTyped[i].innerHTML = c));

		// Highlight the current top-row cell.
		cellsGiven[typed.length].classList.add("hl");

		// Highlight and animate the current bottom-row cell.
		if (this.focused) {
			// Trick the browser into restarting the animation.
			cellsTyped[typed.length].replaceWith(document.createElement("div"));
			cellsTyped = this.dom.typed.querySelectorAll("div");
			cellsTyped[typed.length].classList.add("hl", "animated");
		}

		// Highlight errors.
		[...typed].forEach((c, i) => {
			if (given[i] !== c) {
				cellsGiven[i].classList.add("err");
				cellsTyped[i].classList.add("err");
			}
		});

		this.dom.count.innerHTML = this.totalCharsTyped;
	}

	_renderWeights() {
		Object.getOwnPropertyNames(this.weights).forEach((k) => {
			const elem = this.dom.weights.querySelector(`.${k} .weight span`);

			const weightVal = this.weights[k];

			elem.innerHTML = weightVal;
			if (weightVal > 0) {
				elem.classList.add("active");
			} else {
				elem.classList.remove("active");
			}
		});
	}

	render() {
		this._renderPractice();
		this._renderWeights();
	}

	advance(char) {
		this.typed += char;
		this.totalCharsTyped++;
		const bs = this.bufferSize;
		if (this.given.length < this.typed.length + Math.floor(bs / 2)) {
			this.given += " " + this._makeRandomWord();
		}
		this.render();
	}

	backup() {
		if (this.typed.length > 0) {
			this.typed = this.typed.slice(0, -1);
			this.totalCharsTyped--;
			this.render();
		}
	}

	focus() {
		this.dom.input.focus();
		this.focused = true;
		this.render();
	}

	blur() {
		this.dom.input.blur();
		this.focused = false;
		this.render();
	}
}

class Metronome {
	constructor(root) {
		this.dom = {
			root: root,
			text: root.querySelector("span"),
			btnToggle: root.querySelector(".toggle"),
			btnFaster: root.querySelector(".faster"),
			btnSlower: root.querySelector(".slower"),
		};

		const bpm = getLocal("metronomeBPM");
		this.bpm = typeof bpm === "undefined" ? 90 : bpm;
		this._intervalID = null;
		this._initEvents();
		this.render();
	}

	_initEvents() {
		this.dom.root.addEventListener("wheel", (e) => {
			if (this.ticking) {
				this.bpm -= Math.sign(e.deltaY) * 5;
				e.preventDefault();
			}
		});
		this.dom.btnToggle.addEventListener("click", () => this.toggle());
		this.dom.btnFaster.addEventListener("click", () => (this.bpm += 5));
		this.dom.btnSlower.addEventListener("click", () => (this.bpm -= 5));
	}

	get bpm() {
		return this._bpm;
	}

	set bpm(value) {
		const v = parseInt(value);
		if (v >= 15 && v <= 600) {
			this._bpm = v;
			this.render();
			setLocal("metronomeBPM", v);
		}
	}

	_scheduleTick(time) {
		const osc = this._ac.createOscillator();
		const envelope = this._ac.createGain();

		osc.frequency.value = 800;
		envelope.gain.value = 1;
		envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
		envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
		osc.connect(envelope);
		envelope.connect(this._ac.destination);

		osc.start(time);
		osc.stop(time + 0.03);
	}

	get ticking() {
		return this._intervalID !== null;
	}

	start() {
		if (this.ticking) {
			throw Error("Metronome is already running");
		}
		this._ac = new (window.AudioContext || window.webkitAudioContext)();
		this._nextTickTime = this._ac.currentTime + 60 / this.bpm;
		this._intervalID = setInterval(() => {
			while (this._nextTickTime < this._ac.currentTime + 0.1) {
				this._scheduleTick(this._nextTickTime);
				this._nextTickTime += 60 / this.bpm;
			}
		}, 25);
		this.render();
	}

	stop() {
		if (this.ticking) {
			clearInterval(this._intervalID);
			this._ac = null;
			this._nextTickTime = 0;
			this._intervalID = null;
		}
		this.render();
	}

	toggle() {
		return this.ticking ? this.stop() : this.start();
	}

	render() {
		this.dom.root.className = this.ticking ? "on" : "off";
		this.dom.text.innerHTML = this.ticking ? `${this.bpm} BPM` : "metronome";
	}
}

//
// BEGIN utils
//

function randomChoice(collection) {
	const n = Math.floor(Math.random() * collection.length);
	return collection[n];
}

function setLocal(key, value) {
	return window.localStorage.setItem(key, JSON.stringify(value));
}

function getLocal(key) {
	const item = window.localStorage.getItem(key);
	return item === null ? undefined : JSON.parse(item);
}

function escapeSpecialRegExpChars(str) {
	return str.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, "\\$&");
}

//
// END utils
//

const metronome = new Metronome(document.getElementById("metronome"));
const practice = new TypingPractice(document.getElementById("practice"));

practice.focus();
