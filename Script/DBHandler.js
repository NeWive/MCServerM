const sqlite = require('sqlite3').verbose();
const fs = require('fs');
const util = require('util');
const child_process = require('child_process');
const Utils = require('./Util');
const colors = require('colors');

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

    _print(msgArr, source) {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green(`[${source}]: `) + msg]);
        });
    }

    show(tableName, limit = 10) {
        let statement = `select * from ${tableName} order by timestamp desc limit ${limit}`;
        return new Promise((res) => {
            this.DB.all(statement, (err, rows) => {
                console.log(rows);
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
            let q = this.__generateQuery(tableName, type);
            console.log(query);
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

// let dbHandler = new DBHandler();
// dbHandler.init().then(async () => {
//     await dbHandler.insert('command_log', {cmd: 'display_frp_info', timestamp: new Date().getTime().toString(), executor: 'NeWive'}, 'cmd')
//     dbHandler.DB.all('select * from command_log', (err, arr) => {
//         console.log(arr);
//     });
// });

module.exports = DBHandler;
