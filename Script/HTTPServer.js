const express = require('express');
const bodyParser = require('body-parser');
const Utils = require('./Util');
const colors = require('colors');

class HTTPServer {
    constructor() {
        this.port = 1415;
    }

    _print(msgArr, source) {
        msgArr.forEach(msg => {
            Utils.outputLog([colors.green(`[${source}]: `) + msg]);
        });
    }

    start() {
        this.httpServ = express();
        this.httpServ.use(bodyParser.json());
        this.httpServ.post('/', (req, res) => {
            let data = req.body;
            let result = global.playerCmd.indexOf(data.cmd);
            if (result > -1) {
                global.listener.emit('execute-cmd', { cmd: data.cmd, args: data.args, from: data.from });
                res.header("content-type", "application/json");
                res.send(JSON.stringify({msg: 'success'}));
            } else {
                res.header("content-type", "application/json");
                res.send(JSON.stringify({msg: 'unknown command'}));
            }
        });
        this.httpServ.listen(this.port, () => {
            this._print([`http server is listening on port ${this.port}`], 'HTTPServer');
        });
    }
}

module.exports = HTTPServer;
