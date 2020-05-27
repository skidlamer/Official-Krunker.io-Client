const {
  remote,
  ipcRenderer
} = require('electron');
const msgpack = require("msgpack-lite");
const Store = require('electron-store');
const config = new Store();
const Log = require('./log.js');
window.log = new Log();
window.remote = remote;
const clientWindow = remote.getCurrentWindow();

var obfu = {};
var chamTimer = 0;
var downKeys = new Set();

Object.defineProperty(CanvasRenderingContext2D.prototype, 'save', {
  value: CanvasRenderingContext2D.prototype.save,
  writable: false
}); //nice try Nathan noob 

Object.defineProperty(window, '__SENTRY__', {
  value: undefined,
  writable: false
}); //fuck off Tehchy

let isDefined = function(object) {
  return void 0 !== object;
}

let isType = function(item, type) {
  return typeof item === type;
}

let isNative = function(fn) {
  return (/^function\s*[a-z0-9_\$]*\s*\([^)]*\)\s*\{\s*\[native code\]\s*\}/i).test('' + fn)
}

let waitFor = function(parent, name, callback, startTime = 0) {
    const interval = setInterval(() => {
        if (!startTime) startTime = Date.now();
        else if (isDefined(parent[name]) && parent[name]) {
            console.log(`${name} Loaded, elapsed time: ${ String(Date.now() - startTime) } m/s`);
            typeof callback === 'function' && callback();
            clearInterval(interval);
        }
    });
}

let ObjectEntries = function(object, callback) {
  let descriptors = Object.getOwnPropertyDescriptors(object);
  Object.entries(descriptors).forEach(([key, {
      value,
      get,
      set,
      configurable,
      enumerable,
      writable
  }]) => callback([object, key, value, get, set, configurable, enumerable, writable]));
}

let getVersion = function() {
  const elems = document.getElementsByClassName('terms');
  const version = elems[elems.length - 1].innerText;
  return version;
}

let doOnce = function(func) {
  var ran = false,
      memo;
  return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
  }
}

let createObserver = function(elm, check, callback, onshow = true) {
  return new MutationObserver((mutationsList, observer) => {
      if (check == 'src' || onshow && mutationsList[0].target.style.display == 'block' || !onshow) {
          callback(mutationsList[0].target);
      }
  }).observe(elm, check == 'childList' ? {
      childList: true
  } : {
      attributes: true,
      attributeFilter: [check]
  });
}

let createListener = function(elm, type, callback = null) {
  if (!isDefined(elm)) {
      alert("Failed creating " + type + "listener");
      return
  }
  elm.addEventListener(type, event => callback(event));
}

let createElement = function(type, html, id) {
    let newElement = document.createElement(type)
    if (id) newElement.id = id
    newElement.innerHTML = html
    return newElement
}

let proxy = (type, targetFn, callbackFn) => {
    if (targetFn.hasOwnProperty('proxy')) return targetFn;
    targetFn.proxy = true;
    console.groupCollapsed("HOOKED ", targetFn.name ? targetFn.name:"anonymous", type);
    console.dir(targetFn);
    console.log(targetFn);
    console.groupEnd();
    switch (type) {
        case 'apply': return new Proxy(targetFn, { apply: function(target, parent, args) { return callbackFn(target, parent, args) }})
        case 'construct': return new Proxy(targetFn, { construct: function(target, args) { return callbackFn(target, args) } });
        default: console.error("ERROR unknown proxied hook method"); return;
    }
}

