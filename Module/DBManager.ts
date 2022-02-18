import DBHandler from "./DBHandler";
import {DBManagerType} from "./interface";

class DBManager {
    static async addGuList(satelliteLauncher: string, time: number, guName: string) {
        try {
            await DBHandler.insertSingle(
                "gu_list",
                ["gu_name", "time", "satellite_launcher", "status"],
                [guName, time, satelliteLauncher, 0]);
        } catch (e) {
            console.log("插入失败");
            throw e;
        }
    }

    static async selectGuList(indexNumber: number = -1) {
        try {
            return await DBHandler.select(
                ["gu_list"],
                ["*"],
                indexNumber < 0 ? [] : [`index_number=${indexNumber}`],
                true
            );
        } catch (e) {
            console.log("查找失败");
            throw e;
        }
    }

    static async completeSatellite(index: number) {
        try {
            await DBHandler.update(
                "gu_list",
                [
                    {
                        k: "status",
                        v: 1
                    }
                ],
                [
                    `index_number=${index}`
                ]
            )
        } catch (e) {
            console.log("更新表失败");
            throw e;
        }
    }

    static async addCmdLog(cmd: string, executor: string, time: number) {
        try {
            await DBHandler.insertSingle(
                "cmd_log",
                [
                    "cmd", "executor", "time"
                ],
                [
                    cmd, executor, time
                ]
            )
        } catch (e) {
            console.log("记录命令日志失败");
            throw e;
        }
    }

    static async addServerInfo(serverName: string, target: string = "server.jar") {
        try {
            await DBHandler.insertSingle(
                "server_list",
                [
                    "server_name", "dir", "target"
                ],
                [
                    serverName, serverName, target
                ]
            )
        } catch (e) {
            console.log("记录服务器信息失败");
            throw e;
        }
    }

    static async selectCmdLog() {
        try {
            return await DBHandler.select(
                ["cmd_log"],
                ["*"],
                [],
                true
            );
        } catch (e) {
            console.log("查询日志失败");
            throw e;
        }
    }

    static async selectSingleServerInfo(serverN: string): Promise<Array<DBManagerType.ServerInfo>> {
        try {
            return await DBHandler.select(
                ["server_list"],
                ["*"],
                [`server_name=${serverN}`]
            );
        } catch (e) {
            console.log("查询服务器信息失败");
            throw e;
        }
    }

    static async selectAllServerInfo(): Promise<Array<DBManagerType.ServerInfo>> {
        try {
            return await DBHandler.select(
                ["server_list"],
                ["*"],
                [],
                true
            );
        } catch (e) {
            console.log("查询服务器信息失败");
            throw e;
        }
    }
}

export default DBManager;
