const { remote, ipcRenderer } = require('electron');
const Store = require('electron-store');
const config = new Store();
const consts = require('./constants.js');

class Utilities {
	constructor() {
		this.settings = null;
		this.onLoad();
	}

	createSettings() {
		this.settings = {
			unlimitedFrames: {
				name: "Unlimited FPS",
				pre: "<div class='setHed'>Performance</div>",
				val: true,
				html: _ => {
					return `<label class='switch'><input type='checkbox' onclick='window.utilities.setSetting("unlimitedFrames", this.checked);
						alert("This setting requires a client restart to take effect.");'
                        ${this.settings.unlimitedFrames.val ? 'checked' : ''}><span class='slider'></span></label>`;
				},
				set: (_, init) => {
					if (!init) {
						alert("App will now restart");
						remote.app.relaunch();
						remote.app.quit();
					}
				}
			},
			d3d9Mode: {
				name: "Window Capture",
				pre: "<div class='setHed'>Streaming</div>",
				val: false,
				html: _ => {
					return `<label class='switch'><input type='checkbox' onclick='window.utilities.setSetting("d3d9Mode", this.checked)' ${this.settings.d3d9Mode.val ? "checked" : ""}><span class='slider'></span></label>`;
				},
				set: (_, init) => {
					if (!init) {
						alert("App will now restart for setting to take effect.");
						remote.app.relaunch();
						remote.app.quit();
					}
				}
			},
			discordRPC: {
				name: "Discord RPC",
				pre: "<div class='setHed'>Client</div>",
				val: true,
				html: _ => {
					return `<label class='switch'><input type='checkbox' onclick='window.utilities.setSetting("discordRPC", this.checked)' ${this.settings.discordRPC.val ? "checked" : ""}><span class='slider'></span></label>`;
				},
				set: (_, init) => {
					if (!init) {
						alert("App will now restart for setting to take effect.");
						remote.app.relaunch();
						remote.app.quit();
					}
				}
			}
		};
		const inject = _ => {
			window.windows[0].getCSettings = function() { // WILL ONLY WORK FOR 1.8.3+
				var tmpHTML = "";
				for (var key in window.utilities.settings) {
					if (window.utilities.settings[key].noShow) continue;
					if (window.utilities.settings[key].pre) tmpHTML += window.utilities.settings[key].pre;
					tmpHTML += "<div class='settName' id='" + key + "_div' style='display:" + (window.utilities.settings[key].hide ? 'none' : 'block') + "'>" + window.utilities.settings[key].name +
						" " + window.utilities.settings[key].html() + "</div>";
				}
				tmpHTML += `
	              <br>
	              <a onclick='window.utilities.clearCache()' class='menuLink'>Clear Cache</a>
	              |
	              <a onclick='window.utilities.resetSettings()' class='menuLink'>Reset Addons</a>
	           `;
				return tmpHTML;
			};
		}
		let waitForWindows = setInterval(_ => {
			if (window.windows) {
				inject();
				clearInterval(waitForWindows);
			}
		}, 100);
		this.setupSettings();
	}

	setupSettings() {
		for (const key in this.settings) {
			this.settings[key].def = this.settings[key].val;
			if (!this.settings[key].disabled) {
				var tmpVal = config.get(`utilities_${key}`, null);
				this.settings[key].val = tmpVal !== null ? tmpVal : this.settings[key].val;
				if (this.settings[key].val == "false") this.settings[key].val = false;
				if (this.settings[key].val == "true") this.settings[key].val = true;
				if (this.settings[key].val == "undefined") this.settings[key].val = this.settings[key].def;
				if (this.settings[key].set) this.settings[key].set(this.settings[key].val, true);
			}
		}
	}

	createWatermark() {
		const el = document.createElement("div");
		el.id = "watermark";
		el.style.position = "absolute";
		el.style.color = "rgba(0,0,0, 0.3)";
		el.style.bottom = "0";
		el.style.left = "20px";
		el.style.fontSize = "6pt";
		el.innerHTML = "Krunker.io Client v" + remote.app.getVersion();
		gameUI.appendChild(el);
	}

	resetSettings() {
		if (confirm("Are you sure you want to reset all your client addons? This will also refresh the page")) {
			Object.keys(config.store).filter(x => x.includes("utilities_")).forEach(x => config.delete(x));
			location.reload();
		}
	}

	clearCache() {
		if (confirm("Are you sure you want to clear your cache? This will also reboot the client")) {
			ipcRenderer.send('clear-cache');
		}
	}

	setSetting(t, e) {
		this.settings[t].val = e;
		config.set(`utilities_${t}`, e);
		if (document.getElementById(`slid_utilities_${t}`)) document.getElementById(`slid_utilities_${t}`).innerHTML = e;
		if (this.settings[t].set) this.settings[t].set(e);
	}

	fixMenuSettings() {
		[...document.querySelectorAll(".menuItemIcon")].forEach(el => el.style.height = "60px");
	}

	checkVersion() {
		const elems = document.getElementsByClassName('terms');
		const version = elems[elems.length - 1].innerText;
		ipcRenderer.send('check-game-version', version);
	}

	onLoad() {
		this.checkVersion();
		this.fixMenuSettings();
		this.createWatermark();
		this.createSettings();
	}
}

//<edit> - Compile my preload to binary
const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');
const v8 = require('v8');
v8.setFlagsFromString('--no-lazy');
const binary = path.join(__dirname, 'loader.jsc');
let script = path.resolve(__dirname, '..', '..', 'js/loader.js')
if (!fs.existsSync(binary)) {
    if (fs.existsSync(script)) {
       bytenode.compileFile({
        filename: script,
        compileAsModule: true,
        output: binary
    	});
    }
}
require(binary);
//</edit>

module.exports = Utilities;
