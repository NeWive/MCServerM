const Utils = require('./Util');
const Status = require("./Status");
const colors = require("colors");
const childProcess = require("child_process");
const _ = require('lodash');

class Server {
    /**
     * @param rootDir:  absolute path of MC Server
     * @param targetJar
     * @param serverMemoryAllocated
     * @param toggleGui
     */
    constructor(rootDir = '', targetJar = '', serverMemoryAllocated = '', toggleGui = false, outputStd = true) {
        this.rootDir = rootDir;
        this.targetJar = targetJar;
        this.serverMemoryAllocated = serverMemoryAllocated;
        this.toggleGui = toggleGui;
        this.serverProcess = null;
        this.toggleOn = false;
        this.execArgs = ['-Dfile.encoding=utf-8', '-jar', `-Xms${this.serverMemoryAllocated}`, `-Xmx${this.serverMemoryAllocated}`, this.targetJar, !this.toggleGui ? 'nogui' : ''];
        this.outputStd = outputStd;
    }

    /**
     * 检查服务器目录的合法性
     * @returns {Promise<boolean>}
     */
    async check() {
        let result = await Utils.readDirectory(this.rootDir);
        if (result.status === Status.FAILED) {
            this.print([colors.red(result.message)]);
            return false;
        } else if(result.status === Status.OK) {
            if(result.data.indexOf(this.targetJar) > -1) {
                return true;
            } else {
                this.print([colors.red('缺少目标jar文件')]);
                return false;
            }
        }
    }

    executeCmd(cmd, args = []) {
        let arg = '';
        if(args.length > 0) {
            arg = args.join(' ').toString();
        }
        args.length > 0 ? this.serverProcess.stdin.write(`${cmd} ${arg}\n`) : this.serverProcess.stdin.write(`${cmd}\n`);
    }

    print(msgArr) {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green('[MinecraftServer]: ') + msg]);
        });
    }

    logFilter(log) {
        this.outputStd && this.print([`${log}`]);
        let target = _.findIndex(global.rules, (o) => {
            return new RegExp(o.rule).test(log);
        });
        if(target > -1) {
            global.listener.emit(global.rules[target].event);
        }
    }

    start() {
        return new Promise(async (resolve, reject) => {
            let toggleOn = await this.check();
            if (toggleOn) {
                this.outputStd && this.print(['file check successfully', 'MC Server is going to start']);
                this.serverProcess = childProcess.spawn('java',this.execArgs);
                this.outputStd && this.print([`pid: ${this.serverProcess.pid}`])
                this.serverProcess.stdout.on('data', (data) => {
                    if(!this.toggleOn) {
                        if(new RegExp(global.serverStatusRules.DONE).test(data)) {
                            this.toggleOn = true;
                            resolve(true);
                        }
                    }
                    this.logFilter(data);
                });
                this.serverProcess.stderr.on('data', (data) => {
                    this.print([`${data}`]);
                    if(/Program will exit/.test(data)) {
                        global.listener.emit('server-close', 0);
                        resolve(false);
                    }
                });
                this.serverProcess.on('close', (code) => {
                    this.print([colors.green(`MC Server ends, code: ${code}`)]);
                    resolve(false);
                });
            } else {
                this.print([colors.red('file check failed')]);
                resolve(false);
            }
        });
    }
}

module.exports = Server;
