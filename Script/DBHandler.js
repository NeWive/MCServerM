const sqlite = require('sqlite3');
const fs = require('fs');
const util = require('util');
const child_process = require('child_process');

class DBHandler {
    async init() {
        if(!fs.existsSync('./mcServer.db')) {
            await (util.promisify(child_process.exec))('touch mcServer.db');
            this.DB = new sqlite.Database('./mcServer.db');
            this.DB.run('create table command_log (cmd TEXT, timestamp TEXT, executor TEXT);');
            this.DB.run('create table gugu_list (projectName TEXT, timestamp TEXT, executor TEXT);');
        } else {
            this.DB = new sqlite.Database('./mcServer.db');
        }
    }

    show(tableName, limit = 10) {
        let statement = `select * from ${tableName} order by timestamp desc limit ${limit}`;
        return new Promise((res) => {
            this.DB.all(statement, (err, rows) => {
                res(rows);
            });
        });
    }

    __generateQuery(tableName, type) {
        switch (type) {
            case 'cmd': {
                return `insert into ${tableName} values ($cmd, $timestamp, $executor)`;
            }
            case 'gugu': {
                return `insert into ${tableName} values ($projectName, $timestamp, $executor)`;
            }
            default:
                return '';
        }
    }

    insert(tableName, query, type) {
        return new Promise((res) => {
            let q = this.__generateQuery(tableName, type)
            console.log(query);
            console.log(type);
            switch (type) {
                case 'cmd': {
                    console.log(q);
                    this.DB.run(q, {$cmd: query.cmd, $timestamp: query.timestamp, $executor: query.executor}, () => {
                        res();
                    });
                } break;
                case 'gugu': {
                    this.DB.run(q, {$projectName: query.projectName, $timestamp: query.timestamp, $executor: query.executor}, () => {
                        res();
                    });
                } break;
                default:
                    return '';
            }
        });
    }
}

module.exports = DBHandler;
