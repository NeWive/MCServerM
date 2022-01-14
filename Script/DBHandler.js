const sqlite = require('sqlite3').verbose();
const path = require('path');
const colors = require('colors');

class DBHandler {
    constructor() {
        this.dbPath = path.resolve(global.projectDir, './DB/MCM.db')
        this.tableEnum = {
            GU_LIST: 'gu_list',
            CMD_LOG: 'cmd_log'
        }
        console.log(colors.red(this.dbPath));
    }

    async connectDB() {
        await new Promise(res => {
            this.db = new sqlite.Database(this.dbPath, (err) => {
                err && console.log(err);
                res();
            });
        });
        console.log(colors.red('nmd open db successfully'));
    }

    async initDB() {
        return await new Promise((res) => {
            this.db.serialize(() => {
                let initCmdLogSql = `CREATE TABLE cmd_log (cmd CHAR NOT NULL, executor CHAR, time BIGINT);`
                let initGuListSql = `CREATE TABLE gu_list (gu_name CHAR NOT NULL, time BIGINT, satellite_launcher CHAR, status INTEGER, index_number INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE);`
                this.db.run(initCmdLogSql, () => {
                    this.db.run(initGuListSql, () => {
                        res(1);
                    });
                });
            });
        });
    }

    async handleDBWithNoReturn(sql, options = []) {
        return await new Promise((res) => {
            this.db.serialize(() => {
                this.db.run(sql, options, (err) => {
                    err && console.log(err);
                    res(err ? err : {
                        code: 1
                    });
                });
            })
        });
    }

    async select(sql, options = []) {
        return await new Promise(res => {
            this.db.serialize(() => {
                this.db.all(sql, options, (err, rows) => {
                    err && console.log(err);
                    res(err ? err : rows);
                });
            });
        });
    }

    async addGuList({satellite_launcher, time, gu_name}) {
        let stmt = `insert into ${this.tableEnum.GU_LIST} (gu_name, time, satellite_launcher, status) values ('${gu_name}', ${time}, '${satellite_launcher}', 0)`;
        await this.handleDBWithNoReturn(stmt);
    }

    async selectGuList(options = null) {
        if(!options) {
            let stmt = `select * from ${this.tableEnum.GU_LIST} order by index_number desc limit 0, 20`;
            return await this.select(stmt);
        } else {
            let stmt = `select * from ${this.tableEnum.GU_LIST} where index_number = ${options.index_number}`;
            return await this.select(stmt);
        }
    }

    async completeSatellite({index}) {
        let stmt = `update ${this.tableEnum.GU_LIST} set status = 1 where index_number = ?`;
        await this.handleDBWithNoReturn(stmt, [index]);
    }

    async addCmdLog({cmd, executor, time}) {
        let stmt = `insert into ${this.tableEnum.CMD_LOG} values (?, ?, ?)`;
        await this.handleDBWithNoReturn(stmt, [cmd, executor, time]);
    }

    async selectCmdLog() {
        let stmt = `select * from ${this.tableEnum.CMD_LOG} order by time desc`;
        return await this.select(stmt);
    }

    async close() {
        await new Promise(res => {
            this.db.close(() => {
                console.log(colors.red('db connection closed'));
            });
        })
    }
}

module.exports = DBHandler;
