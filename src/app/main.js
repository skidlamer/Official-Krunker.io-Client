require('v8-compile-cache');
require('./log.js')(true);
const { BrowserWindow, app, shell, Menu, ipcMain, session } = require('electron');
const shortcut = require('electron-localshortcut');
const consts = require('./constants.js');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const config = new Store();
const log = require('electron-log');
const fs = require('fs');
const DiscordRPC = require('discord-rpc');
const rpcEnabled = config.get('utilities_discordRPC', true);

let rpc = null;
let gameWindow = null,
	editorWindow = null,
	socialWindow = null,
	viewerWindow = null,
	splashWindow = null,
	promptWindow = null,
	current = 0;

['SIGTERM', 'SIGHUP', 'SIGINT', 'SIGBREAK'].forEach((signal) => {
  process.on(signal, _ => {
	app.quit()
  })
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.focus();
  else if (gameWindow) {
	 if (gameWindow.isMinimized()) gameWindow.restore();
	 gameWindow.focus();
  }
})


const clearCache = () => {
	session.defaultSession.clearCache();
	console.log("Cache cleared");
	app.relaunch();
	app.quit();
};
ipcMain.on('clear-cache', (event) => { clearCache() });

const initSwitches = () => {
	// Usefull info
	// https://forum.manjaro.org/t/howto-google-chrome-tweaks-for-76-0-3809-100-or-newer-20190817/39946
	if (config.get('utilities_unlimitedFrames', true)) {
		if (consts.isAMDCPU) app.commandLine.appendSwitch('enable-zero-copy');
		app.commandLine.appendSwitch('disable-frame-rate-limit');
	}
	if (config.get('utilities_d3d9Mode', false)) {
		app.commandLine.appendSwitch('use-angle', 'd3d9');
		app.commandLine.appendSwitch('enable-webgl2-compute-context');
		app.commandLine.appendSwitch('renderer-process-limit', 100);
		app.commandLine.appendSwitch('max-active-webgl-contexts', 100);
	}
	app.commandLine.appendSwitch('enable-quic');
	app.commandLine.appendSwitch('high-dpi-support',1);
	app.commandLine.appendSwitch('ignore-gpu-blacklist');

};
initSwitches();

