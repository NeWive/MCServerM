import {spawn, ChildProcessWithoutNullStreams} from "child_process";
import {eventNameEnum, pattern, serverStatusPattern} from "./pattern";
import {PatternType} from "./interface";
import globalConfig from "./Config";
import EventEmitter from "events";
import lodash from "lodash";

class Server extends EventEmitter{
    private _cmd: string = "java";
    private readonly _target: string;
    private readonly _args: Array<string>;
    private readonly _serverSavePath: string;
    public _server!: ChildProcessWithoutNullStreams;
    private _isServerStart: boolean = false;


    constructor(t: string, serverSavePath: string) {
        super();
        this._target = t;
        this._args = ["-jar", `-Xms${globalConfig.serverConfig.xms}`, `-Xmx${globalConfig.serverConfig.xmx}`, this._target, !<boolean>(globalConfig.serverConfig.toggleGUI) ? "nogui" : ""];
        this._serverSavePath = serverSavePath;
    }

    serverLogFilter(log: string) {
        let target = lodash.findIndex(serverStatusPattern, (s) => s.rule.test(log));
        target > -1 && this.emit(serverStatusPattern[target].event);
    }

    executeCommand(cmd: string, args: Array<string> = []) {
        const arg = args.length > 0 ? (" " + args.join(" ").toString()) : "";
        const cmdInput = `${cmd}${arg}\n`;
        console.log(cmdInput);
        this._server.stdin.write(cmdInput);
    }

    start() {
        return new Promise((res) => {
            this._server = spawn(
                this._cmd,
                this._args,
                {
                    cwd: this._serverSavePath
                }
            );
            console.log(`pid: ${this._server.pid}`);
            this._server.stdout.on("data", (d) => {
                const data = d.toString();
                console.log(data);
                if (!this._isServerStart && pattern[PatternType.PatternAttr.SERVER_START_DONE].test(data)) {
                    this._isServerStart = true;
                    console.log("启动成功");
                    res(true);
                }
                this.serverLogFilter(data);
            });
            this._server.stderr.on("data", (d) => {
                const data = d.toString();
                console.log(data);
                this.serverLogFilter(data);
            })
            this._server.on("close", (code) => {
                console.log(`服务端关闭，返回码: ${code}`);
                this.emit(eventNameEnum.SERVER_CLOSE);
            });
        });
    }

    testRun() {
        return new Promise((res, rej) => {
            try {
                this._server = spawn(
                    this._cmd,
                    this._args,
                    {
                        cwd: this._serverSavePath
                    }
                );
                let isSuccessful = false;
                this._server.stdout.on("data", (message) => {
                    let log = message.toString();
                    console.log(log);
                    if (!isSuccessful && pattern[PatternType.PatternAttr.TEST_RUN_SUCCESS].test(log)) {
                        isSuccessful = true;
                        res(isSuccessful);
                    }
                });
                this._server.stderr.on("data", (message) => {
                    console.log(message);
                    rej(message);
                });
                this._server.on("close", (message) => {
                    console.log(`MinecraftServer exited, code: ${message}`);
                });
            } catch (e) {
                rej(e);
            }
        });
    }
}

export default Server;
