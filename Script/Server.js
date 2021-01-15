const Utils = require('./Util');
const Status = require("./Status");
const colors = require("colors");
const childProcess = require("child_process");
const pattern = require('../server.config');

class Server {
    /**
     * @param rootDir:  absolute path of MC Server
     * @param targetJar
     * @param serverMemoryAllocated
     * @param toggleGui
     */
    constructor(rootDir = '', targetJar = '', serverMemoryAllocated = '', toggleGui = false) {
        this.rootDir = rootDir;
        this.targetJar = targetJar;
        this.serverMemoryAllocated = serverMemoryAllocated;
        this.toggleGui = toggleGui;
        this.serverProcess = null;
        this.toggleOn = false;
        this.execArgs = ['-jar', `-Xms${this.serverMemoryAllocated}`, `-Xmx${this.serverMemoryAllocated}`, this.targetJar, !this.toggleGui ? 'nogui' : ''];
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
        this.serverProcess && this.serverProcess.stdin.write(`${cmd} ${args.join(' ')}`);
    }

    print(msgArr) {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green('[MinecraftServer]: ') + msg]);
        });
    }

    logFilter(log) {
        this.print([`${log}`]);
    }

    start() {
        return new Promise(async (resolve, reject) => {
            let toggleOn = await this.check();
            if (toggleOn) {
                this.print(['file check successfully', 'MC Server is going to start']);
                this.serverProcess = childProcess.spawn('java',this.execArgs);
                this.print([`pid: ${this.serverProcess.pid}`])
                this.serverProcess.stdout.on('data', (data) => {
                    if(!this.toggleOn) {
                        if(pattern.DONE.test(data)) {
                            this.toggleOn = true;
                            resolve(true);
                        }
                    }
                    this.logFilter(data);
                });
                this.serverProcess.stderr.on('data', (data) => {
                    this.print([`${data}`]);
                });
                this.serverProcess.on('close', (code) => {
                    this.print([colors.green(`MC Server ends, code: ${code}`)]);
                });
            } else {
                this.print([colors.red('file check failed')]);
                resolve(false);
            }
        });
    }
}

module.exports = Server;
