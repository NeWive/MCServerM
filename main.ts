import Initializer from "./Module/Initializer";
import {CmdHandlerType} from "./Module/interface";
import inquirer, {Question} from "inquirer";
import downloader from "./Module/Downloader";
import DBManager from "./Module/DBManager";
import ServerManager from "./Module/ServerManager";

let server!: ServerManager;

interface HandlerType {
    [i: string]: (args: string) => Promise<Number>;
}

const entryQuestion = [
    {
        type: "list",
        name: "entry",
        message: "请选择操作: ",
        choices: [
            {
                value: CmdHandlerType.choiceName.ADD_A_SERVER,
                name: "添加并下载一个服务端"
            },
            {
                name: "选择并开启一个服务器",
                value: CmdHandlerType.choiceName.RUN_A_SERVER
            },
            {
                name: "退出",
                value: CmdHandlerType.choiceName.EXIT
            }
        ]
    }
];

const addServerQuestion = [
    {
        type: "input",
        name: "serverName",
        message: "给你的新服务器取一个名字吧: "
    },
    {
        type: "list",
        name: "serverType",
        message: "选择服务器类型: ",
        choices: [
            {
                value: CmdHandlerType.choiceName.FABRIC,
                name: "Fabric"
            },
            {
                name: "原版",
                value: CmdHandlerType.choiceName.VANILLA
            }
        ]
    }
];

const addServerHandler: HandlerType = {
    "FABRIC": async (serverName: string) => {
        try {
            await downloader.requestFabricInfo();
        } catch (e) {
            console.log(e);
            return 1;
        }
        const versionQuestion = [
            {
                type: "list",
                name: "game",
                message: "请选择一个游戏版本: ",
                choices: downloader._fabricGameList
            },
            {
                type: "list",
                name: "installer",
                message: "请选择一个Fabric Installer版本: ",
                choices: downloader._fabricInstallerList
            },
            {
                type: "list",
                name: "loader",
                message: "请选择一个Fabric Loader版本: ",
                choices: downloader._fabricLoaderList
            }
        ];
        const baseAns = await inquirer.prompt(versionQuestion);
        // 处理并寻找版本号对应的Fabric API版本
        let gameVer = baseAns.game;
        let apiVersions: Array<string>;
        let temp = [];
        let flag = false;
        if(downloader._fabricAPIVersions.has(gameVer)) {
            apiVersions = <Array<string>>downloader._fabricAPIVersions.get(gameVer);
        } else {
            temp = gameVer.split(".");
            temp.splice(temp.length - 1, 1);
            temp = temp.join(".");
            apiVersions = <Array<string>>downloader._fabricAPIVersions.get(<string>temp);
            flag = true;
        }
        const apiQuestion = [
            {
                type: "list",
                name: "api",
                message: "请选择一个Fabric API版本",
                choices: apiVersions
            }
        ];
        let apiAns = (await inquirer.prompt(apiQuestion)).api;
        if (flag) {
            apiAns += `+${temp}`;
        } else {
            apiAns += `+${gameVer}`;
        }
        await downloader.getFabricServer(serverName, baseAns.game, baseAns.loader, baseAns.installer, apiAns);
        return -1;
    },
    "VANILLA": async (serverName) => {
        try {
            await downloader.requestPureInfo();
            const ques = [
                {
                    type: "list",
                    message: "请选择一个版本: ",
                    choices: downloader._pureServerList,
                    name: "game"
                }
            ];
            const ans = (await inquirer.prompt(ques)).game;
            await downloader.getPureServer(ans, serverName);
            return -1;
        } catch (e) {
            console.log(e);
            return 1;
        }
    }
}

async function addServer() {
    try {
        const answer = await inquirer.prompt(addServerQuestion);
        console.log(answer);
        if (answer.serverName) {
            const checkRes = await DBManager.selectSingleServerInfo(answer.serverName);
            if (checkRes.length > 0) {
                console.log("服务器名已存在");
                return 1;
            }
            return await addServerHandler[<string>answer.serverType](answer.serverName);
        } else {
            console.log("不合法的服务器名");
            return -1;
        }
    } catch (e) {
        console.log(e);
        return 1;
    }
}

async function runServer() {
    try {
        const list = (await DBManager.selectAllServerInfo()).map(i => {
            return {
                name: i.server_name,
                value: i
            }
        });
        if (list.length) {
            const ans = (await inquirer.prompt({
                type: "list",
                name: "serverN",
                message: "请选择一个服务器",
                choices: list
            })).serverN;
            server = new ServerManager(ans.server_name, ans.dir);
            await server.run();
            return 1;
        } else {
            console.log("您大概还没有安装MC服务端");
            return -1;
        }
    } catch (e) {
        console.log(e);
        return 1;
    }
}

function* questionGenerator() {
    let answer = <string>(yield entryQuestion);
    while(1) {
        let target;
        switch (answer) {
            case CmdHandlerType.choiceName.RUN_A_SERVER: {
                target = runServer;
            } break;
            case CmdHandlerType.choiceName.ADD_A_SERVER: {
                target = addServer;
            } break;
            default:
                target = entryQuestion;break;
        }
        if (answer === CmdHandlerType.choiceName.EXIT) {
            break;
        } else {
            answer = yield target;
        }
    }
    yield 0;
}

async function main() {
    await Initializer.init();
    process.on("error", (e) => {
        console.log(e);
    });
}

main().then(async () => {
    try {
        let status = -1;
        let ans = "";
        const gen = questionGenerator();
        while (1) {
            if (status < 0) {
                const question = <Array<Question>>gen.next("entry").value;
                ans = (await inquirer.prompt(question)).entry;
                if (ans === CmdHandlerType.choiceName.EXIT) {
                    status = 1;
                } else {
                    status = 0;
                }
            } else if (!status) {
                const operation = <Function>gen.next(ans).value;
                status = await operation();
            } else if (status){
                break;
            }
        }
    } catch (e) {
        console.log(e);
    }
}, (err) => {
    console.log(err);
});
