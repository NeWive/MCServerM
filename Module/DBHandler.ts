import DB, {Database} from "better-sqlite3";
import path from "path";
import {readFile, checkExists, writeFile} from "./FileHandler";
import process from "process";
import globalConfig from "./Config";
import {DBHandlerType} from "./interface";

class DBHandler {
    private _rootDir: string = globalConfig.projectDir;
    public _service!: Database;
    private _dbConfig!: DBHandlerType.DBConfig;
    private _targetDir: string = "";

    constructor() {
        process.on("exit", () => {
            if (this._service) this._service.close();
        });
    }

    private _isEmpty(err: Error): boolean {
        return /no such column/.test(err.message);
    }

    private async _getDBConfig() {
        try {
            const data = (await readFile(path.resolve(this._rootDir, "db.config.json"))).toString();
            try {
                return JSON.parse(data);
            } catch (parseError) {
                console.log(parseError);
                console.log("配置文件解析失败");
            }
        } catch (e) {
            console.log(e);
            throw e;
        }
    }

    private async _readConfig() {
        console.log("读取数据库配置文件");
        try {
            return await this._getDBConfig();
        } catch (e) {
            console.log("读取配置文件失败");
            throw e;
        }
    }

    private _connectDB() {
        console.log("连接数据库...");
        this._service = new DB(this._targetDir, {
            verbose: (message) => {
                console.log(message);
            },
            fileMustExist: true,
        });
    }

    private _createTable(t: DBHandlerType.DBTable) {
        const args = t.columns.map(
            (c) =>
                `${c.cName} ${c.cDataType} ${
                    c.attributes && c.attributes.join(" ")
                }`
        );
        try {
            const info = this._service
                .prepare(`create table ${t.tName} (${args})`)
                .run().changes;
            console.log(`changes: ${info}`);
        } catch (err) {
            console.log((<Error>err).message)
        }
    }

    private __initTable() {
        this._dbConfig.tables.forEach((t) => {
            this._createTable(t);
        });
    }

    private async _initDB(refreshDB: boolean = false) {
        try {
            await checkExists(this._targetDir);
            this._connectDB();
            refreshDB && this.__initTable();
        } catch (e) {
            console.log(e);
            try {
                console.log("数据库文件不存在，将要创建数据库文件");
                await writeFile(this._targetDir, "");
                this._connectDB();
                this.__initTable();
                console.log("数据库初始化完成");
            } catch (e) {
                console.log(e);
                throw e;
            }
        }
    }

    public run(query: string, value: Array<any> = []) {
        return new Promise<any>((res, rej) => {
            try {
                const info = this._service.prepare(query).run(...value);
                res(info);
            } catch (e) {
                console.log("执行run失败");
                rej(e);
            }
        });
    }

    public getSingle(query: string, value: Array<any> = []) {
        return new Promise((res, rej) => {
            try {
                res(this._service.prepare(query).get(...value));
            } catch (e) {
                console.log("执行get失败");
                rej(e);
            }
        });
    }

    public getMulti(query: string, value: Array<any> = []) {
        return new Promise((res, rej) => {
            try {
                res(this._service.prepare(query).all(...value));
            } catch (e) {
                console.log("执行all失败");
                rej(e);
            }
        });
    }

    public insertSingle(
        tableName: string,
        columns: Array<string>,
        values: Array<any>
    ) {
        return new Promise(async (res, rej) => {
            try {
                const vQuery = new Array(values.length).fill("?").join(",");
                const cQuery = columns.length ? `(${columns.join(",")})` : "";
                await this.run(
                    `insert into ${tableName} ${cQuery} values (${vQuery})`,
                    values
                );
                // logger.debug("插入成功");
                res(1);
            } catch (e) {
                console.log("插入失败");
                rej(e);
            }
        });
    }

    public insertMulti(
        tableName: string,
        columns: Array<string>,
        values: Array<Array<any>>
    ) {
        return new Promise(async (res, rej) => {
            try {
                const vQuery = new Array(values[0].length).fill("?").join(",");
                const cQuery = columns.length ? `(${columns.join(",")})` : "";
                const stmt = this._service.prepare(
                    `insert into ${tableName} ${cQuery} values (${vQuery})`
                );
                const handler = this._service.transaction(
                    (q: Array<Array<any>>) => {
                        for (const i of q) stmt.run(...i);
                    }
                );
                handler(values);
                res(1);
            } catch (e) {
                console.log("执行插入失败");
                rej(e);
            }
        });
    }

    public delete(tableName: string, condition: Array<string>) {
        return new Promise(async (res, rej) => {
            try {
                const cQuery = condition.join(" and ");
                const info = await this.run(
                    `delete from ${tableName} where ${cQuery}`
                );
                // logger.info("删除成功");
                res(info);
            } catch (e) {
                console.log("删除失败");
                rej(e);
            }
        });
    }

    public update(
        tableName: string,
        newPair: Array<DBHandlerType.UpdatePairType>,
        condition: Array<string>
    ) {
        return new Promise(async (res, rej) => {
            try {
                const nPQuery = newPair.map((i) => `${i.k}=${i.v}`).join(",");
                const cQuery = condition.join(" and ");
                const info = await this.run(
                    `update ${tableName} set ${nPQuery} where ${cQuery}`
                );
                res(info);
            } catch (e) {
                console.log("更新失败");
                rej(e);
            }
        });
    }

    public select(
        tableName: Array<string>,
        columns: Array<string>,
        condition: Array<string>,
        all = false
    ) {
        return new Promise<any>((res, rej) => {
            try {
                const columnQuery = columns.join(",");
                const conditionQuery = condition.length
                    ? `where ${condition.join(" and ")}`
                    : "";
                const stmt = this._service.prepare(
                    `select ${columnQuery} from ${tableName.join(
                        ","
                    )} ${conditionQuery}`
                );
                if (all) {
                    res(stmt.all());
                } else {
                    res(stmt.get());
                }
            } catch (e) {
                if (this._isEmpty(<Error>e)) {
                    res([]);
                } else {
                    console.log("查找失败");
                    rej(e);
                }
            }
        });
    }

    public init(refreshDB: boolean = false) {
        return new Promise(async (res) => {
            console.log(`初始化数据库，数据库根目录: ${this._rootDir}`);
            this._dbConfig = await this._readConfig();
            this._targetDir = path.resolve(
                this._rootDir,
                globalConfig.dir.DB,
                this._dbConfig.DBTarget
            );
            await this._initDB(refreshDB);
            res(1);
        });
    }

    public getTableName(): Promise<Array<DBHandlerType.TableInfo>> {
        return new Promise(async (res, rej) => {
            try {
                const query =
                    "select name from sqlite_master where type='table' order by name";
                const result = this._service.prepare(query).all();
                res(<Array<DBHandlerType.TableInfo>>result);
            } catch (e) {
                console.log("获取数据库表名失败");
                rej(e);
            }
        });
    }

    public updateTable() {
        return new Promise(async (res, rej) => {
            try {
                const tableInfo = await this.getTableName();
                this._dbConfig = await this._getDBConfig();
                this._dbConfig.tables.forEach((t) => {
                    if (
                        tableInfo.findIndex((temp) => temp.name === t.tName) >
                        -1
                    ) {
                        console.log(`表${t.tName}已存在`);
                    } else {
                        this._createTable(t);
                    }
                });
            } catch (e) {
                rej(e);
            }
        });
    }
}

const dbHandler = new DBHandler();

export default dbHandler;