const initAppMenu = () => {
	if (process.platform == 'darwin') {
		const template = [{
			label: "Application",
			submenu: [
				{ label: "About Application", selector: "orderFrontStandardAboutPanel:" },
				{ type: "separator" },
				{ label: "Quit", accelerator: "Command+Q", click: _ => app.quit() }
			]
		}, {
			label: "Edit",
			submenu: [
				{ label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
				{ label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
				{ type: "separator" },
				{ label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
				{ label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
				{ label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
				{ label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
			]
		}];
		Menu.setApplicationMenu(Menu.buildFromTemplate(template));
	}
};
initAppMenu();

const initDiscordRPC = () => {
	DiscordRPC.register(consts.DISCORD_ID);
	rpc = new DiscordRPC.Client({ transport: 'ipc' });
	rpc.isConnected = false;

	rpc.on('error', console.error);

	rpc.login({ 'clientId': consts.DISCORD_ID })
		.then(() => {
			rpc.isConnected = true;
			rpc.setActivityWin = function(win, obj) {
				if (current == win) rpc.setActivity(obj).catch(console.warn);
			};
			rpc.on('RPC_MESSAGE_RECEIVED', (event) => {
				//console.log('RPC_MESSAGE_RECEIVED', event);
				if (!gameWindow) return;
				gameWindow.webContents.send('log', ['RPC_MESSAGE_RECEIVED', event]);
			});
			rpc.subscribe('ACTIVITY_JOIN', ({ secret }) => {
				if (!gameWindow) return;
				let parse = secret.split('|');
				if (parse[2].isCode()) {
					gameWindow.loadURL('https://' + parse[0] + '/?game=' + parse[2]);
				}
			});
			rpc.subscribe('ACTIVITY_INVITE', (event) => {
				if (!gameWindow) return;
				gameWindow.webContents.send('ACTIVITY_INVITE', event);
			});

			rpc.subscribe('ACTIVITY_JOIN_REQUEST', (user) => {
				if (!gameWindow) return;
				gameWindow.webContents.send('ACTIVITY_JOIN_REQUEST', user);
			});
		})
		.catch(console.error);
};
if (rpcEnabled) initDiscordRPC();

const initGameWindow = () => {
	gameWindow = new BrowserWindow({
		width: 1600,
		height: 900,
		show: false,
		darkTheme: true,
		center: true,
		webPreferences: {
			nodeIntegration: false,
			webSecurity: false,
			preload: consts.joinPath(__dirname, 'preload.js')
		}
	});
	gameWindow.setMenu(null);
	gameWindow.rpc = rpcEnabled ? rpc : false;

	const SWAP_FOLDER = consts.joinPath(app.getPath('documents'), '/KrunkerResourceSwapper');

	try {fs.mkdir(SWAP_FOLDER, { recursive: true }, e => {});}catch(e){};
	let swap = { filter: { urls: [] }, files: {} };
	const allFilesSync = (dir, fileList = []) => {
		fs.readdirSync(dir).forEach(file => {
			const filePath = consts.joinPath(dir, file);
			let useAssets = !(/KrunkerResourceSwapper\\(css|img|libs|sound)/.test(dir));
			if (fs.statSync(filePath).isDirectory()) {
				if (!(/\\(docs)$/.test(filePath)))
					allFilesSync(filePath);
			} else {
				if (!(/\.(html|js)/g.test(file))) {
					let krunk = '*://'+(useAssets ? 'assets.':'')+'krunker.io' + filePath.replace(SWAP_FOLDER, '').replace(/\\/g, '/') + '*';
					swap.filter.urls.push(krunk);
					swap.files[krunk.replace(/\*/g, '')] = url.format({
						pathname: filePath,
						protocol: 'file:',
						slashes: true
					});
				}
			}
		});
	};
	allFilesSync(SWAP_FOLDER);
	if (swap.filter.urls.length) {
		gameWindow.webContents.session.webRequest.onBeforeRequest(swap.filter, (details, callback) => {
			callback({ cancel: false, redirectURL: swap.files[details.url.replace(/https|http|(\?.*)|(#.*)/gi, '')] || details.url });
		});
	}

	gameWindow.loadURL('https://krunker.io');

	let nav = (e, url) => {
		e.preventDefault();
		if (url.isKrunker()) {
			if (url.isEditor()) {
				if (!editorWindow) initEditorWindow();
				else editorWindow.loadURL(url);
			} else if (url.isSocial()) {
				if (!socialWindow) initSocialWindow(url);
				else socialWindow.loadURL(url);
			} else if (url.isViewer()) {
				if (!viewerWindow) initViewerWindow(url);
				else viewerWindow.loadURL(url);
			} else gameWindow.loadURL(url);
		} else shell.openExternal(url);
	};

	gameWindow.webContents.on('new-window', nav);
	gameWindow.webContents.on('will-navigate', nav);

	const showGameWindow = () => {
		if (consts.DEBUG) gameWindow.webContents.openDevTools({ mode: 'undocked' });
		if (config.get('fullscreen', false)) gameWindow.setFullScreen(true);
		splashWindow.destroy();
		gameWindow.show();
	}

	setTimeout(() => {
		if (!gameWindow.isVisible()) showGameWindow();
	}, 2e4)

	ipcMain.on('check-game-version', (event, version) => {
		splashWindow.webContents.send('check-game-version');
		setTimeout(() => {
			if (config.get('game_version') != version) {
				config.set('game_version', version);
				gameWindow.destroy();
				console.log("New game version found");
				splashWindow.webContents.send('new-game-version', {version});
				setTimeout(() => clearCache(), 2000);
			} else {
				splashWindow.webContents.send('same-game-version');
				setTimeout(() => showGameWindow(), 1000);
			}
		}, 1000);
	})

	gameWindow.on('focus', () => {
		current = 0;
	});

	gameWindow.once('closed', () => {
		gameWindow = null;
	});

	initShortcuts();
};

const initEditorWindow = () => {
	let size = gameWindow.getSize()
	editorWindow = new BrowserWindow({
		width: size[0] * consts.windowResize.editor,
		height: size[1] * consts.windowResize.editor,
		show: false,
		darkTheme: true,
		center: true,
		parent: gameWindow,
		webPreferences: {
			nodeIntegration: false,
			webSecurity: false,
			preload: consts.joinPath(__dirname, 'preload.js')
		}
	});

	editorWindow.setMenu(null);
	editorWindow.rpc = rpcEnabled ? rpc : false;

	editorWindow.loadURL('https://krunker.io/editor.html');

	let nav = (e, url) => {
		e.preventDefault();
		if (url.isKrunker() && !url.isEditor()) {
			gameWindow.loadURL(url);
		}
	}

	editorWindow.webContents.on('new-window', nav);
	editorWindow.webContents.on('will-navigate', nav);

	editorWindow.once('ready-to-show', () => {
		if (consts.DEBUG) editorWindow.webContents.openDevTools({ mode: 'undocked' });
		editorWindow.show();
	});

	editorWindow.on('focus', () => {
		current = 1;
	});

	editorWindow.once('closed', () => {
		editorWindow = null;
	});
};

const initSocialWindow = (url) => {
	let size = gameWindow.getSize()
	socialWindow = new BrowserWindow({
		width: size[0] * consts.windowResize.social,
		height: size[1] * consts.windowResize.social,
		show: false,
		darkTheme: true,
		center: true,
		parent: gameWindow,
		webPreferences: {
			nodeIntegration: false,
			webSecurity: false,
			preload: consts.joinPath(__dirname, 'preload.js')
		}
	});

	socialWindow.setMenu(null);
	socialWindow.rpc = rpcEnabled ? rpc : false;

	socialWindow.loadURL(url);

	let nav = (e, url) => {
		e.preventDefault();
		if (url.isKrunker()) {
			if (url.isEditor()) {
				if (!editorWindow) initEditorWindow();
				else editorWindow.loadURL(url);
			} else if (url.isSocial()) {
				socialWindow.loadURL(url);
			} else if (url.isViewer()) {
				if (!viewerWindow) initViewerWindow(url);
				else viewerWindow.loadURL(url);
			} else gameWindow.loadURL(url);
		}
	}

	socialWindow.webContents.on('new-window', nav);
	socialWindow.webContents.on('will-navigate', nav);

	socialWindow.once('ready-to-show', () => {
		if (consts.DEBUG) socialWindow.webContents.openDevTools({ mode: 'undocked' });
		socialWindow.show();
	});

	socialWindow.on('focus', () => {
		current = 2;
	});

	socialWindow.once('closed', () => {
		socialWindow = null;
	});
};

const initViewerWindow = (url) => {
	let size = gameWindow.getSize()
	viewerWindow = new BrowserWindow({
		width: size[0] * consts.windowResize.viewer,
		height: size[1] * consts.windowResize.viewer,
		show: false,
		darkTheme: true,
		center: true,
		parent: gameWindow,
		webPreferences: {
			nodeIntegration: false,
			webSecurity: false,
			preload: consts.joinPath(__dirname, 'preload.js')
		}
	});

	viewerWindow.setMenu(null);
	viewerWindow.rpc = rpcEnabled ? rpc : false;

	viewerWindow.loadURL(url);

	let nav = (e, url) => {
		e.preventDefault();
		if (url.isKrunker()) {
			if (url.isEditor()) {
				if (!editorWindow) initEditorWindow();
				else editorWindow.loadURL(url);
			} else if (url.isSocial()) {
				if (!socialWindow) initSocialWindow(url);
				else socialWindow.loadURL(url);
			} else if (url.isViewer()) {
				viewerWindow.loadURL(url);
			} else gameWindow.loadURL(url);
		}
	}

	viewerWindow.webContents.on('new-window', nav);
	viewerWindow.webContents.on('will-navigate', nav);

	viewerWindow.once('ready-to-show', () => {
		if (consts.DEBUG) viewerWindow.webContents.openDevTools({ mode: 'undocked' });
		viewerWindow.show();
	});

	viewerWindow.on('focus', () => {
		current = 3;
	});

	viewerWindow.once('closed', () => {
		viewerWindow = null;
	});
};

const initSplashWindow = () => {
	splashWindow = new BrowserWindow({
		width: 650,
		height: 370,
		transparent: true,
		frame: false,
		skipTaskbar: true,
		center: true,
		resizable: false,
		webPreferences: {
			nodeIntegration: true
		}
	});
	splashWindow.setMenu(null);
	//if (consts.DEBUG) splashWindow.webContents.openDevTools({ mode: 'undocked' });
	//splashWindow.loadFile(consts.joinPath(__dirname, 'splash.html'));
	splashWindow.loadURL(url.format({
		pathname: consts.joinPath(__dirname, 'splash.html'),
		protocol: 'file:',
		slashes: true
	}));
	splashWindow.webContents.once('did-finish-load', () => initUpdater());
};

const initPromptWindow = () => {
	let response;

	ipcMain.on('prompt', (event, opt) => {
		response = null;

		promptWindow = new BrowserWindow({
			width: 300,
			height: 157,
			show: false,
			frame: false,
			skipTaskbar: true,
			alwaysOnTop: true,
			resizable: false,
			movable: false,
			transparent: true,
			darkTheme: true,
			center: true,
			webPreferences: {
				nodeIntegration: true
			}
		});

		promptWindow.loadURL(url.format({
			pathname: consts.joinPath(__dirname, 'prompt.html'),
			protocol: 'file:',
			slashes: true
		}));
		if (consts.DEBUG) promptWindow.webContents.openDevTools({ mode: 'undocked' });

		promptWindow.webContents.on('did-finish-load', () => {
			promptWindow.show();
			promptWindow.webContents.send('text', JSON.stringify(opt));
		});

		promptWindow.on('closed', () => {
			event.returnValue = response;
			promptWindow = null;
		})

	});
	ipcMain.on('prompt-response', (event, args) => {
		response = args === '' ? null : args;
	});
};
initPromptWindow();

const initUpdater = () => {
	if (consts.DEBUG || process.platform == 'darwin') return initGameWindow();
	let updateCheckFallback = null;
	autoUpdater.on('checking-for-update', (info) => {
		splashWindow.webContents.send('checking-for-update');
		updateCheckFallback = setTimeout(() => {
			splashWindow.webContents.send('update-not-available', info);
			initGameWindow()
		}, 15e3);
	});

	autoUpdater.on('error', (err) => {
		if (updateCheckFallback) clearTimeout(updateCheckFallback);
		splashWindow.webContents.send('update-error', err);
		initGameWindow()
		//app.quit();
	});

	autoUpdater.on('download-progress', (info) => {
		if (updateCheckFallback) clearTimeout(updateCheckFallback);
		splashWindow.webContents.send('download-progress', info);
	});

	autoUpdater.on('update-available', (info) => {
		if (updateCheckFallback) clearTimeout(updateCheckFallback);
		splashWindow.webContents.send('update-available', info);
	});

	autoUpdater.on('update-not-available', (info) => {
		if (updateCheckFallback) clearTimeout(updateCheckFallback);
		splashWindow.webContents.send('update-not-available', info);
		initGameWindow()
	});

	autoUpdater.on('update-downloaded', (info) => {
		if (updateCheckFallback) clearTimeout(updateCheckFallback);
		splashWindow.webContents.send('update-downloaded', info);
		setTimeout(() => autoUpdater.quitAndInstall(true, true), 2500);
	});
	autoUpdater.channel = "latest";
	autoUpdater.allowDowngrade = false;
	// autoUpdater.logger = null;
	autoUpdater.checkForUpdates();
}

const initShortcuts = () => {
	const KEY_BINDS = {
		escape: {
			key: 'Esc',
			press: _ => gameWindow.webContents.send('esc')
		},
		quit: {
			key: 'Alt+F4',
			press: _ => app.quit()
		},
		refresh: {
			key: 'F5',
			press: _ => gameWindow.webContents.reloadIgnoringCache()
		},
		fullscreen: {
			key: 'F11',
			press: _ => {
				let full = !gameWindow.isFullScreen();
				gameWindow.setFullScreen(full);
				config.set("fullscreen", full);
			}
		},
		clearConfig: {
			key: 'Ctrl+F1',
			press: _ => {
				config.store = {};
				app.relaunch();
				app.quit();
			}
		},
		openConfig: {
			key: 'Shift+F1',
			press: _ => config.openInEditor(),
		}
	}
	Object.keys(KEY_BINDS).forEach(k => {
		shortcut.register(gameWindow, KEY_BINDS[k].key, KEY_BINDS[k].press);
	});
};

app.once('ready', () => initSplashWindow());
app.on('activate', () => {
	if (gameWindow === null && (splashWindow === null || splashWindow.isDestroyed())) initSplashWindow();
});

app.once('before-quit', () => {
	if (rpcEnabled) rpc.destroy().catch(console.error);
	shortcut.unregisterAll();
	gameWindow.close();
});

// app.on('login', async (event, webContents, request, authInfo, callback) => {
//  	event.preventDefault();
// 	gameWindow.webContents.send('check-auth');
// 	let details = await new Promise(resolve => {
// 		ipcMain.on('auth-response', (event, data) => {
// 			console.log("callback")
// 			resolve(data);
// 		});
// 	})
// 	if (details) {
// 		callback(details.user, details.pass);
// 	} else {
// 		callback()
// 	}
// });

app.on('window-all-closed', () => app.quit());
app.on('quit', () => app.quit());
