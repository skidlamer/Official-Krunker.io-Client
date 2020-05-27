const format = require('format');
const chalk = require('chalk');
const eLog = require('electron-log');

class Log {
	constructor(isMain = false) {
		if(isMain) {
			console.log = this.info;
			console.info = this.info;
			console.warn = this.warn;
			console.error = this.error;
			console.debug = this.debug;
			eLog.catchErrors({showDialog:false, onError:(error)=>console.trace(error)});
			process.on('uncaughtException', (error) => {
				if (error) {
					console.trace(error);
					this.error(error);
				}
			});
			this.info("-------------------- Client Start --------------------");
		}
	}

	info(fmt, ...args) {
		eLog.info(chalk.green(format(fmt, ...args)))
	}

	debug(fmt, ...args) {
		const color = chalk.keyword('blue');
		eLog.info(format(fmt, color("[DEBUG]   ").concat(...args)))
	}

	warn(fmt, ...args) {
		const color = chalk.keyword('orange');
		eLog.info(format(fmt, color("[WARNING]   ").concat(...args)))
	}

	error(fmt, ...args) {
		const color = chalk.bold.red;
		eLog.info(format(fmt, color("[ERROR]   ").concat(...args)))
	}
}

module.exports = Log;