let deObfuscate = function(script) {
  const map = new Map()

      .set("objInstances", [/\w+\['genObj3D']\(0x0,0x0,0x0\);if\(\w+\['(\w+)']=\w+\['genObj3D']/, 1])
      .set("socket", [/connect'\(\w+,\w+,\w+\){if\(!this\['(\w+)']\)/, 1]).set("isYou", [/this\['(\w+)']&&\(hiddenMsg\['style']/, 1])
      .set("isYou", [/this\['(\w+)']&&\(hiddenMsg\['style']/, 1])
      .set("cnBSeen", [/\['(\w+)']=!0x1;}},this\['saveSpin']/, 1])
    //  .set("canSee", [/\[0x0];},this\['(\w+)']=function\(\w+,\w+,\w+,\w+,\w+,\w+\)/, 1])
    //  .set("getWorldPosition", [/\?\w+\['fpsCamera']\['(\w+)']\(\):\w+/, 1])
      .set("procInputs", [/this\['(\w+)']=function\((\w+),(\w+),\w+,\w+\){(this)\['recon']/, 1])
    //  .set("pchObjc", [/0x0,this\['(\w+)']=new \w+\['Object3D']\(\),this/, 1])
      .set("didShoot", [/--,\w+\['(\w+)']=!0x0/, 1])
      .set("nAuto", [/'(\w+)':!0x0,'burst':/, 1])
    //  .set("crouchVal", [/this\['(\w+)']\+=\w\['crouchSpeed']\*\w+,0x1<=this\['\w+']/, 1])
    //  .set("recoilAnimY", [/\w*1,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,this\['\w+'\]=\w*1,this\['\w+'\]=\w*1,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,this\['(\w+)'\]=\w*0,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,this\['\w+'\]=\w*0,/, 1])
      .set("mouseDownL", [/this\['\w+'\]=function\(\){this\['(\w+)'\]=\w*0,this\['(\w+)'\]=\w*0,this\['\w+'\]={}/, 1])
      .set("mouseDownR", [/this\['(\w+)']=0x0,this\['keys']=/, 1])
    //  .set("maxHealth", [/this\['health']\/this\['(\w+)']\?/, 1])
      .set("reloadTimer", [/\['noReloads']\|\|!\w\['(\w+)']&&\w\['\w+']/, 1])
      .set("ammos", [/\['noReloads']\|\|!\w\['\w+']&&\w\['(\w+)']/, 1])
      .set("weaponIndex", [/\['noReloads']\|\|!\w\['\w+']&&\w\['\w+']\[\w\['(\w+)']]/, 1])
      .set("aimVal", [/&&0x1==\w\['(\w+)']&&!\w/, 1])

  console.groupCollapsed("DEOBFUSCATE ");
  for (const [name, arr] of map) {
      const found = arr[0].exec(script);
      if (!found) {
          console.error("Failed to find " + name);
          window.alert("Failed to find " + name);
          obfu[name] = null;
          continue;
      } else {
          console.log("found ", name, " - ", found[arr[1]]);
          obfu[name] = found[arr[1]];
      }
  }
  console.groupEnd();
}

let patchScript = function(script) {
  console.groupCollapsed("PATCHING ");
  const patches = new Map()

      .set("exports", [/(function\(\w,\w,(\w)\){)'use strict';(\(function\((\w)\){)\//, "$1$3window.exports=$2.c;/"])
      .set("inView", [/if\((!\w+\['\w+'])\)continue;/, "if($1&&!window.utilities.config.renderESP.val)continue;"])
      //.set("inView", [/(if\(!\w+\['\w+']\))continue;/g, "$1 void 0;"])
     //.set("socket", [/(b\['exports']={')/, 'window.socket = $1'])

  for (const [name, item] of patches) {
      const patched = String.prototype.replace.call(script, item[0], item[1]);
      if (script === patched) {
          console.error(`Failed to patch ${name}`);
          continue;
      } else console.log("Successfully patched ", name);
      script = patched;
  }
  console.groupEnd();
  return script;
}

let gameScript = function(script) {
  let version = getVersion();
  console.groupCollapsed("GAMESCRIPT ", version, " size ", script.length);
  console.log(script);
  console.groupEnd();
  deObfuscate(script);
  return patchScript(script)
}

window.Function = proxy("construct", window.Function, (target, args) => {
    const Original = new target(...args);
    if (args && args.length === 3 && isType(args[2], "string") && args[2].length > 24e4) {
        args[2] = gameScript(args[2]);
        const Modified = new target(...args);
        Modified.toString = () => Original.toString();
        return Modified;
    }
    return Original;
});

window.initHooks = function(...[utils, playerManager, mapManager, serverVars, overlay, THREE, colors, ui, ws]) {
    console.groupCollapsed("EXPORTS ");
    console.dir(window.exports);
    ObjectEntries(window.exports, ([rootObject, rootKey, rootValue, rootGet, rootSet, rootConfigurable, rootEnumerable, rootWritable]) => {
        ObjectEntries(rootValue.exports, ([object, key, value, get, set, configurable, enumerable, writable]) => {
            if (!utils && ["getAnglesSSS", "rgbToHex"].includes(key)) {
                utils = rootValue.exports;
                console.log(["utils", utils])
            }
            if (!playerManager && ["Player"].includes(key)) {
                playerManager = rootValue.exports;
                console.log(["playerManager", playerManager])
            }
            if (!serverVars && ["serverTickRate", "camChaseTrn", "cameraHeight", "hitBoxPad"].includes(key)) {
                serverVars = rootValue.exports;
                console.log(["serverVars", serverVars])
            }
            if (!THREE && ["ACESFilmicToneMapping", "TextureLoader", "ObjectLoader"].includes(key)) {
                THREE = rootValue.exports;
                console.log(["THREE", THREE])
            }
            if (!colors && ["getChallCol", "hudHealth"].includes(key)) {
                colors = rootValue.exports;
                console.log(["colors", colors])
            }
            if (!overlay && ["canvas", "render"].includes(key)) {
                overlay = rootValue.exports;
                console.log(["overlay", overlay])
            }
            if (!mapManager && ["maps"].includes(key)) {
                mapManager = rootValue.exports;
                console.log(["mapManager", mapManager])
            }
            if (!ui && ["toggleControlUI", "toggleGameUI"].includes(key)) {
                ui = rootValue.exports;
                console.log(["ui", ui])
            }
            if (!ws && ["sendQueue", "ahNum"].includes(key)) {
                ws = rootValue.exports;
                console.log(["ws", ws])
            }
        })
    });
    console.groupEnd();

    createListener(document, "keyup", event => {
        if (downKeys.has(event.code)) downKeys.delete(event.code)
    })
      
    createListener(document, "keydown", event => {
        if ('INPUT' == document.activeElement.tagName || !window.endUI && window.endUI.style.display) return;
        switch (event.code) {
            case 'Backquote':
               if (document.pointerLockElement || document.mozPointerLockElement) {
                    document.exitPointerLock();
                    window.showWindow(22, 1);
                } else {
                    window.showWindow(22, 0);
                    if(isDefined(window.utilities.toggle)) window.utilities.toggle(true);
                }
            break;
            case 'Numpad0':
                if (ui) {
                }
            break;
            default:
                if (!downKeys.has(event.code)) downKeys.add(event.code);
            break;
        }
    })

    let keyDown = (key) => downKeys.has(key)

    const css = {
        customFontsFix: `.purchBtn, .purchInfoBtn {  position: absolute; bottom: 11px; } .scrollItem > div { overflow: auto; }`,
        noTextShadows: `*, .button.small, .bigShadowT { text-shadow: none !important; }`,
        hideAds: `#aHolder, #pre-content-container { display: none !important }`,
        hideSocials: `.headerBarRight > .verticalSeparator, .imageButton { display: none }`
    }

    window.utilities.setConfig = function(t, e) {
        window.utilities.config[t].val = e;
        config.set(`config_${t}`, e);
        if (document.getElementById(`slid_utilities_${t}`)) document.getElementById(`slid_utilities_${t}`).innerHTML = e;
        if (window.utilities.config[t].set) window.utilities.config[t].set(e);
    }

    window.utilities.resetConfig = function() {
        if (confirm("Are you sure you want to reset all your client config? This will also refresh the page")) {
            Object.keys(config.store).filter(x => x.includes("config_")).forEach(x => config.delete(x));
            location.reload();
        }
    }

    let createConfig = function() {
        const selectStyle = `border: none; background: #eee; padding: 4px; float: right; margin-left: 10px;`;
        const textInputStyle = `border: none; background: #eee; padding: 6px; padding-bottom: 6px; float: right;`;
        window.utilities.config = {

            hideAdverts: {
                name: "Hide Advertisments",
                pre: "<div class='setHed'><center>Quick Client Config</center></div><div class='setHed'>Rendering</div><hr>",
                val: true,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("hideAdverts", this.checked)' ${window.utilities.config.hideAdverts.val ? "checked" : ""}><span class='slider'></span></label>`;
                },
                set: val => {
                    if (val) {
                        document.head.appendChild(css.hideAds)
                        
                    } else {
                        css.hideAds.remove();
                    }
                }
            },

            showExitBtn: {
                name: "Show Exit Button",
                val: false,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("showExitBtn", this.checked)' ${window.utilities.config.showExitBtn.val ? "checked" : ""}><span class='slider'></span></label>`;
                },
                set: val => {
                    const btn = "<div class='button small buttonR' id='menuExit' onmouseenter='playTick()' onclick='window.remote.app.quit()'>Exit</div>";
                    const node = document.getElementById("subLogoButtons");
                    if (node && node.hasChildNodes()) {
                        const menuExit = document.getElementById("menuExit");
                        if (val) {
                            if (!menuExit) node.insertAdjacentHTML("beforeend", btn)
                        } else {
                            if(menuExit) node.removeChild(menuExit)
                        }
                    }
                }
            },

            renderESP: {
                name: "Force Player Nametags",
                val: true,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("renderESP", this.checked)' ${window.utilities.config.renderESP.val ? "checked" : ""}><span class='slider'></span></label>`;
                },
                set: val => {
                }
            },

            renderChams: {
                name: "Player Chams",
                val: 0,
                html: _ => {
                    return `<select style='${selectStyle}' onchange="window.utilities.setConfig('renderChams', this.value)">
                    <option value="0"${window.utilities.config.renderChams.val == 0 ? " selected" : ""}>Off</option>
                    <option value="1"${window.utilities.config.renderChams.val == 1 ? " selected" : ""}>White</option>
                    <option value="2"${window.utilities.config.renderChams.val == 2 ? " selected" : ""}>Blue</option>
                    <option value="3"${window.utilities.config.renderChams.val == 3 ? " selected" : ""}>Teal</option>
                    <option value="4"${window.utilities.config.renderChams.val == 4 ? " selected" : ""}>Purple</option>
                    <option value="5"${window.utilities.config.renderChams.val == 5 ? " selected" : ""}>Green</option>
                    <option value="6"${window.utilities.config.renderChams.val == 6 ? " selected" : ""}>Yellow</option>
                    <option value="7"${window.utilities.config.renderChams.val == 7 ? " selected" : ""}>Red</option>
                    <option value="8"${window.utilities.config.renderChams.val == 8 ? " selected" : ""}>Rainbow</option>
                    </select>`
                }
            },

            renderTimer: {
                name: "Rainbow Loop Interval",
                val: 200,
                html: _ => {
                    return `<span class='sliderVal' id='slid_utilities_renderTimer'>${window.utilities.config.renderTimer.val}</span><div class='slidecontainer'><input type='range' min='0' max='5000' step='100' value='${window.utilities.config.renderTimer.val}' class='sliderM' oninput="window.utilities.setConfig('renderTimer', this.value)"></div>`
                },
                set(t) {
                    window.utilities.config.renderTimer.val = parseInt(t);
                }
            },

            renderWireFrame: {
                name: "Player Wireframe",
                val: false,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("renderWireFrame", this.checked)' ${window.utilities.config.renderWireFrame.val ? "checked" : ""}><span class='slider'></span></label>`;
                }
            },

            wallPenetrate: {
                name: "Aim through Penetratables",
                pre: "<div class='setHed'>Weapon</div><hr>",
                val: false,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("wallPenetrate", this.checked)' ${window.utilities.config.wallPenetrate.val ? "checked" : ""}><span class='slider'></span></label>`;
                },
                set(t) {
                    window.utilities.penetrate(t);
                }
            },

            autoShoot: {
                name: "Auto Shoot Enemies",
                val: false,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("autoShoot", this.checked)' ${window.utilities.config.autoShoot.val ? "checked" : ""}><span class='slider'></span></label>`;
                }
            },

            autoReload: {
                name: "Auto Reload",
                val: false,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("autoReload", this.checked)' ${window.utilities.config.autoReload.val ? "checked" : ""}><span class='slider'></span></label>`;
                }
            },

            fastReload: {
                name: "Fast Reload",
                val: false,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("fastReload", this.checked)' ${window.utilities.config.fastReload.val ? "checked" : ""}><span class='slider'></span></label>`;
                }
            },

            burstShot: {
                name: "Turbo Shoot",
                val: false,
                html: _ => {
                    return `<label class='switch'><input type='checkbox' onclick='window.utilities.setConfig("burstShot", this.checked)' ${window.utilities.config.burstShot.val ? "checked" : ""}><span class='slider'></span></label>`;
                }
            },
        }
    }

    let setupMenuHTML = function() {
        const menu = window.windows[21];
        menu.header = "Config";
        menu.gen = _ => {
            var tmpHTML = "";
            for (const key in window.utilities.config) {
                if (window.utilities.config[key].pre) tmpHTML += window.utilities.config[key].pre;
                tmpHTML += "<div class='settName' id='" + key + "_div' style='display:" + (window.utilities.config[key].hide ? 'none' : 'block') + "'>" + window.utilities.config[key].name +
                " " + window.utilities.config[key].html() + "</div>";
            }
            tmpHTML += `<hr>
            <a onclick='window.utilities.resetConfig()' class='menuLink'>Reset Config</a>
            `
            return tmpHTML;
        };
    }

    let setupConfig = function() {
		for (const key in window.utilities.config) {
			if (!window.utilities.config[key].disabled) {
				let tmpVal = config.get(`config_${key}`, null);
				window.utilities.config[key].val = tmpVal !== null ? tmpVal : window.utilities.config[key].val;
				if (window.utilities.config[key].val == "false") window.utilities.config[key].val = false;
				if (window.utilities.config[key].set) window.utilities.config[key].set(window.utilities.config[key].val, true);
			}
		}
    }

    Object.entries(css).forEach(entry => css[entry[0]] = createElement("style", entry[1]))

    waitFor(window, "windows", ()=> {
        createConfig();
        setupMenuHTML();
        setupConfig();
    });

    // Hook Render
    overlay.render = proxy("apply", overlay.render, (target, that, [Scale, Game, Render, Player]) => {
        if (window.endAHolderL) {
            window.endAHolderL.setAttribute('style', "position: absolute; top:-300px")
        }
        if (Game) {
            // Hook AddBlock
            if(!isDefined(window.utilities.toggle)) { window.utilities.toggle = Game.controls.toggle; }
            if(!isDefined(window.utilities.penetrate)) { window.utilities.penetrate = function(value){
                Game.map.manager.objects.filter(x => {
                    return x && x.penetrable
                }).map((obj, index, array) => {
                    obj.transparent = value ? true : false;
                    obj.opacity = value ? 0.75 : 1.0;
                });
            }}

            Game.map.manager.addBlock = proxy("apply", Game.map.manager.addBlock, (target, that, args) => {
                if (args[7] && args[7].penetrable) {
                    args[7].transparent = window.utilities.config.wallPenetrate.val ? true : false;
                    args[7].opacity = window.utilities.config.wallPenetrate.val ? 0.75 : 1.0;
                }
                return target.apply(that, args);
            });

            if (Player && Player.active) {
                let getIsFriendly = entity => (Player && Player.team ? Player.team : Player.spectating ? 0x1 : 0x0) == entity.team;
                // Hook ProcInputs
                Player[obfu.procInputs] = proxy("apply", Player[obfu.procInputs], (target, me, [inputs, game, recon]) => {
                    const input = {
                        isn: 0,
                        speed: 1,
                        ydir: 2,
                        xdir: 3,
                        move: 4,
                        shoot: 5,
                        scope: 6,
                        jump: 7,
                        crouch: 8,
                        reload: 9,
                        weapon: 10,
                    }

                    if (window.utilities.config.fastReload.val && inputs[input.reload] && me[obfu.reloadTimer]) {
                        let ammoLeft = me[obfu.ammos][me[obfu.weaponIndex]];
                        let capacity = me.weapon.ammo;
                        if (ammoLeft<capacity) me[obfu.reloadTimer] = 10;
                    }

                    if (window.utilities.config.autoReload.val) {
                        let ammoLeft = me[obfu.ammos][me[obfu.weaponIndex]];      
                        if (ammoLeft <= 1) {
                            inputs[input.reload] = 1;
                        }
                    }
                    
                    if (window.utilities.config.burstShot.val) {
                        if (me.weapon[obfu.nAuto] && me[obfu.didShoot]) {
                            inputs[input.shoot] = 0;
                            target.apply(me, [inputs, game, recon, false]);
                        }
                    }
                         
                    if (keyDown("Space")) {
                        game.controls.keys[game.controls.jumpKey] ^= 1;
                        if (me.yVel < -0.04 && me.canSlide) inputs[input.crouch] = 1
                    }

                    if (window.utilities.config.autoShoot.val) {
                        let enemy = game.players.list.filter(x => {
                            return x && x.active && !x[obfu.isYou] && x[obfu.cnBSeen] && !getIsFriendly(x)
                        }).shift();
                        if (enemy) {
                            if (me.weapon[obfu.nAuto] && me[obfu.didShoot]) {
                                inputs[input.shoot] = 0;
                            }
                            else if (!me[obfu.aimVal] && game.controls[obfu.mouseDownR]) {
                                inputs[input.shoot] = 1;
                                inputs[input.scope] = 1;
                            } else if (me[obfu.aimVal]==1) {
                                inputs[input.scope] = 1;
                            }
                        }
                    }

                    target.apply(me, [inputs, game, recon, false]);
                });

                const players = Game.players.list.filter(x => {
                    return x && x.active && x[obfu.objInstances]
                });
                players.forEach(player => {
                    const objects = player[obfu.objInstances];
                    objects.visible = true;
                    objects.traverse((obj) => {
                        //Chams
                        const chamColors = ['Off', 'White', 'Blue', 'Teal', 'Purple', 'Green', 'Yellow', 'Red', 'Rainbow'];
                        let chamVal = window.utilities.config.renderChams.val;
                        let chamColor = chamColors[chamVal];
                        if (obj.type == "Mesh") {
                            obj.material.depthTest = chamVal ? false : true
                            obj.material.opacity = chamVal ? 0.90 : 1;
                            obj.material.transparent = chamVal ? true : false
                            obj.material.fog = chamVal ? false : true
                            obj.material.wireframe = window.utilities.config.renderWireFrame.val ? true : false;
                            if (chamTimer + window.utilities.config.renderTimer.val < Date.now()) {
                                chamTimer = Date.now();
                                obj.material.emissive.r = chamColor == 'Off' || chamColor == 'Teal' || chamColor == 'Green' || chamColor == 'Blue' || chamColor == 'Rainbow' && obj.material.emissive.g ? 0 : 0.55;
                                obj.material.emissive.g = chamColor == 'Off' || chamColor == 'Purple' || chamColor == 'Blue' || chamColor == 'Red' || chamColor == 'Rainbow' && obj.material.emissive.b ? 0 : 0.55;
                                obj.material.emissive.b = chamColor == 'Off' || chamColor == 'Yellow' || chamColor == 'Green' || chamColor == 'Red' || chamColor == 'Rainbow' && obj.material.emissive.r ? 0 : 0.55;
                            }
                        }
                    })
                });
                //const enemies = players.filter(x => { return x.name !== Player.name && !getIsFriendly(x) }).forEach(enemy => {
                //console.dir(enemy);
                //socket.send("fpSp", enemy)
                //})
            }
        }

        //if(endAContainer) document.removeChild(endAContainer)

        return target.apply(that, [Scale, Game, Render, Player]);

    })
/*
    let interval = setInterval(() => {
        if (ws.socketReady()) {
            clearInterval(interval);
            ws[obfu.socket].onmessage = proxy("apply", ws[obfu.socket].onmessage, (target, that, [msg]) => {
                let typedArray = new Uint8Array(msg.data);
                let [id, ...data] = msgpack.decode(typedArray);
                const billArray = ["Krunker Skid. to win every game.", "'This game sux' SkidLamer", "KrunkServ for the win", "Sidney is Ronald McDonald", "Zares Stop stealing my Scripts", "I blame nathan", "Tehchy is a hacker", "Vince rides his brothers success"]
                switch (id) {
                    case "init":
                        data[5].nameTags = true
                        data[8].bill.txt = billArray[Math.floor(Math.random() * billArray.length)];
                        break;
                    default:
                        return target.apply(that, [msg])
                }
                typedArray = msgpack.encode([id, ...data]);

                Object.defineProperty(msg, 'data', {
                    value: typedArray.buffer

                });

                return target.apply(that, [msg])
            });

            //setInterval(()=>{
            //  for (let i = 0; i < 8; ++i) socket.send("fpSp", i)
            //}, 1000);

        }
    }, 100)
*/
}

waitFor(window, "exports", initHooks);
